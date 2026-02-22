'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Flame, ArrowRight } from 'lucide-react';
import { NewsArticle } from './NewsCard';

interface DigestPanelProps {
  articles: NewsArticle[];
}

export default function DigestPanel({ articles }: DigestPanelProps) {
  const topArticles = articles.slice(0, 5);

  return (
    <div 
      className="rounded-2xl h-fit"
      style={{ 
        padding: 20,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-4 h-4 text-[var(--accent-medium)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)] font-serif">Daily Digest</h2>
      </div>
      
      <p 
        className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-5"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {format(new Date(), 'EEEE, MMMM d')}
      </p>

      <div className="space-y-0">
        {topArticles.map((article, idx) => (
          <Link
            key={article._id}
            href={`/?article=${article._id}`}
            className="block group py-3 border-b border-[var(--border)] last:border-0"
          >
            <div className="flex items-start gap-3">
              <span 
                className="text-2xl font-bold text-[var(--text-muted)] tabular-nums select-none"
                style={{ 
                  fontVariantNumeric: 'tabular-nums', 
                  fontSize: 28,
                  opacity: 0.12,
                  lineHeight: 1,
                  minWidth: 24,
                  fontFamily: 'var(--font-serif)',
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-[var(--text-secondary)] font-serif line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors"
                  style={{ fontSize: 14, lineHeight: 1.45 }}
                >
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span 
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
                    style={{ 
                      backgroundColor: article.importanceScore >= 0.75 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: article.importanceScore >= 0.75 ? 'var(--accent-high)' : 'var(--accent-medium)',
                    }}
                  >
                    {article.importanceScore >= 0.75 ? 'HIGH' : 'MEDIUM'}
                  </span>
                  <span 
                    className="text-[10px]"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
                  >
                    {article.source}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/digest"
        className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <span>View full digest</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
