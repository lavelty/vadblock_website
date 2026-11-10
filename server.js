require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');

const { handleWebhook } = require('./src/webhook/webhook-handler');
const { isAuthorizedPaddleIp } = require('./src/webhook/ip-allowlist');
const { createCustomerPortalSession } = require('./src/portal/portal-handler');
const { getCustomerByEmail, getSubscriptionsForCustomer, hasPaidAccess } = require('./src/db/db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

/**
 * Read raw request body as UTF-8 string.
 * CRITICAL for Paddle Webhook verification: must never be JSON.parse'd first!
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
}

/**
 * Helper to resolve authenticated user server-side.
 * Resolves from session header, cookie, or query parameter (e.g. user_email from auth).
 */
function resolveAuthSession(req, reqUrl) {
  // 1. Authorization header (Bearer token or email)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.includes('@')) {
      return { email: token };
    }
  }

  // 2. Custom header
  const userHeader = req.headers['x-user-email'];
  if (userHeader && userHeader.includes('@')) {
    return { email: userHeader.trim() };
  }

  // 3. Cookie session
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
    if (cookies.user_email) {
      return { email: decodeURIComponent(cookies.user_email) };
    }
  }

  // 4. Query param for portal link click
  const emailQuery = reqUrl.searchParams.get('email');
  if (emailQuery && emailQuery.includes('@')) {
    return { email: emailQuery.trim() };
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, paddle-signature, x-user-email');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // =========================================================================
  // 1. Webhook Route: POST /api/webhook
  // =========================================================================
  if (pathname === '/api/webhook' && req.method === 'POST') {
    // Security: verify incoming IP against dynamic Paddle allowlist in production
    const isAllowed = await isAuthorizedPaddleIp(req, process.env.PADDLE_ENVIRONMENT);
    if (!isAllowed) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: IP not in Paddle allowlist' }));
      return;
    }

    const signature = req.headers['paddle-signature'] || '';

    try {
      // Must read raw body as text for HMAC signature verification
      const rawBody = await getRawBody(req);

      const result = await handleWebhook(rawBody, signature);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, eventType: result.eventType }));
    } catch (err) {
      console.error('[Webhook Route Error]:', err.message);
      // Return non-2xx status code so Paddle retries delivery
      const statusCode = err.status || 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // =========================================================================
  // 2. Customer Portal Session: POST /api/portal-session or GET /api/portal
  // =========================================================================
  if ((pathname === '/api/portal-session' || pathname === '/api/portal')) {
    let authSession = resolveAuthSession(req, reqUrl);

    if (req.method === 'POST' && !authSession) {
      try {
        const rawBody = await getRawBody(req);
        if (rawBody) {
          const parsed = JSON.parse(rawBody);
          if (parsed.email) authSession = { email: parsed.email };
        }
      } catch (e) {}
    }

    if (!authSession) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Oturum açmanız gerekiyor. Lütfen önce hesabınıza giriş yapın.' }));
      return;
    }

    try {
      const sessionResult = await createCustomerPortalSession(authSession);

      if (req.method === 'GET') {
        // Direct browser redirect
        res.writeHead(302, { Location: sessionResult.portalUrl });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessionResult));
      }
    } catch (err) {
      const statusCode = err.status || 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // =========================================================================
  // 3. Paid Access Status Check: GET /api/access-status
  // =========================================================================
  if (pathname === '/api/access-status') {
    const authSession = resolveAuthSession(req, reqUrl);
    if (!authSession) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasPaidAccess: false, error: 'Unauthorized' }));
      return;
    }

    const customer = getCustomerByEmail(authSession.email);
    if (!customer) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasPaidAccess: false, reason: 'No customer record found' }));
      return;
    }

    const subscriptions = getSubscriptionsForCustomer(customer.customer_id);
    const activeSub = subscriptions.find(s => hasPaidAccess(s));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasPaidAccess: !!activeSub,
      customer,
      subscription: activeSub || subscriptions[0] || null,
      allSubscriptions: subscriptions
    }));
    return;
  }

  // =========================================================================
  // 4. Static File Serving
  // =========================================================================
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if .html extension exists
      if (!path.extname(filePath)) {
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
          filePath = htmlPath;
        } else {
          filePath = path.join(PUBLIC_DIR, '404.html');
        }
      } else {
        filePath = path.join(PUBLIC_DIR, '404.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`vAdBlock server running on http://localhost:${PORT}`);
    console.log(`- Webhook: http://localhost:${PORT}/api/webhook`);
    console.log(`- Customer Portal: http://localhost:${PORT}/api/portal-session`);
    console.log(`- Access Check: http://localhost:${PORT}/api/access-status`);
  });
}

module.exports = server;
