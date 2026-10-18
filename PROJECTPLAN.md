> **Superseded.** This file describes the pre-v2 NewsIntel app. The current design is in `docs/superpowers/specs/2026-10-18-newsintel-v2-design.md` and the implementation plan is `docs/superpowers/plans/2026-10-18-datrix-v2.md`. Kept as history.

# 1. What This App Is (Clear Product Definition)

### App Name (working)

**NewsIntel** (you can rename later)

### One-line definition

> **NewsIntel is an AI-powered news intelligence app that aggregates, ranks, and summarizes the most important global news into concise, readable insights—saving users hours every day.**

### What makes it different

This is **not a normal news app**.

- It does **not show everything**
- It shows **what matters**
- It explains **why it matters**
- It removes **noise, repetition, and clickbait**

Think of it as:

> **“Your personal daily news analyst.”**

---

# 2. What Problem This App Solves

### The real problems

1. Too many news sources
2. Same news repeated everywhere
3. Long articles with low signal
4. No time to read everything
5. Difficulty understanding _impact_

### Your app solves this by:

- Aggregating trusted sources
- Removing duplicates
- Ranking importance
- Generating **high-quality summaries**
- Delivering a **daily digest**

---

# 3. What This App Is Used For

### Primary use cases

- Staying updated in **5–10 minutes/day**
- Tracking **AI, tech, economy, world events**
- Understanding **impact**, not just headlines
- Quickly searching past important news
- Reading on **mobile or desktop**

### Target users

- Developers & tech professionals
- Startup founders
- Students
- Knowledge workers
- Anyone who values time + clarity

---

# 4. Core Features (Professional & Necessary)

## A. News Aggregation (Free & Legal)

### Data sources (combined approach)

- Free news APIs
  - **GNews**
  - **MediaStack**

- RSS feeds from trusted publications
- Optional trend signals (non-content)

⚠️ No scraping. No copyrighted rewriting.

---

## B. De-duplication Engine

- Detects same story from multiple sources
- Merges them into **one canonical news item**

Result:

> 10 articles → 1 clean story

---

## C. Importance & Trend Scoring

Each news item gets an **importance score** based on:

- Source credibility
- Frequency across sources
- Freshness
- Topic relevance

Only **high-score news** is summarized.

---

## D. AI Summaries (Quality Focused)

Each article contains:

1. **TL;DR (2 lines)**
2. **Key Points (bullets)**
3. **Why It Matters (context)**
4. _(Optional)_ Potential impact

Summaries are:

- Neutral
- Fact-preserving
- Cached forever (no reprocessing)

---

## E. Filters & Search

- Category (AI, Tech, Economy, World)
- Time range
- Importance level
- Keyword + semantic search

---

## F. Daily Digest (Retention Feature)

- Automatically generated once per day
- Shows top 5–10 most important stories
- Cached & reused

---

## G. Responsive, Modern UI (Critical)

- Mobile-first design
- Desktop-optimized layout
- Dark mode by default
- Card-based reading experience
- Smooth transitions & skeleton loaders

---

# 5. UI / UX DESIGN (High Retention Focus)

## Design Principles

- **Clarity over clutter**
- **Reading comfort**
- **Minimal cognitive load**
- **Fast scanning**

---

## Layout Structure

### Desktop

```
Sidebar (Categories)
Main Feed (Ranked Cards)
Right Panel (Filters / Digest)
```

### Mobile

```
Top Bar
Scrollable Feed
Bottom Sheet Filters
Swipeable Cards
```

---

## Card Design

Each news card shows:

- Title
- Importance badge (High / Medium)
- Category icon
- Published time
- TL;DR preview

Tap → opens **summary modal**

---

## UX Enhancements

- Infinite scroll with pagination
- Skeleton loading states
- Sticky filter bar
- Save/bookmark animation
- Read progress indicator

---

# 6. Technical Architecture (100% Free)

## Stack

- Framework: **Next.js (App Router)**
- Styling: Tailwind CSS
- Database: MongoDB Atlas (free)
- Search: MongoDB Atlas Search
- Cache: Upstash Redis (free)
- Hosting: Vercel (free)
- Version control: GitHub

---

## Data Model (Simplified)

### `articles`

```ts
{
  title,
  url,
  source,
  category,
  publishedAt,
  importanceScore,
  topics[],
  summary: {
    tldr,
    bullets[],
    whyItMatters
  }
}
```

