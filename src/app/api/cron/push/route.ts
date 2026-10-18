import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { PushSub } from '@/lib/models/PushSub';
import { Article } from '@/lib/models/Article';
import { buildPayload, isDue, sendToSub } from '@/lib/services/push';
import { categoriesKey, localDateFor, runWithConcurrency } from '@/lib/services/pushDispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_MS = 50_000;
const CONCURRENCY = 5;

type Head = { title: string; summary?: { tldr?: string } };
type DueItem = { _id: unknown; endpoint: string; keys: { p256dh: string; auth: string }; categories: string[]; localDate: string; prev?: string };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  try {
    await connectToDatabase();
    const now = new Date();

    const recent = await Article.exists({ createdAt: { $gte: new Date(now.getTime() - DAY_MS) } });
    if (!recent) return NextResponse.json({ success: true, skipped: 'no recent ingest' });

    const cache = new Map<string, Promise<Head[]>>();
    const topFor = (categories: string[]): Promise<Head[]> => {
      const key = categoriesKey(categories);
      let p = cache.get(key);
      if (!p) {
        p = (async () => {
          const base = categories.length ? { categories: { $in: categories } } : {};
          const sort = { importanceScore: -1, publishedAt: -1 } as const;
          const fields = 'title summary.tldr';
          const fresh = await Article.find({ ...base, publishedAt: { $gte: new Date(now.getTime() - 2 * DAY_MS) } })
            .sort(sort).limit(10).select(fields).lean();
          if (fresh.length) return fresh as unknown as Head[];
          return (await Article.find(base).sort(sort).limit(10).select(fields).lean()) as unknown as Head[];
        })();
        cache.set(key, p);
      }
      return p;
    };

    let checked = 0;
    const dueItems: DueItem[] = [];
    const cursor = PushSub.find({}).lean().cursor();
    for await (const sub of cursor) {
      checked++;
      if (!isDue(sub, now)) continue;
      const localDate = localDateFor(sub, now);
      if (!localDate) continue;
      dueItems.push({ _id: sub._id, endpoint: sub.endpoint, keys: sub.keys, categories: sub.categories ?? [], localDate, prev: sub.lastSentDate });
    }

    let sent = 0, gone = 0, errors = 0;
    const { deferred } = await runWithConcurrency(
      dueItems,
      CONCURRENCY,
      async (item) => {
        // Claim first so overlapping ticks can't double-send.
        const claim = await PushSub.findOneAndUpdate(
          { _id: item._id, lastSentDate: { $ne: item.localDate } },
          { $set: { lastSentDate: item.localDate } },
          { new: false },
        );
        if (!claim) return;
        const prev = claim.lastSentDate;
        let result: 'sent' | 'gone' | 'error' = 'error';
        try {
          const payload = buildPayload(await topFor(item.categories));
          result = await sendToSub({ endpoint: item.endpoint, keys: item.keys }, payload);
        } catch {
          result = 'error';
        }
        if (result === 'sent') sent++;
        else if (result === 'gone') {
          gone++;
          await PushSub.deleteOne({ _id: item._id });
        } else {
          errors++;
          await PushSub.updateOne(
            { _id: item._id, lastSentDate: item.localDate },
            prev ? { $set: { lastSentDate: prev } } : { $unset: { lastSentDate: 1 } },
          );
        }
      },
      started + DEADLINE_MS,
    );

    return NextResponse.json({ success: true, checked, due: dueItems.length, sent, gone, errors, deferred: deferred.length });
  } catch (error) {
    console.error('Push dispatch failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Dispatch failed' }, { status: 500 });
  }
}
