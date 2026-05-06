import { ChannelType, REST, Routes, SlashCommandBuilder } from 'discord.js';

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
  new SlashCommandBuilder()
    .setName('muody')
    .setDescription('Privileged Muody controls')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('say')
        .setDescription('Send a specific message as Muody')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel to send the message to')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.AnnouncementThread,
            )
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('The message to send')
            .setMaxLength(2000)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reply-to')
        .setDescription('Reply to a specific message as Muody')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('The message ID or Discord message link to reply to')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('The reply message to send')
            .setMaxLength(2000)
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Needed only when target is a bare message ID from another channel')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.AnnouncementThread,
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-reply-chance')
        .setDescription('Change the random chat reply frequency until the bot restarts')
        .addNumberOption((option) =>
          option
            .setName('chance')
            .setDescription('Chance from 0 to 1, e.g. 0.08 for 8%')
            .setMinValue(0)
            .setMaxValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('schedule-join')
        .setDescription('Schedule Muody to join a specific voice channel once')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The voice channel to join')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('when')
            .setDescription('ISO time, YYYY-MM-DD HH:mm, today HH:mm, tomorrow HH:mm, or +10m')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('clip')
            .setDescription('Optional voice noise title or filename to play once')
            .setAutocomplete(true),
        ),
    )
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
