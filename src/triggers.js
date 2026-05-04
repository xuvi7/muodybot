import { formatRobloxSuggestion, getRobloxSuggestions } from './roblox.js';
import { config } from './config.js';
import { pickRandomChatResponse } from './chat.js';
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

  return getTriggerResponse(weightedPick(matchingTriggers));
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

  if (trigger.responseType === 'text') {
    const responseTexts = getTextResponses(trigger);
    return responseTexts.length > 0 ? pick(responseTexts) : null;
  }

  return null;
}

function getTextResponses(trigger) {
  return (Array.isArray(trigger.responseTexts) ? trigger.responseTexts : [])
    .filter((response) => typeof response === 'string' && response.trim());
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
