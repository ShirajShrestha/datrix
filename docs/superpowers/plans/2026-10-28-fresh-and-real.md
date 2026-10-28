# Fresh & Real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Today actually show today's news (including Nepal), refresh it every 2 hours, and summarize real article text instead of RSS teasers, at zero cost.

**Architecture:** Ingest moves out of the Vercel route into a plain Node script run by GitHub Actions (no 120 s limit). Today's feed is re-ranked on read with an age decay. Article bodies (from RSS `content:encoded`, Guardian `bodyText`, or a Readability fetch) feed the LLM prompt but are never stored.

**Tech Stack:** Next.js 16, Mongoose/Atlas M0, Vitest, `tsx` (script runner), `@mozilla/readability` + `linkedom`, Groq/Gemini free tiers (already wired).

**Spec:** Decisions agreed in conversation on 2026-10-28 (review of the app, then free-options discussion), restated under "Design decisions" below. Background: `docs/superpowers/specs/2026-10-18-newsintel-v2-design.md`. Branch: create `feat/fresh-and-real` from `redesign/v2`.

## Global Constraints

- Free only: no paid service, no new required env var. All API keys stay optional, as today.
- Node 20 in CI. Code uses the `@/` alias; the script must resolve it (tsx reads `tsconfig.json` paths).
- Article body text is never written to MongoDB and never returned by `/api/articles` (copyright; personal-use app).
- `GET /api/cron/news` keeps working (manual trigger) with its current 100 s budget.
- English only. Nepal coverage is English-language outlets.
- TDD with Vitest; each task ends with `npm test` green plus a commit. Commit messages are conventional (`feat:`, `fix:`, `chore:`); the executor appends the attribution trailer the session requires.
- Existing tests that encode old behavior (category count 14, single-hit tagging) are updated in the task that changes the behavior.

## Design decisions

- **Recency:** Today and Digest request `fresh=48` (hours). The API fetches candidates in that window, re-ranks by `importanceScore * 0.5^(ageHours/24)`, and widens to 168 h if fewer than 12 articles qualify.
- **Local / Global:** Today gets a two-way toggle. Local = articles tagged `nepal`; Global = everything else in the user's chosen categories. Local ignores the category preferences (it is always Nepal), Global excludes `nepal`. This replaces any ranking boost for Nepal, since Nepal no longer competes with global stories.
- **Tagging:** a secondary category needs one non-generic keyword hit, or two distinct generic hits.
- **Nepal:** new category `nepal` (🇳🇵). Verified working feeds on 2026-10-28: Online Khabar English, The Rising Nepal, Nepali Times, Nepal News, Khabarhub English. Kathmandu Post and The Himalayan Times serve HTML at their feed URLs (blocked), so they are excluded.
- **Ingest in Actions:** every 2 hours. Note: a private repo gets 2,000 free Actions minutes/month, and `push.yml` alone (every 15 min, ≥1 billed minute per run) already uses about 2,900. Make the repo public after a secret scan of history (Prerequisites) or ingest and push will be throttled by billing.
- **Bodies:** fetch for the top 40 articles that still need an LLM summary. Prompt gets 2,000 chars of body, 4 articles per call (3,500-token-ish calls stay under free per-minute token limits). On HTTP 429 the script sleeps 20 s and retries once before declaring the provider exhausted.

## Prerequisites (human, before Task 4 goes live)

- [ ] Scan history for leaked secrets (`brew install gitleaks && gitleaks detect`), rotate anything found, then make the repo public (or accept a 3 h cron and a slower push cadence).
- [ ] Add repository secrets: `MONGODB_URI`, `GUARDIAN_API_KEY`, `GNEWS_API_KEY`, `MEDIASTACK_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` (existing `APP_URL`/`CRON_SECRET` stay for push).

## Review Focus

1. Fewer than 12 fresh articles (quiet night, failed ingest) → widen to 168 h; the page must never come back empty while older stories exist. (Task 3)
2. Blocked or paywalled page (403, redirect to login, under 400 chars of text) → body is `null`, summary falls back to the description, the run does not fail. (Task 6)
3. Future-dated or invalid `publishedAt` → age clamped to 0 so rank never exceeds importance; invalid date ranks as 7 days old. (Task 3)
4. Body text leaking to storage or API → `buildOps` output and `toArticleDTO` output contain no `body` key. (Tasks 5, 8)
5. Groq 429 twice, Gemini key missing → articles still get extractive summaries and the run completes with a `summarizer:groq:429` failure entry. (Task 7)

