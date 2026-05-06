import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';

import { formatDiscordReply, pickRandomChatResponse, sendChatReply } from './chat.js';
import { registerCommands } from './commands.js';
import { config, token } from './config.js';
import {
  findNoiseByName,
  joinVoiceChannelAndPlayNoise,
  joinVoiceChannelAndPlaySpecificNoise,
  respondWithNoiseAutocomplete,
  scheduleNextVoiceVisit,
  scheduleVoiceVisitAt,
} from './voice.js';
import { pickMessageTriggerResponse } from './triggers.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(generateDependencyReport());
  await registerCommands(client);

  if (config.voiceRandomJoinEnabled) {
    scheduleNextVoiceVisit(client);
  } else {
    console.log('Random scheduled voice joins are disabled.');
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.channel.isTextBased()) {
    return;
  }

  console.log(`Saw message from ${message.author.tag} in #${message.channel.name}.`);

  const triggerResponse = await pickMessageTriggerResponse(message.content);
  if (triggerResponse) {
    await sendChatReply(message, triggerResponse);
    return;
  }

  if (Math.random() < config.randomReplyChance) {
    await sendChatReply(message, await pickRandomChatResponse());
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'muody' && !isPrivilegedUser(interaction.user.id)) {
      await interaction.respond([]);
      return;
    }

    if (interaction.commandName === 'playnoise' || interaction.commandName === 'muody') {
      await respondWithNoiseAutocomplete(interaction);
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === 'join') {
    await handleJoinCommand(interaction);
    return;
  }

  if (interaction.commandName === 'playnoise') {
    await handlePlayNoiseCommand(interaction);
    return;
  }

  if (interaction.commandName === 'reply') {
    await interaction.reply(formatDiscordReply(await pickRandomChatResponse()));
    return;
  }

  if (interaction.commandName === 'muody') {
    await handlePrivilegedMuodyCommand(interaction);
  }
});

async function handleJoinCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.member?.voice?.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('Join a voice channel first, then run /join again.');
    return;
  }

  const joined = await joinVoiceChannelAndPlayNoise(channel);
  await interaction.editReply(joined
    ? 'Joined and played voice noises for the configured visit time.'
    : 'Joined visually, but Discord voice never became ready. Check the terminal logs.');
}

async function handlePlayNoiseCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.member?.voice?.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('Join a voice channel first, then run /playnoise again.');
    return;
  }

  const clip = interaction.options.getString('clip', true);
  const noiseFile = await findNoiseByName(clip);

  if (!noiseFile) {
    await interaction.editReply(`I could not find a voice noise named "${clip}".`);
    return;
  }

  const joined = await joinVoiceChannelAndPlaySpecificNoise(channel, noiseFile);
  await interaction.editReply(joined
    ? `Joined and played "${noiseFile.name}".`
    : 'Joined visually, but Discord voice never became ready. Check the terminal logs.');
}

async function handlePrivilegedMuodyCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isPrivilegedUser(interaction.user.id)) {
    await interaction.editReply('You are not allowed to use privileged Muody controls.');
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'say') {
    await handlePrivilegedSayCommand(interaction);
    return;
  }

  if (subcommand === 'reply-to') {
    await handlePrivilegedReplyToCommand(interaction);
    return;
  }

  if (subcommand === 'set-reply-chance') {
    await handlePrivilegedSetReplyChanceCommand(interaction);
    return;
  }

  if (subcommand === 'schedule-join') {
    await handlePrivilegedScheduleJoinCommand(interaction);
  }
}

async function handlePrivilegedSayCommand(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const message = interaction.options.getString('message', true);

  if (!channel.isTextBased()) {
    await interaction.editReply('Choose a text channel or thread.');
    return;
  }

  await channel.send(message);
  await interaction.editReply(`Sent message to ${channel}.`);
}

async function handlePrivilegedReplyToCommand(interaction) {
  const selectedChannel = interaction.options.getChannel('channel');
  const target = interaction.options.getString('target', true);
  const message = interaction.options.getString('message', true);
  const messageReference = getDiscordMessageReference(target);

  if (!messageReference) {
    await interaction.editReply('Use a Discord message ID or message link for `target`.');
    return;
  }

  const channel = await getMessageChannel(interaction, selectedChannel, messageReference.channelId);
  if (!channel) {
    await interaction.editReply('I could not find a text channel for that target message.');
    return;
  }

  const { messageId } = messageReference;
  const targetMessage = await fetchChannelMessage(channel, messageId);
  if (!targetMessage) {
    await interaction.editReply(`I could not fetch message ${messageId} from ${channel}.`);
    return;
  }

  await targetMessage.reply(message);
  await interaction.editReply(`Replied to ${targetMessage.url}.`);
}

