# Telegram Focus Bot MVP

A Telegram bot that tracks focus time and estimation accuracy using natural language processing.

## Features

- **Natural Language Processing**: Uses Claude API to parse messages naturally
- **Task Tracking**: Automatically detects task starts and completions
- **Estimation Accuracy**: Calculates and tracks estimation vs. actual time
- **Daily Summaries**: Automated daily reports with accuracy leaderboards
- **Serverless**: Deploys on Vercel with KV storage

## Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo-url>
   cd telegram-focus-bot
   npm install
   ```

2. **Create a Telegram Bot**:
   - Message @BotFather on Telegram
   - Use `/newbot` command to create a new bot
   - Save the bot token

3. **Get your Chat ID**:
   - Add your bot to a group or message it directly
   - Send a message to the bot
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

4. **Set up Anthropic API**:
   - Create account at https://console.anthropic.com
   - Get your API key

5. **Environment Variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your tokens and chat ID

6. **Deploy to Vercel**:
   ```bash
   npm run deploy
   ```

7. **Set up Webhook**:
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-vercel-app.vercel.app/api/webhook"}'
   ```

## Usage

The bot recognizes natural language messages:

- **Starting tasks**: "30 mins: fix the login bug", "gonna work on emails for an hour"
- **Completing tasks**: "done in 45 minutes", "finished that task, took 20 mins"

## Development

```bash
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from BotFather |
| `CHAT_ID` | Your Telegram chat/group ID |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |