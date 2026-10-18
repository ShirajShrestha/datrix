import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { PushSub } from '@/lib/models/PushSub';
import { localParts, validateSubscribeBody } from '@/lib/services/push';
import { readJsonBody, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';

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
    await PushSub.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { $set: { keys: subscription.keys, categories, time, timeZone }, $setOnInsert: setOnInsert },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Subscribe failed:', e instanceof Error ? e.name : 'unknown');
    return jsonError('Subscribe failed', 500);
  }
}
