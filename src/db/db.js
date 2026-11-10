const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'vadblock.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    last_event_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

  CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id),
    status TEXT NOT NULL,
    price_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    scheduled_change_action TEXT,
    scheduled_change_at TEXT,
    last_event_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
`);

/**
 * Idempotent upsert for customers.
 * Only applies updates if incoming event is newer than stored last_event_at.
 */
function upsertCustomer({ customerId, email, lastEventAt }) {
  const existing = getCustomer(customerId);

  if (existing) {
    if (existing.last_event_at && lastEventAt && new Date(lastEventAt) <= new Date(existing.last_event_at)) {
      // Out of order or older event: ignore update to maintain consistency
      return existing;
    }

    const stmt = db.prepare(`
      UPDATE customers
      SET email = ?, last_event_at = ?, updated_at = datetime('now')
      WHERE customer_id = ?
    `);
    stmt.run(email, lastEventAt || null, customerId);
  } else {
    const stmt = db.prepare(`
      INSERT INTO customers (customer_id, email, last_event_at, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(customerId, email, lastEventAt || null);
  }

  return getCustomer(customerId);
}

/**
 * Idempotent upsert for subscriptions.
 * Only applies updates if incoming event is newer than stored last_event_at.
 */
function upsertSubscription({
  subscriptionId,
  customerId,
  status,
  priceId,
  productId,
  scheduledChangeAction = null,
  scheduledChangeAt = null,
  lastEventAt = null
}) {
  // Ensure customer exists in customers table before inserting foreign key
  let customer = getCustomer(customerId);
  if (!customer) {
    // Insert stub customer record to satisfy foreign key constraint
    upsertCustomer({
      customerId,
      email: `${customerId}@paddle.placeholder`,
      lastEventAt
    });
  }

  const existing = getSubscription(subscriptionId);

  if (existing) {
    if (existing.last_event_at && lastEventAt && new Date(lastEventAt) <= new Date(existing.last_event_at)) {
      // Out of order or older event: ignore update
      return existing;
    }

    const stmt = db.prepare(`
      UPDATE subscriptions
      SET customer_id = ?, status = ?, price_id = ?, product_id = ?,
          scheduled_change_action = ?, scheduled_change_at = ?,
          last_event_at = ?, updated_at = datetime('now')
      WHERE subscription_id = ?
    `);
    stmt.run(
      customerId,
      status,
      priceId,
      productId,
      scheduledChangeAction,
      scheduledChangeAt,
      lastEventAt || null,
      subscriptionId
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO subscriptions (
        subscription_id, customer_id, status, price_id, product_id,
        scheduled_change_action, scheduled_change_at, last_event_at,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(
      subscriptionId,
      customerId,
      status,
      priceId,
      productId,
      scheduledChangeAction,
      scheduledChangeAt,
      lastEventAt || null
    );
  }

  return getSubscription(subscriptionId);
}

function getCustomer(customerId) {
  const stmt = db.prepare('SELECT * FROM customers WHERE customer_id = ?');
  return stmt.get(customerId) || null;
}

function getCustomerByEmail(email) {
  const stmt = db.prepare('SELECT * FROM customers WHERE LOWER(email) = LOWER(?) ORDER BY updated_at DESC LIMIT 1');
  return stmt.get(email) || null;
}

function getSubscription(subscriptionId) {
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE subscription_id = ?');
  return stmt.get(subscriptionId) || null;
}

function getSubscriptionsForCustomer(customerId) {
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE customer_id = ? ORDER BY created_at DESC');
  return stmt.all(customerId) || [];
}

/**
 * Decides whether a subscription currently grants paid VIP access.
 *
 * Rules:
 * - 'active' AND 'trialing' grant paid access.
 * - Having a `scheduled_change` (to cancel or pause) does NOT revoke access until `status` is actually 'canceled' or 'paused'.
 * - 'canceled', 'paused', 'past_due' do NOT grant paid access.
 */
function hasPaidAccess(subscription) {
  if (!subscription) return false;

  const status = subscription.status?.toLowerCase();

  // Active and trialing grant full paid VIP access
  if (status === 'active' || status === 'trialing') {
    return true;
  }

  // Once status is canceled or paused, access is revoked
  if (status === 'canceled' || status === 'paused') {
    return false;
  }

  // past_due does not grant access
  if (status === 'past_due') {
    return false;
  }

  return false;
}

module.exports = {
  db,
  upsertCustomer,
  upsertSubscription,
  getCustomer,
  getCustomerByEmail,
  getSubscription,
  getSubscriptionsForCustomer,
  hasPaidAccess
};