---

### Task 1: Tagging precision

**Files:**
- Modify: `src/lib/categories.ts` (`tagCategories`, matcher construction)
- Test: `src/lib/__tests__/categories.test.ts`

**Interfaces:**
- Produces: `tagCategories(primary: CategorySlug, title: string, description?: string): CategorySlug[]` (signature unchanged); `GENERIC_KEYWORDS: ReadonlySet<string>` exported.

- [ ] **Step 1: Write failing tests** in `categories.test.ts`:
  - `tagCategories('world', 'Oil prices rise as vote nears')` equals `['world']` (oil and vote are each a single generic hit in different categories).
  - `tagCategories('world', 'New app lets cafes cut food waste')` equals `['world']`.
  - `tagCategories('geopolitics', 'Sanctions hit oil exports')` equals `['geopolitics', 'business']` (two distinct generic business hits; existing test, must stay green).
  - `tagCategories('world', 'Stocks fall as elections loom')` equals `['world', 'business', 'politics']` (`stock` and `election` are non-generic; existing test).
  - `tagCategories('world', 'Prime minister opens bank branch')` contains `politics` (non-generic `prime minister`) and not `business` (single generic `bank`).
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/categories.test.ts`. Expected: the first two new tests FAIL.
- [ ] **Step 3:** Export `GENERIC_KEYWORDS = new Set(['app','war','oil','vote','trade','chip','drug','bank','import','export','market','campaign','space','trial','exam','film','students'])`. Build each category matcher as per-keyword regexes (same whole-word and `(s|es|ed)?` inflection rule as today). A category matches when the text hits at least one non-generic keyword, or at least two distinct generic keywords.
- [ ] **Step 4:** Run the categories test file. Expected: PASS (including the old regression tests).
- [ ] **Step 5:** Commit `fix: require stronger evidence for secondary category tags`.

### Task 2: Nepal category

**Files:**
- Modify: `src/lib/categories.ts` (type union, `CATEGORIES` append), `src/app/globals.css` (add `--cat-nepal`), `src/lib/services/scoring.ts` (`SOURCE_CREDIBILITY`)
- Test: `src/lib/__tests__/categories.test.ts`, `src/lib/__tests__/prefs.test.ts`

**Interfaces:**
- Produces: `CategorySlug` includes `'nepal'`; `getCategory('nepal')` returns label `Nepal`, emoji `🇳🇵`, weight `1.0`, `guardianSections: []`.

- [ ] **Step 1: Write failing tests.**
  - categories: update `ORDER` to append `'nepal'` and the unique-count expectation to 15 (rename the test "has 15 unique slugs").
  - categories: `tagCategories('world', 'Kathmandu protest turns violent')` contains `nepal`; `tagCategories('world', 'Nepalese climbers reach summit')` contains `nepal`.
  - prefs: `sanitizePrefs` of a stored value with the 14 old slugs returns exactly those 14 (no `nepal` injected, no crash), and `effectiveCategories(DEFAULT_PREFS)` includes `nepal`.
- [ ] **Step 2:** Run both files. Expected: FAIL.
- [ ] **Step 3:** Add the `nepal` entry at the end of `CATEGORIES` with keywords `['nepal','nepali','nepalese','kathmandu','pokhara','kp oli','himalaya','sherpa']` and these feeds (source name = `FeedDef.source`): `https://english.onlinekhabar.com/feed` "Online Khabar English"; `https://risingnepaldaily.com/rss` "The Rising Nepal"; `https://www.nepalitimes.com/feed` "Nepali Times"; `https://nepalnews.com/feed` "Nepal News"; `https://english.khabarhub.com/feed` "Khabarhub". Add `--cat-nepal: var(--tone-politics);`. Add credibility entries: Nepali Times 0.7, Online Khabar English 0.65, The Rising Nepal 0.6, Khabarhub 0.6.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`. Expected: PASS and no type errors (fix any exhaustive `Record<CategorySlug, …>` the compiler flags).
- [ ] **Step 5:** Smoke-check feeds: `curl -sL -A Mozilla/5.0 <each url> | grep -c "<item"` returns >0 for all five. Existing users keep their saved category list; Nepal appears for them after enabling it in Settings.
- [ ] **Step 6:** Commit `feat: add Nepal category with English-language feeds`.

