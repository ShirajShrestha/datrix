import mongoose from 'mongoose';
import { runIngest } from '@/lib/services/ingest';

async function main(): Promise<void> {
  let code = 1;
  try {
    const report = await runIngest({ budgetMs: 600_000, poolPerCategory: 40 });
    console.log(JSON.stringify(report, null, 2));
    code = report.fetched === 0 ? 1 : 0;
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
