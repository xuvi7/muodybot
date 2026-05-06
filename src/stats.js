import { createSanityUsageEvent, getSanityUsageEvents } from './sanity.js';

export function recordUsageEvent(event) {
  createSanityUsageEvent(event).catch((error) => {
    console.error('Failed to record usage event:', error);
  });
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

export async function getUsageStats(days = 30) {
  const events = await getSanityUsageEvents(days);

  return {
    totalEvents: events.length,
    topTriggers: countTop(events, 'triggerTitle', (event) => event.eventType === 'trigger_reply'),
    topNoises: countTop(events, 'noiseName', (event) => event.eventType === 'noise_play'),
    topReplyTargets: countTop(
      events,
      (event) => event.username || event.userId,
      (event) => ['trigger_reply', 'random_reply', 'manual_reply'].includes(event.eventType),
    ),
    topCommandUsers: countTop(
      events,
      (event) => event.username || event.userId,
      (event) => event.eventType === 'command',
    ),
    topCommands: countTop(
      events,
      (event) => [event.commandName, event.subcommandName].filter(Boolean).join(' '),
      (event) => event.eventType === 'command',
    ),
  };
}

export function formatUsageStats(stats, days = 30) {
  return [
    `Usage stats for the last ${days} day(s):`,
    `Events recorded: ${stats.totalEvents}`,
    '',
    formatTopList('Top triggers', stats.topTriggers),
    formatTopList('Top noises', stats.topNoises),
    formatTopList('Who Muody replies to', stats.topReplyTargets),
    formatTopList('Command users', stats.topCommandUsers),
    formatTopList('Commands', stats.topCommands),
  ].join('\n');
}

function countTop(events, keyOrGetter, filter = () => true, limit = 5) {
  const counts = new Map();
  const getKey = typeof keyOrGetter === 'function'
    ? keyOrGetter
    : (event) => event[keyOrGetter];

  for (const event of events) {
    if (!filter(event)) {
      continue;
    }

    const key = getKey(event);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
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
