require('dotenv').config();
const { Paddle, Environment, LogLevel } = require('@paddle/paddle-node-sdk');

const liveApiKey = process.env.PADDLE_LIVE_API_KEY || process.env.PADDLE_API_KEY;

const paddle = new Paddle(liveApiKey, {
  environment: Environment.production,
  logLevel: LogLevel.error
});

async function setup() {
  console.log('--- Setting up Live Notification Destination & Checkout URL ---');
  
  // 1. Notification setting for live webhooks
  try {
    const destination = await paddle.notificationSettings.create({
      description: 'vAdBlock Production Webhook',
      destination: 'https://vadblock.com/api/webhook',
      type: 'url',
      subscribedEvents: [
        { name: 'subscription.created' },
        { name: 'subscription.updated' },
        { name: 'subscription.canceled' },
        { name: 'subscription.past_due' },
        { name: 'customer.created' },
        { name: 'customer.updated' },
        { name: 'transaction.completed' },
        { name: 'transaction.updated' }
      ]
    });
    console.log('Notification Destination Created:');
    console.log('  ID:', destination.id);
    console.log('  Endpoint Secret Key:', destination.endpointSecretKey);
    console.log('  Active:', destination.active);
    
    // Save to .env
    const fs = require('fs');
    const envPath = require('path').resolve(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (destination.endpointSecretKey) {
      envContent = envContent.replace(
        /PADDLE_NOTIFICATION_WEBHOOK_SECRET=.*/,
        `PADDLE_NOTIFICATION_WEBHOOK_SECRET=${destination.endpointSecretKey}`
      );
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('Updated .env with live notification signing secret.');
  } catch (err) {
    console.error('Error creating notification destination:', err.message);
  }

  // 2. Default Checkout URL
  try {
    // Note: PATCH /settings/checkout-url
    const res = await fetch('https://api.paddle.com/settings/checkout-url', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${liveApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        default_url: 'https://vadblock.com/#pricing'
      })
    });
    const data = await res.json();
    console.log('Checkout URL update response:', data);
  } catch (err) {
    console.error('Error setting default checkout URL:', err.message);
  }

  // 3. Checkout Domains list
  try {
    const domRes = await fetch('https://api.paddle.com/checkout-domains', {
      headers: { 'Authorization': `Bearer ${liveApiKey}` }
    });
    const domData = await domRes.json();
    console.log('Live checkout domains:', domData);
  } catch (err) {
    console.error('Error fetching domains:', err.message);
  }
}

setup().catch(console.error);
