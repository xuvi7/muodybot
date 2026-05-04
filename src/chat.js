import { config } from './config.js';
import { getSanityMuodies, getSanityTextReplies } from './sanity.js';
import { pick, weightedPick } from './utils.js';

export async function sendChatReply(message, response) {
  const payload = formatDiscordReply(response);

  try {
    await message.reply(payload);
  } catch (error) {
    console.error('Failed to reply to message, trying normal channel send:', error);
    await message.channel.send(payload).catch((sendError) => {
      console.error('Failed to send message to channel:', sendError);
    });
  }
}

export function formatDiscordReply(response) {
  if (typeof response === 'string') {
    return response;
  }

  if (response?.type === 'gif' && response.url) {
    return response.url;
  }

  if (response?.type === 'muody' && response.url) {
    if (isVideoResponse(response)) {
      return response.url;
    }

    return {
      embeds: [
        {
          image: {
            url: response.url,
          },
        },
      ],
    };
  }

  return pick(config.randomReplies);
}

export async function pickRandomChatResponse() {
  const [textReplies, muodies] = await Promise.all([
    getSanityTextReplies(),
    getSanityMuodies(),
  ]);
  const responses = [
    ...textReplies.map((reply) => ({ ...reply, type: 'text' })),
    ...muodies.map((muody) => ({ ...muody, type: 'muody' })),
  ];

  if (responses.length === 0) {
    return pick(config.randomReplies);
  }

  const response = weightedPick(responses);
  return response.type === 'text' ? response.text : response;
}

export async function pickRandomTextReply() {
  const textReplies = await getSanityTextReplies();

  if (textReplies.length === 0) {
    return pick(config.randomReplies);
  }

  return weightedPick(textReplies).text;
}

export async function pickRandomMuody() {
  const muodies = await getSanityMuodies();
  return muodies.length > 0 ? { ...weightedPick(muodies), type: 'muody' } : null;
}

function isVideoResponse(response) {
  return response.mimeType?.startsWith('video/');
}
