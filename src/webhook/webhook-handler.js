const { paddle } = require('../paddle');
const {
  upsertCustomer,
  upsertSubscription,
  getCustomer
} = require('../db/db');

/**
 * Handle incoming Paddle webhook.
 *
 * @param {string} rawBody - Raw request body as string. DO NOT JSON.parse before passing!
 * @param {string} signature - paddle-signature header.
 * @param {string} [secret] - Webhook notification secret. Defaults to process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET.
 * @returns {Promise<{ success: boolean, eventType?: string, eventId?: string }>}
 */
async function handleWebhook(rawBody, signature, secret) {
  const webhookSecret = secret || process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('PADDLE_NOTIFICATION_WEBHOOK_SECRET is not configured.');
  }

  if (!signature || !rawBody) {
    const error = new Error('Missing paddle-signature header or raw request body');
    error.status = 400;
    throw error;
  }

  // Verify signature and unmarshal event with Paddle SDK
  // Throws if signature is invalid, payload is malformed, or timestamp expired
  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch (err) {
    console.error('[Paddle Webhook] Signature verification failed:', err.message);
    const error = new Error(`Signature verification failed: ${err.message}`);
    error.status = 401;
    throw error;
  }

  if (!event) {
    const error = new Error('Failed to unmarshal event from webhook payload');
    error.status = 400;
    throw error;
  }

  // Route verified event to appropriate idempotent handler
  await routeEvent(event);

  return {
    success: true,
    eventType: event.eventType,
    eventId: event.eventId
  };
}

/**
 * Route verified Paddle event to typed idempotent handler.
 */
async function routeEvent(event) {
  const eventType = event.eventType;
  const occurredAt = event.occurredAt;
  const data = event.data;

  switch (eventType) {
    case 'customer.created':
    case 'customer.updated':
      await handleCustomerEvent(data, occurredAt);
      break;

    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      await handleSubscriptionEvent(data, occurredAt);
      break;

    case 'transaction.completed':
      await handleTransactionCompletedEvent(data, occurredAt);
      break;

    default:
      // Safely ignore other event types as requested
      console.log(`[Paddle Webhook] Safely ignored unhandled event type: ${eventType}`);
      break;
  }
}

async function handleCustomerEvent(data, occurredAt) {
  const customerId = data?.id;
  const email = data?.email;

  if (!customerId || !email) {
    console.warn('[Paddle Webhook] Incomplete customer payload, skipping:', data);
    return;
  }

  upsertCustomer({
    customerId,
    email,
    lastEventAt: occurredAt
  });

  console.log(`[Paddle Webhook] Customer upserted: ${customerId} (${email})`);
}

async function handleSubscriptionEvent(data, occurredAt) {
  const subscriptionId = data?.id;
  const customerId = data?.customerId;
  const status = data?.status;

  if (!subscriptionId || !customerId || !status) {
    console.warn('[Paddle Webhook] Incomplete subscription payload, skipping:', data);
    return;
  }

  // Extract primary item's price and product IDs
  const primaryItem = data?.items?.[0];
  const priceId = primaryItem?.price?.id || data?.priceId || 'unknown_price';
  const productId = primaryItem?.price?.productId || data?.productId || 'unknown_product';

  const scheduledChangeAction = data?.scheduledChange?.action || null;
  const scheduledChangeAt = data?.scheduledChange?.effectiveAt || null;

  upsertSubscription({
    subscriptionId,
    customerId,
    status,
    priceId,
    productId,
    scheduledChangeAction,
    scheduledChangeAt,
    lastEventAt: occurredAt
  });

  console.log(`[Paddle Webhook] Subscription upserted: ${subscriptionId} for customer ${customerId} (status: ${status})`);
}

async function handleTransactionCompletedEvent(data, occurredAt) {
  const transactionId = data?.id;
  const customerId = data?.customerId;
  const subscriptionId = data?.subscriptionId;

  console.log(`[Paddle Webhook] Transaction completed: ${transactionId} (Customer: ${customerId}, Subscription: ${subscriptionId || 'one-off'})`);

  // If customer details are provided in transaction, ensure customer record exists
  if (customerId && data?.customer?.email) {
    upsertCustomer({
      customerId,
      email: data.customer.email,
      lastEventAt: occurredAt
    });
  }
}

module.exports = {
  handleWebhook,
  routeEvent
};
