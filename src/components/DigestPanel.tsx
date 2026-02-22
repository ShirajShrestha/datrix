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
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Daily Digest</h2>
      </div>
      
      <p className="text-xs text-zinc-500 mb-4">
        {format(new Date(), 'EEEE, MMMM d, yyyy')}
      </p>

      <div className="space-y-3">
        {topArticles.map((article, idx) => (
          <Link
            key={article._id}
            href={`/?article=${article._id}`}
            className="block group"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg font-bold text-zinc-600 group-hover:text-orange-400 transition-colors">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm text-zinc-200 line-clamp-2 group-hover:text-white transition-colors">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    article.importanceScore >= 0.75 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {article.importanceScore >= 0.75 ? 'HIGH' : 'MEDIUM'}
                  </span>
                  <span className="text-xs text-zinc-500">{article.source}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/digest"
        className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-zinc-800/50 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>View full digest</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
