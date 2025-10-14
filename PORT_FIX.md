# Port Configuration Fix

## Issue
The notification service was configured to connect to the main API on port 3001, but the actual main Nostria API is running on port 3000. This caused "fetch failed" errors when trying to retrieve user data.

Additionally, the notification service itself was configured to run on port 3000, which would conflict with the main API.

## Solution
Updated port configuration to avoid conflicts and ensure proper communication:

### Port Assignments
- **Main Nostria API**: Port 3000
- **Notification Service**: Port 3002

### Files Updated

1. **`.env`**
   - Changed `PORT=3000` to `PORT=3002` (notification service port)
   - Changed `NOSTRIA_API_URL=http://localhost:3001` to `NOSTRIA_API_URL=http://localhost:3000`

2. **`.env.example`**
   - Changed `PORT=3000` to `PORT=3002`
   - Changed `NOSTRIA_API_URL=http://localhost:3001` to `NOSTRIA_API_URL=http://localhost:3000`

3. **`src/services/notificationService.ts`**
   - Changed default `apiBaseUrl` from `http://localhost:3001` to `http://localhost:3000`

4. **`README.md`**
   - Updated documentation to reflect correct ports
   - Changed default port from 3000 to 3002
   - Changed NOSTRIA_API_URL default from 3001 to 3000

5. **`QUICK_START.md`**
   - Updated all example URLs and ports
   - Updated environment variable examples
   - Updated expected log output

## Verification

After making these changes, restart the notification service:

```bash
npm run dev
```

You should now see:
```
[INFO] Notification service initialized with API URL: http://localhost:3000
[INFO] WebPush service initialized (delegates to main API)
[INFO] Server listening on port 3002
[INFO] Notification daemon started (checking every 300000ms / 5 minutes)
[INFO] Checking for new notifications...
[INFO] Fetching all user pubkeys from Nostria API at: http://localhost:3000/api/users?limit=1000
[INFO] Found X user pubkeys
```

## Service Architecture

```
Port 3000: Main Nostria API
    ↓
    ↓ HTTP requests with X-API-Key
    ↓
Port 3002: Notification Service (this service)
    ↓
    ↓ Connects to Nostr relays
    ↓
Nostr Relay Network
```

## Access Points

- **Main API**: http://localhost:3000
  - `/api/users` (protected by API key)
  - `/api/notification/send` (protected by API key)
  - `/api/notification/status/:pubkey` (protected by API key)
  - `/api/status` (public)

- **Notification Service**: http://localhost:3002
  - `/api/status` (public)
  - `/api/notification/*` (for manual notification operations if needed)

## Testing

1. **Check Main API is running**:
   ```bash
   curl http://localhost:3000/api/status
   ```

2. **Check Notification Service is running**:
   ```bash
   curl http://localhost:3002/api/status
   ```

3. **Test user fetching** (watch the logs in notification service):
   The daemon should now successfully fetch users from http://localhost:3000/api/users

## Build Status
✅ Build successful - all TypeScript compilation completed without errors

## Date
October 14, 2025
