# Datrix

Datrix aggregates news from RSS feeds and news APIs, removes duplicate stories, summarizes them, and shows the top stories in the categories you pick. It is a Next.js app backed by MongoDB, installable as a PWA, with an optional daily Web Push notification at a time you choose. There are no user accounts; preferences live on the device.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)

## Features

- 15 categories, chosen at onboarding and changeable in Settings. The 15th, Nepal, is not part of the saved categories: it is reached through the Global/Local toggle.
- Global / Local toggle on Today: Global shows your saved categories (Nepal excluded), Local shows only Nepal stories (five English-language Nepali feeds), even if Nepal is not in your saved categories. The choice is stored on the device (`datrix_scope`) and survives a reload.
- Fresh first: Today and the digest ask for the last 48 hours (`fresh=48`) and rank by importance decayed with a 24 h half-life, so newer stories win. If fewer than 12 stories fall in the window, the API widens it to 168 h.
- Multi-source ingest: RSS feeds, Guardian Open Platform, GNews, MediaStack.
- Deduplication: the same story from several outlets becomes one card ("N sources", each with its own link).
- Image cards, with an `og:image` page fetch as a fallback when a feed has no image.
- Summaries (TL;DR, key points, why it matters): Groq first (default model `qwen/qwen3.8-27b`), then Gemini Flash, then an extractive fallback. Only articles without an LLM summary are sent to a provider.
- Summaries from article text: the ingest takes the body from the feed when it has one, otherwise fetches the article page and extracts readable text with Mozilla Readability (free, no API; capped page fetches per run). The text is sent to the summarizer only (batches of 4 when text is present, else 8) and is never stored; articles without usable text fall back to the RSS description. Pages from hard-paywalled hosts (nytimes.com, wsj.com, ft.com, bloomberg.com) are never fetched. Only articles with text, or a description of at least 200 characters, are sent to an LLM (text-bearing ones first); the rest get an extractive summary directly. The ingest script paces Groq to its free token limit: one call at a time, at least 18 s between call starts, and a 60 s wait before the single retry after a 429. A missing `GEMINI_API_KEY` just skips Gemini.
- Known limit: summaries from article text depend on Groq's free-tier token limit (8,000 tokens/min for the default model), so each ingest run summarizes only a limited number of articles with the LLM, paced one call at a time (see `scripts/ingest.ts` for the pacing values). The backlog drains over several 2-hourly runs. Articles with article text go first; paywalled outlets (NYT, WSJ, FT, Bloomberg) are not page-fetched, and items with no usable text (no article text and a description under 200 characters) are not sent to the LLM and keep extractive summaries.
- Ingest every 2 hours from GitHub Actions (`ingest.yml`), so the feed stays fresh.
- Installable PWA: offline fallback page and the last loaded feed available offline.
- Daily Web Push at a time you choose (default 08:00 in your own time zone).
- Story modal: open a story (title or "Read more") for a short brief, an image gallery and links to every outlet (see "Story modal and briefs").
- Search, daily digest, saved articles (local to the device), dark mode.

## Categories

| Slug | Category | Slug | Category |
|------|----------|------|----------|
| `ai` | 🤖 AI | `science` | 🔬 Science |
| `technology` | 💻 Technology | `health` | 🏥 Health |
| `business` | 💼 Business & Economy | `environment` | 🌱 Environment |
| `world` | 🌍 World | `sports` | ⚽ Sports |
| `geopolitics` | 🌐 Geopolitics | `entertainment` | 🎬 Entertainment |
| `politics` | 🏛️ Politics | `education` | 🎓 Education |
| `law` | ⚖️ Law & Justice | `society` | 👥 Society & Culture |
| `nepal` | 🇳🇵 Nepal (Local toggle) | | |

Legacy slugs `tech` and `economy` are mapped to `technology` and `business`. An article can carry several categories (keyword tagging on top of its primary one). The Nepal category is tagged by its own feeds and keywords and is shown only in Local scope. Category definitions, feeds and API mappings are in `src/lib/categories.ts`.

## Architecture