---

# 7. Automation & Cron Jobs (Very Important)

## A. Daily News Update Cron

### Using Vercel Cron Jobs

Runs **once per day**:

1. Fetch news
2. Normalize
3. De-duplicate
4. Score importance
5. Summarize top news
6. Store in DB

---

## B. GitHub Auto-Update Cron (Requested Feature)

### Purpose

- Keep repository updated
- Maintain daily data snapshot
- Transparent update history

### How it works

- Daily cron job exports:
  - Daily digest JSON
  - Trending topics summary

- Commits to GitHub automatically via GitHub Actions

Example:

```text
/data/daily/2026-02-21.json
```

This is **great for credibility and debugging**.

---

# 8. SEO & Performance

- Static generation for main feed
- Dynamic rendering for search
- Meta tags per article
- OpenGraph previews
- Fast page loads

---

# 9. DETAILED STEP-BY-STEP EXECUTION PROMPT

### (You can copy this directly)

---

### PROJECT PROMPT

> Build a fully responsive AI-powered news intelligence application using Next.js that aggregates, ranks, summarizes, and presents the most important global news in a clean, modern UI.

#### Requirements:

1. Use **Next.js (App Router)** with Tailwind CSS
2. Fetch news using free APIs and RSS feeds
3. Normalize and de-duplicate articles
4. Score importance using credibility, freshness, and frequency
5. Summarize only high-importance articles
6. Store summaries permanently
7. Create daily cron jobs for:
   - News ingestion
   - Digest generation
   - GitHub data updates

8. Implement:
   - Filters
   - Search
   - Daily digest

9. Design:
   - Mobile-first
   - Dark mode
   - Card-based UI
   - Smooth animations

10. Ensure:
    - Fast load times
    - Clean UX
    - Readable typography
    - High information quality

---

# 10. Why This App Is Strong

✅ Free to run
✅ Legal & ethical
✅ Scales well
✅ High daily value
✅ Excellent portfolio project
✅ Potential real users

---

## Additionally

# STEP 1 — PRODUCT & UX FOUNDATION (WHY + EXPERIENCE)

Before UI or code, we lock the **experience**.

## What this app _feels like_ to use

- Calm
- Trustworthy
- Intelligent
- Fast
- Focused on _signal, not noise_

User opens the app and thinks:

> “Oh… this is everything important. I don’t need to search.”

---

## Core UX principles

1. **One glance value** (TL;DR visible immediately)
2. **Progressive disclosure** (details only when needed)
3. **Zero overwhelm**
4. **Mobile-first reading comfort**
5. **Consistency everywhere**

---

## Information hierarchy (VERY IMPORTANT)

Every news item has this priority order:

1. Importance badge
2. Headline
3. TL;DR
4. Key points
5. Why it matters

Never break this order.

---

# STEP 2 — UI WIREFRAMES (DESKTOP + MOBILE)

## 2.1 Desktop Wireframe (Primary)

```
┌──────────────────────────────────────────────┐
│  NewsIntel                                   │
├───────────────┬──────────────────────────────┤
│  Categories   │  Daily Digest                │
│               │  ─────────────────────────   │
│  ▸ AI         │  🔥 Top 5 Stories Today       │
│  ▸ Tech       │                              │
│  ▸ Economy    │  [High] AI regulation bill   │
│  ▸ World      │  [High] Fed interest rates   │
│               │                              │
│───────────────┼──────────────────────────────┤
│               │  Main Feed (Ranked)           │
│               │                              │
│               │  ┌──────────────────────┐   │
│               │  │ HIGH · AI             │   │
│               │  │ OpenAI releases new…  │   │
│               │  │ TL;DR: Model improves │   │
│               │  └──────────────────────┘   │
│               │                              │
└──────────────────────────────────────────────┘
```

---

## 2.2 Mobile Wireframe (Critical)

```
┌─────────────────────┐
│ ☰ NewsIntel   🔍    │
├─────────────────────┤
│ 🔥 Daily Digest     │
│ ───────────────    │
│ [High] AI policy    │
├─────────────────────┤
│ HIGH · TECH         │
│ Apple announces…    │
│ TL;DR: New chips…   │
│                     │
│ MEDIUM · ECONOMY    │
│ Inflation slows…    │
└─────────────────────┘
```

