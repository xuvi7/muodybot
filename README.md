# Muodybot

A Discord bot that:

- randomly joins a voice channel between 11 PM and 3 AM when people are in voice
- plays random voice noises from Sanity, falling back to `assets/noises`, until its randomized stay time is up
- randomly responds to chat messages with Sanity text replies or image `muodies`, falling back to `yay`, `ok`, `or`, or `nope`
- sends an immediate random reply with `/reply`
- joins your current voice channel and plays a selected voice noise with `/playnoise`
- responds to Sanity-managed message triggers, including Roblox game suggestions

## Setup

1. Install Node.js 18 or newer.
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

- `/reply`: sends a random Sanity text reply or muody media item immediately, without waiting for `RANDOM_REPLY_CHANCE`.
- `/join`: tests joining your current voice channel and playing voice noises.
- `/playnoise clip:<name>`: joins your current voice channel, plays the selected Sanity or local voice noise once, then leaves. The `clip` option autocompletes from available voice noise titles and filenames.

## Sanity CMS assets

This repo includes a Sanity Studio in `sanity/muody`. Use that Studio to add or edit the bot's CMS content.

Set these in `.env` to read bot assets from Sanity:

```text
SANITY_PROJECT_ID=me88yh3c
SANITY_DATASET=production
SANITY_API_VERSION=2025-01-01
SANITY_USE_CDN=true
```

If your dataset is private, also set:

```text
SANITY_TOKEN=your-read-token
```

The bot uses `SANITY_TOKEN` for private files too. Without it, text and image queries may still work in some setups, but private audio, video, and GIF files can fail when Discord or ffmpeg tries to read the protected file URL.

The bot queries four document types:

- `muodyTextReply`: text responses for random chat replies
- `muody`: image, GIF, or video responses, called muodies
- `muodyVoiceNoise`: audio files for voice joins
- `muodyMessageTrigger`: custom message triggers and their response actions

The optional `weight` field controls how often an item is picked relative to other enabled items. For message triggers, `priority` is checked first; `weight` is only used when more than one same-priority trigger matches the same message. If Sanity is not configured, empty, or temporarily unavailable, the bot keeps using `RANDOM_REPLIES`, local files in `assets/noises`, and a built-in Roblox trigger fallback.

Random GIF trigger responses use Klipy. Set this in `.env`:

```text
KLIPY_API_KEY=your-klipy-api-key
KLIPY_CLIENT_KEY=muodybot
GIF_RESULT_LIMIT=25
GIF_CONTENT_FILTER=off
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

After publishing changes, restart the bot or wait up to `SANITY_CACHE_SECONDS` for the bot cache to refresh.

## Join noises

Sanity `muodyVoiceNoise` documents are preferred. For local fallback, put sound files in `assets/noises`.

Supported extensions are `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, and `.webm`.

For fast voice testing, set this in `.env` and restart the bot:

```text
VOICE_TEST_DELAY_SECONDS=10
```

Set it back to `0` when you want normal 11 PM to 3 AM scheduling.

Voice visits choose a random stay length and random pauses between clips. Set these in `.env` to tune the behavior:

```text
VOICE_STAY_MIN_MINUTES=1
VOICE_STAY_MAX_MINUTES=5
VOICE_PAUSE_MIN_SECONDS=8
VOICE_PAUSE_MAX_SECONDS=45
```

`VOICE_STAY_MINUTES` is still supported as a fixed-length fallback when the min/max values are not set.
