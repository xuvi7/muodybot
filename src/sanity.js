import { config } from './config.js';

const sanityCache = new Map();

export const botSettingsDocumentId = 'muodyBotSettings';

export async function getSanityTextReplies() {
  return fetchSanityList(
    'text replies',
    '*[_type == "muodyTextReply" && enabled != false && defined(text)]{text, weight}',
  );
}

export async function getSanityMuodies() {
  return fetchSanityList(
    'muodies',
    '*[_type == "muody" && enabled != false && (defined(image.asset->url) || defined(file.asset->url))]{title, altText, weight, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType), "originalFilename": file.asset->originalFilename}',
  );
}

export async function getSanityVoiceNoises() {
  return fetchSanityList(
    'voice noises',
    '*[_type == "muodyVoiceNoise" && enabled != false && defined(file.asset->url)]{title, weight, "url": file.asset->url, "originalFilename": file.asset->originalFilename}',
  );
}

export async function getSanityMessageTriggers() {
  return fetchSanityList(
    'message triggers',
    '*[_type == "muodyMessageTrigger" && enabled != false && defined(patterns[0])]{title, patterns, matchType, responseActions[]{type, text, title, altText, weight, gifPrompt, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType), "originalFilename": file.asset->originalFilename}, responseType, responseTexts, responseMedia[]{title, altText, weight, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType), "originalFilename": file.asset->originalFilename}, gifPrompt, priority, weight}',
  );
}

export async function getSanityBotSettings() {
  return fetchSanityValue(
    'bot settings',
    `*[_id == "${botSettingsDocumentId}"][0]{defaultRandomReplyChance, randomReplies, gifResultLimit, gifContentFilter, timeZone, voiceJoinStartHour, voiceJoinEndHour, voiceStayMinMinutes, voiceStayMaxMinutes, voicePauseMinSeconds, voicePauseMaxSeconds, voiceNoiseDir, voiceRandomJoinEnabled, voiceMaxVisitsPerNight, voiceTestDelaySeconds, robloxSuggestionCount, channelSettings[]{_key, channelId, channelName, randomRepliesEnabled, messageTriggersEnabled, randomReplyChance}}`,
    null,
  );
}

export async function updateSanityBotSettings(fields) {
  if (!config.sanityProjectId || !config.sanityDataset) {
    throw new Error('Sanity is not configured. Set SANITY_PROJECT_ID and SANITY_DATASET.');
  }

  if (!config.sanityToken) {
    throw new Error('SANITY_TOKEN is required to write persistent settings.');
  }

  const response = await fetch(getSanityMutateEndpoint(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.sanityToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mutations: [
        {
          createIfNotExists: {
            _id: botSettingsDocumentId,
            _type: 'muodyBotSettings',
            title: 'Muody Bot Settings',
          },
        },
        {
          patch: {
            id: botSettingsDocumentId,
            set: fields,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Sanity settings write failed with HTTP ${response.status}${body ? `: ${body}` : ''}`,
    );
  }

  sanityCache.clear();
}

export async function createSanityUsageEvent(event) {
  if (!config.sanityProjectId || !config.sanityDataset || !config.sanityToken) {
    return false;
  }

  const response = await fetch(getSanityMutateEndpoint(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.sanityToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mutations: [
        {
          create: {
            _type: 'muodyUsageEvent',
            createdAt: new Date().toISOString(),
            ...removeUndefinedValues(event),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Sanity usage event write failed with HTTP ${response.status}`);
  }

  return true;
}

export async function getSanityUsageEvents(days = 30, limit = 500) {
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const safeLimit = Math.min(1000, Math.max(1, Math.round(limit)));

  return fetchSanityValue(
    'usage events',
    `*[_type == "muodyUsageEvent" && createdAt >= "${since}"] | order(createdAt desc)[0...${safeLimit}]{eventType, createdAt, guildId, guildName, channelId, channelName, userId, username, commandName, subcommandName, triggerTitle, responseType, noiseName, source}`,
    [],
  );
}

async function fetchSanityList(label, query) {
  return fetchSanityValue(label, query, []);
}

async function fetchSanityValue(label, query, fallback) {
  if (!config.sanityProjectId || !config.sanityDataset) {
    return fallback;
  }

  const cached = sanityCache.get(query);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const url = new URL(getSanityQueryEndpoint());
    url.searchParams.set('query', query);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(config.sanityToken ? { Authorization: `Bearer ${config.sanityToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const value = payload.result ?? fallback;
    sanityCache.set(query, {
      value,
      expiresAt: Date.now() + Math.max(0, config.sanityCacheSeconds) * 1000,
    });
    return value;
  } catch (error) {
    console.error(`Failed to fetch Sanity ${label}:`, error);
    return cached?.value ?? fallback;
  }
}

function getSanityQueryEndpoint() {
  const host = config.sanityUseCdn && !config.sanityToken ? 'apicdn.sanity.io' : 'api.sanity.io';
  return `https://${config.sanityProjectId}.${host}/v${config.sanityApiVersion}/data/query/${config.sanityDataset}`;
}

function getSanityMutateEndpoint() {
  return `https://${config.sanityProjectId}.api.sanity.io/v${config.sanityApiVersion}/data/mutate/${config.sanityDataset}`;
}

function removeUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
