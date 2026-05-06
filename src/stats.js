import { getSanityUsageStats, updateSanityUsageStats } from './sanity.js';

const usageEventQueue = [];
const flushIntervalMs = 60 * 60 * 1000;
const flushBatchSize = 25;
const maxQueuedEvents = 500;
const maxPersistedCounters = 25;
let flushTimer = null;
let flushInProgress = false;

export function recordUsageEvent(event) {
  usageEventQueue.push({
    createdAt: new Date().toISOString(),
    ...event,
  });

  if (usageEventQueue.length > maxQueuedEvents) {
    usageEventQueue.splice(0, usageEventQueue.length - maxQueuedEvents);
  }

  if (usageEventQueue.length >= flushBatchSize) {
    flushUsageEvents();
    return;
  }

  scheduleUsageFlush();
}

export async function flushUsageEvents() {
  if (flushInProgress || usageEventQueue.length === 0) {
    return true;
  }

  clearUsageFlushTimer();
  flushInProgress = true;
  const events = usageEventQueue.splice(0, flushBatchSize);

  try {
    const wroteEvents = await flushEventSummaries(events);

    if (!wroteEvents) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to flush usage events:', error);
    requeueUsageEvents(events);
    return false;
  } finally {
    flushInProgress = false;

    if (usageEventQueue.length > 0) {
      scheduleUsageFlush();
    }
  }
}

export async function flushAllUsageEvents() {
  let flushedAll = true;

  while (usageEventQueue.length > 0) {
    const flushed = await flushUsageEvents();

    if (!flushed || flushInProgress) {
      flushedAll = false;
      break;
    }
  }

  return flushedAll;
}

export function getUsageFlushStatus() {
  return {
    queuedEvents: usageEventQueue.length,
    flushIntervalMs,
    flushBatchSize,
    maxQueuedEvents,
    flushInProgress,
  };
}

export function getMessageContext(message) {
  return {
    guildId: message.guild?.id,
    guildName: message.guild?.name,
    channelId: message.channel?.id,
    channelName: message.channel?.name,
    userId: message.author?.id,
    username: message.author?.tag || message.author?.username,
  };
}

export function getInteractionContext(interaction) {
  return {
    guildId: interaction.guild?.id,
    guildName: interaction.guild?.name,
    channelId: interaction.channel?.id,
    channelName: interaction.channel?.name,
    userId: interaction.user?.id,
    username: interaction.user?.tag || interaction.user?.username,
    commandName: interaction.commandName,
    subcommandName: getInteractionSubcommand(interaction),
  };
}

export function getVoiceContext(channel) {
  return {
    guildId: channel.guild?.id,
    guildName: channel.guild?.name,
    channelId: channel.id,
    channelName: channel.name,
  };
}

export async function getUsageStats() {
  const queuedSummary = summarizeEvents(usageEventQueue);
  const persistedSummary = await getSanityUsageStats();
  const summary = mergeUsageSummaries([persistedSummary, queuedSummary]);

  return {
    totalEvents: summary.totalEvents,
    persistedEvents: Number(persistedSummary.totalEvents) || 0,
    queuedEvents: usageEventQueue.length,
    topEventTypes: topCounters(summary.eventTypes),
    topTriggers: topCounters(summary.triggers),
    topNoises: topCounters(summary.noises),
    topReplyTargets: topCounters(summary.replyTargets),
    topCommandUsers: topCounters(summary.commandUsers),
    topCommands: topCounters(summary.commands),
  };
}

export function formatUsageStats(stats) {
  return [
    'Usage stats:',
    `Events counted: ${stats.totalEvents} (${stats.persistedEvents} persisted, ${stats.queuedEvents} queued)`,
    '',
    formatTopList('Event types', stats.topEventTypes),
    formatTopList('Top triggers', stats.topTriggers),
    formatTopList('Top noises', stats.topNoises),
    formatTopList('Who Muody replies to', stats.topReplyTargets),
    formatTopList('Command users', stats.topCommandUsers),
    formatTopList('Commands', stats.topCommands),
  ].join('\n');
}

