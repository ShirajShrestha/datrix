# NewsIntel Development Log

## Project Overview

**NewsIntel** - An AI-powered news intelligence app that aggregates, ranks, and summarizes the most important global news into concise, readable insights.

---

## Completed Tasks

### 1. Project Setup
- **Date:** 2026-02-22
- **Description:** Initialized Next.js 16 project with TypeScript and Tailwind CSS
- **Why:** Required foundation for modern React application with type safety and responsive styling

### 2. Database Schema
- **Files:** 
  - `src/lib/db.ts` - MongoDB connection with caching
  - `src/lib/models/Article.ts` - Mongoose schema for articles
- **Why:** Establishes data layer for storing and retrieving news articles with proper indexing

### 3. Backend Services

#### News Fetcher (`src/lib/services/newsFetcher.ts`)
- Fetches from RSS feeds (BBC, NYT)
- Includes demo articles for testing
- Auto-categorizes articles using keyword detection
- **Why:** Provides legal, free news data without scraping

#### Importance Scoring (`src/lib/services/scoring.ts`)
- Implements scoring formula:
  - Source credibility (40%)
  - Frequency across sources (30%)
  - Freshness (20%)
  - Topic weight (10%)
- De-duplication engine to merge similar stories
- **Why:** Core intelligence feature - filters noise and surfaces what matters

#### AI Summarization (`src/lib/services/summarizer.ts`)
- Generates TL;DR summaries
- Creates key points bullets
- Explains why it matters
- Supports OpenAI integration (optional)
- **Why:** Transforms long articles into quick insights

### 4. API Routes
- `GET /api/news` - Fetches and processes all news
- `GET /api/search` - Search with filters (category, importance, query)
- **Why:** Provides data to frontend with server-side processing

### 5. Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| NewsCard | `src/components/NewsCard.tsx` | Displays article with expandable summary |
| FilterBar | `src/components/FilterBar.tsx` | Search + category/importance filters |
| Sidebar | `src/components/Sidebar.tsx` | Desktop navigation |
| MobileNav | `src/components/MobileNav.tsx` | Mobile bottom navigation |
| MobileHeader | `src/components/MobileHeader.tsx` | Mobile top header |
| DigestPanel | `src/components/DigestPanel.tsx` | Top 5 stories sidebar widget |
| Skeletons | `src/components/Skeletons.tsx` | Loading states |

### 6. Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Main feed with filters |
| `/category/[slug]` | `src/app/category/[slug]/page.tsx` | Category filter view |
| `/search` | `src/app/search/page.tsx` | Full-text search |
| `/digest` | `src/app/digest/page.tsx` | Daily top 10 |
| `/saved` | `src/app/saved/page.tsx` | Bookmarked articles |

---

## Features Summary

### Core Features (From Project Plan)
1. **News Aggregation** - RSS feeds + demo data
2. **De-duplication Engine** - Merges similar stories
3. **Importance Scoring** - Ranks by credibility, freshness, frequency
4. **AI Summaries** - TL;DR, key points, why it matters
5. **Filters & Search** - Category, importance, keyword search
6. **Daily Digest** - Top 10 ranked stories
7. **Responsive UI** - Mobile-first, dark mode

### UI/UX Features
- Card-based news display
- Expandable summaries on click
- Bookmark/save articles (localStorage)
- Skeleton loading states
- Category color coding
- Importance badges (HIGH/MEDIUM)
- Sticky filter bar

---

## Technical Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Database:** MongoDB (schema ready, connection configured)
- **Fonts:** Geist Sans/Mono
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **RSS Parsing:** rss-parser

---

## Notes

- App currently uses demo articles; add API keys for live news
- MongoDB connection string needs to be set in environment
- OpenAI API key optional for enhanced summarization
- All data processing happens server-side for performance

---

## Cron Job Setup (Vercel)

### API Endpoints Added
- `GET /api/cron/news` - Fetches and stores news in MongoDB (runs daily at 6 AM)
- `GET /api/cron/digest` - Generates daily digest (runs daily at 7 AM)

### Authentication
- Requires header: `Authorization: Bearer <CRON_SECRET>`
- CRON_SECRET must be set in environment variables

### Vercel Configuration (`vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/news", "schedule": "0 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "0 7 * * *" }
  ]
}
```

### Testing Cron Jobs Locally
```bash
# Test news fetch
curl -H "Authorization: Bearer newsintel_cron_2024" http://localhost:3000/api/cron/news

# Test digest generation
curl -H "Authorization: Bearer newsintel_cron_2024" http://localhost:3000/api/cron/digest
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| MONGODB_URI | Yes | MongoDB Atlas connection string |
| GNEWS_API_KEY | Yes | For fetching real news |
| COHERE_API_KEY | Optional | AI summarization |
| CRON_SECRET | Yes | For cron job authentication |
| UPSTASH_REDIS_REST_URL | Optional | Redis caching |

---

