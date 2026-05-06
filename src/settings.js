import { getSanityBotSettings, updateSanityBotSettings } from './sanity.js';

const defaultBotSettings = {
  defaultRandomReplyChance: 0.08,
  randomReplies: ['yay', 'ok', 'or', 'nope'],
  gifResultLimit: 25,
  gifContentFilter: 'off',
  timeZone: 'America/New_York',
  voiceJoinStartHour: 23,
  voiceJoinEndHour: 3,
  voiceStayMinMinutes: 5,
  voiceStayMaxMinutes: 5,
  voicePauseMinSeconds: 8,
  voicePauseMaxSeconds: 45,
  voiceNoiseDir: 'assets/noises',
  voiceRandomJoinEnabled: true,
  voiceMaxVisitsPerNight: 1,
  voiceTestDelaySeconds: 0,
  robloxSuggestionCount: 5,
  channelSettings: [],
};

let currentBotSettings = normalizeBotSettings(defaultBotSettings);

export async function getEffectiveChannelSettings(channelId) {
  const settings = await getBotSettings();
  const channelSettings = findChannelSettings(settings, channelId);

  return {
    randomRepliesEnabled: channelSettings?.randomRepliesEnabled ?? true,
    messageTriggersEnabled: channelSettings?.messageTriggersEnabled ?? true,
    randomReplyChance: channelSettings?.randomReplyChance ?? settings.defaultRandomReplyChance,
  };
}

export async function getBotSettings() {
  currentBotSettings = normalizeBotSettings(await getSanityBotSettings());
  return currentBotSettings;
}

export function getCurrentBotSettings() {
  return currentBotSettings;
}

export async function initializeBotSettings() {
  const existingSettings = await getSanityBotSettings();

  if (existingSettings) {
    currentBotSettings = normalizeBotSettings(existingSettings);
    if (hasMissingDefaultFields(existingSettings)) {
      await updateSanityBotSettings(currentBotSettings);
    }

    return currentBotSettings;
  }

  await updateSanityBotSettings(defaultBotSettings);
  currentBotSettings = normalizeBotSettings(defaultBotSettings);
  return currentBotSettings;
}

export async function setDefaultRandomReplyChance(chance) {
  const settings = await getBotSettings();
  await updateSanityBotSettings({
    ...settings,
    defaultRandomReplyChance: chance,
  });
  currentBotSettings = normalizeBotSettings({ ...settings, defaultRandomReplyChance: chance });
  return currentBotSettings;
}

export async function setChannelRandomReplies(channel, enabled) {
  return updateChannelSettings(channel, { randomRepliesEnabled: enabled });
}

export async function setChannelMessageTriggers(channel, enabled) {
  return updateChannelSettings(channel, { messageTriggersEnabled: enabled });
}

export async function setChannelRandomReplyChance(channel, chance) {
  return updateChannelSettings(channel, { randomReplyChance: chance });
}

export async function clearChannelSettings(channelId) {
  const settings = await getBotSettings();
  const channelSettings = settings.channelSettings.filter((item) => item.channelId !== channelId);

  await updateSanityBotSettings({
    ...settings,
    channelSettings,
  });

  currentBotSettings = normalizeBotSettings({ ...settings, channelSettings });
  return currentBotSettings;
}

async function updateChannelSettings(channel, fields) {
  const settings = await getBotSettings();
  const existing = findChannelSettings(settings, channel.id) || {};
  const nextChannelSettings = normalizeChannelSettings({
    ...existing,
    ...fields,
    channelId: channel.id,
    channelName: channel.name,
  });
  const channelSettings = [
    ...settings.channelSettings.filter((item) => item.channelId !== channel.id),
    nextChannelSettings,
  ];

  await updateSanityBotSettings({
    ...settings,
    channelSettings,
  });

  currentBotSettings = normalizeBotSettings({ ...settings, channelSettings });
  return currentBotSettings;
}