async function handlePrivilegedSetReplyChanceCommand(interaction) {
  const chance = interaction.options.getNumber('chance', true);
  const previousChance = config.randomReplyChance;

  config.randomReplyChance = chance;
  await interaction.editReply(
    `Random reply chance changed from ${formatPercent(previousChance)} to ${formatPercent(chance)} until restart.`,
  );
}

async function handlePrivilegedScheduleJoinCommand(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const when = interaction.options.getString('when', true);
  const visitAt = parseScheduledTime(when);

  if (channel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('Choose a voice channel.');
    return;
  }

  if (!visitAt) {
    await interaction.editReply(
      'I could not parse that time. Try `2026-05-05 23:30`, `today 23:30`, `tomorrow 00:15`, an ISO timestamp, or `+10m`.',
    );
    return;
  }

  const clip = interaction.options.getString('clip');
  const noiseFile = clip ? await getRequestedNoiseFile(interaction) : null;

  if (clip && !noiseFile) {
    return;
  }

  if (!scheduleVoiceVisitAt(channel, visitAt, noiseFile)) {
    await interaction.editReply('That scheduled time is in the past.');
    return;
  }

  await interaction.editReply(
    `Scheduled Muody to join ${channel} at ${formatScheduledTime(visitAt)}` +
      (noiseFile ? ` and play "${noiseFile.name}".` : '.'),
  );
}

async function getRequestedNoiseFile(interaction) {
  const clip = interaction.options.getString('clip', true);
  const noiseFile = await findNoiseByName(clip);

  if (!noiseFile) {
    await interaction.editReply(`I could not find a voice noise named "${clip}".`);
    return null;
  }

  return noiseFile;
}

function isPrivilegedUser(userId) {
  return config.privilegedUserIds.includes(userId);
}

async function fetchChannelMessage(channel, messageId) {
  try {
    return await channel.messages.fetch(messageId);
  } catch (error) {
    console.error(`Failed to fetch message ${messageId} from ${channel.id}:`, error);
    return null;
  }
}

async function getMessageChannel(interaction, selectedChannel, linkedChannelId) {
  const channel = selectedChannel ||
    (linkedChannelId ? await fetchClientChannel(linkedChannelId) : null) ||
    interaction.channel;

  return channel?.isTextBased() ? channel : null;
}

async function fetchClientChannel(channelId) {
  try {
    return await client.channels.fetch(channelId);
  } catch (error) {
    console.error(`Failed to fetch channel ${channelId}:`, error);
    return null;
  }
}

function getDiscordMessageReference(value) {
  const input = value.trim();
  const linkMatch = input.match(/discord(?:app)?\.com\/channels\/\d+\/(\d+)\/(\d+)/i);

  if (linkMatch) {
    return {
      channelId: linkMatch[1],
      messageId: linkMatch[2],
    };
  }

  return /^\d{17,20}$/.test(input)
    ? {
        channelId: null,
        messageId: input,
      }
    : null;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function parseScheduledTime(value) {
  const input = value.trim();
  const relativeMatch = input.match(/^\+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/i);

  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const multiplier = unit.startsWith('s') ? 1000 : unit.startsWith('h') ? 60 * 60 * 1000 : 60 * 1000;
    return new Date(Date.now() + amount * multiplier);
  }

  const absolute = parseAbsoluteScheduledTime(input);
  if (!absolute || absolute.getTime() <= Date.now()) {
    return null;
  }

  return absolute;
}

function parseAbsoluteScheduledTime(input) {
  const localMatch = input.match(/^(?:(today|tomorrow)\s+)?(?:(\d{4})-(\d{1,2})-(\d{1,2})\s+)?(\d{1,2}):(\d{2})$/i);

  if (localMatch) {
    const [, dayWord, year, month, day, hour, minute] = localMatch;
    const numericHour = Number(hour);
    const numericMinute = Number(minute);

    if (numericHour > 23 || numericMinute > 59) {
      return null;
    }

    const nowParts = getZonedDateParts(new Date(), config.timeZone);
    let parts = {
      year: Number(year || nowParts.year),
      month: Number(month || nowParts.month),
      day: Number(day || nowParts.day),
    };

    if (dayWord?.toLowerCase() === 'tomorrow') {
      parts = getZonedDateParts(new Date(Date.now() + 24 * 60 * 60 * 1000), config.timeZone);
    }

    return zonedDateToUtc(parts, numericHour, numericMinute, config.timeZone);
  }

  const nativeDate = new Date(input);
  return Number.isNaN(nativeDate.getTime()) ? null : nativeDate;
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
    day: Number(parts.find((part) => part.type === 'day').value),
  };
}

function zonedDateToUtc(parts, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute));
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function formatScheduledTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

client.login(token);
