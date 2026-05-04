import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';

import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { ChannelType } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import prism from 'prism-media';

import { config } from './config.js';
import { getSanityVoiceNoises } from './sanity.js';
import {
  addDays,
  formatDuration,
  getRandomMilliseconds,
  pad2,
  pick,
  sleep,
  weightedPick,
} from './utils.js';

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const voiceJoinLocks = new Set();
const voiceVisitsByNight = new Map();

export function scheduleNextVoiceVisit(client) {
  const delay = config.voiceTestDelaySeconds > 0
    ? config.voiceTestDelaySeconds * 1000
    : getDelayUntilNextVoiceVisit();
  const visitAt = new Date(Date.now() + delay);

  console.log(`Next possible voice visit scheduled for ${visitAt.toISOString()}.`);

  setTimeout(async () => {
    await visitRandomOccupiedVoiceChannel(client);
    scheduleNextVoiceVisit(client);
  }, delay);
}

export async function joinVoiceChannelAndPlayNoise(channel) {
  return joinVoiceChannelForSession(channel, playJoinNoiseSession, 'voice visit');
}

export async function joinVoiceChannelAndPlaySpecificNoise(channel, noiseFile) {
  return joinVoiceChannelForSession(
    channel,
    (connection) => playSingleNoiseSession(connection, noiseFile),
    `voice noise ${noiseFile.name}`,
  );
}

export async function findNoiseByName(name) {
  const normalizedName = normalizeNoiseName(name);
  const noises = await getAvailableVoiceNoises();

  return noises.find((noise) => noise.matchNames.some((matchName) => normalizeNoiseName(matchName) === normalizedName)) ||
    noises.find((noise) => noise.matchNames.some((matchName) => normalizeNoiseName(matchName).includes(normalizedName))) ||
    null;
}

export async function respondWithNoiseAutocomplete(interaction) {
  const focused = interaction.options.getFocused();
  const normalizedFocused = normalizeNoiseName(focused);
  const noises = await getAvailableVoiceNoises();
  const matches = noises
    .filter((noise) => {
      if (!normalizedFocused) {
        return true;
      }

      return noise.matchNames.some((matchName) => normalizeNoiseName(matchName).includes(normalizedFocused));
    })
    .slice(0, 25)
    .map((noise) => ({
      name: noise.name.slice(0, 100),
      value: noise.name.slice(0, 100),
    }));

  await interaction.respond(matches);
}

async function visitRandomOccupiedVoiceChannel(client) {
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

async function joinVoiceChannelForSession(channel, playSession, label) {
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
    await playSession(connection);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
      console.log(`Left ${channel.name} in ${channel.guild.name} after ${label} ended.`);
    }
  } catch (error) {
    console.error(
      `Failed to make voice connection ready. Current status: ${connection.state.status}. ` +
        'If the bot appears in VC but this keeps happening, check firewall/VPN/UDP access to Discord voice.',
      error,
    );
    return false;
  } finally {
    voiceJoinLocks.delete(channel.guild.id);
  }

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

