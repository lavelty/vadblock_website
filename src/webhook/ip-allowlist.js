const https = require('https');

let cachedIps = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch current live Paddle IP CIDRs dynamically from https://api.paddle.com/ips
 * Source of truth from Paddle - never hardcoded.
 */
async function fetchPaddleIps() {
  const now = Date.now();
  if (cachedIps && (now - lastFetchedAt < CACHE_TTL_MS)) {
    return cachedIps;
  }

  return new Promise((resolve) => {
    https.get('https://api.paddle.com/ips', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const cidrs = parsed?.data?.ipv4_cidrs || [];
          if (cidrs.length > 0) {
            cachedIps = cidrs.map(c => c.split('/')[0].trim());
            lastFetchedAt = Date.now();
            console.log('[Paddle IP Allowlist] Updated live IPs from api.paddle.com/ips:', cachedIps);
          }
          resolve(cachedIps || []);
        } catch (e) {
          console.error('[Paddle IP Allowlist] Error parsing IPs:', e.message);
          resolve(cachedIps || []);
        }
      });
    }).on('error', (err) => {
      console.error('[Paddle IP Allowlist] Error fetching IPs from Paddle:', err.message);
      resolve(cachedIps || []);
    });
  });
}

/**
 * Verify whether request IP matches Paddle's allowlist.
 * Only enforced in production environment.
 */
async function isAuthorizedPaddleIp(req, environment) {
  if (environment !== 'production') {
    return true; // Sandbox allows testing from local tunnels, localhost, etc.
  }

  const allowedIps = await fetchPaddleIps();
  if (allowedIps.length === 0) {
    return true; // Fallback if API temporarily unreachable to avoid dropping legitimate webhooks
  }

  // Extract client IP (handling reverse proxies / Cloudflare / localtunnel)
  const forwarded = req.headers['x-forwarded-for'];
  let clientIp = (forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '';

  // Clean IPv6 mapped IPv4 (::ffff:1.2.3.4)
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.replace('::ffff:', '');
  }

  const isMatch = allowedIps.includes(clientIp);
  if (!isMatch) {
    console.warn(`[Paddle Security] Rejected webhook delivery from unauthorized IP: ${clientIp}. Allowed:`, allowedIps);
  }

  return isMatch;
}

module.exports = {
  fetchPaddleIps,
  isAuthorizedPaddleIp
};
