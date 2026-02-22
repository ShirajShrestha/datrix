# NewsIntel

> AI-Powered News Intelligence - Stay informed with what matters

NewsIntel aggregates, ranks, and summarizes the most important global news into concise, readable insights—saving you hours every day.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)

## Why NewsIntel?

The problem with traditional news apps:
- ❌ Show everything (noise)
- ❌ Same news repeated everywhere
- ❌ Long articles with low signal
- ❌ No time to read everything

What NewsIntel does:
- ✅ Shows **what matters** (importance scoring)
- ✅ Removes **duplicates** (de-duplication engine)
- ✅ Provides **AI summaries** (TL;DR, key points, why it matters)
- ✅ Saves hours with **daily digest**

## Features

### Core Intelligence
- **News Aggregation** - Fetches from RSS feeds (BBC, NYT) + GNews API
- **De-duplication** - Merges similar stories into one canonical item
- **Importance Scoring** - Ranks by source credibility, freshness, frequency
- **AI Summaries** - TL;DR, key points, and "why it matters"

### User Experience
- **Dark Mode** - Easy on the eyes
- **Mobile-First** - Works great on phone and desktop
- **Category Filters** - AI, Tech, Economy, World
- **Search** - Find specific topics
- **Daily Digest** - Top 10 stories at a glance
- **Save Articles** - Bookmark for later (localStorage)

### Automation
- **Cron Jobs** - Automatically fetches news daily
- **MongoDB Storage** - Articles persist between visits
- **Smart Caching** - Uses stored data instead of repeated API calls

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | Framework (App Router) |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| MongoDB Atlas | Database (free tier) |
| Vercel | Hosting + Cron Jobs |
| GNews API | News data (free tier) |
| RSS Parser | Feed parsing |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free)
- GNews API key (free)

### Installation

```bash
# Clone the repo
git clone <your-repo>
cd newsintel

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your credentials to .env.local
MONGODB_URI=your_mongodb_connection_string
GNEWS_API_KEY=your_gnews_api_key
CRON_SECRET=your_secret_key
```

### Get Free API Keys

1. **MongoDB Atlas**: https://mongodb.com/atlas (512MB free)
2. **GNews**: https://gnews.io (100 requests/day free)

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
newsintel/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── api/
│   │   │   ├── cron/          # Cron job endpoints
│   │   │   ├── news/          # News API
│   │   │   └── search/        # Search API
│   │   ├── category/           # Category pages
│   │   ├── digest/            # Daily digest
│   │   ├── saved/             # Bookmarked articles
│   │   └── search/            # Search page
│   ├── components/             # React components
│   │   ├── NewsCard.tsx
│   │   ├── FilterBar.tsx
│   │   ├── Sidebar.tsx
│   │   └── ...
│   └── lib/
│       ├── db.ts               # MongoDB connection
│       ├── models/             # Mongoose schemas
│       └── services/           # Business logic
│           ├── newsFetcher.ts
│           ├── scoring.ts
│           └── summarizer.ts
├── vercel.json                 # Cron schedule config
└── .env.local                 # Environment variables
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/search` | Search articles (with filters) |
| `GET /api/cron/news` | Fetch & store news (authenticated) |
| `GET /api/cron/digest` | Generate daily digest |

### Search API Usage

```bash
# Basic search
curl http://localhost:3000/api/search

# Filter by category
curl http://localhost:3000/api/search?category=ai

# Filter by importance
curl http://localhost:3000/api/search?importance=high

# Search by keyword
curl http://localhost:3000/api/search?q=technology

# Combined filters
curl "http://localhost:3000/api/search?category=tech&importance=high"
```

## Cron Jobs

The app automatically runs daily to fetch fresh news:

- **News Fetch** - 6:00 AM UTC daily
- **Digest Generation** - 7:00 AM UTC daily

Configure in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/news", "schedule": "0 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "0 7 * * *" }
  ]
}
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Settings
4. Deploy!

Vercel automatically enables cron jobs for Pro accounts (free for personal use).

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    DAILY CRON JOB                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐      │
│  │  GNews   │ +  │   RSS    │ →  │  Dedupe &   │      │
│  │   API    │    │   Feeds  │    │   Score     │      │
│  └──────────┘    └──────────┘    └──────────────┘      │
│                                              │          │
│                                              ▼          │
│                                     ┌──────────────┐    │
│                                     │   MongoDB    │    │
│                                     │   Storage    │    │
│                                     └──────────────┘    │
└─────────────────────────────────────────────────────────┘
                                           │
                    ┌───────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────┐
│                     USER VISIT                           │
│  ┌──────────────┐    ┌──────────────────────┐         │
│  │  /api/search │ →  │  Check MongoDB First │         │
│  └──────────────┘    └──────────────────────┘         │
│                            │                            │
│              ┌─────────────┴─────────────┐              │
│              ▼                           ▼              │
│     ┌─────────────────┐      ┌──────────────────┐    │
│     │  Data exists?    │      │  DB Empty?       │    │
│     │  Return cached   │      │  Fetch live      │    │
│     └─────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Importance Scoring Formula

```
Score = (Source Credibility × 0.4) 
      + (Frequency × 0.3) 
      + (Freshness × 0.2) 
      + (Topic Weight × 0.1)
```

| Level | Score | Action |
|-------|-------|--------|
| HIGH | ≥ 0.75 | Summarized |
| MEDIUM | 0.5-0.74 | Summarized |
| LOW | < 0.5 | Filtered out |

## Screenshots

The app features:
- Clean, dark-themed UI
- Card-based news display
- Expandable summaries
- Category filtering
- Mobile navigation
- Daily digest panel

## License

MIT License - Feel free to use for learning or building your own projects.

## Credits

Built with Next.js, Tailwind CSS, MongoDB, and Vercel.
