# Datrix v2 — Design

App name: **Datrix** (formerly "NewsIntel" in the README and repo folder). **[Decided]**

Status: DRAFT for owner review. Nothing is built yet.
Marks: **[Decided]** = owner said so. **[My call]** = assistant's default, owner can overrule. **[Open]** = needs owner answer.

## 1. Intent

NewsIntel today shows ~20 top stories a day in 4 fixed categories (AI, Tech, Economy, World) for one anonymous reader. Summaries are template text, cards are text-only, and it cannot be installed or notify the reader.

v2 makes it a personal news app the owner (and anyone who opens the site) can tune to their interests, install on a phone, and get a morning notification from, using only free services.

## 2. Goals

1. Reader picks which categories they see, at first visit and later in Settings. **[Decided]**
2. Many more categories than today, backed by a bigger stored pool per category. **[Decided]**
3. Installable PWA with a Web Push notification each morning after fresh news is fetched. **[Decided]**
4. Free sources only: RSS as the backbone, Guardian Open Platform API, GNews/MediaStack as optional extras. **[Decided]**
5. Real AI summaries from a free LLM (Groq primary, Gemini Flash fallback, existing extractive summarizer as last fallback). **[Decided]**
6. Redesigned cards: image, headline, one-line TL;DR, "N sources" badge, "new since last visit", details behind expand. **[Decided]**
7. Fix the problems found in the current code (section 9).

## 3. Non-goals and anti-goals

- **No user accounts, login, or multi-user backend.** **[Decided]** Preferences live on the device. Failure if we end up storing passwords/emails.
- No paid APIs or paid tiers. A feature that needs a card on file is out.
- No full-article scraping as a main pipeline. Scraping is allowed only to read `og:image` from a page. **[My call]**
- No native apps, comments, social features, or per-user personalised ranking.
- Anti-goal: spending LLM quota per page view. Summaries are generated once, at fetch time.
- Anti-goal: a public endpoint that anyone can hit to burn API/LLM quota (see 9.1).

## 4. Constraints

- Free tiers only: MongoDB Atlas free (512 MB), Vercel Hobby, GitHub Actions, Groq/Gemini free tiers. Free-tier limits change; the owner must re-check provider pages before relying on the numbers in this doc.
- Keep the stack: Next.js (App Router), TypeScript, Tailwind, Mongoose.
- iOS only delivers Web Push to a PWA that was added to the Home Screen (iOS 16.4+). Android/desktop work in the browser.

## 5. Decisions

### 5.1 Users and preferences **[Decided]**
Single-user model. Selected categories, notification settings, and saved articles are stored in the browser (localStorage). The server filters by a `?categories=a,b,c` query parameter. The only per-device server record is the push subscription (5.5).

### 5.2 Categories and multi-label tagging **[Decided: broad categories include their sub-areas; My call: mechanism]**
Final list (14), owner-defined **[Decided]**:

| # | Slug | Label | Covers |
|---|---|---|---|
| 1 | `ai` | AI | AI, LLMs, automation, robotics, AI research |
| 2 | `technology` | Technology | Software, hardware, cybersecurity, startups, consumer tech |
| 3 | `business` | Business & Economy | Companies, markets, finance, inflation, trade, cryptocurrency |
| 4 | `world` | World | Major international developments and global events |
| 5 | `geopolitics` | Geopolitics | International relations, diplomacy, conflicts, global security |
| 6 | `politics` | Politics | Governments, elections, public policy, legislation |
| 7 | `law` | Law & Justice | Courts, legal decisions, human rights, legal reforms |
| 8 | `science` | Science | Discoveries, research, space, physics, biology |
| 9 | `health` | Health | Medicine, healthcare, diseases, public health |
| 10 | `environment` | Environment | Climate, sustainability, conservation, natural disasters |
| 11 | `sports` | Sports | Competitions, athletes, tournaments, events |
| 12 | `entertainment` | Entertainment | Movies, music, gaming, celebrities, streaming |
| 13 | `education` | Education | Universities, learning, education policy, academic developments |
| 14 | `society` | Society & Culture | Social trends, communities, migration, cultural developments |

Emoji icons are part of the label (🤖 💻 💼 🌍 🌐 🏛️ ⚖️ 🔬 🏥 🌱 ⚽ 🎬 🎓 👥). The existing slugs `tech` and `economy` become `technology` and `business`; stored articles using old slugs are migrated or simply expire (TTL) — builder's choice.

Sub-areas such as finance, markets and crypto live **inside** their parent category (Business & Economy), not as separate categories.

Volume note **[My call]**: 14 categories × ~25 pool = up to ~350 articles per ingest. Summaries are only generated for new articles and batched, so this stays inside free LLM limits, but the builder logs call counts. Some categories (Law, Education, Society) have fewer dedicated RSS feeds; they rely more on the Guardian API sections (law, education, society, culture) and keyword tagging, and may have fewer than 25 stories on some days.