async function playJoinNoiseSession(connection) {
  const stayMs = getRandomMilliseconds(config.voiceStayMinMinutes, config.voiceStayMaxMinutes, 60_000);
  const leaveAt = Date.now() + stayMs;
  let clipsPlayed = 0;
  const abortController = new AbortController();
  const { signal } = abortController;
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Stop,
    },
  });
  const subscription = connection.subscribe(player);

  if (!subscription) {
    console.error('Failed to subscribe audio player to the voice connection.');
    return;
  }

  player.on('stateChange', (oldState, newState) => {
    console.log(`Join noise player changed from ${oldState.status} to ${newState.status}.`);
  });

  player.on('debug', (message) => {
    console.log(`Join noise debug: ${message}`);
  });

  player.on('error', (error) => {
    console.error('Failed to play join noise:', error);
  });

  const stopSession = (reason) => {
    if (!signal.aborted) {
      abortController.abort(reason);
    }

    player.stop();
  };
  const onConnectionStateChange = (oldState, newState) => {
    if (
      oldState.status === VoiceConnectionStatus.Ready &&
      [VoiceConnectionStatus.Disconnected, VoiceConnectionStatus.Destroyed].includes(newState.status)
    ) {
      console.log('Stopping join noise player because the bot was disconnected from voice.');
      stopSession(newState.status);
    }
  };

  connection.on('stateChange', onConnectionStateChange);
  console.log(`Voice visit will last ${formatDuration(stayMs)}.`);

  try {
    while (!signal.aborted && Date.now() < leaveAt) {
      const noiseFile = await pickRandomNoise();

      if (!noiseFile) {
        console.log(`No join noises found in ${config.voiceNoiseDir}.`);
        break;
      }

      await playNoiseFile(player, noiseFile, leaveAt - Date.now(), signal);

      if (signal.aborted) {
        break;
      }

      clipsPlayed += 1;

      const remainingMs = leaveAt - Date.now();
      if (remainingMs <= 0) {
        break;
      }

      const pauseMs = Math.min(
        getRandomMilliseconds(config.voicePauseMinSeconds, config.voicePauseMaxSeconds, 1000),
        remainingMs,
      );
      console.log(`Waiting ${formatDuration(pauseMs)} before next join noise.`);
      await sleep(pauseMs, signal);
    }
  } finally {
    connection.off('stateChange', onConnectionStateChange);
    subscription.unsubscribe();
    player.stop();
  }

  if (signal.aborted) {
    console.log(`Voice visit stopped early after ${clipsPlayed} clip(s).`);
  } else {
    console.log(`Voice visit finished after ${clipsPlayed} clip(s).`);
  }
}

async function playSingleNoiseSession(connection, noiseFile) {
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Stop,
    },
  });
  const subscription = connection.subscribe(player);

  if (!subscription) {
    console.error('Failed to subscribe audio player to the voice connection.');
    return;
  }

  player.on('stateChange', (oldState, newState) => {
    console.log(`Single noise player changed from ${oldState.status} to ${newState.status}.`);
  });

  player.on('debug', (message) => {
    console.log(`Single noise debug: ${message}`);
  });

  player.on('error', (error) => {
    console.error('Failed to play selected noise:', error);
  });

  try {
    await playNoiseFile(player, noiseFile, null);
  } finally {
    subscription.unsubscribe();
    player.stop();
  }
}

