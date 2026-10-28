import mongoose from 'mongoose';
import { runIngest, ingestExitCode } from '@/lib/services/ingest';
import { quotaSourcesFor } from '@/lib/sources/schedule';

async function main(): Promise<void> {
  // db.ts silently falls back to localhost when this is unset; fail fast instead.
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  let code = 1;
  try {
    const quota = quotaSourcesFor(new Date(), process.env);
    const skipSources = [...(quota.gnews ? [] : ['gnews']), ...(quota.mediastack ? [] : ['mediastack'])];
    if (skipSources.length) console.log(`Skipping quota-limited sources this run: ${skipSources.join(', ')}`);
    const report = await runIngest({ skipSources, budgetMs: 600_000, poolPerCategory: 40, bodyMax: 40, summarizeConcurrency: 1, minCallGapMs: 25_000, retry429Ms: 60_000 });
    console.log(JSON.stringify(report, null, 2));
    code = ingestExitCode(report);
  } catch (e) {
    console.error('Ingest failed:', e instanceof Error ? e.name : 'unknown');
  }
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(code);
}

void main();
