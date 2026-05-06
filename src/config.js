import 'dotenv/config';

import { readBoolean, readCsv, readNumber } from './utils.js';

export const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment.');
}

export const config = {
  guildId: process.env.GUILD_ID || null,
  privilegedUserIds: readCsv(process.env.PRIVILEGED_USER_IDS || process.env.ADMIN_USER_IDS, []),
  sanityProjectId: process.env.SANITY_PROJECT_ID || null,
  sanityDataset: process.env.SANITY_DATASET || 'production',
  sanityApiVersion: process.env.SANITY_API_VERSION || '2025-01-01',
  sanityToken: process.env.SANITY_TOKEN || null,
  sanityUseCdn: readBoolean(process.env.SANITY_USE_CDN, true),
  sanityCacheSeconds: readNumber(process.env.SANITY_CACHE_SECONDS, 86_400),
  klipyApiKey: process.env.KLIPY_API_KEY || null,
  klipyClientKey: process.env.KLIPY_CLIENT_KEY || 'muodybot',
};
