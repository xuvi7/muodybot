import 'dotenv/config';

import { readBoolean, readCsv, readNumber } from './utils.js';

export const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment.');
}

export const config = {
  guildId: process.env.GUILD_ID || null,
  randomReplyChance: readNumber(process.env.RANDOM_REPLY_CHANCE, 0.08),
  randomReplies: readCsv(process.env.RANDOM_REPLIES, ['yay', 'ok', 'or', 'nope']),
  sanityProjectId: process.env.SANITY_PROJECT_ID || null,
  sanityDataset: process.env.SANITY_DATASET || 'production',
  sanityApiVersion: process.env.SANITY_API_VERSION || '2025-01-01',
  sanityToken: process.env.SANITY_TOKEN || null,
  sanityUseCdn: readBoolean(process.env.SANITY_USE_CDN, true),
  sanityCacheSeconds: readNumber(process.env.SANITY_CACHE_SECONDS, 300),
  klipyApiKey: process.env.KLIPY_API_KEY || null,
  klipyClientKey: process.env.KLIPY_CLIENT_KEY || 'muodybot',
  gifResultLimit: readNumber(process.env.GIF_RESULT_LIMIT, 25),
  gifContentFilter: process.env.GIF_CONTENT_FILTER || process.env.GIF_RATING || 'off',
  timeZone: process.env.TIME_ZONE || 'America/New_York',
  voiceJoinStartHour: readNumber(process.env.VOICE_JOIN_START_HOUR, 23),
  voiceJoinEndHour: readNumber(process.env.VOICE_JOIN_END_HOUR, 3),
  voiceStayMinMinutes: readNumber(process.env.VOICE_STAY_MIN_MINUTES, readNumber(process.env.VOICE_STAY_MINUTES, 5)),
  voiceStayMaxMinutes: readNumber(process.env.VOICE_STAY_MAX_MINUTES, readNumber(process.env.VOICE_STAY_MINUTES, 5)),
  voicePauseMinSeconds: readNumber(process.env.VOICE_PAUSE_MIN_SECONDS, 8),
  voicePauseMaxSeconds: readNumber(process.env.VOICE_PAUSE_MAX_SECONDS, 45),
  voiceNoiseDir: process.env.VOICE_NOISE_DIR || 'assets/noises',
  voiceRandomJoinEnabled: readBoolean(process.env.VOICE_RANDOM_JOIN_ENABLED, true),
  voiceMaxVisitsPerNight: readNumber(process.env.VOICE_MAX_VISITS_PER_NIGHT, 1),
  voiceTestDelaySeconds: readNumber(process.env.VOICE_TEST_DELAY_SECONDS, 0),
  robloxSuggestionCount: readNumber(process.env.ROBLOX_SUGGESTION_COUNT, 5),
};
