'use client';

import Link from 'next/link';
import { Zap, Menu } from 'lucide-react';

export default function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/50 lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-zinc-100">NewsIntel</span>
        </Link>
      </div>
    </header>
  );
}