function normalizeBotSettings(settings) {
  return {
    defaultRandomReplyChance: normalizeChance(
      settings?.defaultRandomReplyChance,
      defaultBotSettings.defaultRandomReplyChance,
    ),
    randomReplies: normalizeStringList(settings?.randomReplies, defaultBotSettings.randomReplies),
    gifResultLimit: normalizeInteger(settings?.gifResultLimit, defaultBotSettings.gifResultLimit, 1, 50),
    gifContentFilter: normalizeString(settings?.gifContentFilter, defaultBotSettings.gifContentFilter),
    timeZone: normalizeString(settings?.timeZone, defaultBotSettings.timeZone),
    voiceJoinStartHour: normalizeInteger(settings?.voiceJoinStartHour, defaultBotSettings.voiceJoinStartHour, 0, 23),
    voiceJoinEndHour: normalizeInteger(settings?.voiceJoinEndHour, defaultBotSettings.voiceJoinEndHour, 0, 23),
    voiceStayMinMinutes: normalizeNumber(settings?.voiceStayMinMinutes, defaultBotSettings.voiceStayMinMinutes, 0),
    voiceStayMaxMinutes: normalizeNumber(settings?.voiceStayMaxMinutes, defaultBotSettings.voiceStayMaxMinutes, 0),
    voicePauseMinSeconds: normalizeNumber(settings?.voicePauseMinSeconds, defaultBotSettings.voicePauseMinSeconds, 0),
    voicePauseMaxSeconds: normalizeNumber(settings?.voicePauseMaxSeconds, defaultBotSettings.voicePauseMaxSeconds, 0),
    voiceNoiseDir: normalizeString(settings?.voiceNoiseDir, defaultBotSettings.voiceNoiseDir),
    voiceRandomJoinEnabled: settings?.voiceRandomJoinEnabled !== false,
    voiceMaxVisitsPerNight: normalizeInteger(
      settings?.voiceMaxVisitsPerNight,
      defaultBotSettings.voiceMaxVisitsPerNight,
      0,
    ),
    voiceTestDelaySeconds: normalizeNumber(settings?.voiceTestDelaySeconds, defaultBotSettings.voiceTestDelaySeconds, 0),
    robloxSuggestionCount: normalizeInteger(
      settings?.robloxSuggestionCount,
      defaultBotSettings.robloxSuggestionCount,
      1,
    ),
    channelSettings: Array.isArray(settings?.channelSettings)
      ? settings.channelSettings.map(normalizeChannelSettings).filter((item) => item.channelId)
      : [],
  };
}

function hasMissingDefaultFields(settings) {
  return Object.keys(defaultBotSettings).some((key) => settings?.[key] === undefined);
}

function normalizeChannelSettings(settings) {
  const channelId = typeof settings?.channelId === 'string' ? settings.channelId : null;

  return removeUndefinedValues({
    _key: typeof settings?._key === 'string' ? settings._key : `channel-${channelId}`,
    channelId,
    channelName: typeof settings?.channelName === 'string' ? settings.channelName : null,
    randomRepliesEnabled: settings?.randomRepliesEnabled !== false,
    messageTriggersEnabled: settings?.messageTriggersEnabled !== false,
    randomReplyChance: settings?.randomReplyChance === null
      ? undefined
      : normalizeOptionalChance(settings?.randomReplyChance),
  });
}

function findChannelSettings(settings, channelId) {
  return settings.channelSettings.find((item) => item.channelId === channelId) || null;
}

function normalizeOptionalChance(value) {
  const chance = Number(value);
  return Number.isFinite(chance) && chance >= 0 && chance <= 1 ? chance : undefined;
}

function normalizeChance(value, fallback) {
  return normalizeOptionalChance(value) ?? fallback;
}

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeStringList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const values = value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());

  return values.length > 0 ? values : fallback;
}

function normalizeNumber(value, fallback, min = null, max = null) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return clamp(number, min, max);
}

function normalizeInteger(value, fallback, min = null, max = null) {
  return Math.round(normalizeNumber(value, fallback, min, max));
}

function clamp(value, min, max) {
  let nextValue = value;

  if (Number.isFinite(min)) {
    nextValue = Math.max(min, nextValue);
  }

  if (Number.isFinite(max)) {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
}

function removeUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
