import 'dotenv/config';

import { readdir } from 'node:fs/promises';
import { inspect } from 'node:util';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import prism from 'prism-media';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  generateDependencyReport,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { randomUUID } from 'node:crypto';

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment.');
}

const config = {
  guildId: process.env.GUILD_ID || null,
  randomReplyChance: readNumber(process.env.RANDOM_REPLY_CHANCE, 0.08),
  randomReplies: readCsv(process.env.RANDOM_REPLIES, ['yay', 'ok', 'or', 'nope']),
  timeZone: process.env.TIME_ZONE || 'America/New_York',
  voiceJoinStartHour: readNumber(process.env.VOICE_JOIN_START_HOUR, 23),
  voiceJoinEndHour: readNumber(process.env.VOICE_JOIN_END_HOUR, 3),
  voiceStayMinutes: readNumber(process.env.VOICE_STAY_MINUTES, 5),
  voiceNoiseDir: process.env.VOICE_NOISE_DIR || 'assets/noises',
  voiceRandomJoinEnabled: readBoolean(process.env.VOICE_RANDOM_JOIN_ENABLED, true),
  voiceMaxVisitsPerNight: readNumber(process.env.VOICE_MAX_VISITS_PER_NIGHT, 1),
  voiceTestDelaySeconds: readNumber(process.env.VOICE_TEST_DELAY_SECONDS, 0),
  robloxSuggestionCount: readNumber(process.env.ROBLOX_SUGGESTION_COUNT, 5),
};