### Task 3: Recency ranking

**Files:**
- Create: `src/lib/ranking.ts`
- Modify: `src/lib/articleQuery.ts`, `src/app/api/articles/route.ts`, `src/app/page.tsx` (fetch URL), `src/app/digest/page.tsx` (fetch URL)
- Test: `src/lib/__tests__/ranking.test.ts` (create), `src/lib/__tests__/articleQuery.test.ts`, `src/lib/__tests__/articlesRoute.test.ts` (create, mock `Article.find` the way `briefRoute.test.ts` mocks the model)

**Interfaces:**
- Produces in `ranking.ts`: `HALF_LIFE_HOURS = 24`, `rankScore(a: { importanceScore: number; publishedAt: Date | string }, now: number): number`, `rankArticles<T extends { importanceScore: number; publishedAt: Date | string }>(items: T[], now: number): T[]` (new array, descending by `rankScore`, ties by newer `publishedAt`).
- Produces in `articleQuery.ts`: `buildArticleQuery(params: URLSearchParams, now?: number): ArticleQuery` where `ArticleQuery` gains `freshHours?: number` (from `fresh` param, clamped 1–720, ignored when `q` is non-empty) and, when set, `filter.publishedAt = { $gte: Date }`; `FRESH_MIN_RESULTS = 12`, `FRESH_WIDEN_HOURS = 168`.

- [ ] **Step 1: Write failing tests.**
  - ranking: a 1 h old score-0.6 article outranks a 72 h old score-0.9 one; `rankScore` of a 24 h old article ≈ half its importance (±0.01); a `publishedAt` 3 h in the future scores exactly its importance; an invalid date string ranks as 168 h old; equal scores order by newer date.
  - articleQuery: `fresh=48` with `now` fixed gives `filter.publishedAt.$gte` equal to `new Date(now - 48*3600e3)`; `fresh=9999` clamps to 720; `fresh=48&q=climate` yields no `publishedAt` filter; no `fresh` leaves behavior unchanged.
  - route: with 5 docs inside 48 h, `Article.find` is called a second time with a 168 h filter and the response contains the union ranked; with 20 docs in the window it is called once; the candidate query uses `limit` = 2× requested, response is cut back to the requested limit.
- [ ] **Step 2:** Run the three files. Expected: FAIL (modules/params missing).
- [ ] **Step 3:** Implement `ranking.ts` (decay `0.5 ** (ageHours / HALF_LIFE_HOURS)` with `ageHours = max(0, …)`, invalid date → 168). Extend `buildArticleQuery`. In the route, when `freshHours` is set: query with limit×2, `rankArticles`, if fewer than `FRESH_MIN_RESULTS` rebuild the filter with `FRESH_WIDEN_HOURS` and requery, then slice to `limit`. Without `fresh`, behavior is unchanged. Change both client fetches to add `&fresh=48`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: rank Today by recency and widen when the window is thin`.

### Task 3b: Local / Global toggle on Today

**Files:**
- Create: `src/lib/scope.ts`
- Modify: `src/app/page.tsx` (state, fetch categories), `src/components/today.tsx` (new `ScopeToggle` component, Local empty state)
- Test: `src/lib/__tests__/scope.test.ts` (create)

**Interfaces:**
- Consumes: `CATEGORIES`, `CategorySlug` from `src/lib/categories.ts`.
- Produces in `scope.ts`: `type Scope = 'global' | 'local'`; `LOCAL_SLUG = 'nepal'`; `scopeCategories(scope: Scope, chosen: readonly string[]): string[]` — local returns `['nepal']`; global returns `chosen` minus `nepal`, or every non-`nepal` slug when that leaves nothing; `parseScope(v: unknown): Scope` (anything but `'local'` → `'global'`). In `today.tsx`: `ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void })`, a two-button segmented control (`role="group"`, `aria-pressed` on each, labels "Global" and "Local · Nepal").

- [ ] **Step 1: Write failing tests** in `scope.test.ts`: `scopeCategories('local', ['ai','world'])` equals `['nepal']`; `scopeCategories('global', ['ai','nepal','world'])` equals `['ai','world']`; `scopeCategories('global', ['nepal'])` equals every slug except `nepal` (14 entries); `parseScope('local')` is `'local'`, `parseScope('x')`, `parseScope(undefined)` are `'global'`.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/scope.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `scope.ts`. In `page.tsx`, hold `scope` in state, initialised from `parseScope(localStorage 'datrix_scope')` after hydration (wrapped in try/catch, storage failure falls back to global) and written back on change; build the fetch from `scopeCategories(scope, effectiveCategories(prefs))` and re-fetch when scope changes; reset the topic chip and "show more" on scope change; render `ScopeToggle` under the greeting. In Local, the empty state reads "No Nepal stories yet. The next refresh will bring some in." and `SixtySeconds` still uses the visible list.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`. Expected: PASS. Manually confirm in `npm run dev`: toggle switches the feed, the choice survives a reload, Local works even if Nepal is not in the saved categories.
- [ ] **Step 5:** Commit `feat: add Local and Global toggle to Today`.

