# Muodybot

A Discord bot that:

- randomly joins a voice channel between 11 PM and 3 AM when people are in voice
- plays a random noise from `assets/noises` when it joins voice
- randomly responds to chat messages with `yay`, `ok`, `or`, or `nope`
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

## Join noises

Put sound files in `assets/noises`, for example:

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
