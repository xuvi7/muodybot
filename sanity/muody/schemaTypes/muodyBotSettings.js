export default {
  name: 'muodyBotSettings',
  title: 'Bot Settings',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      initialValue: 'Muody Bot Settings',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'defaultRandomReplyChance',
      title: 'Default random reply chance',
      description: 'Chance from 0 to 1. For example, 0.08 means 8%.',
      type: 'number',
      validation: (Rule) => Rule.min(0).max(1),
    },
    {
      name: 'randomReplies',
      title: 'Fallback random replies',
      description: 'Used when Sanity text replies and muodies are empty or unavailable.',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'gifResultLimit',
      title: 'GIF result limit',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(50),
    },
    {
      name: 'gifContentFilter',
      title: 'GIF content filter',
      type: 'string',
    },
    {
      name: 'timeZone',
      title: 'Time zone',
      type: 'string',
    },
    {
      name: 'voiceJoinStartHour',
      title: 'Voice join start hour',
      description: '24-hour local hour, from 0 to 23.',
      type: 'number',
      validation: (Rule) => Rule.integer().min(0).max(23),
    },
    {
      name: 'voiceJoinEndHour',
      title: 'Voice join end hour',
      description: '24-hour local hour, from 0 to 23.',
      type: 'number',
      validation: (Rule) => Rule.integer().min(0).max(23),
    },
    {
      name: 'voiceStayMinMinutes',
      title: 'Voice stay minimum minutes',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'voiceStayMaxMinutes',
      title: 'Voice stay maximum minutes',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'voicePauseMinSeconds',
      title: 'Voice pause minimum seconds',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'voicePauseMaxSeconds',
      title: 'Voice pause maximum seconds',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'voiceNoiseDir',
      title: 'Local voice noise directory',
      type: 'string',
    },
    {
      name: 'voiceRandomJoinEnabled',
      title: 'Random voice joins enabled',
      type: 'boolean',
    },
    {
      name: 'voiceMaxVisitsPerNight',
      title: 'Voice max visits per night',
      type: 'number',
      validation: (Rule) => Rule.integer().min(0),
    },
    {
      name: 'voiceTestDelaySeconds',
      title: 'Voice test delay seconds',
      type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'robloxSuggestionCount',
      title: 'Roblox suggestion count',
      type: 'number',
      validation: (Rule) => Rule.integer().min(1),
    },
    {
      name: 'channelSettings',
      title: 'Channel settings',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'channelName',
              title: 'Channel name',
              type: 'string',
              readOnly: true,
            },
            {
              name: 'channelId',
              title: 'Discord channel ID',
              type: 'string',
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'randomRepliesEnabled',
              title: 'Random replies enabled',
              type: 'boolean',
              initialValue: true,
            },
            {
              name: 'messageTriggersEnabled',
              title: 'Message triggers enabled',
              type: 'boolean',
              initialValue: true,
            },
            {
              name: 'randomReplyChance',
              title: 'Channel random reply chance',
              description: 'Leave empty to use the default random reply chance.',
              type: 'number',
              validation: (Rule) => Rule.min(0).max(1),
            },
          ],
          preview: {
            select: {
              channelName: 'channelName',
              channelId: 'channelId',
              randomRepliesEnabled: 'randomRepliesEnabled',
              messageTriggersEnabled: 'messageTriggersEnabled',
              randomReplyChance: 'randomReplyChance',
            },
            prepare({
              channelName,
              channelId,
              randomRepliesEnabled,
              messageTriggersEnabled,
              randomReplyChance,
            }) {
              const randomReplyLabel = randomRepliesEnabled === false ? 'random off' : 'random on';
              const triggerLabel = messageTriggersEnabled === false ? 'triggers off' : 'triggers on';
              const chanceLabel = typeof randomReplyChance === 'number'
                ? `${formatPercent(randomReplyChance)} random chance`
                : 'default chance';

              return {
                title: channelName ? `#${channelName}` : channelId,
                subtitle: `${randomReplyLabel}, ${triggerLabel}, ${chanceLabel}`,
              };
            },
          },
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      defaultRandomReplyChance: 'defaultRandomReplyChance',
    },
    prepare({ title, defaultRandomReplyChance }) {
      return {
        title: title || 'Muody Bot Settings',
        subtitle: typeof defaultRandomReplyChance === 'number'
          ? `Default random chance: ${formatPercent(defaultRandomReplyChance)}`
          : 'Using built-in default',
      };
    },
  },
};

function formatPercent(value) {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}
