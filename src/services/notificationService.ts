import logger from '../utils/logger';
import { NotificationSettings } from '../models/notificationSettings';
import { NotificationSubscription } from '../models/notificationSubscription';

/**
 * Notification Service
 * 
 * This service manages communication with the main Nostria API
 * for notification-related operations.
 */

class NotificationService {
  private apiBaseUrl: string;
  private apiKey: string;

  constructor() {
    this.apiBaseUrl = process.env.NOSTRIA_API_URL || 'http://localhost:3001';
    this.apiKey = process.env.NOSTRIA_API_KEY || process.env.API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('NOSTRIA_API_KEY not set - API calls will fail');
    }
  }

  /**
   * Get all user public keys that have notification subscriptions
   * This will need to be implemented on the main Nostria API
   * For now, we can use the account list endpoint (admin only)
   */
  async getAllUserPubkeys(): Promise<string[]> {
    try {
      logger.info('Fetching all user pubkeys from Nostria API');
      
      // TODO: The main API needs a dedicated endpoint for this
      // For now, return empty array to avoid errors
      logger.warn('getAllUserPubkeys not yet implemented on main API');
      return [];
      
      // Future implementation:
      // const response = await fetch(`${this.apiBaseUrl}/api/account/list`, {
      //   headers: { 'X-API-Key': this.apiKey }
      // });
      // const accounts = await response.json();
      // return accounts.map(a => a.pubkey);
    } catch (error) {
      logger.error('Error fetching user pubkeys:', error);
      return [];
    }
  }

  /**
   * Get notification settings for a specific user
   * Uses GET /api/notification/status/{pubkey} from the main service
   */
  async getNotificationSettings(pubkey: string): Promise<NotificationSettings | null> {
    try {
      logger.debug(`Fetching notification settings for pubkey: ${pubkey.substring(0, 8)}...`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/notification/status/${pubkey}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch notification settings: ${response.statusText}`);
      }
      
      const status = await response.json() as any;
      
      // Convert the status response to NotificationSettings format
      return {
        id: `notification-settings-${pubkey}`,
        type: 'notification-settings',
        pubkey,
        enabled: status.settings?.enabled !== false,
        settings: status.settings,
        created: Date.now(),
        modified: Date.now(),
      };
    } catch (error) {
      logger.error(`Error fetching notification settings for ${pubkey.substring(0, 8)}...:`, error);
      return null;
    }
  }

  /**
   * Get all notification subscriptions for a specific user
   * Alias for getNotificationSubscriptions for backward compatibility
   */
  async getUserSubscriptions(pubkey: string): Promise<NotificationSubscription[]> {
    return this.getNotificationSubscriptions(pubkey);
  }

  /**
   * Check if user has a premium subscription
   * Uses GET /api/notification/status/{pubkey} from the main service
   */
  async hasPremiumSubscription(pubkey: string): Promise<boolean> {
    try {
      logger.debug(`Checking premium subscription for pubkey: ${pubkey.substring(0, 8)}...`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/notification/status/${pubkey}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        return false;
      }
      
      const status = await response.json() as any;
      return status.isPremium === true;
    } catch (error) {
      logger.error(`Error checking premium subscription for ${pubkey.substring(0, 8)}...:`, error);
      return false;
    }
  }

  /**
   * Get 24-hour notification count for rate limiting
   * Uses GET /api/notification/status/{pubkey} from the main service
   */
  async get24HourNotificationCount(pubkey: string): Promise<number> {
    try {
      logger.debug(`Fetching 24-hour notification count for pubkey: ${pubkey.substring(0, 8)}...`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/notification/status/${pubkey}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        return 0;
      }
      
      const status = await response.json() as any;
      return status.notifications?.count24h || 0;
    } catch (error) {
      logger.error(`Error fetching notification count for ${pubkey.substring(0, 8)}...:`, error);
      return 0;
    }
  }

  /**
   * Get all notification subscriptions for a specific user
   * Uses GET /api/notification/status/{pubkey} from the main service
   */
  async getNotificationSubscriptions(pubkey: string): Promise<NotificationSubscription[]> {
    try {
      logger.debug(`Fetching notification subscriptions for pubkey: ${pubkey.substring(0, 8)}...`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/notification/status/${pubkey}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notification subscriptions: ${response.statusText}`);
      }
      
      const status = await response.json() as any;
      
      // The status endpoint returns hasSubscription and deviceCount
      // We don't get the actual subscriptions, but we can create placeholder data
      if (!status.hasSubscription || status.deviceCount === 0) {
        return [];
      }
      
      // Return placeholder subscriptions based on device count
      // Note: This is a limitation - we don't have access to actual subscription details
      const subscriptions: NotificationSubscription[] = [];
      for (let i = 0; i < status.deviceCount; i++) {
        subscriptions.push({
          id: `${pubkey}-device-${i}`,
          type: 'notification-subscription',
          pubkey,
          subscription: {
            endpoint: `placeholder-endpoint-${i}`,
            keys: {
              p256dh: 'placeholder',
              auth: 'placeholder',
            },
          },
          deviceKey: `device-${i}`,
          created: Date.now(),
          modified: Date.now(),
        });
      }
      
      return subscriptions;
    } catch (error) {
      logger.error(`Error fetching notification subscriptions for ${pubkey.substring(0, 8)}...:`, error);
      return [];
    }
  }

  /**
   * Send a notification through the Nostria API
   * Uses the POST /api/notification/send endpoint from the main service
   */
  async sendNotification(pubkey: string, notification: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    data?: any;
  }): Promise<boolean> {
    try {
      logger.info(`Sending notification to pubkey: ${pubkey.substring(0, 8)}...`);
      
      // Use the Nostria API format from OpenAPI spec
      const response = await fetch(`${this.apiBaseUrl}/api/notification/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey, // API key authentication
        },
        body: JSON.stringify({
          pubkeys: [pubkey], // Array of pubkeys
          title: notification.title,
          body: notification.body,
          icon: notification.icon || 'https://nostria.app/icons/icon-128x128.png',
          url: notification.url,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send notification: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      logger.info(`Notification sent successfully to ${pubkey.substring(0, 8)}...`);
      return true;
    } catch (error) {
      logger.error(`Error sending notification to ${pubkey.substring(0, 8)}...:`, error);
      return false;
    }
  }

  /**
   * Log notification for tracking purposes (optional - logging to console)
   */
  async logNotification(pubkey: string, notification: any): Promise<void> {
    // Just log locally, no API call needed
    logger.info(`Notification logged for ${pubkey.substring(0, 8)}...: ${notification.title || 'No title'}`);
  }

  /**
   * Get entity by pubkey and type (generic method for backward compatibility)
   */
  async getEntity(pubkey: string, type: string): Promise<any | null> {
    if (type === 'notification-settings') {
      return this.getNotificationSettings(pubkey);
    }
    
    logger.warn(`getEntity called with unknown type: ${type}`);
    return null;
  }
}

export default new NotificationService();
