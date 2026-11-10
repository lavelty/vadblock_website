const test = require('node:test');
const assert = require('node:assert/strict');
const {
  upsertCustomer,
  upsertSubscription,
  getCustomer,
  getSubscription,
  hasPaidAccess
} = require('../src/db/db');
const { handleWebhook } = require('../src/webhook/webhook-handler');
const { createCustomerPortalSession } = require('../src/portal/portal-handler');

test('Fulfillment Layer Tests', async (t) => {

  await t.test('1. Database mirroring & Idempotency tests', () => {
    const testCustomerId = 'ctm_test_' + Date.now();
    const testEmail = 'user_' + Date.now() + '@example.com';
    const initialTime = '2026-11-10T10:00:00Z';
    const newerTime = '2026-11-10T11:00:00Z';
    const olderTime = '2026-11-10T09:00:00Z';

    // 1. Initial Insert
    const c1 = upsertCustomer({
      customerId: testCustomerId,
      email: testEmail,
      lastEventAt: initialTime
    });
    assert.equal(c1.customer_id, testCustomerId);
    assert.equal(c1.email, testEmail);

    // 2. Newer Event updates customer
    const updatedEmail = 'updated_' + testEmail;
    const c2 = upsertCustomer({
      customerId: testCustomerId,
      email: updatedEmail,
      lastEventAt: newerTime
    });
    assert.equal(c2.email, updatedEmail);

    // 3. Out-of-order older event must NOT overwrite newer state
    const c3 = upsertCustomer({
      customerId: testCustomerId,
      email: 'stale@example.com',
      lastEventAt: olderTime
    });
    assert.equal(c3.email, updatedEmail, 'Stale event should be ignored');

    // 4. Subscriptions mirroring
    const testSubId = 'sub_test_' + Date.now();
    const s1 = upsertSubscription({
      subscriptionId: testSubId,
      customerId: testCustomerId,
      status: 'trialing',
      priceId: 'pri_01m72gmcpvvddfk1x6j0jmfzn3',
      productId: 'pro_01m72gmcg71fyq05gbmw27ft54',
      lastEventAt: initialTime
    });
    assert.equal(s1.subscription_id, testSubId);
    assert.equal(s1.status, 'trialing');

    // 5. Update subscription to active with scheduled cancel
    const s2 = upsertSubscription({
      subscriptionId: testSubId,
      customerId: testCustomerId,
      status: 'active',
      priceId: 'pri_01m72gmcpvvddfk1x6j0jmfzn3',
      productId: 'pro_01m72gmcg71fyq05gbmw27ft54',
      scheduledChangeAction: 'cancel',
      scheduledChangeAt: '2026-11-17T10:00:00Z',
      lastEventAt: newerTime
    });
    assert.equal(s2.status, 'active');
    assert.equal(s2.scheduled_change_action, 'cancel');

    // 6. Older event arrives out of order
    const s3 = upsertSubscription({
      subscriptionId: testSubId,
      customerId: testCustomerId,
      status: 'canceled',
      priceId: 'pri_01m72gmcpvvddfk1x6j0jmfzn3',
      productId: 'pro_01m72gmcg71fyq05gbmw27ft54',
      lastEventAt: olderTime
    });
    assert.equal(s3.status, 'active', 'Older out-of-order event should not revert active status');
  });

  await t.test('2. Access Helper (hasPaidAccess) decision rules', () => {
    // Active grants access
    assert.equal(hasPaidAccess({ status: 'active' }), true);

    // Trialing grants access
    assert.equal(hasPaidAccess({ status: 'trialing' }), true);

    // CRITICAL REQUIREMENT: Do NOT revoke access just because scheduled_change exists!
    assert.equal(hasPaidAccess({
      status: 'active',
      scheduled_change_action: 'cancel',
      scheduled_change_at: '2026-12-01T00:00:00Z'
    }), true, 'Active subscription with scheduled cancellation MUST still grant access until canceled');

    assert.equal(hasPaidAccess({
      status: 'trialing',
      scheduled_change_action: 'cancel',
      scheduled_change_at: '2026-11-17T00:00:00Z'
    }), true, 'Trialing subscription with scheduled cancellation MUST still grant access');

    // Status is actually canceled -> revoke access
    assert.equal(hasPaidAccess({ status: 'canceled' }), false);

    // Paused -> revoke access
    assert.equal(hasPaidAccess({ status: 'paused' }), false);

    // Past due -> revoke access
    assert.equal(hasPaidAccess({ status: 'past_due' }), false);

    // Null or undefined
    assert.equal(hasPaidAccess(null), false);
    assert.equal(hasPaidAccess(undefined), false);
  });

  await t.test('3. Webhook signature verification and invalid request rejection', async () => {
    // Missing signature or body must throw error with status 400
    await assert.rejects(
      async () => handleWebhook('', ''),
      (err) => err.status === 400
    );

    // Invalid signature must reject and NOT return 2xx (returns 401)
    const fakeRawBody = JSON.stringify({
      event_id: 'evt_fake_123',
      event_type: 'subscription.created',
      occurred_at: '2026-11-10T10:00:00Z',
      data: {}
    });

    await assert.rejects(
      async () => handleWebhook(fakeRawBody, 'ts=123;h1=invalid_hmac_signature'),
      (err) => err.status === 401
    );
  });

  await t.test('4. Customer Portal session authorization check', async () => {
    // Reject unauthenticated request
    await assert.rejects(
      async () => createCustomerPortalSession(null),
      (err) => err.status === 401
    );

    await assert.rejects(
      async () => createCustomerPortalSession({}),
      (err) => err.status === 401
    );

    // Reject unknown user
    await assert.rejects(
      async () => createCustomerPortalSession({ email: 'non_existent_customer_xyz@example.com' }),
      (err) => err.status === 404
    );
  });

});