### Task 4: Ingest as a standalone script on Actions

**Files:**
- Create: `scripts/ingest.ts`
- Modify: `src/lib/services/ingest.ts` (options), `package.json` (`tsx` devDependency, `"ingest": "tsx --env-file=.env.local scripts/ingest.ts"`), `.github/workflows/ingest.yml`, `README.md` (Schedulers, GitHub Actions, env sections)
- Test: `src/lib/__tests__/ingest.test.ts`

**Interfaces:**
- Produces: `runIngest(opts?: { clock?: () => number; budgetMs?: number; poolPerCategory?: number }): Promise<IngestReport>`. Defaults equal today's values (`INGEST_BUDGET_MS`, 25), so the Vercel route is unaffected. All internal uses of `INGEST_BUDGET_MS`/`POOL_PER_CATEGORY` read the options.

- [ ] **Step 1: Write failing test:** extend `ingest.test.ts` so `planImageBudget(elapsed, 600_000)` and `planFetchDeadline(0, 600_000)` return the values implied by the larger budget (`max` 60, fetch deadline 35 000), and add a test (mocking `fetchAllSources` to return 0 articles) that `runIngest({ budgetMs: 1 })` resolves to a report with `fetched: 0` without throwing.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/ingest.test.ts`. Expected: FAIL on the new option.
- [ ] **Step 3:** Thread `budgetMs`/`poolPerCategory` through `runIngest`. Write `scripts/ingest.ts`: calls `runIngest({ budgetMs: 600_000, poolPerCategory: 40 })`, prints the report as JSON, disconnects mongoose, `process.exit(report.fetched === 0 ? 1 : 0)`, and exits 1 with only the error name logged on throw.
- [ ] **Step 4:** Rewrite `ingest.yml`: cron `20 */2 * * *`, `workflow_dispatch`, `concurrency: ingest` (no overlapping runs), `timeout-minutes: 15`, steps checkout → `actions/setup-node@v4` (node 20, npm cache) → `npm ci` → `npx tsx scripts/ingest.ts` with the secrets from Prerequisites as `env`.
- [ ] **Step 5:** Verify locally: `npm run ingest`. Expected: JSON report with `fetched > 0`, `kept > 0`, exit code 0, and Nepal articles present (`mongosh`/Atlas UI: a `categories: "nepal"` document exists).
- [ ] **Step 6:** Update README (ingest now runs from Actions every 2 h; route is manual-only; secrets list). Run `npm test`. Commit `feat: run ingest from GitHub Actions every 2 hours`.

### Task 5: Carry article body through the pipeline

**Files:**
- Modify: `src/lib/sources/types.ts`, `src/lib/sources/rss.ts`, `src/lib/sources/guardian.ts`, `src/lib/services/scoring.ts` (`ScoredArticle`)
- Test: `src/lib/__tests__/rss.test.ts`, `src/lib/__tests__/sources.test.ts`, `src/lib/__tests__/ingest.test.ts`, `src/lib/__tests__/articlePayload.test.ts`

**Interfaces:**
- Produces: `RawArticle.body?: string` and `ScoredArticle.body?: string` (plain text, at most `MAX_BODY_CHARS = 6000`, exported from `src/lib/sources/types.ts`); `MIN_BODY_CHARS = 400` exported from the same file.

- [ ] **Step 1: Write failing tests.**
  - rss: `parseRssItem` of an item whose `content:encoded` strips to ≥400 chars sets `body` (stripped, ≤6000); one with a 100-char `content:encoded` leaves `body` undefined.
  - sources: `mapGuardianResult` with `fields.bodyText` of 1,000 chars sets `body`; without it, undefined.
  - ingest: `buildOps` output for an article carrying `body` has no `body` key anywhere in `$set` or `$setOnInsert`.
  - articlePayload: `toArticleDTO` of a doc containing a `body` field outputs no `body`.
- [ ] **Step 2:** Run the four files. Expected: FAIL.
- [ ] **Step 3:** Add the fields and constants. In `parseRssItem`, derive `body` from `item['content:encoded']` via `stripHtml`. In `guardian.ts` add `bodyText` to `show-fields` and map it. `body` rides through `scoreArticles`/`deduplicateArticles`/`mergeByUrl` via the existing spreads (assert this in the ingest test with a merged pair).
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: capture article body from feeds without storing it`.

