'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/components/Sidebar';

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden grid grid-cols-4"
      style={{ background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', padding: '6px 8px calc(8px + env(safe-area-inset-bottom))' }}
    >
      {NAV.map((n) => {
        const active = pathname === n.href;
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-1"
            style={{ height: 52, fontSize: 11, fontWeight: active ? 500 : 400, color: active ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none' }}
          >
            <Icon className="w-[22px] h-[22px]" aria-hidden />
            {n.short}
          </Link>
        );
      })}
    </nav>
  );
}
