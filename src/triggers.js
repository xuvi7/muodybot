import { formatRobloxSuggestion, getRobloxSuggestions } from './roblox.js';
import { config } from './config.js';
import { pickRandomChatResponse } from './chat.js';
import { getRandomGif } from './gifs.js';
import { getSanityMessageTriggers } from './sanity.js';
import { pick, weightedPick } from './utils.js';

const fallbackMessageTriggers = [
  {
    title: 'Roblox game suggestion',
    patterns: ['roblox', 'what should we play', 'game suggestion', 'game suggestions', 'games to play'],
    matchType: 'word',
    responseType: 'robloxSuggestion',
    weight: 1,
  },
];

export async function pickMessageTriggerResponse(content) {
  const triggers = await getMessageTriggers();
  const matchingTriggers = triggers.filter((trigger) => messageMatchesTrigger(content, trigger));

  if (matchingTriggers.length === 0) {
    return null;
  }

  return getTriggerResponse(weightedPick(getHighestPriorityTriggers(matchingTriggers)));
}

async function getMessageTriggers() {
  const sanityTriggers = await getSanityMessageTriggers();
  return sanityTriggers.length > 0 ? sanityTriggers : fallbackMessageTriggers;
}

async function getTriggerResponse(trigger) {
  if (trigger.responseType === 'robloxSuggestion') {
    const suggestions = await getRobloxSuggestions(config.robloxSuggestionCount);
    return formatRobloxSuggestion(pick(suggestions));
  }

  if (trigger.responseType === 'randomReply') {
    return pickRandomChatResponse();
  }

  if (trigger.responseType === 'randomGif') {
    return getRandomGif(trigger.gifPrompt);
  }

  if (isCustomResponseTrigger(trigger)) {
    const responses = getCustomResponses(trigger);
    const response = responses.length > 0 ? weightedPick(responses) : null;
    return response?.type === 'text' ? response.text : response;
  }

  return null;
}

function isCustomResponseTrigger(trigger) {
  return ['responses', 'text', 'media'].includes(trigger.responseType);
}

function getCustomResponses(trigger) {
  const textResponses = (Array.isArray(trigger.responseTexts) ? trigger.responseTexts : [])
    .filter((response) => typeof response === 'string' && response.trim())
    .map((text) => ({ text, type: 'text', weight: 1 }));
  const mediaResponses = (Array.isArray(trigger.responseMedia) ? trigger.responseMedia : [])
    .filter((response) => response?.url)
    .map((response) => ({ ...response, type: 'muody' }));

  return [...textResponses, ...mediaResponses];
}

function getHighestPriorityTriggers(triggers) {
  const highestPriority = Math.max(...triggers.map(getPriority));
  return triggers.filter((trigger) => getPriority(trigger) === highestPriority);
}

function getPriority(trigger) {
  const priority = Number(trigger?.priority);
  return Number.isFinite(priority) ? priority : 0;
}

function messageMatchesTrigger(content, trigger) {
  const patterns = Array.isArray(trigger.patterns) ? trigger.patterns : [];
  return patterns.some((pattern) => patternMatchesContent(content, pattern, trigger.matchType));
}

function patternMatchesContent(content, pattern, matchType = 'word') {
  if (!content || !pattern) {
    return false;
  }

  if (matchType === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(content);
    } catch (error) {
      console.error(`Invalid message trigger regex "${pattern}":`, error);
      return false;
    }
  }

  if (matchType === 'contains') {
    return content.toLowerCase().includes(pattern.toLowerCase());
  }

  return new RegExp(`(^|\\P{L})${escapeRegex(pattern)}($|\\P{L})`, 'iu').test(content);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
