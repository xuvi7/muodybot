import { REST, Routes, SlashCommandBuilder } from 'discord.js';

import { config, token } from './config.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Make Muody join the current voice channel')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('playnoise')
    .setDescription('Join your current voice channel and play a specific Muody noise')
    .addStringOption((option) =>
      option
        .setName('clip')
        .setDescription('The voice noise title or filename to play')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('reply')
    .setDescription('Send a random Muody reply without waiting for random chance')
    .toJSON(),
];

export async function registerCommands(client) {
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
