import logger from '../utils/logger';
import notificationService from './notificationService';
import { SimplePool, Event, Filter } from 'nostr-tools';

/**
 * Notification Daemon
 * 
 * This daemon runs on intervals to:
 * 1. Get all user public keys from the Nostria API
 * 2. Discover each user's relays (kind 10002)
 * 3. Query those relays for relevant events (e.g., kind 3 follow lists)
 * 4. Send notifications to users when they're mentioned/followed
 */

interface UserRelayInfo {
  pubkey: string;
  relays: string[];
  lastChecked: number;
}

class NotificationDaemon {
  private pool: SimplePool;
  private isRunning: boolean = false;
  private intervalMs: number;
  private checkIntervalHandle?: NodeJS.Timeout;
  private userRelayCache: Map<string, UserRelayInfo> = new Map();
  private relayCacheTTL: number = 30 * 60 * 1000; // 30 minutes

  constructor(intervalMinutes: number = 5) {
    this.pool = new SimplePool();
    this.intervalMs = intervalMinutes * 60 * 1000;
    logger.info(`Notification Daemon initialized with ${intervalMinutes} minute interval`);
  }

  /**
   * Start the notification daemon
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Notification Daemon is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Notification Daemon...');

    // Run immediately on start
    this.checkForNotifications().catch(error => {
      logger.error('Error in initial notification check:', error);
    });

    // Then run on interval
    this.checkIntervalHandle = setInterval(() => {
      this.checkForNotifications().catch(error => {
        logger.error('Error in notification check:', error);
      });
    }, this.intervalMs);

    logger.info(`Notification Daemon started, checking every ${this.intervalMs / 1000 / 60} minutes`);
  }

  /**
   * Stop the notification daemon
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Notification Daemon is not running');
      return;
    }

    if (this.checkIntervalHandle) {
      clearInterval(this.checkIntervalHandle);
      this.checkIntervalHandle = undefined;
    }

    this.isRunning = false;
    this.pool.close(Array.from(new Set([...this.userRelayCache.values()].flatMap(u => u.relays))));
    logger.info('Notification Daemon stopped');
  }

  /**
   * Main notification check loop
   */
  private async checkForNotifications(): Promise<void> {
    logger.info('Checking for notifications...');

    try {
      // Get all user public keys from the API
      const pubkeys = await notificationService.getAllUserPubkeys();
      logger.info(`Found ${pubkeys.length} users to check for notifications`);

      if (pubkeys.length === 0) {
        logger.info('No users found, skipping notification check');
        return;
      }

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < pubkeys.length; i += batchSize) {
        const batch = pubkeys.slice(i, i + batchSize);
        await Promise.all(batch.map(pubkey => this.checkUserNotifications(pubkey)));
        
        // Small delay between batches
        if (i + batchSize < pubkeys.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Notification check completed');
    } catch (error) {
      logger.error('Error in checkForNotifications:', error);
    }
  }

  /**
   * Check notifications for a specific user
   */
  private async checkUserNotifications(pubkey: string): Promise<void> {
    try {
      // Get user's relay list
      const relays = await this.getUserRelays(pubkey);

      if (relays.length === 0) {
        logger.debug(`No relays found for user ${pubkey}`);
        return;
      }

      // Select 1-2 relays to query (for optimization)
      const selectedRelays = relays.slice(0, 2);
      logger.debug(`Checking ${selectedRelays.length} relays for user ${pubkey}`);

      // Check for new follows (kind 3 events that mention this user)
      await this.checkForNewFollows(pubkey, selectedRelays);

      // TODO: Add more notification types:
      // - Mentions (kind 1 events)
      // - Replies (kind 1 events with 'e' tag)
      // - Reactions (kind 7 events)
      // - Zaps (kind 9735 events)
      // - DMs (kind 4 events)

    } catch (error) {
      logger.error(`Error checking notifications for user ${pubkey}:`, error);
    }
  }

  /**
   * Get user's relay list (kind 10002)
   */
  private async getUserRelays(pubkey: string): Promise<string[]> {
    // Check cache first
    const cached = this.userRelayCache.get(pubkey);
    if (cached && (Date.now() - cached.lastChecked) < this.relayCacheTTL) {
      return cached.relays;
    }

    try {
      // Default relays to use if user doesn't have kind 10002
      const defaultRelays = [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
      ];

      // Query for user's relay list (kind 10002)
      const filter: Filter = {
        kinds: [10002],
        authors: [pubkey],
        limit: 1,
      };

      const events = await this.pool.querySync(defaultRelays, filter);

      if (events.length === 0) {
        // No relay list found, use defaults
        logger.debug(`No relay list found for ${pubkey}, using defaults`);
        this.userRelayCache.set(pubkey, {
          pubkey,
          relays: defaultRelays,
          lastChecked: Date.now(),
        });
        return defaultRelays;
      }

      // Parse relay list from kind 10002 event
      const relayEvent = events[0];
      const relays = relayEvent.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => tag[1])
        .filter(url => url && url.startsWith('wss://'));

      if (relays.length === 0) {
        relays.push(...defaultRelays);
      }

      // Cache the relay list
      this.userRelayCache.set(pubkey, {
        pubkey,
        relays,
        lastChecked: Date.now(),
      });

      logger.debug(`Found ${relays.length} relays for user ${pubkey}`);
      return relays;

    } catch (error) {
      logger.error(`Error getting relays for user ${pubkey}:`, error);
      return ['wss://relay.damus.io']; // Fallback to a single default relay
    }
  }

  /**
   * Check for new follows (kind 3 events)
   */
  private async checkForNewFollows(pubkey: string, relays: string[]): Promise<void> {
    try {
      // Query for recent kind 3 events (follow lists) that include this user
      const since = Math.floor(Date.now() / 1000) - (this.intervalMs / 1000); // Since last check
      
      const filter: Filter = {
        kinds: [3],
        '#p': [pubkey],
        since,
        limit: 50,
      };

      logger.debug(`Querying relays for new follows of ${pubkey} since ${since}`);

      const events = await this.pool.querySync(relays, filter);

      if (events.length === 0) {
        logger.debug(`No new follows found for ${pubkey}`);
        return;
      }

      logger.info(`Found ${events.length} potential new follows for ${pubkey}`);

      // Process each follow event
      for (const event of events) {
        await this.processFollowEvent(pubkey, event);
      }

    } catch (error) {
      logger.error(`Error checking for new follows for ${pubkey}:`, error);
    }
  }

  /**
   * Process a follow event (kind 3)
   */
  private async processFollowEvent(targetPubkey: string, event: Event): Promise<void> {
    try {
      const followerPubkey = event.pubkey;

      // Check if this user is in the follow list
      const followedPubkeys = event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      if (!followedPubkeys.includes(targetPubkey)) {
        return;
      }

      logger.info(`User ${followerPubkey.substring(0, 8)}... followed ${targetPubkey.substring(0, 8)}...`);

      // Send notification via the Nostria API
      await notificationService.sendNotification(targetPubkey, {
        title: 'New Follower',
        body: `Someone followed you on Nostr`,
        icon: 'https://nostria.app/icons/icon-128x128.png',
        url: `https://nostria.app/user/${followerPubkey}`,
        data: {
          type: 'follow',
          follower: followerPubkey,
          timestamp: event.created_at,
        },
      });

      logger.info(`Notification sent to ${targetPubkey} for new follower`);

    } catch (error) {
      logger.error(`Error processing follow event:`, error);
    }
  }
}

// Create singleton instance
const daemon = new NotificationDaemon(5); // Check every 5 minutes

export default daemon;
