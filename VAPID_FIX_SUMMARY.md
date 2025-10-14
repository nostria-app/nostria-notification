# VAPID Keys Removal - Summary

## Issue
The notification service was throwing an error: `"VAPID keys or subject not set in environment variables"`

## Root Cause
The notification service was copied from the main Nostria service and included code for directly sending web push notifications using VAPID keys. However, this service should NOT send push notifications directly - it should only call the main Nostria API.

## Architecture Clarification

### Main Nostria Service (port 3001)
- Manages user accounts and subscriptions
- Handles web push registration
- Stores VAPID keys
- Sends actual push notifications to devices
- Enforces rate limiting
- Manages user notification preferences

### Notification Daemon Service (port 3000 - THIS SERVICE)
- Monitors Nostr relays for events
- Discovers user relay lists (kind 10002)
- Detects notification-worthy events (follows, mentions, etc.)
- **Calls the main API** to send notifications
- Does NOT send push notifications directly
- Does NOT need VAPID keys

## Changes Made

### 1. Updated `notificationService.ts`
- Added `NOSTRIA_API_KEY` configuration for authenticating with main API
- Updated `sendNotification()` to use the correct API format:
  ```typescript
  POST /api/notification/send
  Headers: X-API-Key: {api-key}
  Body: {
    pubkeys: [string],
    title: string,
    body: string,
    icon?: string,
    url?: string
  }
  ```
- Updated `getNotificationSettings()` to use `GET /api/notification/status/{pubkey}`
- Updated `hasPremiumSubscription()` to use the status endpoint
- Updated `get24HourNotificationCount()` to use the status endpoint
- Commented out `getAllUserPubkeys()` since the main API doesn't have this endpoint yet

### 2. Updated `.env.example`
- Removed VAPID key variables
- Changed `API_KEY` to `NOSTRIA_API_KEY` for clarity
- Added note that VAPID keys are not needed

### 3. Updated `README.md`
- Added clear note that this service does NOT need VAPID keys
- Explained that the main service handles all web push operations

### 4. Updated `IMPLEMENTATION_NOTES.md`
- Clarified API integration points
- Documented which endpoints are used
- Explained the separation of concerns

## Current Limitation

The `getAllUserPubkeys()` method currently returns an empty array because the main Nostria API doesn't have an endpoint to list all users yet. 

### To Fix:
Add an endpoint to the main Nostria service:
```
GET /api/notification/users
Headers: X-API-Key: {api-key}
Response: { pubkeys: string[] }
```

Or use the existing admin endpoint:
```
GET /api/account/list?limit=1000
Headers: X-API-Key: {api-key}
Response: Account[]
```

## Testing

The service now compiles successfully:
```bash
npm run build
# Success!
```

To run the service:
```bash
# 1. Set environment variables
export NOSTRIA_API_URL=http://localhost:3001
export NOSTRIA_API_KEY=your-api-key-here
export ENABLE_DAEMON=true

# 2. Start the service
npm run dev
```

The daemon will:
1. Start checking for notifications every 5 minutes
2. Query the main API for users (currently returns empty)
3. For each user, discover their relays
4. Monitor relays for events
5. Call `POST /api/notification/send` when events are found

## Next Steps

1. **Add user listing endpoint** to the main Nostria service
2. **Test the notification flow**:
   - Create a test user in main service
   - Add a follow to their kind 3 list
   - Verify the daemon detects it
   - Verify notification is sent via main API
3. **Add more event types** (mentions, replies, reactions, zaps, DMs)
4. **Optimize relay queries** (WebSocket connections, caching, etc.)
