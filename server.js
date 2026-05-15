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

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReentryApp running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