async function playNoiseFile(player, noiseFile, maxPlayMs, signal) {
  if (!noiseFile) {
    console.log(`No join noises found in ${config.voiceNoiseDir}.`);
    return;
  }

  if (signal?.aborted) {
    return;
  }

  const input = await createNoiseInput(noiseFile, signal);

  if (!input) {
    return;
  }

  try {
    const ffmpeg = new prism.FFmpeg({
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        ...input.args,
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
    let ffmpegErrorOutput = '';

    ffmpeg.process?.stderr?.on('data', (chunk) => {
      ffmpegErrorOutput += chunk.toString();
    });

    ffmpeg.process?.once('error', (error) => {
      console.error(`Failed to start ffmpeg for join noise ${noiseFile.name}:`, error);
    });

    ffmpeg.process?.once('close', (code, processSignal) => {
      if (code && code !== 0) {
        console.error(
          `ffmpeg exited with code ${code} while playing join noise ${noiseFile.name}.` +
            (ffmpegErrorOutput ? ` stderr: ${ffmpegErrorOutput.trim()}` : ''),
        );
      } else if (processSignal && processSignal !== 'SIGKILL') {
        console.error(`ffmpeg exited from signal ${processSignal} while playing join noise ${noiseFile.name}.`);
      }
    });

    const resource = createAudioResource(ffmpeg, {
      inputType: StreamType.Raw,
    });

    player.play(resource);
    console.log(`Playing join noise: ${noiseFile.name}`);

    await new Promise((resolve) => {
      let finished = false;
      let playTimeout;
      const onAbort = () => {
        player.stop();
        finish();
      };
      const onIdle = () => {
        player.stop();
        finish();
      };
      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;
        if (playTimeout) {
          clearTimeout(playTimeout);
        }
        player.off(AudioPlayerStatus.Idle, onIdle);
        player.off('error', finish);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };

      if (Number.isFinite(maxPlayMs)) {
        playTimeout = setTimeout(() => {
          player.stop();
        }, Math.max(0, maxPlayMs));
      }

      player.once(AudioPlayerStatus.Idle, onIdle);
      player.once('error', finish);
      signal?.addEventListener('abort', onAbort, { once: true });

      if (signal?.aborted) {
        onAbort();
      }
    });
  } finally {
    await input.cleanup?.();
  }
}

async function createNoiseInput(noiseFile, signal) {
  if (!isHttpUrl(noiseFile.url)) {
    return {
      args: ['-i', noiseFile.url],
      cleanup: null,
    };
  }

  try {
    const response = await fetch(noiseFile.url, {
      headers: getNoiseFetchHeaders(noiseFile.url),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    console.log(
      `Fetched join noise ${noiseFile.name}: ` +
        `${response.headers.get('content-type') || 'unknown content type'}, ` +
        `${audioBuffer.byteLength} bytes.`,
    );

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'muodybot-noise-'));
    const tempFile = path.join(tempDir, getSafeNoiseFilename(noiseFile));
    await writeFile(tempFile, audioBuffer);

    return {
      args: ['-i', tempFile],
      cleanup: () => rm(tempDir, { recursive: true, force: true }),
    };
  } catch (error) {
    if (!signal?.aborted) {
      console.error(`Failed to fetch join noise ${noiseFile.name}:`, error);
    }

    return null;
  }
}

async function pickRandomNoise() {
  const cmsNoise = await pickRandomSanityVoiceNoise();

  if (cmsNoise) {
    return cmsNoise;
  }

  const localNoiseFile = await pickRandomNoiseFile();
  return localNoiseFile
    ? {
        url: localNoiseFile,
        name: path.basename(localNoiseFile),
      }
    : null;
}

async function getAvailableVoiceNoises() {
  const [sanityNoises, localNoiseFiles] = await Promise.all([
    getSanityVoiceNoises(),
    getLocalNoiseFiles(),
  ]);

  return [
    ...sanityNoises.map((noise) => {
      const name = noise.title || noise.originalFilename || noise.url;

      return {
        url: noise.url,
        name,
        matchNames: [
          name,
          noise.title,
          noise.originalFilename,
          stripExtension(noise.originalFilename),
        ].filter(Boolean),
      };
    }),
    ...localNoiseFiles.map((file) => {
      const basename = path.basename(file);

      return {
        url: file,
        name: basename,
        matchNames: [basename, stripExtension(basename)],
      };
    }),
  ];
}

async function pickRandomSanityVoiceNoise() {
  const noises = await getSanityVoiceNoises();

  if (noises.length === 0) {
    return null;
  }

  const noise = weightedPick(noises);
  return {
    url: noise.url,
    name: noise.title || noise.originalFilename || noise.url,
  };
}

async function pickRandomNoiseFile() {
  const files = await getLocalNoiseFiles();
  return files.length > 0 ? pick(files) : null;
}

async function getLocalNoiseFiles() {
  const noiseDir = path.resolve(config.voiceNoiseDir);
  const supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm']);

  try {
    const entries = await readdir(noiseDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(noiseDir, entry.name));

    return files;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to read join noise directory ${noiseDir}:`, error);
    }

    return [];
  }
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

function getSafeNoiseFilename(noiseFile) {
  const fallbackExtension = getExtensionFromUrl(noiseFile.url) || '.m4a';
  const parsedName = path.parse(noiseFile.name || 'join-noise');
  const safeName = (parsedName.name || 'join-noise')
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  const extension = parsedName.ext || fallbackExtension;
  return `${safeName || 'join-noise'}${extension}`;
}

function getExtensionFromUrl(url) {
  try {
    const extension = path.extname(new URL(url).pathname);
    return extension || null;
  } catch {
    return null;
  }
}

function getNoiseFetchHeaders(url) {
  if (config.sanityToken && isSanityUrl(url)) {
    return {
      Authorization: `Bearer ${config.sanityToken}`,
    };
  }

  return {};
}

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSanityUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.sanity.io');
  } catch {
    return false;
  }
}

function normalizeNoiseName(name) {
  return String(name || '').trim().toLowerCase();
}

function stripExtension(filename) {
  return filename ? filename.slice(0, filename.length - path.extname(filename).length) : filename;
}
