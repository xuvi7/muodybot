const counterArray = {
  type: 'array',
  of: [
    {
      type: 'object',
      fields: [
        {
          name: 'name',
          title: 'Name',
          type: 'string',
          validation: (Rule) => Rule.required(),
        },
        {
          name: 'count',
          title: 'Count',
          type: 'number',
          validation: (Rule) => Rule.integer().min(0),
        },
      ],
      preview: {
        select: {
          name: 'name',
          count: 'count',
        },
        prepare({ name, count }) {
          return {
            title: name,
            subtitle: `${count || 0}`,
          };
        },
      },
    },
  ],
};

export default {
  name: 'muodyUsageStats',
  title: 'Usage Stats',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      initialValue: 'Muody Usage Stats',
    },
    {
      name: 'totalEvents',
      title: 'Total events',
      type: 'number',
      validation: (Rule) => Rule.integer().min(0),
    },
    {
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
    },
    {
      ...counterArray,
      name: 'eventTypes',
      title: 'Event types',
    },
    {
      ...counterArray,
      name: 'triggers',
      title: 'Top triggers',
    },
    {
      ...counterArray,
      name: 'noises',
      title: 'Top noises',
    },
    {
      ...counterArray,
      name: 'replyTargets',
      title: 'Top reply targets',
    },
    {
      ...counterArray,
      name: 'commandUsers',
      title: 'Top command users',
    },
    {
      ...counterArray,
      name: 'commands',
      title: 'Top commands',
    },
  ],
  preview: {
    select: {
      title: 'title',
      totalEvents: 'totalEvents',
    },
    prepare({ title, totalEvents }) {
      return {
        title: title || 'Muody Usage Stats',
        subtitle: `${totalEvents || 0} event(s)`,
      };
    },
  },
};
