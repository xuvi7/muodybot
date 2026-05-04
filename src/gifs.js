import { config } from './config.js';
import { pick } from './utils.js';

const KLIPY_SEARCH_URL = 'https://api.klipy.com/v2/search';

export async function getRandomGif(prompt) {
  const query = typeof prompt === 'string' ? prompt.trim() : '';

  if (!query || !config.klipyApiKey) {
    return null;
  }

  try {
    const url = new URL(KLIPY_SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('key', config.klipyApiKey);
    url.searchParams.set('client_key', config.klipyClientKey);
    url.searchParams.set('limit', String(clampResultLimit(config.gifResultLimit)));
    url.searchParams.set('media_filter', 'gif,tinygif');
    url.searchParams.set('contentfilter', config.gifContentFilter);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const gifs = (Array.isArray(payload.results) ? payload.results : [])
      .map((result) => result?.media_formats?.gif?.url || result?.media_formats?.tinygif?.url)
      .filter(Boolean);

    const gifUrl = gifs.length > 0 ? pick(gifs) : null;
    return gifUrl ? { type: 'gif', url: gifUrl } : null;
  } catch (error) {
    console.error(`Failed to fetch random GIF for "${query}":`, error);
    return null;
  }
}

function clampResultLimit(value) {
  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 25;
  }

  return Math.min(50, Math.max(1, Math.round(limit)));
}
