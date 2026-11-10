require('dotenv').config();
const { Paddle, Environment, LogLevel } = require('@paddle/paddle-node-sdk');

const env = process.env.PADDLE_ENVIRONMENT || process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox';
const apiKey = process.env.PADDLE_API_KEY || process.env.PADDLE_SANDBOX_API_KEY;

if (!apiKey) {
  throw new Error('PADDLE_API_KEY is not set. Paddle server operations require a server-side API key.');
}

const paddle = new Paddle(apiKey, {
  environment: env === 'production' ? Environment.production : Environment.sandbox,
  logLevel: LogLevel.error
});

module.exports = {
  paddle,
  environment: env
};
