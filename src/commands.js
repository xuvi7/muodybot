import { ChannelType, REST, Routes, SlashCommandBuilder } from 'discord.js';

import { config, token } from './config.js';

const textChannelTypes = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
];

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
        .setDescription('Persistently change the default random chat reply frequency')
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
        .setName('channel-settings')
        .setDescription('Show persistent Muody settings for a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel or thread to inspect')
            .addChannelTypes(...textChannelTypes),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-channel-random')
        .setDescription('Enable or disable random chat replies in one channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel or thread to update')
            .addChannelTypes(...textChannelTypes)
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether random chat replies should run in this channel')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-channel-triggers')
        .setDescription('Enable or disable message triggers in one channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel or thread to update')
            .addChannelTypes(...textChannelTypes)
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether message triggers should run in this channel')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-channel-chance')
        .setDescription('Set the random chat reply chance for one channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel or thread to update')
            .addChannelTypes(...textChannelTypes)
            .setRequired(true),
        )
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
        .setName('clear-channel-settings')
        .setDescription('Remove persistent Muody overrides for one channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The text channel or thread to reset')
            .addChannelTypes(...textChannelTypes)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('Show Muody usage stats')
        .addIntegerOption((option) =>
          option
            .setName('days')
            .setDescription('Number of recent days to include')
            .setMinValue(1)
            .setMaxValue(365),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('flush-stats')
        .setDescription('Flush queued Muody usage stats to Sanity now'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cache-status')
        .setDescription('Show Sanity cache status and next reset time'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset-cache')
        .setDescription('Clear cached Sanity content immediately'),
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
