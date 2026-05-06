# Muodybot

A Discord bot that:

- randomly joins a voice channel between 11 PM and 3 AM when people are in voice
- plays random voice noises from Sanity, falling back to `assets/noises`, until its randomized stay time is up
- randomly responds to chat messages with Sanity text replies or image `muodies`, falling back to `yay`, `ok`, `or`, or `nope`
- sends an immediate random reply with `/reply`
- joins your current voice channel and plays a selected voice noise with `/playnoise`
- exposes privileged controls for an allowlisted set of Discord users
- responds to Sanity-managed message triggers, including Roblox game suggestions
- stores persistent bot settings and per-channel controls in Sanity CMS

## Setup

1. Install Node.js 22.12 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`.
4. In the Discord developer portal, enable these bot intents:
   - Server Members Intent is not required
   - Message Content Intent is required for random chat replies
5. Invite the bot with these permissions:
   - Send Messages
   - Read Message History
   - Connect
   - Speak
   - Use Slash Commands

Run it:

```bash
npm start
```

If `GUILD_ID` is set in `.env`, slash commands register to that server when the bot starts.

## Commands

- `/reply`: sends a random Sanity text reply or muody media item immediately, without waiting for the configured random reply chance.
- `/join`: tests joining your current voice channel and playing voice noises.
- `/playnoise clip:<name>`: joins your current voice channel, plays the selected Sanity or local voice noise once, then leaves. The `clip` option autocompletes from available voice noise titles and filenames.

## Privileged controls

Set `PRIVILEGED_USER_IDS` to a comma-separated list of Discord user IDs that can use privileged commands:

```text
PRIVILEGED_USER_IDS=123456789012345678,234567890123456789
```

These slash commands are registered for everyone but only users in that allowlist can run them:

- `/muody say channel:<channel> message:<message>`: sends a specific message as the bot.
- `/muody reply-to target:<message-id-or-link> message:<message> [channel:<channel>]`: replies to a specific message as the bot. A full Discord message link includes the channel; use `channel` when `target` is only a message ID from another channel.
- `/muody set-reply-chance chance:<0-1>`: persistently changes the default random chat reply frequency in Sanity. For example, `0.08` means 8%.
- `/muody channel-settings [channel:<channel>]`: shows the effective random reply and trigger settings for a text channel or thread.
- `/muody set-channel-random channel:<channel> enabled:<true|false>`: enables or disables random chat replies in one channel.
- `/muody set-channel-triggers channel:<channel> enabled:<true|false>`: enables or disables Sanity message triggers in one channel.
- `/muody set-channel-chance channel:<channel> chance:<0-1>`: sets one channel's random chat reply frequency.
- `/muody clear-channel-settings channel:<channel>`: removes one channel's persistent overrides so it uses the default settings again.
- `/muody stats [days:<1-365>]`: shows usage stats, including top triggers, top noises, reply targets, command users, and commands.
- `/muody schedule-join channel:<voice-channel> when:<time> [clip:<name>]`: schedules one voice join. `when` accepts ISO timestamps, `YYYY-MM-DD HH:mm`, `today HH:mm`, `tomorrow HH:mm`, or relative values like `+10m` and `+1h`. Local times use the time zone from Bot Settings.

## Sanity CMS assets

This repo includes a Sanity Studio in `sanity/muody`. Use that Studio to add or edit the bot's CMS content.

Set this in `.env` to read bot assets and persistent settings from Sanity:

```text
SANITY_PROJECT_ID=me88yh3c
```

If your dataset is private or you want the bot to initialize and edit persistent settings, also set:

```text
SANITY_TOKEN=your-read-or-write-token
```

The bot uses `SANITY_TOKEN` for private files too. Without it, text and image queries may still work in some setups, but private audio, video, and GIF files can fail when Discord or ffmpeg tries to read the protected file URL. Persistent settings writes and usage stats recording require a token with Sanity write access.

The bot queries six document types:

- `muodyTextReply`: text responses for random chat replies
- `muody`: image, GIF, or video responses, called muodies
- `muodyVoiceNoise`: audio files for voice joins
- `muodyMessageTrigger`: custom message triggers and their response actions
- `muodyBotSettings`: persistent default and per-channel bot settings
- `muodyUsageEvent`: usage stats events for replies, triggers, noises, and commands

The optional `weight` field controls how often an item is picked relative to other enabled items. For message triggers, `priority` is checked first; `weight` is only used when more than one same-priority trigger matches the same message. If Sanity is not configured, empty, or temporarily unavailable, the bot keeps using built-in settings defaults, local files in `assets/noises`, and a built-in Roblox trigger fallback.

Random GIF trigger responses use Klipy. Set the API key and client key in `.env`; the result limit and content filter live in **Bot Settings**:

```text
KLIPY_API_KEY=your-klipy-api-key
KLIPY_CLIENT_KEY=muodybot
```

### Editing Sanity content

Start the Studio:

```bash
cd sanity/muody
npm run dev
```

Open the local Studio URL it prints, usually `http://localhost:3333`.

