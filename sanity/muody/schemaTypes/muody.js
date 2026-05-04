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
    {
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
    },
  ],
  validation: (Rule) => Rule.custom((document) => (
    document.image || document.file
      ? true
      : 'Upload an image, GIF, or video.'
  )),
  preview: {
    select: {
      title: 'title',
      subtitle: 'altText',
      media: 'image',
    },
  },
};
