import { config } from './config.js';

const sanityCache = new Map();

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
    '*[_type == "muodyMessageTrigger" && enabled != false && defined(patterns[0])]{title, patterns, matchType, responseType, responseTexts, responseMedia[]{title, altText, weight, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType), "originalFilename": file.asset->originalFilename}, weight}',
  );
}

async function fetchSanityList(label, query) {
  if (!config.sanityProjectId || !config.sanityDataset) {
    return [];
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
    const value = Array.isArray(payload.result) ? payload.result : [];
    sanityCache.set(query, {
      value,
      expiresAt: Date.now() + Math.max(0, config.sanityCacheSeconds) * 1000,
    });
    return value;
  } catch (error) {
    console.error(`Failed to fetch Sanity ${label}:`, error);
    return cached?.value || [];
  }
}

function getSanityQueryEndpoint() {
  const host = config.sanityUseCdn && !config.sanityToken ? 'apicdn.sanity.io' : 'api.sanity.io';
  return `https://${config.sanityProjectId}.${host}/v${config.sanityApiVersion}/data/query/${config.sanityDataset}`;
}