## Recent Updates (2026-02-22)

### Data Flow Optimization

**Problem:** Previously, homepage used hardcoded demo data and always fetched fresh data on each request.

**Solution:** Updated `/api/search` to:
1. **First** check MongoDB for stored articles (from cron job)
2. **If DB has data** → return stored articles (fast, no API calls)
3. **If DB empty** → fetch live news as fallback

**API Response now includes:**
- `source: "database"` - Data from MongoDB (cached by cron)
- `source: "live"` - Data fetched fresh from APIs

### Files Updated
- `src/app/api/search/route.ts` - Now fetches from MongoDB first

### Verified Working
```bash
# Returns database source after cron has run
curl http://localhost:3000/api/search
# {"success":true,"source":"database","count":20,...}
```

### How It Works Now
1. **Cron runs** (daily at 6 AM) → fetches news → saves to MongoDB
2. **User visits homepage** → `/api/search` checks MongoDB → returns stored data
3. **Multiple visits** → same MongoDB data (no new API calls)
4. **Only when DB empty** → fetches live data as fallback

This ensures:
- No repeated API calls to GNews/RSS (saves API quota)
- Fast page loads (MongoDB query is quick)
- Data persists between visits

---

## Recent Updates (2026-02-22) - UI/UX Redesign

### Design System Overhaul

**Typography:**
- Dual-font system: Inter (sans) for UI elements, Lora (serif) for headlines
- Playfair Display for display/brand elements
- Refined type scale for better hierarchy

**Color Palette:**
- Premium dark mode: #0a0a0c base, #0f0f12 sidebar
- Light mode: #fcfcfc base, #ffffff sidebar
- Glassmorphism effects with backdrop-blur
- Category accent colors (AI=purple, TECH=cyan, ECONOMY=green, WORLD=blue)
- Brand accent: #6366f1 (indigo)

**Layout:**
- Fluid grid system (240px sidebar, flexible content, 320px digest panel)
- Sticky header with centered search bar
- Responsive breakpoints (mobile bottom nav, collapsible sidebar)

**Components:**
- Article cards with category-colored left border accent
- Expandable cards with "Key Points" and "Why It Matters" sections
- Hover-reveal actions (bookmark, share, read more)
- Daily Digest panel with bold ordinal numbers
- Theme toggle (dark/light) with smooth transitions

### Summarization Improvements

**Enhanced Key Points:**
- Increased from 5 to 8 bullet points per article
- Improved sentence extraction with better keyword scoring
- Longer bullet length limit (120 chars vs 100)

**Better "Why It Matters":**
- Category-specific impact statements (4 options per category)
- More detailed and context-aware explanations
- References article title for personalization

### PWA Support Added

**Files Created:**
- `public/manifest.json` - PWA manifest with app name, colors, icons
- `public/icon-192.svg` - App icon (192x192)
- `public/icon-512.svg` - App icon (512x512)

**Configuration:**
- Updated `next.config.ts` with next-pwa plugin
- Configured for offline support, auto-install prompt
- Standalone display mode for mobile

### Bug Fixes

1. **Light mode text readability** - Fixed hardcoded dark colors (text-white, etc.) to use CSS variables
2. **Main content padding** - Added 32px horizontal padding (16px mobile)
3. **Header layout** - Fixed sticky header with proper spacing
4. **Mobile theme toggle** - Removed duplicate, kept only in header
5. **Pro card removed** - Removed upgrade card from sidebar

---

## Technical Stack (Updated)

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS with CSS variables
- **PWA:** next-pwa
- **Fonts:** Inter, Lora, Playfair Display, DM Sans
- **Icons:** Lucide React
- **Themes:** next-themes (dark/light toggle)
- **PWA:** next-pwa
- **Date Handling:** date-fns
- **RSS Parsing:** rss-parser

---

## GitHub Actions Cron Setup

### Why GitHub Actions?
- Vercel cron jobs require Pro plan
- GitHub Actions runs free on public repos
- Schedules can run daily without deployment

### Workflow File
Created `.github/workflows/daily-cron.yml`:

```yaml
name: Daily News Cron

on:
  schedule:
    - cron: '0 6 * * *'  # 6:00 AM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - name: Call Vercel News Cron
        run: |
          curl -X GET "https://newsintel.vercel.app/api/cron/news" \
            -H "Authorization: Bearer newsintel_cron_2024"

  fetch-digest:
    runs-on: ubuntu-latest
    needs: fetch-news
    steps:
      - name: Call Vercel Digest Cron
        run: |
          curl -X GET "https://newsintel.vercel.app/api/cron/digest" \
            -H "Authorization: Bearer newsintel_cron_2024"
```

### Important Notes
- GitHub Actions `curl` calls do NOT trigger Vercel deployments
- Only `git push` triggers deployment
- CRON_SECRET must match in both Vercel and GitHub Actions
- URL must be updated to your actual Vercel deployment URL
