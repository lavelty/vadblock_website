const { paddle } = require('../paddle');
const {
  getCustomerByEmail,
  getCustomer,
  getSubscriptionsForCustomer,
  upsertCustomer
} = require('../db/db');

/**
 * Mint a Paddle Customer Portal session for an authenticated user.
 *
 * Requirements:
 * - Verify user is authenticated FIRST.
 * - Resolve Paddle customer ID server-side — NEVER trust a client-supplied customer ID.
 * - Look up customer and subscriptions in mirrored DB.
 * - Mint session with Paddle SDK: paddle.customerPortalSessions.create(customerId, subscriptionIds)
 *
 * @param {Object} authSession - Server-verified session containing authenticated user details
 * @param {string} authSession.email - User email resolved securely from server session
 * @param {string} [authSession.userId] - User ID resolved securely from server session
 * @returns {Promise<{ portalUrl: string, customerId: string, subscriptionIds: string[] }>}
 */
async function createCustomerPortalSession(authSession) {
  if (!authSession || !authSession.email) {
    const error = new Error('Authentication required: user session is invalid or missing');
    error.status = 401;
    throw error;
  }

  const email = authSession.email.trim().toLowerCase();

  // 1. Resolve Paddle customer ID server-side from mirrored database
  let customer = getCustomerByEmail(email);

  // 2. If not yet in local DB, attempt looking up via Paddle API as a fallback
  if (!customer) {
    try {
      const customerCollection = paddle.customers.list({ email: [email] });
      const paddleCustomers = [];
      for await (const ctm of customerCollection) {
        paddleCustomers.push(ctm);
      }

      if (paddleCustomers.length > 0) {
        const found = paddleCustomers[0];
        customer = upsertCustomer({
          customerId: found.id,
          email: found.email,
          lastEventAt: found.updatedAt || found.createdAt
        });
      }
    } catch (apiErr) {
      console.warn('[Paddle Portal] Could not query Paddle customer by email:', apiErr.message);
    }
  }

  if (!customer) {
    const error = new Error(`Henüz vAdBlock VIP aboneliği veya Paddle müşteri kaydınız bulunmuyor. Lütfen önce bir plan seçip abone olun.`);
    error.status = 404;
    throw error;
  }

  const customerId = customer.customer_id;

  // 3. Look up customer's subscriptions in mirrored database
  const subscriptions = getSubscriptionsForCustomer(customerId);
  const subscriptionIds = subscriptions.map(s => s.subscription_id);

  // 4. Mint customer portal session using Paddle Node SDK
  let portalSession;
  try {
    portalSession = await paddle.customerPortalSessions.create(
      customerId,
      subscriptionIds.length > 0 ? subscriptionIds : undefined
    );
  } catch (err) {
    console.error('[Paddle Portal] Error creating customer portal session:', err.message);
    const error = new Error(`Paddle Müşteri Portalı oturumu oluşturulamadı: ${err.message}`);
    error.status = 502;
    throw error;
  }

  // 5. Extract general overview portal URL
  const portalUrl = portalSession?.urls?.general?.overview ||
                    portalSession?.urls?.subscriptions?.[0]?.cancelSubscription ||
                    portalSession?.urls?.general?.updatePaymentMethod;

  if (!portalUrl) {
    const error = new Error('Paddle portal URL could not be retrieved from session response.');
    error.status = 500;
    throw error;
  }

  return {
    portalUrl,
    customerId,
    subscriptionIds
  };
}

module.exports = {
  createCustomerPortalSession
};
