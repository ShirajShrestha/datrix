# Datrix

A personal news-summary PWA. It pulls stories from RSS feeds and news APIs, merges duplicates, summarizes them, and shows the freshest ones in the categories you pick. Next.js 16 + MongoDB Atlas, installable, with an optional daily push notification. No accounts; preferences live on the device.

## Features

- **Fresh first:** Today and the digest show the last 48 h (widened to 7 days if fewer than 12 stories), ranked by importance with a 24 h half-life.
- **Global / Local toggle:** Global shows your categories; Local shows Nepal news (5 English-language Nepali outlets). Nepal is only reachable via the toggle, not in Settings, digest or push.
- **14 selectable categories** plus `nepal` (definitions and feeds in `src/lib/categories.ts`).
- **Sources:** RSS, Guardian, GNews, MediaStack. Duplicate stories merge into one card with links to every outlet.
- **Summaries** (TL;DR, key points, why it matters): Groq (`qwen/qwen3.8-27b`) → Gemini → extractive fallback. Built from article text where available (feed body or Readability page fetch). Text is used for summarizing only and is never stored.
- **Story modal** with a short brief and links out, search, daily digest, saved articles, dark mode, offline page, daily Web Push.

## How it works

- **Ingest** (`npm run ingest`, `scripts/ingest.ts`): fetch → score → dedupe → keep top 40 per category → resolve images and article text → summarize (paced to Groq's free 8,000 tokens/min) → upsert to MongoDB. Runs every 2 hours from GitHub Actions (`ingest.yml`). The backlog of LLM summaries drains over several runs; unsummarized items keep extractive summaries.
- **Quota gating:** GNews runs in 6 of 12 daily runs, MediaStack once a day, to fit their free limits. Force both with `INGEST_ALL_SOURCES=1` (or the `all_sources` box on a manual run).
- **Read API** (`/api/articles`): serves stored articles; the browser never calls news APIs.
- **Push:** `push.yml` calls `/api/cron/push` every 15 minutes; subscriptions are stored with their time zone and preferred time.
- **Vercel** hosts the app only. `vercel.json` has no crons; all scheduling is GitHub Actions. `GET /api/cron/news` still exists for manual runs.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

`npm run dev` does not run the service worker. To test PWA/push: `npm run build && npm start`.
Other commands: `npm run ingest` (writes to the DB in `.env.local`), `npm test`, `npm run lint`, `npx tsc --noEmit`.

## Environment variables and secrets

GitHub Actions secrets are not visible to Vercel, so some values live in both. Mark secrets "Sensitive" in Vercel.

| Variable | GitHub Actions secret | Vercel env var | Notes |
|---|:-:|:-:|---|
| `MONGODB_URI` | ingest (required) | yes | Atlas connection string. Ingest exits 1 if unset. |
| `CRON_SECRET` | push | yes | Long random string (`openssl rand -hex 32`). Same value in both. |
| `APP_URL` | push | no | Site URL, no trailing slash. |
| `GROQ_API_KEY` | ingest | yes | Free key at console.groq.com. |
| `GEMINI_API_KEY` | ingest (optional) | optional | Free key at aistudio.google.com. |
| `GUARDIAN_API_KEY`, `GNEWS_API_KEY`, `MEDIASTACK_API_KEY` | ingest (optional) | no | Skipped if unset. |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | push only | See below. |

Optional overrides (Vercel): `GROQ_MODEL`, `GEMINI_MODEL`, `BRIEF_MAX_PER_HOUR` (default 60), `MAX_PUSH_SUBSCRIPTIONS` (default 2000), `MEDIASTACK_MAX_CALLS_PER_RUN` (default 3). If Vercel still has `GROQ_MODEL=llama-3.1-8b-instant` (retired), remove it.

With no source keys the app ingests RSS only; with no LLM keys summaries are extractive.

**VAPID keys (push only, optional):** `npx web-push generate-vapid-keys`. Put the public key in both `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (inlined at build, so redeploy after changing), the private key in `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:you@example.com`. Don't rotate casually: existing subscriptions are bound to the old public key.

## Deploy

1. **Atlas:** free M0 cluster, a database user with a strong password, Network Access `0.0.0.0/0` (Vercel has no fixed IPs). Add a database name to the URI path.
2. **Vercel:** import the repo, set the env vars above, deploy.
3. **GitHub:** add the Actions secrets above. Scheduled workflows run only from the default branch (`main`).
4. **First run:** Actions → "Ingest News" → Run workflow (tick `all_sources`), confirm it is green, then open the site.
5. **Push (optional):** generate VAPID keys, set them in Vercel, redeploy. Chrome/Android: Install app. iOS 16.4+: Share → Add to Home Screen first. Then Settings → enable notifications → "Send test notification".

Troubleshooting: workflow 401 = `CRON_SECRET` differs between GitHub and Vercel; connection error = check `APP_URL`; empty feed = ingest hasn't run or `MONGODB_URI` is wrong; GNews/MediaStack 429 = free quota used, harmless.

## Making the repo public

1. Scan history: `brew install gitleaks && gitleaks detect`. Rotate anything found, including secrets from the old repo history. Check `git log --all -- .env.local` is empty.
2. Real values stay in GitHub secrets and Vercel only; fork PRs don't receive Actions secrets.
3. Keep `BRIEF_MAX_PER_HOUR` set: the brief endpoint is public and spends Groq/Gemini quota.
4. Public repos get unlimited Actions minutes, which the 15-minute `push.yml` needs (about 2,900 min/month vs 2,000 free on private).

## Free-tier limits

| Source | Limit | Use |
|---|---|---|
| GNews | 100 req/day | 7 calls × 6 runs = 42/day |
| MediaStack | 100 calls/month (http only, key sent in plaintext) | 3 calls × 1 run/day ≈ 90/month |
| Groq | 8,000 tokens/min for the default model | one call at a time, ≥25 s apart |
| Guardian | unverified | 19 parallel calls per run |

Articles expire 30 days after publication (TTL index on `expireAt`). Atlas M0 has 512 MB.

## Known limitations

- Dedupe is token-based: it misses aliases ("Fed" vs "Federal Reserve") and occasionally merges near-identical headlines.
- Push depends on GitHub's scheduler, which can run late; a push is skipped for the day if more than 3 hours late. Delivery is at-most-once.
- Images are hotlinked and may break. The `og:image` fallback fetch may be blocked by some publishers.
- Paywalled hosts (NYT, WSJ, FT, Bloomberg) are not page-fetched and keep extractive summaries.
- PWA install, offline and Web Push have not been verified on real devices.
- The `localStorage` key `newsintel_saved_articles` keeps its old name so saved articles are not wiped.

## Docs

History is in `DEVELOPMENT_LOG.md`. Design spec: `docs/superpowers/specs/2026-10-18-newsintel-v2-design.md`. Plans: `docs/superpowers/plans/`.