- **Ingest pipeline** (`src/lib/services/ingest.ts`, `GET /api/cron/news`): fetch all sources in parallel against a shared 35 s deadline (one failing or slow source does not stop the run; a slow one is reported as `timeout:<name>` in `failures`) -> score -> deduplicate (token-similarity within 48 h) -> keep the top 25 per category -> resolve missing images (at most 60 page fetches) -> collect article text (feed body or Readability page fetch, not stored) -> summarize articles lacking an LLM summary (batches of 8, or 4 with text; one retry after a 429) -> bulk upsert into MongoDB. The route works inside a 100 s time budget (`maxDuration = 120`); the GitHub Actions script (`npm run ingest`) uses a 600 s budget, top 40 per category and up to 40 article-page fetches and returns an `IngestReport`. Summarizer provider problems appear in `failures` as coarse entries such as `summarizer:groq:429` or `summarizer:gemini:timeout`. Articles whose url is not http(s) are dropped.
- **Read API** (`GET /api/articles`): reads stored articles, filtered by the categories the client sends. `GET /api/cron/digest` also exists but is not scheduled. The browser never calls the news APIs.
- **Device-only prefs**: categories, notify time and onboarding state are stored in `localStorage` (`datrix_prefs`). Saved articles use `newsintel_saved_articles`.
- **Push subscriptions** (`/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/test`): a subscription is stored (at most `MAX_PUSH_SUBSCRIPTIONS`, default 2000; over the cap the API answers 503 "Subscription limit reached") with its categories, preferred time and IANA time zone. `GET /api/cron/push` sends to subscriptions that are due (their local time has reached the preferred time, within a 3 hour catch-up window, and nothing was sent yet today). Changing the notification time after today's push already went out, or subscribing after the chosen time has already passed today, skips today's push until tomorrow.
- **Subscription expiry and abuse limits**: the three POST routes require a same-host `Origin` header (a request without one gets 403). A new subscription row expires after 14 days (TTL index on `PushSub.expireAt`) unless a push is actually delivered; a delivered push (daily cron or the test button) moves expiry to 90 days. Re-subscribing an existing endpoint never changes `expireAt`, so fake rows added by an attacker vanish after 14 days while real users, who get a push within a day, are kept. The `MAX_PUSH_SUBSCRIPTIONS` cap still applies. Rows created before this field existed have no `expireAt` and do not expire.
- **Schedulers**: GitHub Actions only (`.github/workflows`); ingest runs every 2 hours as a script, not through the Vercel route. `vercel.json` has no crons.
- **Service worker**: hand-written `public/sw.js` (runtime caching, offline page, push handling). It is not registered by `next dev`.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real values.

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes (production) | MongoDB connection string. Falls back to `mongodb://localhost:27017/newsintel` if unset. |
| `CRON_SECRET` | Yes | Shared secret; cron endpoints require `Authorization: Bearer <CRON_SECRET>`. Use a long random string. |
| `GUARDIAN_API_KEY` | Optional | Guardian Open Platform source. Source skipped if unset. |
| `GNEWS_API_KEY` | Optional | GNews source. Skipped if unset. |
| `MEDIASTACK_API_KEY` | Optional | MediaStack source. Skipped if unset. |
| `MEDIASTACK_MAX_CALLS_PER_RUN` | Optional | MediaStack calls per ingest run; default `3`, clamped 0-7, `0` disables the source. Categories rotate daily. |
| `GROQ_API_KEY` | Optional | First summary provider. |
| `GROQ_MODEL` | Optional | Groq model; default `qwen/qwen3.8-27b`. |
| `GEMINI_API_KEY` | Optional | Second summary provider. |
| `GEMINI_MODEL` | Optional | Gemini model; default `gemini-3.5-flash-lite`. |
| `VAPID_PUBLIC_KEY` | Required for push | VAPID public key (server). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Required for push | Same value as `VAPID_PUBLIC_KEY`; the browser needs it to subscribe. Inlined at build time, so changing it needs a rebuild/redeploy. |
| `VAPID_PRIVATE_KEY` | Required for push | VAPID private key. Keep secret. |
| `VAPID_SUBJECT` | Required for push | Contact for push services, e.g. `mailto:you@example.com`. |
| `MAX_PUSH_SUBSCRIPTIONS` | Optional | Cap on stored push subscriptions; default `2000`. Beyond it `POST /api/push/subscribe` returns 503 "Subscription limit reached". |

With no source keys the app still ingests RSS. With no LLM keys, summaries are extractive. A missing `GEMINI_API_KEY` only skips Gemini (Groq still runs).

### Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Put the public key in both `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and the private key in `VAPID_PRIVATE_KEY`. Do not rotate the pair casually: existing subscriptions are bound to the old public key.

## GitHub Actions

