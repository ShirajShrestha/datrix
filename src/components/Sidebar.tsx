'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  FileText,
  Bookmark,
  Zap,
  Sparkles,
  Settings,
} from 'lucide-react';
import { usePrefs, effectiveCategories } from '@/lib/prefs';
import { orderedCategories } from '@/lib/categoryPicker';
import { useHydrated } from '@/lib/useHydrated';

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/digest', label: 'Daily Digest', icon: FileText },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const categories = hydrated
    ? orderedCategories(effectiveCategories(prefs)).map((c) => ({
        href: `/category/${c.slug}`,
        label: c.label,
        emoji: c.emoji,
        color: c.color,
      }))
    : [];

  return (
    <aside 
      className="w-[240px] h-screen sticky top-0 border-r border-[var(--border)] hidden lg:block z-50 flex-shrink-0"
      style={{ 
        backgroundColor: 'var(--bg-base)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center gap-2.5 mb-8">
          <Zap className="w-5 h-5" style={{ color: 'var(--accent-brand)' }} strokeWidth={2.5} />
          <span 
            className="text-xl font-semibold font-serif tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Datrix
          </span>
        </div>

        <nav className="space-y-1 mb-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
                style={{
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {isActive && (
                  <span 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r" 
                    style={{ backgroundColor: 'var(--accent-brand)' }}
                  />
                )}
                <Icon 
                  className="w-4 h-4" 
                  style={{ color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)' }}
                />
                <span 
                  className="text-sm"
                  style={{ 
                    fontFamily: 'var(--font-sans)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] pt-5 mb-6 flex-1 min-h-0 overflow-y-auto">
          <h3 
            className="px-3 text-[10px] font-medium mb-3"
            style={{ 
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}
          >
            Categories
          </h3>
          <nav className="space-y-1">
            {categories.map((cat) => {
              const isActive = pathname === cat.href;
              return (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
                  style={{
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {isActive && (
                    <span 
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r" 
                      style={{ backgroundColor: 'var(--accent-brand)' }}
                    />
                  )}
                  <span aria-hidden className="shrink-0" style={{ width: 18, textAlign: 'center', fontSize: 14 }}>
                    {cat.emoji}
                  </span>
                  <span 
                    className="text-sm"
                    style={{ 
                      fontFamily: 'var(--font-sans)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {cat.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto pt-2">
          <div 
            className="p-3 rounded-xl border"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <p 
              className="text-[11px] leading-relaxed flex items-center gap-2"
              style={{ 
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-muted)',
              }}
            >
              <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-brand)' }} />
              AI-powered intelligence for what matters.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
