require('dotenv').config({ path: '.env' });

// Test setup file to configure environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NOTIFICATION_API_KEY = 'test-api-key';