Add repository secrets (Settings -> Secrets and variables -> Actions):

| Secret | Value |
|--------|-------|
| `APP_URL` | Deployed site URL, no trailing slash (used by `push.yml`) |
| `CRON_SECRET` | Same value as the `CRON_SECRET` env var on the server (used by `push.yml`) |
| `MONGODB_URI` | Atlas connection string (used by `ingest.yml`) |
| `GUARDIAN_API_KEY`, `GNEWS_API_KEY`, `MEDIASTACK_API_KEY` | Optional news source keys (ingest) |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Optional summarizer keys (ingest) |

Workflows:

- `ingest.yml` "Ingest News": every 2 hours (minute 20), runs `scripts/ingest.ts` directly on the runner (10 minute budget, top 40 per category, no overlapping runs). `GET /api/cron/news` still exists but is manual-only (100 s budget, top 25 per category).
- `push.yml` "Push Dispatch": every 15 minutes, calls `GET /api/cron/push`.

Both also have `workflow_dispatch` for manual runs.

## Deploying to Vercel (owner walkthrough)

1. **MongoDB Atlas.** Create a free (M0) cluster. Add a database user with a strong, unique password. Under Network Access allow `0.0.0.0/0`: Vercel functions have no fixed IPs, so this is required. The tradeoff is that the database is reachable from anywhere and protected only by the user credentials, so use a long random password and a user limited to this database. Copy the connection string and add a database name as the path segment, e.g. `mongodb+srv://USER:PASSWORD@cluster.mongodb.net/datrix?retryWrites=true&w=majority`. That is `MONGODB_URI`.
2. **API keys.** All are optional: with none of them the app ingests RSS only, summaries are extractive, and missing sources are skipped.
   - Guardian: https://open-platform.theguardian.com/register (`GUARDIAN_API_KEY`)
   - GNews: https://gnews.io (`GNEWS_API_KEY`)
   - MediaStack: https://mediastack.com (`MEDIASTACK_API_KEY`). Read the quota warning under Free-tier usage first.
   - Groq: https://console.groq.com (`GROQ_API_KEY`)
   - Gemini: https://aistudio.google.com (`GEMINI_API_KEY`)
3. **VAPID keys** (needed for push): run `npx web-push generate-vapid-keys`. Choose `VAPID_SUBJECT`, e.g. `mailto:you@example.com`.
4. **CRON_SECRET**: generate a new one with `openssl rand -hex 32`. Do NOT reuse any secret that was ever exposed in the old repository history; treat those as compromised.
5. **Vercel env vars.** Import the repo into Vercel and set every variable from the table above (Production, plus Preview if you want). `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined at build time, so changing it requires a redeploy.
6. **Deploy.** `vercel.json` no longer defines any crons, so the Vercel dashboard shows none; scheduling is done entirely by GitHub Actions.
7. **GitHub.** In the repo, Settings -> Secrets and variables -> Actions, set `APP_URL` (`https://<project>.vercel.app`, no trailing slash) and `CRON_SECRET` (same value as in Vercel). Delete any old secrets and workflows left from before. Make sure Actions are enabled for the repo.
8. **First ingest.** Actions -> "Ingest News" -> Run workflow (`workflow_dispatch`) and confirm it succeeds. Open the site and check that onboarding appears, categories can be chosen and articles load.
9. **Install and notifications.** Chrome/Android: use "Install app". iOS: Share -> Add to Home Screen first (iOS 16.4+), then open from the home screen. In Settings enable notifications and press "Send test notification".
10. **Daily push.** The "Push Dispatch" workflow runs every 15 minutes. GitHub's scheduler can delay runs, and GitHub disables scheduled workflows after 60 days of repository inactivity on public repos (re-enable them in the Actions tab).

Function duration: `/api/cron/news` and `/api/cron/push` set `maxDuration` of 120 s and 60 s respectively; the ingest stops starting new work after about 100 s (source fetching is capped at 35 s) and the push dispatcher after about 50 s. Verified 2026-10-18 against Vercel's [duration docs](https://vercel.com/docs/functions/configuring-functions/duration): with fluid compute (default) the Hobby plan default and maximum are 300 s, so both values are allowed.

### Troubleshooting

