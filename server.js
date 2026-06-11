require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// Trust the first proxy hop so express-rate-limit sees the real client IP
// when the app runs behind Nginx / a cloud load balancer.
app.set('trust proxy', 1);

app.use(helmet());

// Health endpoint is exempt from rate-limiting so load-balancer probes
// always get a timely 200, even when other routes are being throttled.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);
app.use(
  express.static(publicDir, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      // HTML files must not be cached so browsers always fetch a fresh copy.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  });
});

// Explicit error handler so stack traces are never leaked to clients,
// regardless of NODE_ENV (Express 5 exposes them in development mode by default).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  const rawStatus = err?.status ?? err?.statusCode;
  const statusCode =
    Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus < 600
      ? rawStatus
      : 500;
  const message = statusCode >= 500 ? 'Internal Server Error' : 'Bad Request';
  res.status(statusCode).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`ReentryApp running at http://localhost:${PORT}`);
});
