# Quick Start Guide

## Prerequisites

- Node.js 20 or higher
- npm
- Main Nostria API running (default: http://localhost:3001)
- Valid API key for the Nostria API

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# Daemon Configuration
ENABLE_DAEMON=true

# Main Nostria API Configuration
NOSTRIA_API_URL=http://localhost:3000
NOSTRIA_API_KEY=your-api-key-here
```

## Running the Service

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## Verification

After starting the service, you should see logs similar to:

```
[INFO] Notification service initialized with API URL: http://localhost:3000
[INFO] WebPush service initialized (delegates to main API)
[INFO] Server listening on port 3002
[INFO] Notification daemon started (checking every 300000ms / 5 minutes)
[INFO] Checking for new notifications...
[INFO] Fetching all user pubkeys from Nostria API
[INFO] Found 42 user pubkeys
[INFO] Processing user batch 1/5 (10 users)
```

## API Endpoints

### Health Check
```bash
GET http://localhost:3002/api/status
```

### Send Notification (requires API key)
```bash
POST http://localhost:3002/api/notification/send
Content-Type: application/json
X-API-Key: your-api-key

{
  "pubkeys": ["user-pubkey-hex"],
  "title": "Test Notification",
  "body": "This is a test",
  "url": "https://example.com"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Notification Service                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Notification Daemon (Background)            │  │
│  │                                                      │  │
│  │  Every 5 minutes:                                    │  │
│  │  1. Fetch users from /api/users                     │  │
│  │  2. Discover user relays (kind 10002)               │  │
│  │  3. Monitor relays for events                       │  │
│  │  4. Send notifications via main API                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Notification Service API                 │  │
│  │                                                      │  │
│  │  • GET /api/users (with X-API-Key)                  │  │
│  │  • POST /api/notification/send (with X-API-Key)     │  │
│  │  • GET /api/notification/status/:pubkey             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Main Nostria API                          │
│                                                              │
│  • /api/users (protected by apiKeyAuth)                     │
│  • /api/notification/send (protected by apiKeyAuth)         │
│  • Manages VAPID keys                                       │
│  • Sends actual push notifications to devices               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nostr Relays                            │
│                                                              │
│  • User relay lists (kind 10002)                            │
│  • Follow events (kind 3)                                   │
│  • Mentions, replies, reactions, zaps, DMs (future)         │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

1. **User Discovery**: The daemon calls `/api/users` to get all registered user pubkeys
2. **Relay Discovery**: For each user, queries Nostr relays for kind 10002 events (relay lists)
3. **Event Monitoring**: Connects to user relays and checks for new relevant events
4. **Notification Delivery**: When an event is found, calls `/api/notification/send` on the main API
5. **Push Notification**: Main API handles VAPID keys and sends push notifications to user devices

## Current Features

- ✅ User relay discovery (kind 10002)
- ✅ New follow notifications (kind 3)
- ✅ Batch processing (10 users at a time)
- ✅ Relay caching (30 minute TTL)
- ✅ Rate limiting and error handling

## Planned Features

- ⏳ Mention notifications (kind 1 with #p tag)
- ⏳ Reply notifications
- ⏳ Reaction notifications (kind 7)
- ⏳ Zap notifications (kind 9735)
- ⏳ Direct message notifications (kind 4)

## Troubleshooting

### "NOSTRIA_API_KEY not set"
- Ensure `.env` file exists in the root directory
- Verify the environment variable is set correctly
- tsx requires `--env-file=.env` flag (already configured in package.json)

### "Failed to fetch user list: 401"
- Check that your API key is valid
- Verify the main API is running and accessible
- Ensure the `/api/users` endpoint is protected by `apiKeyAuth` middleware

### "No users found"
- Check that users exist in the main API database
- Verify the API key has proper permissions
- Check main API logs for any errors

### Daemon not starting
- Check `ENABLE_DAEMON` is set to `true` in `.env`
- Review logs for any initialization errors
- Ensure no port conflicts (default: 3000)

## Documentation

- [README.md](README.md) - Complete service documentation
- [API_UPDATE_SUMMARY.md](API_UPDATE_SUMMARY.md) - Latest API integration changes
- [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) - Detailed implementation notes
- [.env.example](.env.example) - Environment variable template

## Development

### Run Tests
```bash
npm test
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs for error messages
3. Consult the detailed documentation files
4. Check the main API status and logs