Stories that sit between categories (e.g. sanctions = Geopolitics + Economy) are handled by **multi-label tagging**: an article has a primary category (from the feed it came from) plus zero or more extra categories added by keyword rules at ingest. It then shows under every selected category it matches, shown once in the feed (deduped across categories). The extra-label rules are simple keyword lists in the registry; if the LLM summary step is already running, it may also return suggested categories, validated against the registry. The schema stores `categories: string[]` (replacing the single `category`).

Each category has a registry entry: slug, label, colour, RSS feeds, optional Guardian section, optional GNews/MediaStack topic, keyword rules. Adding a category later = adding one registry entry. Local/regional news (e.g. Nepal) fits the same registry if wanted later.

### 5.3 Sources and images **[Decided: RSS + free APIs]**
- Backbone: RSS feeds per category, with **additional feeds beyond the current BBC/NYT** (e.g. Guardian, NPR, Al Jazeera, Ars Technica, The Verge, CNBC/MarketWatch-style finance feeds, Foreign Policy-style geopolitics feeds; exact URLs picked during build and verified live). **[Decided]**
- Guardian Open Platform API (free key) with `show-fields=thumbnail,trailText`. **[Decided]**
- GNews and MediaStack are **kept** as supplements, called sparingly because their free quotas are small. **[Decided]** The code already receives their `image` field and discards it; keep it.
- RSS parsing must read `media:thumbnail`, `media:content` and `enclosure` via `rss-parser` `customFields`.
- Image resolution order: feed image → API image → `og:image` fetched from the article page once at ingest → category-coloured placeholder.
- Store only the image URL. Render with `referrerPolicy="no-referrer"`; remote image hosts allow-listed in `next.config.ts` if `next/image` is used.
- The hard-coded `DEMO_ARTICLES` are removed from the production path (kept only behind an explicit dev flag).

### 5.4 Pipeline **[My call]**
Single daily ingest, one scheduler:
1. Fetch all category feeds in parallel with per-request timeouts; a failing feed must not fail the run.
2. Normalise, score (existing scoring), cluster near-duplicates (existing dedupe, extended to record the list of sources per cluster → "N sources").
3. Keep top ~25 per category (pool), not top 20 overall.
4. Summarise **only articles without a stored summary**, batching 5–10 per LLM call.
5. Upsert to Mongo. TTL index deletes articles ~30 days after publish (protects the 512 MB limit). Saved articles are unaffected because saving stores a snapshot on the device.
6. After a successful ingest, trigger push dispatch (5.5).

Scheduler: GitHub Actions only; remove the duplicate `vercel.json` crons. Reason: it already exists, supports secrets, can run multiple jobs (ingest daily, push hourly). Known downside: GitHub scheduled runs can start late or occasionally be skipped; acceptable for news.

If the ingest exceeds Vercel's function time limit, split into stages (ingest per category group, then summarise in chunks) — builder verifies actual limit on the owner's Vercel plan before choosing.

### 5.5 PWA and morning notification **[Decided: PWA + push; My call: details]**
- Replace `next-pwa` (unmaintained, shaky with Next 16/Turbopack) with Serwist or a small hand-written service worker. Cache app shell and the last fetched feed so the app opens offline.
- Manifest fixed: PNG icons 192/512 + maskable, `apple-touch-icon`, consistent name. (Current manifest points at a missing `icon-512.svg` and SVG icons.)
- Notifications are **Web Push** (VAPID keys via env, `web-push` library), not in-page toasts.
- Collection `pushSubscriptions`: endpoint, keys, categories, preferred local time (HH:MM), IANA timezone, last-sent date. No other personal data.
- **Default send time 08:00, customizable in Settings** (any HH:MM). **[Decided]** Default timezone is taken from the device (the owner's is Nepal, `Asia/Kathmandu`, UTC+5:45); it is stored per subscription so it is not hard-coded.
- Endpoints: subscribe, unsubscribe, update-preferences.
- Delivery: ingest runs once daily, scheduled so it finishes before the earliest plausible send (for 08:00 Nepal time = 02:15 UTC, ingest at about 00:00 UTC, i.e. ~05:45 Nepal). A GitHub Actions job every 15 minutes calls a dispatch endpoint that sends to subscriptions whose local time has reached their preferred time and who haven't been sent today (15-minute steps handle Nepal's :45 offset). Payload: top 1–3 headlines from the subscriber's categories; click opens the app. If the day's ingest hasn't completed, dispatch skips and retries next tick.
- Subscriptions returning 404/410 are deleted.
- Settings page shows install hint (important on iOS) and a "send test notification" button.

### 5.6 Summaries **[Decided providers; My call on mechanics]**
- One `summarize()` interface; providers tried in order: Groq → Gemini Flash → existing extractive summarizer.
- Strict JSON output (`tldr`, `bullets`, `whyItMatters`), validated; malformed output falls back to the next provider.
- Prompt restricts the model to the supplied title/description ("no outside facts") because only headline + snippet are available.
- The canned per-category "why it matters" text is removed; if the LLM path fails the field is omitted rather than filled with boilerplate.
- API keys in env vars; model names configurable by env so a retired free model is a config change.

