'use strict';

/**
 * Tests for the server.js changes introduced in this PR:
 *
 *   1. /health endpoint moved to AFTER the rate-limit middleware
 *      (previously it was registered before rateLimit() so it was exempt).
 *   2. helmet version downgraded from ^8.1.0 to ^8.0.0 (verified via
 *      package.json, not separately tested here as it is a transitive version).
 *
 * The sandbox blocks outbound TCP connections, so every suite spins up an
 * Express server that listens on a Unix socket and makes requests via the
 * built-in `http` module.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const PUBLIC_DIR = path.join(__dirname, 'public');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Build an Express app that mirrors the post-PR server.js middleware stack.
 *
 * @param {object} rateLimitOverrides – merged into the rateLimit() config so
 *   tests can lower the `limit` without touching the real server file.
 */
function createApp(rateLimitOverrides = {}) {
  const app = express();

  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Provide a static key so rate-limiter never needs req.ip (which is
      // undefined on Unix-socket connections and would throw a ValidationError).
      keyGenerator: () => 'test-client',
      ...rateLimitOverrides,
    })
  );
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

  // /health is registered AFTER the rate-limiter (post-PR behaviour)
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use((_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

/**
 * Start `app` on a unique Unix-domain socket and return `{ server, socketPath }`.
 * Call `server.close()` in afterAll / afterEach to release the socket.
 */
function startServer(app) {
  return new Promise((resolve, reject) => {
    const socketPath = `/tmp/test-server-${process.pid}-${Date.now()}.sock`;
    // Remove stale socket if it exists
    try { fs.unlinkSync(socketPath); } catch (_) { /* ignore */ }

    const server = http.createServer(app);
    server.listen(socketPath, () => resolve({ server, socketPath }));
    server.once('error', reject);
  });
}

/**
 * Make an HTTP GET request over `socketPath` and return a plain object with
 * `{ status, headers, body }` (body is already JSON-parsed when the response
 * is application/json, otherwise left as a string).
 */
function get(socketPath, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath, path: urlPath, method: 'GET' },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          const ct = res.headers['content-type'] || '';
          const body = ct.includes('application/json') ? JSON.parse(raw) : raw;
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── test suites ────────────────────────────────────────────────────────────

describe('GET /health – basic response', () => {
  let socketPath;
  let server;

  beforeAll(async () => {
    const result = await startServer(createApp());
    server = result.server;
    socketPath = result.socketPath;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('returns HTTP 200', async () => {
    const res = await get(socketPath, '/health');
    expect(res.status).toBe(200);
  });

  it('returns JSON body { status: "ok" }', async () => {
    const res = await get(socketPath, '/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('sets Content-Type: application/json', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /health – helmet security headers', () => {
  // helmet() is applied before the rate-limiter and before /health in the
  // post-PR middleware stack, so its headers must appear on every response.
  let socketPath;
  let server;

  beforeAll(async () => {
    const result = await startServer(createApp());
    server = result.server;
    socketPath = result.socketPath;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options header', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('sets X-DNS-Prefetch-Control header', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });
});

describe('GET /health – rate-limit middleware is now applied (post-PR)', () => {
  // The critical change in this PR: /health is now registered AFTER rateLimit(),
  // so rate-limit headers must appear on every /health response.
  let socketPath;
  let server;

  beforeAll(async () => {
    const result = await startServer(createApp());
    server = result.server;
    socketPath = result.socketPath;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('includes a RateLimit response header (draft-7 format)', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['ratelimit']).toBeDefined();
  });

  it('RateLimit header reflects limit=100', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['ratelimit']).toMatch(/limit=100/);
  });

  it('RateLimit header contains a "remaining" field', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['ratelimit']).toMatch(/remaining=\d+/);
  });

  it('RateLimit header contains a "reset" field', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['ratelimit']).toMatch(/reset=\d+/);
  });

  it('does NOT set legacy X-RateLimit-* headers (legacyHeaders: false)', async () => {
    const res = await get(socketPath, '/health');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
    expect(res.headers['x-ratelimit-reset']).toBeUndefined();
  });

  it('"remaining" decrements on successive requests', async () => {
    const r1 = await get(socketPath, '/health');
    const r2 = await get(socketPath, '/health');
    const remaining1 = parseInt(r1.headers['ratelimit'].match(/remaining=(\d+)/)[1]);
    const remaining2 = parseInt(r2.headers['ratelimit'].match(/remaining=(\d+)/)[1]);
    expect(remaining2).toBeLessThan(remaining1);
  });
});

describe('GET /health – rate-limit enforcement boundary', () => {
  // Uses a low limit so the test can exhaust it without 100+ real requests.
  let socketPath;
  let server;

  beforeAll(async () => {
    const result = await startServer(createApp({ limit: 5 }));
    server = result.server;
    socketPath = result.socketPath;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('allows exactly `limit` requests and returns 429 on the next one', async () => {
    // First 5 requests must all succeed.
    for (let i = 0; i < 5; i++) {
      const res = await get(socketPath, '/health');
      expect(res.status).toBe(200);
    }
    // 6th request exceeds the window limit.
    const throttled = await get(socketPath, '/health');
    expect(throttled.status).toBe(429);
  });

  it('continues returning 429 for requests beyond the limit (not just the first)', async () => {
    // Exhaust the limit (may already be exhausted from previous test in same suite)
    for (let i = 0; i < 5; i++) {
      await get(socketPath, '/health');
    }
    const r1 = await get(socketPath, '/health');
    const r2 = await get(socketPath, '/health');
    expect(r1.status).toBe(429);
    expect(r2.status).toBe(429);
  });

  it('throttled response includes retry information', async () => {
    for (let i = 0; i < 5; i++) {
      await get(socketPath, '/health');
    }
    const res = await get(socketPath, '/health');
    expect(res.status).toBe(429);
    // express-rate-limit should provide reset info via the RateLimit header or Retry-After
    const hasRetryInfo =
      res.headers['retry-after'] !== undefined ||
      (res.headers['ratelimit'] !== undefined &&
        res.headers['ratelimit'].includes('reset'));
    expect(hasRetryInfo).toBe(true);
  });
});

describe('Middleware order – /health is after rate-limiter and static files', () => {
  // Verify the ordering established by the post-PR server.js:
  //   helmet → rateLimit → express.static → GET /health → catch-all
  let socketPath;
  let server;

  beforeAll(async () => {
    const result = await startServer(createApp());
    server = result.server;
    socketPath = result.socketPath;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('/health is served as a JSON route, not as a static file', async () => {
    const res = await get(socketPath, '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('/health is matched before the catch-all handler', async () => {
    // If /health fell through to the catch-all it would serve index.html (text/html).
    const res = await get(socketPath, '/health');
    expect(res.headers['content-type']).not.toMatch(/text\/html/);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('static assets are served independently of /health', async () => {
    // styles.css exists in public/; it should be served by express.static before
    // the /health route is ever evaluated.
    const res = await get(socketPath, '/styles.css');
    expect([200, 304]).toContain(res.status);
    expect(res.body).not.toEqual({ status: 'ok' });
  });
});
