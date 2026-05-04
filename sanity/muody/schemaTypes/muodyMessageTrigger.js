export default {
  name: 'muodyMessageTrigger',
  title: 'Message Trigger',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'patterns',
      title: 'Trigger patterns',
      description: 'Words, phrases, or JavaScript regex patterns to match against message text.',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule) => Rule.required().min(1),
    },
    {
      name: 'matchType',
      title: 'Match type',
      type: 'string',
      initialValue: 'word',
      options: {
        list: [
          { title: 'Whole word or phrase', value: 'word' },
          { title: 'Contains text', value: 'contains' },
          { title: 'Regular expression', value: 'regex' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'responseType',
      title: 'Response type',
      type: 'string',
      initialValue: 'text',
      options: {
        list: [
          { title: 'Text response', value: 'text' },
          { title: 'Random chat reply', value: 'randomReply' },
          { title: 'Roblox game suggestion', value: 'robloxSuggestion' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'responseText',
      title: 'Response text',
      description: 'Used when Response type is Text response.',
      type: 'string',
      hidden: ({ parent }) => parent?.responseType !== 'text',
      validation: (Rule) => Rule.custom((value, context) => (
        context.parent?.responseType === 'text' && !value
          ? 'Response text is required for text triggers.'
          : true
      )),
    },
    {
      name: 'weight',
      title: 'Random weight',
      description: 'Used when more than one trigger matches the same message.',
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
      title: 'title',
      responseType: 'responseType',
      patterns: 'patterns',
    },
    prepare({ title, responseType, patterns }) {
      return {
        title: title || 'Untitled message trigger',
        subtitle: `${responseType || 'unknown'}: ${(patterns || []).join(', ')}`,
      };
    },
  },
};
