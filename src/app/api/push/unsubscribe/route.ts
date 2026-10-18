import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { PushSub } from '@/lib/models/PushSub';
import { readJsonBody, endpointFromBody, jsonError } from '@/lib/pushRequest';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const endpoint = endpointFromBody(parsed.body);
  if (!endpoint) return jsonError('Invalid endpoint', 400);
  try {
    await connectToDatabase();
    await PushSub.deleteOne({ endpoint });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Unsubscribe failed:', e instanceof Error ? e.name : 'unknown');
    return jsonError('Unsubscribe failed', 500);
  }
}
