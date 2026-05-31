# CLAUDE.md

Guidance for Claude Code (and humans) when working in this repository.

## Project overview

**ReentryApp** is a web app supporting reentry into the community after incarceration. The repo currently holds a minimal Express scaffold that serves a static landing page; real product features (auth, DB, APIs) are still to be built on top.

## Tech stack

- Node.js (CommonJS), requires Node 18.11.0+
- Express 5 + helmet + express-rate-limit + dotenv
- Plain HTML/CSS in `public/` (no frontend framework chosen yet)

## Commands

```bash
npm install
npm start          # node server.js — http://localhost:3000
npm run dev        # node --watch server.js (auto-reload)
npm test           # placeholder ("No tests yet")
```

## Environment

Copy `.env.example` to `.env`:

- `PORT` (default 3000)
- `NODE_ENV` (default development)

When adding a DB or auth, extend `.env.example` first so collaborators know what to set.

## Repo layout

- `server.js` — Express server. Configures helmet, `trust proxy 1` for cloud load balancers, a `/health` route exempt from rate limiting, a 100-req/60s global rate limiter, static hosting from `public/` (1h cache), and an SPA fallback.
- `public/` — static assets shipped to the browser (`index.html`, `styles.css` — dark theme).
- `.vscode/` — F5 launch config (sets `NODE_ENV=development`, `PORT=3000`), Prettier format-on-save, recommended extensions.
- `.github/dependabot.yml` — weekly npm + GitHub Actions updates.

## Conventions

- Mount any new API routes **before** the SPA fallback in `server.js`.
- Keep helmet enabled with default headers unless a specific exemption is justified.
- Tune `windowMs` / `limit` on the rate limiter (express-rate-limit v7+) rather than removing it.
- The `/health` route must remain exempt from rate limiting (load balancers/probes depend on it).
- 2-space indent, LF line endings, final newline (`.editorconfig`).
- Never commit `.env`.

## Roadmap suggestions

- Pick a DB (Supabase / Firebase / Postgres) and add the corresponding `.env.example` keys.
- Add an auth layer before storing any user data.
- Add a CI workflow at `.github/workflows/ci.yml` that runs `npm test` (and real tests once they exist).
- Customize `SECURITY.md` with project-specific contact info.

## Running in VS Code

Open the folder, accept the recommended extensions, then press **F5** to launch the server with the debugger attached.
