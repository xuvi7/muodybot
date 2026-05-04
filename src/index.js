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
} from './voice.js';
import { formatRobloxSuggestion, getRobloxSuggestions, shouldSuggestRoblox } from './roblox.js';
import { pick } from './utils.js';

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

  if (shouldSuggestRoblox(message.content)) {
    const suggestions = await getRobloxSuggestions(config.robloxSuggestionCount);
    await sendChatReply(message, formatRobloxSuggestion(pick(suggestions)));
    return;
  }

  if (Math.random() < config.randomReplyChance) {
    await sendChatReply(message, await pickRandomChatResponse());
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'playnoise') {
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

client.login(token);
