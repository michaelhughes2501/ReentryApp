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
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);
app.use(express.static(publicDir, { maxAge: '1h' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Catch-all: serve index.html for navigable HTML routes (SPA / MPA fallback),
// but return a proper 404 for asset requests (JS, CSS, images, fonts, etc.)
// so the browser doesn't silently receive HTML when it expected a binary.
app.use((req, res) => {
  const ext = path.extname(req.path).toLowerCase();
  const htmlExtensions = ['', '.html', '.htm'];

  if (htmlExtensions.includes(ext)) {
    // Unknown HTML / navigation route — send the 404 page with a 404 status.
    res.status(404).sendFile(path.join(publicDir, '404.html'));
  } else {
    // Asset not found — plain 404, no body needed.
    res.status(404).end();
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReentryApp running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