const voiceJoinLocks = new Set();
const voiceVisitsByNight = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Test Muody joining your current voice channel')
    .toJSON(),
];

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(generateDependencyReport());
  await registerCommands();

  if (config.voiceRandomJoinEnabled) {
    scheduleNextVoiceVisit();
  } else {
    console.log('Random scheduled voice joins are disabled.');
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.channel.isTextBased()) {
    return;
  }

  console.log(`Saw message from ${message.author.tag} in #${message.channel.name}.`);

  if (shouldSuggestRoblox(message.content)) {
    const suggestions = await getRobloxSuggestions(config.robloxSuggestionCount);
    await sendChatReply(message, formatRobloxSuggestion(pick(suggestions)));
    return;
  }

  if (Math.random() < config.randomReplyChance) {
    await sendChatReply(message, pick(config.randomReplies));
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === 'join') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.member?.voice?.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await interaction.editReply('Join a voice channel first, then run /join again.');
      return;
    }

    const joined = await joinVoiceChannelAndPlayNoise(channel);
    await interaction.editReply(joined ? 'Joined and tried to play a noise.' : 'Joined visually, but Discord voice never became ready. Check the terminal logs.');
  }
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  const applicationId = client.application?.id;

  if (!applicationId) {
    return;
  }

  const route = config.guildId
    ? Routes.applicationGuildCommands(applicationId, config.guildId)
    : Routes.applicationCommands(applicationId);

  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} slash command(s).`);
}

async function sendChatReply(message, content) {
  try {
    await message.reply(content);
  } catch (error) {
    console.error('Failed to reply to message, trying normal channel send:', error);
    await message.channel.send(content).catch((sendError) => {
      console.error('Failed to send message to channel:', sendError);
    });
  }
}

function scheduleNextVoiceVisit() {
  const delay = config.voiceTestDelaySeconds > 0
    ? config.voiceTestDelaySeconds * 1000
    : getDelayUntilNextVoiceVisit();
  const visitAt = new Date(Date.now() + delay);

  console.log(`Next possible voice visit scheduled for ${visitAt.toISOString()}.`);

  setTimeout(async () => {
    await visitRandomOccupiedVoiceChannel();
    scheduleNextVoiceVisit();
  }, delay);
}

async function visitRandomOccupiedVoiceChannel() {
  if (!canVisitVoiceTonight()) {
    console.log('Skipped voice visit because tonight already hit the configured visit limit.');
    return;
  }

  const guilds = [...client.guilds.cache.values()];
  const candidates = guilds.flatMap((guild) =>
    [...guild.channels.cache.values()].filter((channel) => {
      if (channel.type !== ChannelType.GuildVoice) {
        return false;
      }

      const people = channel.members.filter((member) => !member.user.bot);
      return people.size > 0;
    }),
  );

  if (candidates.length === 0) {
    console.log('Skipped voice visit because nobody was in voice.');
    return;
  }

  const channel = pick(candidates);
  const joined = await joinVoiceChannelAndPlayNoise(channel);

  if (joined) {
    recordVoiceVisit();
  }
}

async function joinVoiceChannelAndPlayNoise(channel) {
  if (voiceJoinLocks.has(channel.guild.id)) {
    console.log(`Skipped voice join in ${channel.guild.name} because another join is already in progress.`);
    return false;
  }

  voiceJoinLocks.add(channel.guild.id);
  const existingConnection = getVoiceConnection(channel.guild.id);

  if (existingConnection) {
    existingConnection.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    debug: true,
  });
  logVoiceConnection(connection);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 45_000);
    console.log(`Joined ${channel.name} in ${channel.guild.name}.`);
    await playRandomJoinNoise(connection);
    connection.destroy();
    console.log(`Left ${channel.name} in ${channel.guild.name} after audio finished.`);
  } catch (error) {
    console.error(
      `Failed to make voice connection ready. Current status: ${connection.state.status}. ` +
        'If the bot appears in VC but this keeps happening, check firewall/VPN/UDP access to Discord voice.',
      error,
    );
    voiceJoinLocks.delete(channel.guild.id);
    return false;
  }

  voiceJoinLocks.delete(channel.guild.id);
  return true;
}

function logVoiceConnection(connection) {
  connection.on('stateChange', (oldState, newState) => {
    console.log(`Voice connection changed from ${oldState.status} to ${newState.status}.`);

    if (newState.status !== VoiceConnectionStatus.Ready) {
      console.log(`Voice connection details: ${inspect(newState, { depth: 2 })}`);
    }
  });

  connection.on('error', (error) => {
    console.error('Voice connection error:', error);
  });

  connection.on('debug', (message) => {
    console.log(`Voice debug: ${message}`);
  });
}

async function playRandomJoinNoise(connection) {
  const noiseFile = await pickRandomNoiseFile();

  if (!noiseFile) {
    console.log(`No join noises found in ${config.voiceNoiseDir}.`);
    return;
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });
  const ffmpeg = new prism.FFmpeg({
    args: [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      noiseFile,
      '-analyzeduration',
      '0',
      '-f',
      's16le',
      '-ar',
      '48000',
      '-ac',
      '2',
    ],
  });
  const resource = createAudioResource(ffmpeg, {
    inputType: StreamType.Raw,
  });

  const subscription = connection.subscribe(player);
  if (!subscription) {
    console.error('Failed to subscribe audio player to the voice connection.');
    return;
  }

  player.play(resource);
  console.log(`Playing join noise: ${path.basename(noiseFile)}`);

  player.on('stateChange', (oldState, newState) => {
    console.log(`Join noise player changed from ${oldState.status} to ${newState.status}.`);
  });

  player.on('debug', (message) => {
    console.log(`Join noise debug: ${message}`);
  });

  player.on('error', (error) => {
    console.error(`Failed to play join noise ${noiseFile}:`, error);
  });

  await new Promise((resolve) => {
    player.once(AudioPlayerStatus.Idle, () => {
      player.stop();
      resolve();
    });

    player.once('error', () => {
      resolve();
    });
  });
}

async function pickRandomNoiseFile() {
  const noiseDir = path.resolve(config.voiceNoiseDir);
  const supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm']);

  try {
    const entries = await readdir(noiseDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(noiseDir, entry.name));

    return files.length > 0 ? pick(files) : null;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to read join noise directory ${noiseDir}:`, error);
    }

    return null;
  }
}

