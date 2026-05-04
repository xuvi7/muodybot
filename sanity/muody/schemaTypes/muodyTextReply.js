export default {
  name: 'muodyTextReply',
  title: 'Text Reply',
  type: 'document',
  fields: [
    {
      name: 'text',
      title: 'Text',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'weight',
      title: 'Random weight',
      type: 'number',
      initialValue: 1,
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
    },
  ],
  preview: {
    select: {
      title: 'text',
    },
  },
};
