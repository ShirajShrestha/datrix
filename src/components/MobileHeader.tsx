'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function MobileHeader() {
  return (
    <header 
      className="sticky top-0 z-40 border-b border-[var(--border)] lg:hidden"
      style={{ 
        background: 'var(--bg-base)',
        height: 56,
      }}
    >
      <div className="flex items-center justify-between px-4 h-full">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: 'var(--accent-brand)' }} strokeWidth={2.5} />
          <span 
            className="text-lg font-semibold font-serif"
            style={{ color: 'var(--text-primary)' }}
          >
            Datrix
          </span>
        </Link>
      </div>
    </header>
  );
}
