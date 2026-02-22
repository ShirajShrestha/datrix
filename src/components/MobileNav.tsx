'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, FileText, Bookmark } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/digest', label: 'Digest', icon: FileText },
  { href: '/saved', label: 'Saved', icon: Bookmark },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ 
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        height: 56,
      }}
    >
      <div className="flex items-center justify-around h-full px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all"
              style={{ height: '100%' }}
            >
              <Icon 
                className="w-5 h-5" 
                style={{ color: isActive ? 'var(--accent-brand)' : 'var(--text-muted)' }}
              />
              <span 
                className="text-[10px]"
                style={{ 
                  fontFamily: 'var(--font-sans)',
                  color: isActive ? 'var(--accent-brand)' : 'var(--text-muted)',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