async function getRobloxSuggestions(limit) {
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
        : `https://www.roblox.com/discover#/sortName=TopTrending`,
    });
  }

  return [...byUniverseId.values()];
}

function formatRobloxSuggestion(game) {
  const prompts = [
    'anyone want to play [this game]({url})?',
    'we should play [this game]({url})',
    'does anyone want to try [this game]({url})?',
    '[this game]({url}) looks fun',
    'i found [this game]({url}) if anyone wants to play',
  ];

  return pick(prompts).replace('{url}', game.url);
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

function shouldSuggestRoblox(content) {
  return /\b(roblox|what should we play|game suggestions?|games to play)\b/i.test(content);
}

function getDelayUntilNextVoiceVisit() {
  const now = new Date();
  const crossesMidnight = config.voiceJoinEndHour <= config.voiceJoinStartHour;
  const nowParts = getZonedParts(now, config.timeZone, true);
  let startParts = nowParts;
  let endParts = nowParts;

  if (crossesMidnight) {
    if (nowParts.hour < config.voiceJoinEndHour) {
      startParts = getZonedParts(addDays(now, -1), config.timeZone);
      endParts = nowParts;
    } else {
      endParts = getZonedParts(addDays(now, 1), config.timeZone);
    }
  }

  let start = zonedDateToUtc(startParts, config.voiceJoinStartHour, 0, config.timeZone);
  let end = zonedDateToUtc(endParts, config.voiceJoinEndHour, 0, config.timeZone);

  if (now >= end) {
    const tomorrowParts = getZonedParts(addDays(now, 1), config.timeZone);
    start = zonedDateToUtc(tomorrowParts, config.voiceJoinStartHour, 0, config.timeZone);
    end = zonedDateToUtc(tomorrowParts, config.voiceJoinEndHour, 0, config.timeZone);

    if (config.voiceJoinEndHour <= config.voiceJoinStartHour) {
      end = addDays(end, 1);
    }
  }

  const earliest = now > start ? now : start;
  const delayWindow = Math.max(60_000, end.getTime() - earliest.getTime());
  return earliest.getTime() - now.getTime() + Math.floor(Math.random() * delayWindow);
}

function canVisitVoiceTonight() {
  return getVoiceVisitsForTonight() < config.voiceMaxVisitsPerNight;
}

function recordVoiceVisit() {
  const nightKey = getVoiceNightKey();
  const visits = getVoiceVisitsForTonight() + 1;
  voiceVisitsByNight.set(nightKey, visits);
  console.log(`Recorded voice visit ${visits}/${config.voiceMaxVisitsPerNight} for ${nightKey}.`);
}

function getVoiceVisitsForTonight() {
  return voiceVisitsByNight.get(getVoiceNightKey()) || 0;
}

function getVoiceNightKey(date = new Date()) {
  const parts = getZonedParts(date, config.timeZone, true);

  if (
    config.voiceJoinEndHour <= config.voiceJoinStartHour &&
    parts.hour < config.voiceJoinEndHour
  ) {
    const previousDayParts = getZonedParts(addDays(date, -1), config.timeZone);
    return `${previousDayParts.year}-${pad2(previousDayParts.month)}-${pad2(previousDayParts.day)}`;
  }

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function zonedDateToUtc(parts, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute));
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function getZonedParts(date, timeZone, includeTime = false) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime
      ? {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
    day: Number(parts.find((part) => part.type === 'day').value),
    hour: Number(parts.find((part) => part.type === 'hour')?.value || 0) % 24,
    minute: Number(parts.find((part) => part.type === 'minute')?.value || 0),
  };
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

function flattenValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenValues);
  }

  if (value && typeof value === 'object') {
    return [value, ...Object.values(value).flatMap(flattenValues)];
  }

  return [];
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

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCsv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}

function readBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

client.login(token);
