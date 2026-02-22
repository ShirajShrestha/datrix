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