- Workflow fails with 401: `CRON_SECRET` in GitHub differs from the one in Vercel, or the Vercel env var is unset.
- Workflow fails with a connection/DNS error: check `APP_URL` (scheme, no trailing slash).
- Empty feed: the ingest has not run yet (or `MONGODB_URI` is wrong).
- Notifications "unsupported": you are on `npm run dev`, a browser without push support, an iOS tab not added to the Home Screen, or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` was missing at build time.
- GNews/MediaStack HTTP 429 in logs: free quota exhausted; harmless, the other sources still run.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

`npm run dev` does not run the service worker, so PWA install, offline mode and push do not work there. To test them:

```bash
npm run build && npm start
```

Run an ingest locally (reads `.env.local`, writes to the database it points at):

```bash
npm run ingest
```

Or via the route:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/news
```

Tests and checks:

```bash
npm test            # Vitest, src/**/__tests__/*.test.ts
npm run lint
npx tsc --noEmit
npm run build
```

## iOS

Web Push on iPhone/iPad works only on iOS 16.4+ and only after Share -> Add to Home Screen. Open Datrix from the home screen icon, then enable notifications in Settings.

## MongoDB notes

- Atlas free tier (M0) has 512 MB. Datrix keeps about 25 articles per category in the pool, and old ones expire.
- Articles expire 30 days after `publishedAt` through a TTL index on the `expireAt` field (never earlier than one day after insert).
- The first ingest after upgrading from the pre-v2 app deletes legacy documents that lack a `categories` field.
- Existing production `publishedAt` indexes are plain (non-TTL) and stay as they are; expiry uses `expireAt` instead.

## Story modal and briefs

Tapping a story's title or "Read more" opens a story modal. The URL gets a `?story=<id>` parameter, so a story can be deep-linked, and closing the modal or pressing Back returns to the feed.

- **What is stored:** the ingest keeps, per article, a short `description` and a per-outlet `snippet` (each capped at 600 characters, HTML tags stripped) plus up to 5 image URLs. No full article bodies are stored or shown; the modal links out to each outlet.
- **Briefs:** the modal shows "what happened / why it matters / background", generated from the stored snippets on first open by `POST /api/articles/<id>/brief` (Groq first, then Gemini, using the existing `GROQ_API_KEY` / `GEMINI_API_KEY`; the only new optional variable is `BRIEF_MAX_PER_HOUR`) and cached on the article document. Output is validated (word limits, and any number must appear in the title or snippets the model saw). Cost is bounded to one successful provider call per article: later opens read the cache. Failed generations (provider error, missing keys, too little text) are retried with backoff, not forever: 1 minute after the first failure, then 1 hour, 6 hours and 24 hours (attempt count and `briefRetryAfter` are claimed atomically). A global cap of `BRIEF_MAX_PER_HOUR` claims per hour (default 60) bounds total provider calls; over the cap, the modal falls back without calling a provider. The brief routes never change an article's `updatedAt`. While no brief exists the modal shows the stored description, or the existing short summary for stories ingested before this feature.
- **Endpoints:** `GET /api/articles/<id>` returns one article without snippets (`Cache-Control: public, s-maxage=60, stale-while-revalidate=120`). The brief `POST` requires a same-origin `Origin` header. Clustered stories list at most 8 outlets, so the "N sources" chip tops out at 8.
- **Saved articles:** the modal's save button uses the same on-device saved list as the cards.
- **Known limits:** the first open of an uncached story takes about 1-3 s. Stories ingested before this change get snippets and images on the next ingest; until then the modal shows their existing short summary instead of a brief.

## Free-tier usage

Counts below come from the code (`src/lib/categories.ts`, source adapters), for one ingest run. Ingest runs every 2 hours (12 runs per day, UTC hours 0, 2, ..., 22). To stay inside the free quotas, `quotaSourcesFor` (`src/lib/sources/schedule.ts`) runs GNews only every 4 hours (6 runs per day) and MediaStack only once a day at 00 UTC; the other sources run every time. Set `INGEST_ALL_SOURCES=1` to force GNews and MediaStack for a manual run.

