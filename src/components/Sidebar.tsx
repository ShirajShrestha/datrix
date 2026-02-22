'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  FileText,
  Bookmark,
  Zap,
  TrendingUp,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/digest', label: 'Daily Digest', icon: FileText },
  { href: '/saved', label: 'Saved', icon: Bookmark },
];

const categories = [
  { href: '/category/ai', label: 'AI', icon: Zap, color: 'text-purple-400' },
  {
    href: '/category/tech',
    label: 'Tech',
    icon: TrendingUp,
    color: 'text-blue-400',
  },
  {
    href: '/category/economy',
    label: 'Economy',
    icon: TrendingUp,
    color: 'text-amber-400',
  },
  {
    href: '/category/world',
    label: 'World',
    icon: TrendingUp,
    color: 'text-green-400',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen sticky top-0 bg-zinc-950/50 border-r border-zinc-800/50 p-4 hidden lg:block">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-zinc-100">Datrix</span>
      </div>

      <nav className="space-y-1 mb-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-zinc-100 text-zinc-900 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/50 pt-6">
        <h3 className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Categories
        </h3>
        <nav className="space-y-1">
          {categories.map((cat) => {
            const isActive = pathname === cat.href;
            const Icon = cat.icon;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${cat.color}`} />
                <span>{cat.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Stay informed with AI-powered news that matters.
          </p>
        </div>
      </div>
    </aside>
  );
}
