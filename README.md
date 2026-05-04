# Muodybot

A Discord bot that:

- randomly joins a voice channel between 11 PM and 3 AM when people are in voice
- plays random voice noises from Sanity, falling back to `assets/noises`, until its randomized stay time is up
- randomly responds to chat messages with Sanity text replies or image `muodies`, falling back to `yay`, `ok`, `or`, or `nope`
- sends an immediate random reply with `/reply`
- joins your current voice channel and plays a selected voice noise with `/playnoise`
- suggests a random trending Roblox game when someone says `roblox`

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

- `/reply`: sends a random Sanity text reply or muody image immediately, without waiting for `RANDOM_REPLY_CHANCE`.
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

The bot uses `SANITY_TOKEN` for private audio files too. Without it, text and image queries may still work in some setups, but voice noises can fail when ffmpeg tries to read the protected file URL.

The bot queries three document types:

- `muodyTextReply`: text responses for random chat replies
- `muody`: image responses, called muodies
- `muodyVoiceNoise`: audio files for voice joins

The optional `weight` field controls how often an item is picked relative to other enabled items. If Sanity is not configured, empty, or temporarily unavailable, the bot keeps using `RANDOM_REPLIES` and local files in `assets/noises`.

### Editing Sanity content

Start the Studio:

```bash
cd sanity/muody
npm run dev
```

Open the local Studio URL it prints, usually `http://localhost:3333`.

In Studio, create or edit these documents:

- **Text Reply**: set `text`, keep `enabled` on, and publish.
- **Muody**: upload an `image`, keep `enabled` on, and publish. The bot posts only the image, without the title or alt text.
- **Voice Noise**: upload an audio `file`, keep `enabled` on, and publish.

Use `weight` when one item should appear more often. For example, an item with `weight` set to `3` is three times as likely as an item with `weight` set to `1`.

To verify content from Studio, open the **Vision** tab and run:

```groq
*[_type == "muodyTextReply" && enabled != false && defined(text)]{text, weight}
```

For image replies:

```groq
*[_type == "muody" && enabled != false && defined(image.asset->url)]{title, "url": image.asset->url, weight}
```

For voice noises:

```groq
*[_type == "muodyVoiceNoise" && enabled != false && defined(file.asset->url)]{title, "url": file.asset->url, weight}
```

After publishing changes, restart the bot or wait up to `SANITY_CACHE_SECONDS` for the bot cache to refresh.

## Join noises

Sanity `muodyVoiceNoise` documents are preferred. For local fallback, put sound files in `assets/noises`, for example:

```text
assets/noises/bruh.mp3
assets/noises/yippee.wav
assets/noises/metal-pipe.ogg
```

Supported extensions are `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, and `.webm`.

For fast voice testing, set this in `.env` and restart the bot:

```text
VOICE_TEST_DELAY_SECONDS=10
```

Set it back to `0` when you want normal 11 PM to 3 AM scheduling.

Voice visits choose a random stay length and random pauses between clips. Set these in `.env` to tune the behavior:

```text
VOICE_STAY_MIN_MINUTES=4
VOICE_STAY_MAX_MINUTES=8
VOICE_PAUSE_MIN_SECONDS=8
VOICE_PAUSE_MAX_SECONDS=45
```

`VOICE_STAY_MINUTES` is still supported as a fixed-length fallback when the min/max values are not set.
