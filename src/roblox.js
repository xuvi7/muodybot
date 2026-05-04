import { randomUUID } from 'node:crypto';

import { flattenValues, pick } from './utils.js';

export async function getRobloxSuggestions(limit) {
  try {
    const sessionId = randomUUID();
    const sortsUrl = new URL('https://apis.roblox.com/explore-api/v1/get-sorts');
    sortsUrl.searchParams.set('sessionId', sessionId);

    const sortsPayload = await fetchJson(sortsUrl);
    const sort = chooseRobloxSort(sortsPayload);

    if (!sort?.id) {
      throw new Error('Roblox explore API did not return a usable sort.');
    }

    const contentUrl = new URL('https://apis.roblox.com/explore-api/v1/get-sort-content');
    contentUrl.searchParams.set('sessionId', sessionId);
    contentUrl.searchParams.set('sortId', sort.id);
    contentUrl.searchParams.set('maxRows', '1');

    const contentPayload = await fetchJson(contentUrl);
    const games = normalizeRobloxGames(contentPayload).slice(0, limit);

    if (games.length === 0) {
      throw new Error('Roblox explore API returned no games.');
    }

    return games;
  } catch (error) {
    console.error('Failed to fetch Roblox suggestions:', error);
    return fallbackRobloxSuggestions().slice(0, limit);
  }
}

export function formatRobloxSuggestion(game) {
  const prompts = [
    'anyone want to play [this game]({url})?',
    'we should play [this game]({url})',
    'does anyone want to try [this game]({url})?',
    '[this game]({url}) looks fun',
    'i found [this game]({url}) if anyone wants to play',
  ];

  return pick(prompts).replace('{url}', game.url);
}

export function shouldSuggestRoblox(content) {
  return /\b(roblox|what should we play|game suggestions?|games to play)\b/i.test(content);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'muodybot/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url.hostname}`);
  }

  return response.json();
}

function chooseRobloxSort(payload) {
  const sorts = flattenValues(payload).filter((value) => {
    return (
      value &&
      typeof value === 'object' &&
      value.contentType === 'Games' &&
      typeof value.id === 'string'
    );
  });

  return (
    sorts.find((sort) => /trending/i.test(getRobloxSortText(sort))) ||
    sorts.find((sort) => /popular|playing|recommended/i.test(getRobloxSortText(sort))) ||
    sorts[0]
  );
}

function getRobloxSortText(sort) {
  return `${sort.id} ${sort.sortId} ${sort.name} ${sort.displayName} ${sort.sortDisplayName} ${sort.topic}`;
}

function normalizeRobloxGames(payload) {
  const objects = flattenValues(payload).filter((value) => value && typeof value === 'object');
  const byUniverseId = new Map();

  for (const item of objects) {
    const universeId = item.universeId || item.universeID || item.id;
    const name = item.name || item.title || item.displayName;
    const rootPlaceId = item.rootPlaceId || item.placeId || item.placeID;

    if (!universeId || !name || byUniverseId.has(String(universeId))) {
      continue;
    }

    byUniverseId.set(String(universeId), {
      name,
      playing: item.playerCount || item.playing || item.concurrentUsers || null,
      url: rootPlaceId
        ? `https://www.roblox.com/games/${rootPlaceId}`
        : 'https://www.roblox.com/discover#/sortName=TopTrending',
    });
  }

  return [...byUniverseId.values()];
}

function fallbackRobloxSuggestions() {
  return [
    { name: 'Dress To Impress', url: 'https://www.roblox.com/discover#/sortName=TopTrending' },
    { name: 'Grow a Garden', url: 'https://www.roblox.com/discover#/sortName=TopTrending' },
    { name: 'Blox Fruits', url: 'https://www.roblox.com/discover#/sortName=TopTrending' },
    { name: 'Blade Ball', url: 'https://www.roblox.com/discover#/sortName=TopTrending' },
    { name: 'Brookhaven RP', url: 'https://www.roblox.com/discover#/sortName=TopTrending' },
  ];
}