### Mobile UX rules

- Thumb-friendly
- Swipe to dismiss
- Bottom-sheet filters
- Tap opens summary modal

---

## 2.3 Visual Style Guide

### Colors

- Dark-first UI
- Neutral backgrounds
- Accent color per category

Example:

- AI → Purple
- Tech → Blue
- Economy → Amber
- World → Green

### Typography

- Headline: Inter / Geist / SF
- Body: relaxed line-height
- TL;DR slightly emphasized

---

# STEP 3 — DATA & BACKEND ARCHITECTURE

## 3.1 News Sources (FREE & LEGAL)

We combine:

- **GNews**
- **MediaStack**
- RSS feeds (trusted publishers only)

❌ No scraping
❌ No rewriting full articles

---

## 3.2 Data Flow (Very Important)

```
CRON (daily)
↓
Fetch (API + RSS)
↓
Normalize
↓
De-duplicate
↓
Score importance
↓
Summarize top stories
↓
Store
↓
Update GitHub snapshot
```

---

## 3.3 Database Schema (Production-Grade)

### `articles`

```ts
{
  _id,
  title,
  url,
  source,
  category,
  publishedAt,
  importanceScore,
  topics[],
  summary: {
    tldr,
    bullets[],
    whyItMatters
  },
  createdAt
}
```

### Indexes

- `publishedAt`
- `category`
- `importanceScore`
- `title` (search)

---

# STEP 4 — IMPORTANCE SCORING (REAL LOGIC)

## 4.1 Why scoring matters

Without scoring:

> You build a feed, not an intelligence app.

---

## 4.2 Scoring Formula (Simple but Powerful)

```
score =
(sourceCredibility × 0.4)
+ (frequencyAcrossSources × 0.3)
+ (freshness × 0.2)
+ (topicWeight × 0.1)
```

### Thresholds

- High: ≥ 0.75
- Medium: 0.5 – 0.74
- Low: < 0.5 (ignored)

Only **High + Medium** get summarized.

---

# STEP 5 — AI SUMMARIZATION (QUALITY FIRST)

## 5.1 Golden Rules

- Neutral
- Factual
- Short
- Context-aware
- Cached forever

---

## 5.2 Summarization Prompt Template

```
You are a professional news analyst.

Summarize the following news article.

Rules:
- No opinions
- No speculation
- Preserve facts
- No sensational language

Output format:
TL;DR (max 2 lines)
Key Points (3–5 bullets)
Why It Matters (1 short paragraph)

Article:
{content}
```

---

## 5.3 Cost Control (Free Strategy)

- Summarize once
- Store forever
- Only summarize top stories
- Reuse cached summaries

---

# STEP 6 — CRON JOBS & AUTOMATION

## 6.1 Daily News Cron (Vercel)

Runs every day:

- Fetch
- Score
- Summarize
- Store

---

## 6.2 GitHub Auto-Update Cron (Requested)

### What gets pushed daily

```
/data/daily/2026-02-21.json
```

Contents:

- Top stories
- Categories
- Scores
- Summary metadata

### How

- GitHub Actions
- Commit via bot token
- One commit per day

This:

- Keeps repo alive
- Shows transparency
- Helps debugging
- Builds credibility

---

# STEP 7 — FRONTEND IMPLEMENTATION (NEXT.JS)

## Pages

- `/` → ranked feed
- `/category/[slug]`
- `/search`
- `/digest`
- `/saved`

## Components

- `NewsCard`
- `SummaryModal`
- `FilterBar`
- `DigestPanel`

---

## UX Enhancements

- Skeleton loaders
- Infinite scroll
- Smooth modal animations
- Sticky filters
- Read indicators

---

# STEP 8 — 30-DAY EXECUTION ROADMAP

### Week 1

- Setup
- DB schema
- Fetchers
- Cron job

### Week 2

- Scoring
- Summarization
- API routes

### Week 3

- UI
- Mobile responsiveness
- Filters
- Search

### Week 4

- Polish
- GitHub cron
- Performance
- Deployment

---

# STEP 9 — WHY THIS PROJECT IS EXCELLENT

- Real-world usefulness
- Strong portfolio signal
- Demonstrates:
  - System design
  - UX thinking
  - AI integration
  - Automation

- Can grow into:
  - Newsletter
  - Mobile app
  - Paid tier later

---
