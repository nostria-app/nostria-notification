import logger from '../utils/logger';
import { NotificationSettings } from '../models/notificationSettings';
import { NotificationSubscription } from '../models/notificationSubscription';

/**
 * Notification Service
 * 
 * This service manages notification subscriptions and settings.
 * It will interact with the external Nostria API to get user settings
 * and manage push notification subscriptions.
 */

class NotificationService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.NOSTRIA_API_URL || 'http://localhost:3001';
  }

  /**
   * Get all user public keys that have notification subscriptions
   * This will call the external Nostria API
   */
  async getAllUserPubkeys(): Promise<string[]> {
    try {
      // TODO: Implement actual API call to get all user pubkeys
      logger.info('Fetching all user pubkeys from Nostria API');
      
      // Placeholder implementation
      const response = await fetch(`${this.apiBaseUrl}/api/users/pubkeys`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user pubkeys: ${response.statusText}`);
      }
      
      const data = await response.json() as { pubkeys?: string[] };
      return data.pubkeys || [];
    } catch (error) {
      logger.error('Error fetching user pubkeys:', error);
      return [];
    }
  }

  /**
   * Get notification settings for a specific user
   */
  async getNotificationSettings(pubkey: string): Promise<NotificationSettings | null> {
    try {
      logger.info(`Fetching notification settings for pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      const response = await fetch(`${this.apiBaseUrl}/api/notification/settings/${pubkey}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch notification settings: ${response.statusText}`);
      }
      
      return await response.json() as NotificationSettings;
    } catch (error) {
      logger.error(`Error fetching notification settings for ${pubkey}:`, error);
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
   */
  async hasPremiumSubscription(pubkey: string): Promise<boolean> {
    try {
      logger.info(`Checking premium subscription for pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      const response = await fetch(`${this.apiBaseUrl}/api/account/${pubkey}/subscription`);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json() as { tier?: string; isPremium?: boolean };
      return data.isPremium === true || data.tier === 'premium' || data.tier === 'pro';
    } catch (error) {
      logger.error(`Error checking premium subscription for ${pubkey}:`, error);
      return false;
    }
  }

  /**
   * Get 24-hour notification count for rate limiting
   */
  async get24HourNotificationCount(pubkey: string): Promise<number> {
    try {
      logger.info(`Fetching 24-hour notification count for pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      const response = await fetch(`${this.apiBaseUrl}/api/notification/count/${pubkey}?hours=24`);
      
      if (!response.ok) {
        return 0;
      }
      
      const data = await response.json() as { count?: number };
      return data.count || 0;
    } catch (error) {
      logger.error(`Error fetching notification count for ${pubkey}:`, error);
      return 0;
    }
  }

  /**
   * Get all notification subscriptions for a specific user
   */
  async getNotificationSubscriptions(pubkey: string): Promise<NotificationSubscription[]> {
    try {
      logger.info(`Fetching notification subscriptions for pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      const response = await fetch(`${this.apiBaseUrl}/api/notification/subscriptions/${pubkey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notification subscriptions: ${response.statusText}`);
      }
      
      const data = await response.json() as { subscriptions?: NotificationSubscription[] };
      return data.subscriptions || [];
    } catch (error) {
      logger.error(`Error fetching notification subscriptions for ${pubkey}:`, error);
      return [];
    }
  }

  /**
   * Send a notification through the external API
   */
  async sendNotification(pubkey: string, notification: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    data?: any;
  }): Promise<boolean> {
    try {
      logger.info(`Sending notification to pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      const response = await fetch(`${this.apiBaseUrl}/api/notification/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pubkey,
          notification,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send notification: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error sending notification to ${pubkey}:`, error);
      return false;
    }
  }

  /**
   * Log notification for tracking purposes
   */
  async logNotification(pubkey: string, notification: any): Promise<void> {
    try {
      logger.info(`Logging notification for pubkey: ${pubkey}`);
      
      // TODO: Implement actual API call
      await fetch(`${this.apiBaseUrl}/api/notification/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pubkey,
          notification,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      logger.error(`Error logging notification for ${pubkey}:`, error);
    }
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
