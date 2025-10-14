# Nostria Notification Service

A notification service daemon for Nostr that monitors relay events and sends push notifications to users.

## Overview

This service runs as a background daemon that:
1. Queries the Nostria API for registered users
2. Discovers each user's relays (kind 10002 events)
3. Monitors those relays for relevant events (follows, mentions, reactions, etc.)
4. Sends push notifications via the Nostria API when events occur

## Features

- **Automatic Relay Discovery**: Queries user's kind 10002 events to find their relay preferences
- **Event Monitoring**: Checks for new follows (kind 3), with support for more event types coming
- **Batch Processing**: Processes users in batches to avoid overwhelming the system
- **Relay Caching**: Caches user relay lists to minimize redundant queries
- **Configurable Intervals**: Check frequency can be adjusted via environment variables

## Architecture

The service consists of:
- **REST API**: Provides endpoints for sending notifications and checking status
- **Notification Daemon**: Background service that polls relays on intervals
- **Notification Service**: Handles communication with the external Nostria API
- **Web Push Utilities**: Manages web push notifications

## Configuration

Environment variables:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `ENABLE_DAEMON`: Enable/disable the notification daemon (default: true)
- `NOSTRIA_API_URL`: URL of the main Nostria API (default: http://localhost:3001)
- `NOSTRIA_API_KEY`: API key for authenticating with the main Nostria API

**Note**: This service does NOT need VAPID keys. The main Nostria service handles all web push operations. This notification service only monitors Nostr relays and calls the main service's `/api/notification/send` endpoint.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

## API Endpoints

### `POST /api/notification/send`
Send notifications to users (requires API key authentication)

### `GET /api/status`
Check service health and status

### `GET /docs`
View API documentation (Swagger UI)

## Notification Types

Currently supported:
- **New Followers**: When someone adds the user to their kind 3 follow list

Coming soon:
- Mentions (kind 1)
- Replies (kind 1 with 'e' tag)
- Reactions (kind 7)
- Zaps (kind 9735)
- Direct Messages (kind 4)

## Development Notes

- The service uses `nostr-tools` for Nostr protocol operations
- Relay queries are optimized by selecting 1-2 relays per user
- The daemon checks for new events every 5 minutes by default
- User relay lists are cached for 30 minutes to reduce queries

## License

MIT
