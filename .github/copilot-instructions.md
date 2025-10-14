This is a Node.js project that uses TypeScript and is built with npm.

This is a notification service, a daemon that will run in the background and listen for Nostr events, then call the Nostria Service API, which sends 
push notification to users.

For optimization purposes, the service will not have subscriptions live to relays, but perform query/get operations every X minutes for each user.

Use "created" and "modified" for timestamps.

