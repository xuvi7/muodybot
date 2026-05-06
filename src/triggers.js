import { formatRobloxSuggestion, getRobloxSuggestions } from './roblox.js';
import { pickRandomChatResponse, pickRandomMuody, pickRandomTextReply } from './chat.js';
import { getRandomGif } from './gifs.js';
import { getSanityMessageTriggers } from './sanity.js';
import { getCurrentBotSettings } from './settings.js';
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

  const trigger = weightedPick(getHighestPriorityTriggers(matchingTriggers));
  const response = await getTriggerResponse(trigger);

  return response
    ? {
        response,
        triggerTitle: trigger.title,
        responseType: getResponseType(response),
      }
    : null;
}

async function getMessageTriggers() {
  const sanityTriggers = await getSanityMessageTriggers();
  return sanityTriggers.length > 0 ? sanityTriggers : fallbackMessageTriggers;
}

async function getTriggerResponse(trigger) {
  const actions = getResponseActions(trigger);
  const action = actions.length > 0 ? weightedPick(actions) : null;
  return action ? getActionResponse(action) : null;
}

async function getActionResponse(action) {
  if (action.type === 'robloxSuggestion') {
    const suggestions = await getRobloxSuggestions(getCurrentBotSettings().robloxSuggestionCount);
    return formatRobloxSuggestion(pick(suggestions));
  }

  if (action.type === 'randomReply') {
    return pickRandomChatResponse();
  }

  if (action.type === 'randomTextReply') {
    return pickRandomTextReply();
  }

  if (action.type === 'randomMuody') {
    return pickRandomMuody();
  }

  if (action.type === 'randomGif') {
    return getRandomGif(action.gifPrompt);
  }

  if (action.type === 'text') {
    return action.text;
  }

  if (action.type === 'media' && action.url) {
    return { ...action, type: 'muody' };
  }

  return null;
}

function getResponseActions(trigger) {
  const actions = (Array.isArray(trigger.responseActions) ? trigger.responseActions : [])
    .map(normalizeResponseAction)
    .filter(Boolean);

  return actions.length > 0 ? actions : getLegacyResponseActions(trigger);
}

function normalizeResponseAction(action) {
  if (action?.type === 'text' && typeof action.text === 'string' && action.text.trim()) {
    return { ...action, text: action.text.trim() };
  }

  if (action?.type === 'media' && action.url) {
    return action;
  }

  if (action?.type === 'randomGif' && typeof action.gifPrompt === 'string' && action.gifPrompt.trim()) {
    return { ...action, gifPrompt: action.gifPrompt.trim() };
  }

  if (['randomReply', 'randomTextReply', 'randomMuody', 'robloxSuggestion'].includes(action?.type)) {
    return action;
  }

  return null;
}

function getLegacyResponseActions(trigger) {
  if (trigger.responseType === 'robloxSuggestion') {
    return [{ type: 'robloxSuggestion', weight: trigger.weight }];
  }

  if (trigger.responseType === 'randomReply') {
    return [{ type: 'randomReply', weight: trigger.weight }];
  }

  if (trigger.responseType === 'randomGif') {
    return normalizeResponseAction({
      type: 'randomGif',
      gifPrompt: trigger.gifPrompt,
      weight: trigger.weight,
    }) ? [{ type: 'randomGif', gifPrompt: trigger.gifPrompt, weight: trigger.weight }] : [];
  }

  if (!['responses', 'text', 'media'].includes(trigger.responseType)) {
    return [];
  }

  const textResponses = (Array.isArray(trigger.responseTexts) ? trigger.responseTexts : [])
    .filter((response) => typeof response === 'string' && response.trim())
    .map((text) => ({ text, type: 'text', weight: 1 }));
  const mediaResponses = (Array.isArray(trigger.responseMedia) ? trigger.responseMedia : [])
    .filter((response) => response?.url)
    .map((response) => ({ ...response, type: 'media' }));

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

function getResponseType(response) {
  if (typeof response === 'string') {
    return 'text';
  }

  return response?.type || 'unknown';
}