| Source | Calls per run | Per month (12 runs/day x 30 days) | Documented free limit | Verdict |
|--------|---------------|---------------------|-----------------------|---------|
| RSS feeds | 47 feed requests | n/a | none | fine |
| Guardian API | 19 (unique sections, shared across categories), all sent in parallel (`Promise.all`) | 6840 (about 228/day) | Not verified: the access page could not be fetched on 2026-10-18. Commonly cited developer-key limits are 12 req/s and 5,000 req/day; check [the access page](https://open-platform.theguardian.com/access/) before relying on this. | Unverified. 19 simultaneous requests may exceed a per-second limit |
| GNews | 7 (categories with a GNews topic), on 6 of 12 runs | 42/day (1260/month) | Free plan: 100 requests/day, 10 articles/request, 12 h delay (checked 2026-10-18 on [gnews.io](https://gnews.io/#pricing)) | within budget |
| MediaStack | 3 by default, on 1 of 12 runs (`MEDIASTACK_MAX_CALLS_PER_RUN`, rotating over the 7 distinct MediaStack categories) | ~90 | Free plan: 100 calls/month (checked 2026-10-18 on [mediastack.com/product](https://mediastack.com/product)) | within budget |
| `og:image` page fetches | at most 60 | n/a | none (hotlink to publishers) | fine |
| Groq / Gemini | at most ceil(articles needing a summary / 8) per provider | n/a | provider-defined, may change: see [Groq limits](https://console.groq.com/docs/rate-limits) and [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits) | see below |
| Push tick (every 15 min) | 0 external API calls unless subscriptions are due; then one push-service request per due subscription | n/a | n/a | fine |

MediaStack's free plan allows only 100 calls per month (verified 2026-10-18). Querying all 7 categories daily would need 210, so each run is capped at `MEDIASTACK_MAX_CALLS_PER_RUN` calls (default 3, about 90 per month at one MediaStack run per day, within the 100 limit). Categories are picked by a deterministic daily rotation (sorted distinct categories, start index = day-of-year (UTC) x cap mod 7, then `cap` consecutive, wrapping), so every category is covered every few days. Budget = runs per day x cap x 30 and must be <= 100: if you trigger extra manual runs, lower the cap or set it to `0`. Security note: the free plan serves only plain `http`, so the `access_key` travels in plaintext on every MediaStack request; use a key you can rotate and prefer disabling the source (`0` or unset key) if that is unacceptable. GNews allows 100/day: 7 calls per GNews run x 6 runs = 42/day, leaving room for manual runs.

Example real run (scratch database, not the production database, RSS + Guardian + GNews + MediaStack keys set, no LLM keys):

```
fetched 1608, kept 244, created 244, updated 0, summarized 244, llmSummarized 0, llmCalls 0, failures []
```

`llmCalls` is 0 because no Groq/Gemini keys were configured, so all 244 summaries were extractive. With keys, the first run would make up to ceil(244 / 8) = 31 calls per provider; later runs only summarize articles that are new or still have an extractive summary. A steady-state daily count was not measured. In that run, most GNews calls and all but one MediaStack call returned HTTP 429 (the free quotas had already been used by earlier verification runs the same day); the ingest continued with the other sources, which is the intended behavior.

## Known limitations

- Deduplication is token-based. It will not merge aliases such as "Fed" and "Federal Reserve", and occasionally merges two distinct events with near-identical headlines into one card (both outlets' links stay available).
- Push delivery depends on the GitHub Actions scheduler, which can run late. A push is skipped for the day if the scheduler is down more than 3 hours after the chosen time. The window does not wrap past local midnight.
- The articles list is served network-first by the service worker (3 s timeout, then a cached copy younger than 6 h, else a 503 `offline` JSON), so a notification tap shows fresh stories whenever the network is up.
- `/api/articles/<id>` (single story) is served network-first by the service worker like the list, and the brief `POST` is never cached (only GET responses are cacheable).
- Push sending claims the subscription before sending, so delivery is at-most-once: a crash or push-service error after the claim means no retry that day.
- Images are hotlinked from publishers. Some may block or break; the card falls back gracefully.
- The `og:image` fallback fetches publisher pages from the server IP, which some sites may block.
- Web Push, PWA install and offline behavior were not verified on real devices during development.

## Compatibility notes

- The `localStorage` key `newsintel_saved_articles` keeps its old name: renaming it would silently wipe users' saved articles.
- The default MongoDB fallback URI in `src/lib/db.ts` still ends in `/newsintel` (used only when `MONGODB_URI` is unset); an existing database keeps its name.
- `DEVELOPMENT_LOG.md` and `PROJECTPLAN.md` describe the pre-v2 app and are historical.

## Further docs

- Design spec: `docs/superpowers/specs/2026-10-18-newsintel-v2-design.md`
- Implementation plan: `docs/superpowers/plans/2026-10-18-datrix-v2.md`
