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
    logger.info('========================================');
    logger.info('Starting notification check cycle...');
    logger.info('========================================');

    try {
      // Get all user public keys from the API
      logger.debug('Fetching all user pubkeys from Nostria API...');
      const pubkeys = await notificationService.getAllUserPubkeys();
      logger.info(`Found ${pubkeys.length} users to check for notifications`);

      if (pubkeys.length === 0) {
        logger.info('No users found, skipping notification check');
        return;
      }

      // Log first few pubkeys for debugging
      if (pubkeys.length > 0) {
        const sampleSize = Math.min(3, pubkeys.length);
        logger.debug(`Sample pubkeys (first ${sampleSize}): ${pubkeys.slice(0, sampleSize).map(p => p.substring(0, 8) + '...').join(', ')}`);
      }

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      logger.info(`Processing users in batches of ${batchSize}...`);
      
      for (let i = 0; i < pubkeys.length; i += batchSize) {
        const batch = pubkeys.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(pubkeys.length / batchSize);
        
        logger.info(`Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);
        logger.debug(`Batch ${batchNum} pubkeys: ${batch.map(p => p.substring(0, 8) + '...').join(', ')}`);
        
        await Promise.all(batch.map(pubkey => this.checkUserNotifications(pubkey)));
        
        logger.debug(`Completed batch ${batchNum}/${totalBatches}`);
        
        // Small delay between batches
        if (i + batchSize < pubkeys.length) {
          logger.debug('Waiting 1 second before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('========================================');
      logger.info('Notification check cycle completed successfully');
      logger.info('========================================');
    } catch (error) {
      logger.error('========================================');
      logger.error('Error in checkForNotifications:', error);
      logger.error('========================================');
    }
  }

  /**
   * Check notifications for a specific user
   */
  private async checkUserNotifications(pubkey: string): Promise<void> {
    try {
      logger.debug(`Starting notification check for user ${pubkey.substring(0, 8)}...`);
      
      // Get user's relay list
      const relays = await this.getUserRelays(pubkey);

      if (relays.length === 0) {
        logger.debug(`No relays found for user ${pubkey.substring(0, 8)}..., skipping`);
        return;
      }

      // Select 1-2 relays to query (for optimization)
      const selectedRelays = relays.slice(0, 2);
      logger.debug(`Selected ${selectedRelays.length} relays for user ${pubkey.substring(0, 8)}...: ${selectedRelays.join(', ')}`);

      // Check for new follows (kind 3 events that mention this user)
      await this.checkForNewFollows(pubkey, selectedRelays);

      logger.debug(`Completed notification check for user ${pubkey.substring(0, 8)}...`);

      // TODO: Add more notification types:
      // - Mentions (kind 1 events)
      // - Replies (kind 1 events with 'e' tag)
      // - Reactions (kind 7 events)
      // - Zaps (kind 9735 events)
      // - DMs (kind 4 events)

    } catch (error) {
      logger.error(`Error checking notifications for user ${pubkey.substring(0, 8)}...:`, error);
    }
  }

  /**
   * Get user's relay list (kind 10002)
   */
  private async getUserRelays(pubkey: string): Promise<string[]> {
    // Check cache first
    const cached = this.userRelayCache.get(pubkey);
    if (cached && (Date.now() - cached.lastChecked) < this.relayCacheTTL) {
      logger.debug(`Using cached relays for user ${pubkey.substring(0, 8)}... (${cached.relays.length} relays)`);
      return cached.relays;
    }

    try {
      // Default relays to use for discovery and if user doesn't have kind 10002
      const defaultRelays = [
        'wss://discovery.eu.nostria.app',
        'wss://purplepag.es',
      ];
      
      logger.debug(`Querying default relays for user ${pubkey.substring(0, 8)}... relay list: ${defaultRelays.join(', ')}`);

      // Query for user's relay list (kind 10002)
      const filter: Filter = {
        kinds: [10002],
        authors: [pubkey],
        limit: 1,
      };

      logger.debug(`Fetching kind 10002 relay list for ${pubkey.substring(0, 8)}...`);
      const events = await this.pool.querySync(defaultRelays, filter);
      logger.debug(`Received ${events.length} kind 10002 events for ${pubkey.substring(0, 8)}...`);

      if (events.length === 0) {
        // No relay list found, use defaults
        logger.debug(`No relay list found for ${pubkey.substring(0, 8)}..., using default relays: ${defaultRelays.join(', ')}`);
        this.userRelayCache.set(pubkey, {
          pubkey,
          relays: defaultRelays,
          lastChecked: Date.now(),
        });
        return defaultRelays;
      }

      // Parse relay list from kind 10002 event
      const relayEvent = events[0];
      logger.debug(`Parsing kind 10002 event with ${relayEvent.tags.length} tags for ${pubkey.substring(0, 8)}...`);
      
      const relays = relayEvent.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => tag[1])
        .filter(url => url && url.startsWith('wss://'));

      logger.debug(`Extracted ${relays.length} relays from kind 10002 event for ${pubkey.substring(0, 8)}...`);

      if (relays.length === 0) {
        logger.debug(`No valid relays in kind 10002, adding defaults for ${pubkey.substring(0, 8)}...`);
        relays.push(...defaultRelays);
      }

      // Cache the relay list
      this.userRelayCache.set(pubkey, {
        pubkey,
        relays,
        lastChecked: Date.now(),
      });

      logger.debug(`Cached ${relays.length} relays for user ${pubkey.substring(0, 8)}...: ${relays.slice(0, 3).join(', ')}${relays.length > 3 ? '...' : ''}`);
      return relays;

    } catch (error) {
      logger.error(`Error getting relays for user ${pubkey.substring(0, 8)}...:`, error);
      const fallbackRelay = 'wss://discovery.eu.nostria.app';
      logger.debug(`Using fallback relay: ${fallbackRelay}`);
      return [fallbackRelay]; // Fallback to discovery relay
    }
  }

  /**
   * Check for new follows (kind 3 events)
   */
  private async checkForNewFollows(pubkey: string, relays: string[]): Promise<void> {
    try {
      // Query for recent kind 3 events (follow lists) that include this user
      const since = Math.floor(Date.now() / 1000) - (this.intervalMs / 1000); // Since last check
      
      logger.debug(`Checking for follows of ${pubkey.substring(0, 8)}... since ${since} (${new Date(since * 1000).toISOString()})`);
      
      const filter: Filter = {
        kinds: [3],
        '#p': [pubkey],
        since,
        limit: 50,
      };

      logger.debug(`Query filter: ${JSON.stringify(filter)}`);
      logger.debug(`Querying ${relays.length} relays: ${relays.join(', ')}`);

      const events = await this.pool.querySync(relays, filter);
      logger.debug(`Received ${events.length} kind 3 events for ${pubkey.substring(0, 8)}...`);

      if (events.length === 0) {
        logger.debug(`No new follows found for ${pubkey.substring(0, 8)}...`);
        return;
      }

      logger.info(`Found ${events.length} potential new follows for ${pubkey.substring(0, 8)}...`);

      // Process each follow event
      for (const event of events) {
        logger.debug(`Processing follow event ${event.id.substring(0, 8)}... from ${event.pubkey.substring(0, 8)}...`);
        await this.processFollowEvent(pubkey, event);
      }

      logger.debug(`Completed processing ${events.length} follow events for ${pubkey.substring(0, 8)}...`);

    } catch (error) {
      logger.error(`Error checking for new follows for ${pubkey.substring(0, 8)}...:`, error);
    }
  }

  /**
   * Process a follow event (kind 3)
   */
  private async processFollowEvent(targetPubkey: string, event: Event): Promise<void> {
    try {
      const followerPubkey = event.pubkey;
      
      logger.debug(`Processing follow event: follower=${followerPubkey.substring(0, 8)}..., target=${targetPubkey.substring(0, 8)}..., created_at=${event.created_at}`);

      // Check if this user is in the follow list
      const followedPubkeys = event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      logger.debug(`Follow list contains ${followedPubkeys.length} pubkeys`);

      if (!followedPubkeys.includes(targetPubkey)) {
        logger.debug(`Target pubkey ${targetPubkey.substring(0, 8)}... not found in follow list, skipping`);
        return;
      }

      logger.info(`✓ User ${followerPubkey.substring(0, 8)}... followed ${targetPubkey.substring(0, 8)}... at ${new Date(event.created_at * 1000).toISOString()}`);

      // Send notification via the Nostria API
      logger.debug(`Sending notification to ${targetPubkey.substring(0, 8)}... via Nostria API...`);
      
      const notificationPayload = {
        title: 'New Follower',
        body: `Someone followed you on Nostr`,
        icon: 'https://nostria.app/icons/icon-128x128.png',
        url: `https://nostria.app/p/${followerPubkey}`,
        data: {
          type: 'follow',
          follower: followerPubkey,
          timestamp: event.created_at,
        },
      };
      
      logger.debug(`Notification payload: ${JSON.stringify(notificationPayload)}`);
      
      await notificationService.sendNotification(targetPubkey, notificationPayload);

      logger.info(`✓ Notification sent successfully to ${targetPubkey.substring(0, 8)}... for new follower ${followerPubkey.substring(0, 8)}...`);

    } catch (error) {
      logger.error(`Error processing follow event:`, error);
      if (error instanceof Error) {
        logger.error(`Error details: ${error.message}`);
        logger.error(`Stack trace:`, error.stack);
      }
    }
  }
}

// Create singleton instance
const daemon = new NotificationDaemon(5); // Check every 5 minutes

export default daemon;