async function flushEventSummaries(events) {
  const existingSummary = await getSanityUsageStats();
  const mergedSummary = mergeUsageSummaries([existingSummary, summarizeEvents(events)]);

  return updateSanityUsageStats(trimUsageSummary(mergedSummary));
}

function summarizeEvents(events) {
  const summary = createEmptySummary();

  for (const event of events) {
    addEventToSummary(summary, event);
  }

  return summary;
}

function mergeUsageSummaries(summaries) {
  const summary = createEmptySummary();

  for (const item of summaries.filter(Boolean)) {
    summary.totalEvents += Number(item.totalEvents) || 0;
    mergeCounters(summary.eventTypes, item.eventTypes);
    mergeCounters(summary.triggers, item.triggers);
    mergeCounters(summary.noises, item.noises);
    mergeCounters(summary.replyTargets, item.replyTargets);
    mergeCounters(summary.commandUsers, item.commandUsers);
    mergeCounters(summary.commands, item.commands);
  }

  return summary;
}

function addEventToSummary(summary, event) {
  summary.totalEvents += 1;
  incrementCounter(summary.eventTypes, event.eventType);

  if (event.eventType === 'trigger_reply') {
    incrementCounter(summary.triggers, event.triggerTitle);
  }

  if (event.eventType === 'noise_play') {
    incrementCounter(summary.noises, event.noiseName);
  }

  if (['trigger_reply', 'random_reply', 'manual_reply'].includes(event.eventType)) {
    incrementCounter(summary.replyTargets, event.username || event.userId);
  }

  if (event.eventType === 'command') {
    incrementCounter(summary.commandUsers, event.username || event.userId);
    incrementCounter(summary.commands, [event.commandName, event.subcommandName].filter(Boolean).join(' '));
  }
}

function createEmptySummary() {
  return {
    totalEvents: 0,
    eventTypes: [],
    triggers: [],
    noises: [],
    replyTargets: [],
    commandUsers: [],
    commands: [],
  };
}

function incrementCounter(counters, name, amount = 1) {
  if (!name) {
    return;
  }

  const counter = counters.find((item) => item.name === name);

  if (counter) {
    counter.count += amount;
    return;
  }

  counters.push({ name, count: amount });
}

function mergeCounters(target, source) {
  for (const counter of Array.isArray(source) ? source : []) {
    incrementCounter(target, counter.name, Number(counter.count) || 0);
  }
}

function topCounters(counters, limit = 5) {
  return [...(Array.isArray(counters) ? counters : [])]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function trimUsageSummary(summary) {
  return {
    ...summary,
    eventTypes: topCounters(summary.eventTypes, maxPersistedCounters),
    triggers: topCounters(summary.triggers, maxPersistedCounters),
    noises: topCounters(summary.noises, maxPersistedCounters),
    replyTargets: topCounters(summary.replyTargets, maxPersistedCounters),
    commandUsers: topCounters(summary.commandUsers, maxPersistedCounters),
    commands: topCounters(summary.commands, maxPersistedCounters),
  };
}

function formatTopList(title, items) {
  if (items.length === 0) {
    return `${title}: none`;
  }

  return `${title}:\n${items.map((item, index) => `${index + 1}. ${item.name} (${item.count})`).join('\n')}`;
}

function getInteractionSubcommand(interaction) {
  try {
    return interaction.options.getSubcommand(false) || null;
  } catch {
    return null;
  }
}

function scheduleUsageFlush() {
  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushUsageEvents();
  }, flushIntervalMs);
}

function clearUsageFlushTimer() {
  if (!flushTimer) {
    return;
  }

  clearTimeout(flushTimer);
  flushTimer = null;
}

function requeueUsageEvents(events) {
  usageEventQueue.unshift(...events);

  if (usageEventQueue.length > maxQueuedEvents) {
    usageEventQueue.length = maxQueuedEvents;
  }
}
