export interface NotificationSettings {
  id: string; // Will be "notification-settings-" + pubkey
  type: 'notification-settings';
  pubkey: string; // Partition key
  enabled: boolean;
  filters?: any; // Custom filters for premium users
  settings?: any; // Additional settings
  created: number;
  modified: number;
}
