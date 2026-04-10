# mon-bot-discord

A Discord bot built with Node.js and discord.js that manages a community server.

## Features

- **XP & Leveling System**: Members earn XP by sending messages (1-minute cooldown) and participating in voice channels (every 5 minutes)
- **Automated Role Management**: Assigns monkey-themed roles based on user level (e.g., "Bébé Singe", "Roi des Singes")
- **Moderation Tools**: Admin commands: `!kick`, `!ban`, `!mute`, `!givexp`, `!removexp`
- **Ticket System**: Button-based support ticket creation via `!setup-ticket`
- **Welcome System**: Greets new members and assigns initial roles
- **Data Persistence**: User XP/levels stored in `xp_data.json`

## Tech Stack

- **Runtime**: Node.js 20
- **Library**: discord.js v14
- **Config**: dotenv
- **Storage**: Flat-file JSON (`xp_data.json`)

## Project Structure

```
index.js        # Main bot entry point (client setup, event listeners, commands)
xp.js           # XP calculation, leveling logic, data I/O
xp_data.json    # Local database for user XP and levels
package.json    # Dependencies and project metadata
```

## Environment Variables

- `DISCORD_TOKEN` (secret) — Discord bot token from the Developer Portal

## Running

The bot starts automatically via the "Start application" workflow:

```
node index.js
```

## Commands

| Command | Description | Permission |
|---|---|---|
| `!bonjour` | Greet the bot | Everyone |
| `!aide` | Show help embed | Everyone |
| `!rang [@user]` | Show XP rank | Everyone |
| `!classement` | Show server leaderboard | Everyone |
| `!kick @user` | Kick a member | Kick Members |
| `!ban @user` | Ban a member | Ban Members |
| `!mute @user` | Mute for 10 minutes | Moderate Members |
| `!givexp @user [amount]` | Give XP to a user | Administrator |
| `!removexp @user [amount]` | Remove XP from a user | Administrator |
| `!setup-ticket` | Set up ticket panel | Administrator |
