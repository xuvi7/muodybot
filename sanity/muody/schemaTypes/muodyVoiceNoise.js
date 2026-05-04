export default {
  name: 'muodyVoiceNoise',
  title: 'Voice Noise',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'file',
      title: 'Audio file',
      type: 'file',
      options: {
        accept: 'audio/*',
      },
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
      title: 'title',
      filename: 'file.asset.originalFilename',
    },
    prepare({ title, filename }) {
      return {
        title: title || filename || 'Untitled voice noise',
        subtitle: filename,
      };
    },
  },
};