In Studio, create or edit these documents:

- **Text Reply**: set `text`, keep `enabled` on, and publish.
- **Muody**: upload an `image` or a video/GIF `file`, keep `enabled` on, and publish. The bot posts only the media, without the title or alt text.
- **Voice Noise**: upload an audio `file`, keep `enabled` on, and publish.
- **Message Trigger**: add one or more `patterns`, choose a `matchType`, add one or more `Responses`, keep `enabled` on, and publish.
- **Bot Settings**: usually managed by `/muody` privileged commands. You can also edit the default random reply chance, fallback replies, GIF options, voice behavior, Roblox suggestion count, and channel settings directly in Studio.

Use `priority` to decide which trigger wins when multiple triggers match the same message. Higher numbers win. If multiple matching triggers have the same highest priority, `weight` controls which one is picked. For example, an item with `weight` set to `3` is three times as likely as an item with `weight` set to `1`.

Message trigger response types can be mixed on the same trigger by adding multiple `Responses` rows:

- `Text`: sends the row's text.
- `Image, GIF, or video`: sends the uploaded media file.
- `Random text reply`: sends a random `muodyTextReply`.
- `Random Muody`: sends a random `muody` media item.
- `Random GIF`: searches Klipy with the row's `gifPrompt` and sends one random matching GIF.
- `Roblox game suggestion`: fetches a trending Roblox game and sends it.

Each response row has its own `Random weight`, so one trigger can choose between text, uploaded media, a random text reply, a random Muody, a Klipy GIF search, or a Roblox game suggestion.

To verify content from Studio, open the **Vision** tab and run:

```groq
*[_type == "muodyTextReply" && enabled != false && defined(text)]{text, weight}
```

For muody media replies:

```groq
*[_type == "muody" && enabled != false && (defined(image.asset->url) || defined(file.asset->url))]{title, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType), weight}
```

For voice noises:

```groq
*[_type == "muodyVoiceNoise" && enabled != false && defined(file.asset->url)]{title, "url": file.asset->url, weight}
```

For message triggers:

```groq
*[_type == "muodyMessageTrigger" && enabled != false && defined(patterns[0])]{title, patterns, matchType, responseActions[]{type, text, title, altText, weight, gifPrompt, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType)}, responseType, responseTexts, responseMedia[]{title, altText, weight, "url": coalesce(image.asset->url, file.asset->url), "mimeType": coalesce(image.asset->mimeType, file.asset->mimeType)}, gifPrompt, priority, weight}
```

For persistent bot settings:

```groq
*[_id == "muodyBotSettings"][0]{defaultRandomReplyChance, randomReplies, gifResultLimit, gifContentFilter, timeZone, voiceJoinStartHour, voiceJoinEndHour, voiceStayMinMinutes, voiceStayMaxMinutes, voicePauseMinSeconds, voicePauseMaxSeconds, voiceNoiseDir, voiceRandomJoinEnabled, voiceMaxVisitsPerNight, voiceTestDelaySeconds, robloxSuggestionCount, channelSettings}
```

After publishing changes, restart the bot or wait up to `SANITY_CACHE_SECONDS` for the bot cache to refresh.

## Join noises

Sanity `muodyVoiceNoise` documents are preferred. For local fallback, put sound files in `assets/noises`.

Supported extensions are `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, and `.webm`.

Voice visits choose a random stay length and random pauses between clips. Tune the voice window, visit length, pause length, maximum visits, local noise directory, and test delay in the Sanity **Bot Settings** document.

## TODO
- implement Discord mentions
