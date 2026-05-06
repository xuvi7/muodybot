export default {
  name: 'muodyUsageEvent',
  title: 'Usage Event',
  type: 'document',
  fields: [
    {
      name: 'eventType',
      title: 'Event type',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'createdAt',
      title: 'Created at',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'guildId',
      title: 'Guild ID',
      type: 'string',
    },
    {
      name: 'guildName',
      title: 'Guild name',
      type: 'string',
    },
    {
      name: 'channelId',
      title: 'Channel ID',
      type: 'string',
    },
    {
      name: 'channelName',
      title: 'Channel name',
      type: 'string',
    },
    {
      name: 'userId',
      title: 'User ID',
      type: 'string',
    },
    {
      name: 'username',
      title: 'Username',
      type: 'string',
    },
    {
      name: 'commandName',
      title: 'Command name',
      type: 'string',
    },
    {
      name: 'subcommandName',
      title: 'Subcommand name',
      type: 'string',
    },
    {
      name: 'triggerTitle',
      title: 'Trigger title',
      type: 'string',
    },
    {
      name: 'responseType',
      title: 'Response type',
      type: 'string',
    },
    {
      name: 'noiseName',
      title: 'Noise name',
      type: 'string',
    },
    {
      name: 'source',
      title: 'Source',
      type: 'string',
    },
  ],
  preview: {
    select: {
      eventType: 'eventType',
      createdAt: 'createdAt',
      username: 'username',
      channelName: 'channelName',
    },
    prepare({ eventType, createdAt, username, channelName }) {
      return {
        title: eventType || 'Usage event',
        subtitle: [username, channelName, createdAt].filter(Boolean).join(' - '),
      };
    },
  },
};