### Task 6: Body extraction service

**Files:**
- Create: `src/lib/services/body.ts`
- Modify: `package.json` (`@mozilla/readability`, `linkedom` as dependencies)
- Test: `src/lib/__tests__/body.test.ts` (create)

**Interfaces:**
- Consumes: `MIN_BODY_CHARS`, `MAX_BODY_CHARS` from `src/lib/sources/types.ts` (Task 5).
- Produces:
  - `extractReadableText(html: string, url: string): string | null` — Readability over a linkedom document; whitespace-normalized; `null` if under `MIN_BODY_CHARS`; cut to `MAX_BODY_CHARS` on a word boundary.
  - `fetchBody(url: string, opts?: { timeoutMs?: number }): Promise<string | null>` — GET with UA `Datrix/1.0 (+news reader)`, `text/html` only, response over 2 MB abandoned, any error or non-2xx → `null`; refuses non-http(s) and loopback/private-IP hosts.
  - `resolveBodies(items: { url: string; body?: string }[], opts: { max: number; concurrency?: number; deadlineAt: number; now?: () => number; fetchBody?: (url: string) => Promise<string | null> }): Promise<Map<string, string>>` — keeps existing `body` values as-is, fetches only for items without one, at most `max` fetches, default concurrency 6, stops starting fetches after `deadlineAt`.

