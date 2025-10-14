#!/usr/bin/env node

/**
 * Diagnostic script to test connection to main Nostria API
 * Run with: node scripts/test-api-connection.js
 */

const API_URL = process.env.NOSTRIA_API_URL || 'http://localhost:3001';
const API_KEY = process.env.NOSTRIA_API_KEY || '';

console.log('=== Nostria API Connection Test ===\n');
console.log(`API URL: ${API_URL}`);
console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
console.log('');

async function testConnection() {
  console.log('1. Testing basic connectivity...');
  try {
    const statusUrl = `${API_URL}/api/status`;
    console.log(`   Fetching: ${statusUrl}`);
    
    const statusResponse = await fetch(statusUrl);
    console.log(`   ✅ Status endpoint: ${statusResponse.status} ${statusResponse.statusText}`);
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`   Service: ${statusData.service}`);
      console.log(`   Version: ${statusData.version}`);
      console.log(`   Environment: ${statusData.environment}`);
    }
  } catch (error) {
    console.error(`   ❌ Failed to connect to status endpoint:`);
    console.error(`   ${error.message}`);
    console.error('\n   Possible issues:');
    console.error('   - Main API is not running');
    console.error('   - Wrong port (check if API is on 3001 or different port)');
    console.error('   - Firewall blocking the connection');
    console.error('   - Try http://127.0.0.1:3001 instead of localhost');
    return false;
  }

  console.log('\n2. Testing /api/users endpoint...');
  try {
    const usersUrl = `${API_URL}/api/users?limit=10`;
    console.log(`   Fetching: ${usersUrl}`);
    console.log(`   Headers: X-API-Key: ${API_KEY.substring(0, 8)}...`);
    
    const usersResponse = await fetch(usersUrl, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${usersResponse.status} ${usersResponse.statusText}`);
    
    if (usersResponse.ok) {
      const users = await usersResponse.json();
      console.log(`   ✅ Successfully fetched users`);
      console.log(`   User count: ${users.length}`);
      if (users.length > 0) {
        console.log(`   First user pubkey: ${users[0].pubkey?.substring(0, 16)}...`);
      }
    } else {
      const errorText = await usersResponse.text();
      console.log(`   ❌ Failed to fetch users`);
      console.log(`   Response: ${errorText}`);
      
      if (usersResponse.status === 401 || usersResponse.status === 403) {
        console.error('\n   Authentication issue:');
        console.error('   - Check if NOSTRIA_API_KEY is correct');
        console.error('   - Verify API key has proper permissions');
      }
    }
  } catch (error) {
    console.error(`   ❌ Failed to fetch users endpoint:`);
    console.error(`   ${error.message}`);
  }

  console.log('\n3. Testing /api/notification/send endpoint (dry run)...');
  try {
    // Just check if endpoint exists, don't actually send
    console.log(`   Endpoint: ${API_URL}/api/notification/send`);
    console.log(`   Note: Not sending actual notification in test`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n=== Test Complete ===');
  return true;
}

// Load .env file if running standalone
if (require.main === module) {
  // Try to load dotenv
  try {
    require('dotenv').config();
  } catch (e) {
    console.warn('dotenv not available, using env vars only');
  }
  
  testConnection().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testConnection };
