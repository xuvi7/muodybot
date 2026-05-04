export default {
  name: 'muody',
  title: 'Muody',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required(),
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
      subtitle: 'altText',
      media: 'image',
    },
  },
};
