import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { BriefBudget } from '@/lib/models/BriefBudget';
import { generateBrief, type BriefInput } from '@/lib/services/brief';
import { sameOrigin, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ID_RE = /^[a-f\d]{24}$/i;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Wait before the next attempt, given attempts made so far: 1 -> 1 min, 2 -> 1 h, 3 -> 6 h, 4+ -> 24 h. */
const backoffMs = (attempts: number): number =>
  attempts <= 0 ? 0 : attempts === 1 ? MINUTE : attempts === 2 ? HOUR : attempts === 3 ? 6 * HOUR : 24 * HOUR;
const maxPerHour = (): number => {
  const n = Number(process.env.BRIEF_MAX_PER_HOUR);
  return Number.isFinite(n) && n >= 0 && process.env.BRIEF_MAX_PER_HOUR ? Math.floor(n) : 60;
};
const PROVIDER_TIMEOUT_MS = 10_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
const publicBrief = (b: any) => ({
  whatHappened: b.whatHappened,
  whyItMatters: b.whyItMatters,
  background: b.background,
  provider: b.provider,
});

// The only place outlet snippet text can reach the browser (and only when the description is empty).
const fallbackText = (doc: any): string => {
  const snip = (doc.sources ?? []).find((s: any) => s.snippet)?.snippet;
  const tldr = typeof doc.summary?.tldr === 'string' ? doc.summary.tldr.trim() : '';
  const bullets = Array.isArray(doc.summary?.bullets) ? doc.summary.bullets.filter((b: unknown) => typeof b === 'string').join(' ') : '';
  return doc.description || snip || tldr || bullets || '';
};

function buildInput(doc: any): BriefInput {
  const snippets = (doc.sources ?? [])
    .filter((s: any) => typeof s.snippet === 'string' && s.snippet.trim())
    .map((s: any) => ({ outlet: s.name, text: s.snippet as string }));
  if (snippets.length === 0 && doc.description) snippets.push({ outlet: doc.source, text: doc.description });
  return { title: doc.title, snippets };
}

const fallback = (doc: any) => NextResponse.json({ success: true, brief: null, fallback: true, text: fallbackText(doc) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request, { requireOrigin: true })) return jsonError('Forbidden', 403);
  const { id } = await params;
  if (!ID_RE.test(id)) return jsonError('Invalid id', 400);

  try {
    await connectToDatabase();
    const doc: any = await Article.findById(id).lean();
    if (!doc) return jsonError('Not found', 404);
    if (doc.brief?.whatHappened) {
      return NextResponse.json({ success: true, brief: publicBrief(doc.brief), cached: true, fallback: false });
    }

    // Atomic claim: only one caller may generate until briefRetryAfter. A short lease is set here and
    // widened to the attempt-based backoff right after. timestamps:false keeps Article.updatedAt
    // (the push "recent ingest" signal) untouched.
    const now = new Date();
    const claimed: any = await Article.findOneAndUpdate(
      {
        _id: id,
        'brief.whatHappened': { $exists: false },
        $or: [{ briefRetryAfter: { $exists: false } }, { briefRetryAfter: { $lte: now } }],
      },
      { $set: { briefTriedAt: now, briefRetryAfter: new Date(now.getTime() + MINUTE) }, $inc: { briefAttempts: 1 } },
      { timestamps: false },
    ).lean();

    if (!claimed) {
      const fresh: any = await Article.findById(id).lean();
      if (fresh?.brief?.whatHappened) {
        return NextResponse.json({ success: true, brief: publicBrief(fresh.brief), cached: true, fallback: false });
      }
      return fallback(fresh ?? doc);
    }

    const attempts = (typeof claimed.briefAttempts === 'number' ? claimed.briefAttempts : 0) + 1;

    // Global hourly budget (own collection, never Article).
    const bucket = String(Math.floor(now.getTime() / HOUR));
    const budget: any = await BriefBudget.findOneAndUpdate(
      { _id: bucket },
      { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date((Number(bucket) + 2) * HOUR) } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    if ((budget?.count ?? 1) > maxPerHour()) {
      // Over budget: refund the attempt and retry in the next hour bucket.
      await Article.updateOne(
        { _id: id },
        { $inc: { briefAttempts: -1 }, $set: { briefRetryAfter: new Date((Number(bucket) + 1) * HOUR) } },
        { timestamps: false },
      );
      return fallback(claimed);
    }
    await Article.updateOne({ _id: id }, { $set: { briefRetryAfter: new Date(now.getTime() + backoffMs(attempts)) } }, { timestamps: false });

    const brief = await generateBrief(buildInput(claimed), undefined, { timeoutMs: PROVIDER_TIMEOUT_MS });
    if (!brief) return fallback(claimed);

    await Article.updateOne({ _id: id }, { $set: { brief: { ...brief, generatedAt: new Date() } } }, { timestamps: false });
    return NextResponse.json({ success: true, brief: publicBrief(brief), cached: false, fallback: false });
  } catch (error) {
    console.error('Brief failed:', error instanceof Error ? error.name : 'unknown');
    return jsonError('Brief failed', 500);
  }
}
