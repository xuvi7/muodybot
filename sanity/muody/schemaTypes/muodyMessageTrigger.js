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
      initialValue: 'responses',
      options: {
        list: [
          { title: 'Custom responses', value: 'responses' },
          { title: 'Random chat reply', value: 'randomReply' },
          { title: 'Random GIF', value: 'randomGif' },
          { title: 'Roblox game suggestion', value: 'robloxSuggestion' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'gifPrompt',
      title: 'GIF prompt',
      description: 'Search prompt used when this trigger sends a random GIF.',
      type: 'string',
      hidden: ({ parent }) => parent?.responseType !== 'randomGif',
      validation: (Rule) => Rule.custom((value, context) => (
        context?.parent?.responseType === 'randomGif' && !value?.trim()
          ? 'Add a GIF prompt.'
          : true
      )),
    },
    {
      name: 'responseTexts',
      title: 'Response texts',
      description: 'One or more text responses. The bot picks one randomly.',
      type: 'array',
      of: [{ type: 'string' }],
      hidden: ({ parent }) => !isCustomResponseType(parent?.responseType),
    },
    {
      name: 'responseMedia',
      title: 'Response media',
      description: 'One or more images, GIFs, or videos. The bot picks one randomly.',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'title',
              title: 'Title',
              type: 'string',
            },
            {
              name: 'image',
              title: 'Image or GIF',
              type: 'image',
              options: {
                hotspot: true,
              },
            },
            {
              name: 'file',
              title: 'Video or GIF file',
              type: 'file',
              options: {
                accept: 'image/gif,video/*',
              },
            },
            {
              name: 'altText',
              title: 'Alt text',
              type: 'string',
            },
            {
              name: 'weight',
              title: 'Random weight',
              type: 'number',
              initialValue: 1,
              validation: (Rule) => Rule.min(0),
            },
          ],
          validation: (Rule) => Rule.custom((value) => (
            value?.image || value?.file
              ? true
              : 'Upload an image, GIF, or video.'
          )),
          preview: {
            select: {
              title: 'title',
              subtitle: 'altText',
              media: 'image',
            },
            prepare({ title, subtitle, media }) {
              return {
                title: title || 'Untitled media response',
                subtitle,
                media,
              };
            },
          },
        },
      ],
      hidden: ({ parent }) => !isCustomResponseType(parent?.responseType),
    },
    {
      name: 'priority',
      title: 'Priority',
      description: 'Higher priority triggers win when multiple triggers match the same message. Same-priority matches are picked randomly using Random weight.',
      type: 'number',
      initialValue: 0,
      validation: (Rule) => Rule.integer(),
    },
    {
      name: 'weight',
      title: 'Random weight',
      description: 'Used when more than one same-priority trigger matches the same message.',
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
  validation: (Rule) => Rule.custom((document) => {
    if (document?.responseType === 'randomGif') {
      return document?.gifPrompt?.trim() ? true : 'Add a GIF prompt.';
    }

    if (!isCustomResponseType(document?.responseType)) {
      return true;
    }

    return document?.responseTexts?.length || document?.responseMedia?.length
      ? true
      : 'Add at least one text or media response.';
  }),
};

function isCustomResponseType(responseType) {
  return ['responses', 'text', 'media'].includes(responseType);
}
