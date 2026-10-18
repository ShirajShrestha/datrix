import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { PushSub } from '@/lib/models/PushSub';
import { sendToSub } from '@/lib/services/push';
import { readJsonBody, endpointFromBody, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';

const TEST_COOLDOWN_MS = 30_000;

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const endpoint = endpointFromBody(parsed.body);
  if (!endpoint) return jsonError('Invalid endpoint', 400);
  try {
    await connectToDatabase();
    const sub = await PushSub.findOne({ endpoint }).lean();
    if (!sub) return jsonError('Subscription not found', 404);
    const now = Date.now();
    if (sub.lastTestAt && now - new Date(sub.lastTestAt).getTime() < TEST_COOLDOWN_MS) {
      return jsonError('Please wait before sending another test', 429);
    }
    // Atomic claim of the cooldown slot, set before sending.
    const claimed = await PushSub.findOneAndUpdate(
      {
        _id: sub._id,
        $or: [{ lastTestAt: { $exists: false } }, { lastTestAt: null }, { lastTestAt: { $lte: new Date(now - TEST_COOLDOWN_MS) } }],
      },
      { $set: { lastTestAt: new Date(now) } },
    );
    if (!claimed) return jsonError('Please wait before sending another test', 429);

    const result = await sendToSub(
      { endpoint: sub.endpoint, keys: sub.keys },
      { title: 'Datrix - Test notification', body: 'Notifications are working.', url: '/' },
    );
    if (result === 'gone') {
      await PushSub.deleteOne({ _id: sub._id });
      return jsonError('Subscription expired', 410);
    }
    if (result === 'error') return jsonError('Send failed', 502);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Test push failed:', e instanceof Error ? e.name : 'unknown');
    return jsonError('Test failed', 500);
  }
}
