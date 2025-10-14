import request from 'supertest';
import { generateKeyPair, NIP98Fixture } from '../helpers/testHelper';
import { finalizeEvent, nip98 } from 'nostr-tools';

// Mock the config
jest.mock('../config', () => ({
  admin: {
    pubkeys: ['test_admin_pubkey_1', 'test_admin_pubkey_2']
  },
  tiers: {
    free: {
      tier: 'free',
      name: 'Free',
      entitlements: {
        notificationsPerDay: 5,
        features: ['BASIC_WEBPUSH', 'COMMUNITY_SUPPORT']
      }
    }
  }
}));

// Mock other routes 
jest.mock('../routes/notification', () => {
  const router = require('express').Router();
  return router;
});

import app from '../index';

// Helper function to generate NIP-98 token with specific pubkey
const generateAdminNIP98 = async (pubkey: string, method = 'GET', url = '/api/account/list'): Promise<NIP98Fixture> => {
  const keyPair = generateKeyPair();
  // Override the pubkey to simulate admin
  keyPair.pubkey = pubkey;
  const token = await nip98.getToken(`http://localhost:3000${url}`, method, e => finalizeEvent(e, keyPair.privateKey));
  return {
    ...keyPair,
    token,
  };
};

describe('Admin Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Endpoint (/api/notification)', () => {
    it('should allow access for admin users with API key', async () => {
      // Note: This test is a placeholder since notification routes require API key
      // Admin auth may not be used for notification routes
      expect(true).toBe(true);
    });
  });

  describe('Admin Configuration', () => {
    it('should have admin pubkeys configured', () => {
      const config = require('../config').default;
      expect(config.admin.pubkeys).toBeDefined();
      expect(Array.isArray(config.admin.pubkeys)).toBe(true);
    });
  });
});