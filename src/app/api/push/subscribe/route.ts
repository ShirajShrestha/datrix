import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { PushSub } from '@/lib/models/PushSub';
import { localParts, validateSubscribeBody } from '@/lib/services/push';
import { readJsonBody, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';

const MAX_SUBSCRIPTIONS = Number(process.env.MAX_PUSH_SUBSCRIPTIONS) > 0 ? Number(process.env.MAX_PUSH_SUBSCRIPTIONS) : 2000;

const isDup = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const v = validateSubscribeBody(parsed.body);
  if (!v.ok) return jsonError(v.error, 400);
  const { subscription, categories, time, timeZone } = v.value;

  // New subscription enabled after today's preferred time: don't send instantly.
  const setOnInsert: Record<string, unknown> = {};
  const local = localParts(new Date(), timeZone);
  const [h, m] = time.split(':').map(Number);
  if (local && local.minutes >= h * 60 + m) setOnInsert.lastSentDate = local.date;

  try {
    await connectToDatabase();
    // Cap on NEW endpoints only; updates of existing ones are always allowed.
    const exists = await PushSub.exists({ endpoint: subscription.endpoint });
    if (!exists && (await PushSub.estimatedDocumentCount()) >= MAX_SUBSCRIPTIONS) {
      return jsonError('Subscription limit reached', 503);
    }
    const upsert = () =>
      PushSub.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        { $set: { keys: subscription.keys, categories, time, timeZone }, $setOnInsert: setOnInsert },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    try {
      await upsert();
    } catch (e) {
      if (!isDup(e)) throw e;
      await upsert(); // concurrent first-subscribe race: retry once
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Subscribe failed:', e instanceof Error ? e.name : 'unknown');
    return jsonError('Subscribe failed', 500);
  }
}
