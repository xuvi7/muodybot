import muodyBotSettings from './muodyBotSettings.js';
import muody from './muody.js';
import muodyMessageTrigger from './muodyMessageTrigger.js';
import muodyTextReply from './muodyTextReply.js';
import muodyVoiceNoise from './muodyVoiceNoise.js';

export const schemaTypes = [
  muody,
  muodyTextReply,
  muodyVoiceNoise,
  muodyMessageTrigger,
  muodyBotSettings,
];
