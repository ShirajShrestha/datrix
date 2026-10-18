import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { generateBrief, type BriefInput } from '@/lib/services/brief';
import { sameOrigin, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ID_RE = /^[a-f\d]{24}$/i;
const RETRY_AFTER_MS = 60_000;
const PROVIDER_TIMEOUT_MS = 10_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
const publicBrief = (b: any) => ({
  whatHappened: b.whatHappened,
  whyItMatters: b.whyItMatters,
  background: b.background,
  provider: b.provider,
});

const fallbackText = (doc: any): string => {
  const snip = (doc.sources ?? []).find((s: any) => s.snippet)?.snippet;
  return doc.description || snip || '';
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

    // Atomic claim: only one caller per 60s window may generate.
    const now = new Date();
    const claimed: any = await Article.findOneAndUpdate(
      {
        _id: id,
        'brief.whatHappened': { $exists: false },
        $or: [{ briefTriedAt: { $exists: false } }, { briefTriedAt: { $lt: new Date(now.getTime() - RETRY_AFTER_MS) } }],
      },
      { $set: { briefTriedAt: now } },
    ).lean();

    if (!claimed) {
      const fresh: any = await Article.findById(id).lean();
      if (fresh?.brief?.whatHappened) {
        return NextResponse.json({ success: true, brief: publicBrief(fresh.brief), cached: true, fallback: false });
      }
      return fallback(fresh ?? doc);
    }

    const brief = await generateBrief(buildInput(claimed), undefined, { timeoutMs: PROVIDER_TIMEOUT_MS });
    if (!brief) return fallback(claimed);

    await Article.updateOne({ _id: id }, { $set: { brief: { ...brief, generatedAt: new Date() } } });
    return NextResponse.json({ success: true, brief: publicBrief(brief), cached: false, fallback: false });
  } catch (error) {
    console.error('Brief failed:', error instanceof Error ? error.name : 'unknown');
    return jsonError('Brief failed', 500);
  }
}
