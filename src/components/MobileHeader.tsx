'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Logo } from '@/components/Sidebar';
import { GoalRing, StreakChip } from '@/components/ui';
import { useReadingStats } from '@/lib/useReadingStats';

export default function MobileHeader() {
  const stats = useReadingStats();
  return (
    <header
      className="sticky top-0 z-40 lg:hidden flex items-center gap-2"
      style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', padding: '8px 16px', minHeight: 60 }}
    >
      <Logo />
      <div className="ml-auto flex items-center gap-2">
        <Link href="/digest" aria-label={`${stats.streak}-day reading streak. Open digest`} style={{ textDecoration: 'none' }}>
          <StreakChip streak={stats.streak} compact />
        </Link>
        <span style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border-highlight)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GoalRing value={stats.today} goal={stats.goal} size={28} label={false} />
        </span>
        <Link
          href="/settings" aria-label="Settings"
          style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border-highlight)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <SlidersHorizontal className="w-[18px] h-[18px]" />
        </Link>
      </div>
    </header>
  );
}
