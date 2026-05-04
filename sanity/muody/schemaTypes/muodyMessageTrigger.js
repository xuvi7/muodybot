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
      title: 'Legacy response type',
      type: 'string',
      initialValue: 'responses',
      description: 'Older single-response mode. Prefer Responses for new triggers.',
      options: {
        list: [
          { title: 'Custom responses', value: 'responses' },
          { title: 'Random chat reply', value: 'randomReply' },
          { title: 'Random GIF', value: 'randomGif' },
          { title: 'Roblox game suggestion', value: 'robloxSuggestion' },
        ],
        layout: 'radio',
      },
      hidden: ({ parent }) => hasResponseActions(parent),
    },
    {
      name: 'responseActions',
      title: 'Responses',
      description: 'Add one or more possible responses. The bot picks one randomly using Random weight.',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'type',
              title: 'Type',
              type: 'string',
              initialValue: 'text',
              options: {
                list: [
                  { title: 'Text', value: 'text' },
                  { title: 'Image, GIF, or video', value: 'media' },
                  { title: 'Random text reply', value: 'randomTextReply' },
                  { title: 'Random Muody', value: 'randomMuody' },
                  { title: 'Random GIF', value: 'randomGif' },
                  { title: 'Roblox game suggestion', value: 'robloxSuggestion' },
                ],
                layout: 'radio',
              },
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'text',
              title: 'Text',
              type: 'text',
              rows: 3,
              hidden: ({ parent }) => parent?.type !== 'text',
            },
            {
              name: 'image',
              title: 'Image or GIF',
              type: 'image',
              options: {
                hotspot: true,
              },
              hidden: ({ parent }) => parent?.type !== 'media',
            },
            {
              name: 'file',
              title: 'Video or GIF file',
              type: 'file',
              options: {
                accept: 'image/gif,video/*',
              },
              hidden: ({ parent }) => parent?.type !== 'media',
            },
            {
              name: 'altText',
              title: 'Alt text',
              type: 'string',
              hidden: ({ parent }) => parent?.type !== 'media',
            },
            {
              name: 'gifPrompt',
              title: 'GIF prompt',
              description: 'Search prompt used when this response sends a random GIF.',
              type: 'string',
              hidden: ({ parent }) => parent?.type !== 'randomGif',
            },
            {
              name: 'weight',
              title: 'Random weight',
              type: 'number',
              initialValue: 1,
              validation: (Rule) => Rule.min(0),
            },
          ],
          validation: (Rule) => Rule.custom(validateResponseAction),
          preview: {
            select: {
              type: 'type',
              text: 'text',
              title: 'title',
              altText: 'altText',
              gifPrompt: 'gifPrompt',
              weight: 'weight',
              media: 'image',
            },
            prepare({ type, text, title, altText, gifPrompt, weight, media }) {
              return {
                title: title || getResponseActionPreviewTitle(type, text, gifPrompt),
                subtitle: getResponseActionPreviewSubtitle(type, altText, weight),
                media,
              };
            },
          },
        },
      ],
      validation: (Rule) => Rule.custom((value, context) => {
        if (value?.length || hasLegacyResponse(context?.document)) {
          return true;
        }

        return 'Add at least one response.';
      }),
    },
    {
      name: 'gifPrompt',
      title: 'GIF prompt',
      description: 'Search prompt used when this trigger sends a random GIF.',
      type: 'string',
      hidden: ({ parent }) => hasResponseActions(parent) || parent?.responseType !== 'randomGif',
      validation: (Rule) => Rule.custom((value, context) => (
        !hasResponseActions(context?.parent) && context?.parent?.responseType === 'randomGif' && !value?.trim()
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
      hidden: ({ parent }) => hasResponseActions(parent) || !isCustomResponseType(parent?.responseType),
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
      hidden: ({ parent }) => hasResponseActions(parent) || !isCustomResponseType(parent?.responseType),
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
    if (hasResponseActions(document)) {
      return true;
    }

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

function hasResponseActions(document) {
  return Array.isArray(document?.responseActions) && document.responseActions.length > 0;
}

function hasLegacyResponse(document) {
  if (document?.responseType === 'randomGif') {
    return Boolean(document?.gifPrompt?.trim());
  }

  if (['randomReply', 'robloxSuggestion'].includes(document?.responseType)) {
    return true;
  }

  return Boolean(document?.responseTexts?.length || document?.responseMedia?.length);
}

function validateResponseAction(value) {
  if (value?.type === 'text') {
    return value?.text?.trim() ? true : 'Add response text.';
  }

  if (value?.type === 'media') {
    return value?.image || value?.file ? true : 'Upload an image, GIF, or video.';
  }

  if (value?.type === 'randomGif') {
    return value?.gifPrompt?.trim() ? true : 'Add a GIF prompt.';
  }

  if (['randomReply', 'randomTextReply', 'randomMuody', 'robloxSuggestion'].includes(value?.type)) {
    return true;
  }

  return 'Choose a response type.';
}

function getResponseActionPreviewTitle(type, text, gifPrompt) {
  if (type === 'text') {
    return text || 'Text response';
  }

  if (type === 'randomGif') {
    return gifPrompt ? `Random GIF: ${gifPrompt}` : 'Random GIF';
  }

  return getResponseActionTypeTitle(type);
}

function getResponseActionTypeTitle(type) {
  if (type === 'media') {
    return 'Image, GIF, or video';
  }

  if (type === 'randomGif') {
    return 'Random GIF';
  }

  if (type === 'randomReply') {
    return 'Random chat reply';
  }

  if (type === 'randomTextReply') {
    return 'Random text reply';
  }

  if (type === 'randomMuody') {
    return 'Random Muody';
  }

  if (type === 'robloxSuggestion') {
    return 'Roblox game suggestion';
  }

  return 'Text';
}

function getResponseActionPreviewSubtitle(type, altText, weight) {
  const details = altText || getResponseActionTypeTitle(type);
  const normalizedWeight = Number.isFinite(Number(weight)) ? weight : 1;
  return `${details} | Weight: ${normalizedWeight}`;
}

function isCustomResponseType(responseType) {
  return ['responses', 'text', 'media'].includes(responseType);
}