### 5.7 UI **[Decided on cards; My call on the rest]**
Scope note: this section covers the functional UI needed by the features (cards, onboarding, Settings). A broader **UI/UX redesign is deliberately deferred to a separate pass after phases 0–7 are complete** (phase 8). **[Decided]**

- Card: thumbnail, source + favicon, headline, one-line TL;DR, "N sources" badge, "New" marker (article newer than the reader's last visit timestamp in localStorage), importance indicator. Expand reveals bullets, why-it-matters, links to all sources.
- First visit: onboarding sheet to choose categories (can be skipped = all categories).
- Settings page: category toggles, notifications on/off + time, theme, clear saved data.
- Home shows only chosen categories; category filter bar lists only those.
- Digest page builds from the chosen categories.

### 5.8 Saved articles **[My call]**
Saved list stays in localStorage and stores a snapshot of the article. The shared `isSaved` field in the Mongo model is removed because it is global state in a single-user-per-device design.

## 6. What is left to the builder
Exact feed URLs, scoring weights, card visual details (follow existing Tailwind/theme tokens), batch size, collection/index names, service-worker library choice (Serwist vs hand-written), file layout.

## 7. Phases and acceptance

| # | Phase | Done when |
|---|---|---|
| 0 | Hygiene | Cron secret rotated and moved to GitHub/Vercel secrets; secret removed from the workflow file; one scheduler only; `/api/news` no longer runs the pipeline per request. |
| 1 | Pipeline v2 | Category registry; RSS + Guardian ingest with images; per-category pool; dedupe records sources; TTL index; ingest run succeeds even when some feeds fail; unit tests for scoring/dedupe/parsing. |
| 2 | Summaries | Groq → Gemini → extractive chain; only new articles summarised; malformed output handled; a run costs well under free limits (log call counts). |
| 3 | Preferences UI | Onboarding + Settings; feed filtered by chosen categories; changes apply immediately and persist after reload. |
| 4 | Cards | New card design on home, category, search, saved, digest pages; mobile and desktop checked in a browser. |
| 5 | PWA | Installable on Android Chrome and iOS Home Screen (Lighthouse installable); offline shows last feed. |
| 6 | Push | Test notification works on Android and an installed iOS PWA; daily dispatch sends at the chosen local hour; dead subscriptions are cleaned up. |
| 7 | Polish | README/log updated; free-tier call counts documented; the unused hacks in `NewsCard.tsx` removed; app renamed to Datrix everywhere. |
| 8 | UI/UX redesign (later, own brainstorm) | Started only after 0–7 are done and accepted. Gets its own design conversation, possibly with mockups. |

Order rationale: 0 is a security fix; 1–2 produce the data everything else needs; 3–4 are visible value; 5–6 depend on a stable app.

## 8. Risks

- Free LLM tiers change or models get retired → provider chain, env-configured models, extractive fallback.
- RSS URLs rot → feed failures are isolated and logged; registry makes replacement easy.
- GitHub scheduled runs delayed → push may arrive late; acceptable, documented.
- iOS push requires install → clear hint in Settings.
- Mongo 512 MB → TTL index, no full-text article bodies stored.
- Image hotlinking blocked by some hosts → placeholder fallback.
- LLM invents facts from a thin snippet → constrained prompt, short outputs.

## 9. Problems found in current code (to fix)

1. `src/app/api/news/route.ts` is public and runs the entire fetch + score + summarise pipeline on every request, burning API quota; replace with a read from Mongo.
2. `.github/workflows/daily-cron.yml` contains the cron bearer secret in plain text in the repo. Treat it as leaked; rotate.
3. News cron is scheduled twice (GitHub Actions and `vercel.json`).
4. `public/manifest.json` references non-existent `icon-512.svg`; SVG-only icons break installability.
5. Only the top 20 overall are stored, which cannot support per-category choice.
6. GNews/MediaStack images are discarded.
7. "Why it matters" is boilerplate text per category.
8. `isSaved` is a global DB flag but saving is localStorage-based; inconsistent.
9. README says "NewsIntel", manifest says "Datrix", deploy URL is `datrix-mu.vercel.app` (resolved: name is Datrix).

## 10. Resolved and still open

Resolved by owner: name = Datrix; 08:00 default, customizable; timezone Nepal; keep GNews/MediaStack plus more RSS and Guardian; broad categories include sub-areas and Geopolitics is its own category; UI/UX redesign comes last.

Also resolved: final 14-category list (5.2); Guardian API key provided and stored locally in `.env.local` as `GUARDIAN_API_KEY` (gitignored, never in docs or code). It must also be added to Vercel/GitHub environment settings by the owner before deploy.

Still open: none blocking.
