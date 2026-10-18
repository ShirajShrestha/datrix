import { NextRequest, NextResponse } from 'next/server';
import { runIngest } from '@/lib/services/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await runIngest();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('Ingest failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Ingest failed' }, { status: 500 });
  }
}
