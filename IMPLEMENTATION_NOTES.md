# Nostria Notification Service - Cleanup and Implementation Summary

## Overview
This document summarizes the changes made to transform the nostria-notification repository from a copy of another service into a dedicated notification service daemon.

## Changes Made

### 1. Removed Old Dependencies and Routes
- **File: `src/index.ts`**
  - Removed database-related imports (`database/prismaClient`, `RepositoryFactory`)
  - Removed unused route imports (`account`, `subscription`, `key`, `payment`, `backup`, `settings`)
  - Removed database initialization functions
  - Kept only `notification` and `status` routes
  - Added notification daemon initialization

### 2. Simplified Models
Updated the following model files to remove database dependencies:
- **`src/models/notificationSettings.ts`** - Removed `CosmosDbEntity` dependency
- **`src/models/notificationSubscription.ts`** - Removed `CosmosDbEntity` dependency
- **`src/models/userSettings.ts`** - Removed `CosmosDbEntity` dependency and added `modified` field

### 3. Fixed Test Helper
- **File: `src/helpers/testHelper.ts`**
  - Removed `Payment` model import
  - Removed `testAccount` and `testPayment` functions
  - Updated NIP98 test URL to use `/api/notification`
  - Kept only essential helper functions

### 4. Fixed Test Files
- **File: `src/middleware/requireAdminAuth.test.ts`**
  - Removed `accountRepository` import
  - Simplified tests to focus on admin configuration
  - Removed database-dependent test cases

### 5. Created Notification Service
- **File: `src/services/notificationService.ts`** (NEW)
  - Stub service that communicates with external Nostria API
  - Methods for fetching user data, settings, and subscriptions
  - Methods for sending notifications
  - Proper TypeScript types and error handling

### 6. Created Notification Daemon
- **File: `src/services/notificationDaemon.ts`** (NEW)
  - Background daemon that runs on configurable intervals (default: 5 minutes)
  - Discovers user relays via kind 10002 events
  - Monitors relays for new events (currently: kind 3 follows)
  - Sends notifications via the Nostria API
  - Includes relay caching and batch processing optimizations

### 7. Fixed Route Issues
- **File: `src/routes/notification.ts`**
  - Updated import to use new notification service
  - Fixed `targetPubkeys` undefined errors with proper checks
  - Fixed subscription parsing (no longer needs JSON.parse)
  - Fixed device key references (use `deviceKey` instead of `rowKey`)

### 8. Updated WebPush Utilities
- **File: `src/utils/webPush.ts`**
  - Updated import to use new notification service

### 9. Documentation Updates
- **File: `README.md`**
  - Comprehensive documentation of the service
  - Architecture overview
  - Configuration options
  - API endpoints
  - Development notes

- **File: `.env.example`**
  - Added `NOSTRIA_API_URL` configuration
  - Added `API_KEY` for authentication
  - Added `ENABLE_DAEMON` flag
  - Added VAPID keys documentation

## Architecture

### Service Components

```
┌─────────────────────────────────────────────┐
│         Nostria Notification Service        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   REST API   │      │ Notification    │ │
│  │              │      │ Daemon          │ │
│  │ - /send      │      │                 │ │
│  │ - /status    │      │ Runs every 5min │ │
│  └──────────────┘      └─────────────────┘ │
│         │                       │           │
│         │                       │           │
│         └───────────┬───────────┘           │
│                     │                       │
│         ┌───────────▼───────────┐           │
│         │ Notification Service  │           │
│         │                       │           │
│         │ - Calls Nostria API   │           │
│         │ - Fetches user data   │           │
│         │ - Sends notifications │           │
│         └───────────────────────┘           │
│                     │                       │
└─────────────────────┼───────────────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   External Nostria    │
          │   API (Main Service)  │
          │                       │
          │ - User management     │
          │ - Push subscriptions  │
          │ - Settings            │
          └───────────────────────┘
```

### Notification Flow

1. **Daemon Loop** (every 5 minutes):
   - Fetch all user pubkeys from Nostria API
   - For each user in batches:
     - Get user's relay list (kind 10002)
     - Query 1-2 relays for new events
     - Process events and send notifications

2. **Event Processing**:
   - Currently: Check for new follows (kind 3)
   - Future: Mentions, replies, reactions, zaps, DMs

3. **Notification Delivery**:
   - Send notification request to Nostria API
   - Nostria API handles actual push delivery to devices

## API Integration Points

The notification service communicates with the main Nostria API using these endpoints:

### Used by Notification Daemon:
- `POST /api/notification/send` - Send notifications to users (requires `X-API-Key` header)
  ```json
  {
    "pubkeys": ["hex-pubkey"],
    "title": "Notification Title",
    "body": "Notification body text",
    "icon": "https://...",
    "url": "https://..."
  }
  ```

- `GET /api/notification/status/{pubkey}` - Get notification status for rate limiting (requires `X-API-Key` header)
  - Returns: `hasSubscription`, `deviceCount`, `isPremium`, `settings`, `notifications` (count24h, dailyLimit, remaining)

### Not Yet Implemented (Future):
- An endpoint to get all user pubkeys for the daemon to monitor
- Currently `getAllUserPubkeys()` returns empty array

### Main Service Handles:
- VAPID key management
- Web push subscriptions
- Device registration
- Actual push notification delivery
- Rate limiting enforcement
- User preferences and filtering

### This Service Handles:
- Monitoring Nostr relays for events
- Discovering user relay lists (kind 10002)
- Detecting notification-worthy events (follows, mentions, etc.)
- Calling the main API to send notifications

## Future Enhancements

### Additional Notification Types
- Mentions (kind 1 events with 'p' tags)
- Replies (kind 1 events with 'e' tags pointing to user's notes)
- Reactions (kind 7 events)
- Zaps (kind 9735 events)
- Direct Messages (kind 4 events)

### Performance Optimizations
- WebSocket connections to relays (instead of polling)
- Redis cache for relay lists and recent events
- Database for tracking processed events (deduplication)
- Parallel relay queries

### Features
- User-configurable notification preferences
- Notification grouping (e.g., "5 new followers")
- Digest mode (batch notifications)
- Rich notifications with user profiles

## Testing

Run the build to verify all compilation errors are fixed:
```bash
npm run build
```

All TypeScript errors have been resolved. The service compiles successfully.

## Environment Setup

1. Copy `.env.example` to `.env`
2. Configure `NOSTRIA_API_URL` to point to the main Nostria service
3. Set `API_KEY` for authentication
4. Generate VAPID keys: `npx web-push generate-vapid-keys`
5. Set `ENABLE_DAEMON=true` to enable background monitoring

## Running the Service

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

The daemon will automatically start checking for notifications every 5 minutes.