- [ ] **Step 1: Write failing tests** (fixture HTML strings inline): extraction returns article paragraph text and drops nav/footer; a page with 120 chars of text returns `null`; a login-wall page returns `null`; text over 6,000 chars is cut and ends on a word; `resolveBodies` with an injected `fetchBody` stub — skips items that already have a body, respects `max`, returns nothing for stubs that return `null`, makes no calls after `deadlineAt` has passed (injected `now`); `fetchBody('http://127.0.0.1/x')` and `fetchBody('file:///etc/passwd')` resolve `null` without a network call.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/body.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** `npm i @mozilla/readability linkedom`, then implement the three functions per the Interfaces block.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: extract readable article text for summarization`.

### Task 7: Summarizer uses body, batches smaller, retries 429

**Files:**
- Modify: `src/lib/services/summarizer/parse.ts` (`SummaryInput`, `SYSTEM_PROMPT`, `buildUserPrompt`), `src/lib/services/summarizer/index.ts` (`summarizeBatch`)
- Test: `src/lib/__tests__/summarizer.test.ts`

**Interfaces:**
- Produces: `SummaryInput` gains `body?: string`; `SummarizeOpts` gains `retry429Ms?: number` (default 0) and `sleep?: (ms: number) => Promise<void>`; `BODY_PROMPT_CHARS = 2000` and `GROUP_SIZE_WITH_BODY = 4` exported from `parse.ts` / `index.ts` respectively. Item JSON key in the prompt becomes `text` (body sliced to 2,000 chars, else description sliced to 600).

- [ ] **Step 1: Write failing tests.**
  - `buildUserPrompt` for an item with a 5,000-char body embeds exactly the first 2,000 chars and not the description; without a body it embeds the description (existing behavior).
  - `SYSTEM_PROMPT` says to use only the title and text and still demands the same JSON shape.
  - `summarizeBatch` with 9 items that have bodies calls a stub provider 3 times (4+4+1); 9 items without bodies call it 2 times (8+1).
  - With `retry429Ms: 20_000` and an injected `sleep`, a provider that throws `ProviderHttpError('groq', 429)` once then succeeds yields an LLM summary, the sleep is called with 20000, and no `summarizer:groq:429` failure is recorded; a provider that always throws 429 yields extractive summaries, one `summarizer:groq:429` failure, and the provider is skipped for later groups.
  - With default options a 429 still marks the provider dead immediately (unchanged behavior).
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/summarizer.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Group size is chosen once from whether any input has a `body`. In `doGroup`, on a 429 and `retry429Ms > 0`, await `sleep(retry429Ms)` and retry that provider once for that group before adding it to `dead`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS (groq.ts and gemini.ts need no change; both call `buildUserPrompt`/`SYSTEM_PROMPT`).
- [ ] **Step 5:** Commit `feat: summarize from article text with smaller batches and 429 retry`.

### Task 8: Wire bodies into ingest

**Files:**
- Modify: `src/lib/services/ingest.ts`, `scripts/ingest.ts`
- Test: `src/lib/__tests__/ingest.test.ts`

**Interfaces:**
- Consumes: `resolveBodies` (Task 6), `SummaryInput.body` and `retry429Ms` (Task 7), `ScoredArticle.body` (Task 5).
- Produces: `runIngest` opts gain `bodyMax?: number` (default 0, so the Vercel route never fetches pages) and `retry429Ms?: number` (default 0); `IngestReport` gains `bodies: number` (articles that went to the LLM with a body). `scripts/ingest.ts` passes `bodyMax: 40, retry429Ms: 20_000`.

- [ ] **Step 1: Write failing tests:** a pure helper `attachBodies(needSummary: ScoredArticle[], bodies: Map<string, string>): SummaryInput[]` exported from `ingest.ts` returns inputs with `body` set only for urls in the map and preserves order; `selectNeedSummary` is unchanged for extractive-only existing summaries (they still need an LLM summary); `buildOps` still emits no `body` (re-assert here with the full pipeline helpers).
- [ ] **Step 2:** Run the ingest test file. Expected: FAIL.
- [ ] **Step 3:** In `runIngest`, after `selectNeedSummary`: take the first `bodyMax` of `needSummary`, call `resolveBodies` (deadline = summary deadline minus 30 s), build inputs with `attachBodies`, pass `retry429Ms` to `summarizeBatch` (extend `summarizeNew` accordingly), set `report.bodies`.
- [ ] **Step 4:** Run `npm test`, `npm run lint`, `npx tsc --noEmit`. Expected: all clean.
- [ ] **Step 5:** Commit `feat: summarize top stories from fetched article text`.

### Task 9: End-to-end verification and docs

**Files:**
- Modify: `README.md`, `DEVELOPMENT_LOG.md`

- [ ] **Step 1:** `npm run ingest` locally with `GROQ_API_KEY` set. Expected: report shows `bodies > 0`, `llmSummarized > 0`, exit 0; the Online Khabar and Guardian stories have tl;drs that cite details absent from their RSS descriptions (spot-check five in Atlas).
- [ ] **Step 2:** `npm run build && npm start`; open `/`. Check: no story older than 48 h in the lead/Keep up sections, the Global/Local toggle switches the feed and Local shows Nepal stories even before Nepal is enabled in Settings, `GET /api/articles?fresh=48&limit=5` returns no `body` field.
- [ ] **Step 3:** Push the branch, trigger "Ingest News" via `workflow_dispatch`. Expected: green run under 10 minutes; scheduled run follows 2 hours later.
- [ ] **Step 4:** Update README (features: Nepal, recency, article-text summaries; categories table to 15) and add a dated entry to `DEVELOPMENT_LOG.md`. Commit `docs: document fresh-and-real changes`.

### Task 10: Pace the summarizer to Groq's free limits

Added after Task 9's live run: Groq's free tier for the default model allows 8,000 tokens/minute (response header `x-ratelimit-limit-tokens: 8000`); calls of 4 bodied articles cost roughly 2.5-3k tokens, so three concurrent calls hit 429 within seconds and only 20 of 438 articles got an LLM summary, all of them paywalled NYT stories with no body (nothing beyond the description to summarize).

**Files:**
- Modify: `src/lib/services/summarizer/index.ts`, `src/lib/services/ingest.ts`, `src/lib/services/body.ts`, `scripts/ingest.ts`, `README.md` (ingest section)
- Test: `src/lib/__tests__/summarizer.test.ts`, `src/lib/__tests__/ingest.test.ts`, `src/lib/__tests__/body.test.ts`

**Interfaces:**
- Produces: `SummarizeOpts.minGapMs?: number` (default 0): minimum ms between the starts of two calls to the same provider, enforced with the injected `sleep` and `now`. `runIngest` opts gain `summarizeConcurrency?: number` (default 3, today's value) and `minCallGapMs?: number` (default 0). In `ingest.ts`: `isLlmEligible(a: { body?: string; description?: string }): boolean` (true when a body is present or the description is at least 200 chars) and `orderForSummary<T extends ScoredArticle>(items: T[]): T[]` (items with a body first, otherwise the existing order). In `body.ts`: `isPaywalledHost(url: string): boolean` (nytimes.com, wsj.com, ft.com, bloomberg.com and their subdomains); `fetchBody` returns `null` for those hosts without making a request, and `resolveBodies` therefore does not spend fetch slots on them.
- `scripts/ingest.ts` passes `summarizeConcurrency: 1, minCallGapMs: 18_000, retry429Ms: 60_000`.

- [ ] **Step 1: Write failing tests.** summarizer: with `minGapMs: 18000`, `concurrency: 1`, injected `now`/`sleep`, three calls to one provider sleep for the remaining gap before calls 2 and 3 and never before call 1; with the default `minGapMs` nothing ever sleeps. body: `isPaywalledHost('https://www.nytimes.com/a')` true, `'https://nytimes.com.evil.example/a'` false, `'https://notnytimes.com/a'` false; `fetchBody` of an nytimes URL resolves `null` with `fetch` not called. ingest: `isLlmEligible` is false for a 150-char description with no body, true for 200 chars, true for any body; `orderForSummary` moves bodied items first and keeps relative order within each group; items that are not eligible receive an `extractive` summary in the final summaries map and are never passed to `summarizeBatch`.
- [ ] **Step 2:** Run the three files. Expected: FAIL.
- [ ] **Step 3:** Implement per the Interfaces block. In `runIngest`, after body resolution: order with `orderForSummary`, split with `isLlmEligible`, send eligible items to `summarizeBatch` (with `minGapMs`, `concurrency`), and build extractive summaries (`extractiveSummary`) directly for the rest.
- [ ] **Step 4:** Run `npm test`, `npx tsc --noEmit`, `npm run lint`. Expected: all clean.
- [ ] **Step 5:** Update the README ingest section (pacing, eligibility rule, paywalled hosts) and commit `fix: pace summarizer to free-tier token limits and skip no-text articles`.

---

## Self-review

- **Spec coverage:** recency (T3), tagging (T1), Nepal (T2), ingest frequency (T4), real-content summaries (T5-T8), free-only (Global Constraints, Prerequisites), verification (T9). Pushing richer briefings, dedupe by embeddings, personalization, custom feeds, read-later are deliberately later plans.
- **Type consistency:** `MIN_BODY_CHARS`/`MAX_BODY_CHARS` defined in T5, consumed in T6; `SummaryInput.body`/`retry429Ms` defined in T7, consumed in T8; `runIngest` options extended in T4 and T8 only.
- **Proportion:** tasks list signatures, test names and assertions, not bodies.

## Follow-up plans (not in this plan)

2. **Smarter dedupe and story threads:** `@xenova/transformers` MiniLM embeddings in the script, cosine clustering, `clusterId`, "new since yesterday" badge.
3. **Personalization:** client-side learned weights from reactions and reads, mute sources/keywords.
4. **Your sources + briefing:** custom RSS feeds in Mongo with Settings UI (owner token), Telegram daily briefing, read-later in IndexedDB.
