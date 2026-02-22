'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, Bookmark, ExternalLink, Sparkles, Share2, X } from 'lucide-react';

export interface NewsArticle {
  _id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: Date;
  importanceScore: number;
  topics: string[];
  summary?: {
    tldr: string;
    bullets: string[];
    whyItMatters: string;
  };
  isSaved?: boolean;
}

interface NewsCardProps {
  article: NewsArticle;
  onSave?: (article: NewsArticle) => void;
  index?: number;
}

const categoryColors: Record<string, { border: string; text: string; bg: string; dot: string; tint: string }> = {
  ai: { border: 'var(--accent-ai)', text: 'var(--accent-ai)', bg: 'rgba(147, 51, 234, 0.08)', dot: 'var(--accent-ai)', tint: 'rgba(147, 51, 234, 0.05)' },
  tech: { border: 'var(--accent-tech)', text: 'var(--accent-tech)', bg: 'rgba(8, 145, 178, 0.08)', dot: 'var(--accent-tech)', tint: 'rgba(8, 145, 178, 0.05)' },
  economy: { border: 'var(--accent-economy)', text: 'var(--accent-economy)', bg: 'rgba(5, 150, 105, 0.08)', dot: 'var(--accent-economy)', tint: 'rgba(5, 150, 105, 0.08)' },
  world: { border: 'var(--accent-world)', text: 'var(--accent-world)', bg: 'rgba(37, 99, 235, 0.08)', dot: 'var(--accent-world)', tint: 'rgba(37, 99, 235, 0.08)' },
};

const defaultCategory = { border: 'var(--border-highlight)', text: 'var(--text-muted)', bg: 'transparent', dot: 'var(--text-muted)', tint: 'transparent' };

export default function NewsCard({ article, onSave, index = 0 }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(article.isSaved || false);
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);

  const importanceLevel = article.importanceScore >= 0.75 ? 'HIGH' : article.importanceScore >= 0.5 ? 'MEDIUM' : 'LOW';
  const isHigh = article.importanceScore >= 0.75;
  const isMedium = article.importanceScore >= 0.5;

  const categoryStyle = categoryColors[article.category] || defaultCategory;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    setBookmarkAnimating(true);
    setTimeout(() => setBookmarkAnimating(false), 300);
    onSave?.(article);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: article.title, url: article.url });
    }
  };

  return (
    <article 
      className="group relative border-b border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-elevated)] cursor-pointer"
      style={{ 
        borderLeftWidth: '3px',
        borderLeftColor: isHigh ? 'var(--accent-high)' : isMedium ? 'var(--accent-medium)' : categoryStyle.border,
        backgroundColor: 'var(--bg-surface)',
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3" style={{ gap: 6 }}>
              {isHigh && (
                <span 
                  style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                    color: 'var(--accent-high)',
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded"
                >
                  HIGH
                </span>
              )}
              {isMedium && !isHigh && (
                <span 
                  style={{ 
                    backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                    color: 'var(--accent-medium)',
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded"
                >
                  MEDIUM
                </span>
              )}
              <span 
                style={{ 
                  borderColor: categoryStyle.border, 
                  color: categoryStyle.text,
                  backgroundColor: categoryStyle.bg,
                }}
                className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded border"
              >
                {article.category}
              </span>
            </div>

            <h3 
              className="font-serif transition-colors"
              style={{
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.4,
                color: isHigh ? 'var(--accent-high)' : 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              {article.title}
            </h3>

            {article.summary?.tldr && (
              <p 
                className="line-clamp-2 mb-3"
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                {article.summary.tldr}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span 
                  className="font-medium"
                  style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
                >
                  {article.source}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>•</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                  {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                </span>
              </div>
              
              <div className="flex items-center gap-1 card-actions">
                <button 
                  onClick={handleShare}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-all"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleSave}
                  className={`p-1.5 rounded-md transition-all ${
                    isSaved 
                      ? 'text-[var(--accent-brand)]' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <Bookmark 
                    className={`w-4 h-4 ${isSaved ? 'fill-current' : ''} ${bookmarkAnimating ? 'animate-pulse-bookmark' : ''}`} 
                  />
                </button>
                <div 
                  className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border)]"
                  style={{ color: 'var(--text-secondary)', fontSize: 13 }}
                >
                  <span>Read more</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && article.summary && (
          <div 
            className="mt-4 pt-4 border-t border-[var(--border)] animate-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="space-y-4">
              <div>
                <h4 
                  className="text-[11px] font-semibold mb-3 flex items-center gap-2 uppercase tracking-wider" 
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: categoryStyle.text }} />
                  Key Points
                </h4>
                <ul className="space-y-2">
                  {article.summary.bullets.map((bullet, idx) => (
                    <li 
                      key={idx} 
                      className="text-[13px] flex items-start gap-2.5 leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span 
                        className="w-1.5 h-1.5 rounded-sm mt-1.5 shrink-0" 
                        style={{ backgroundColor: categoryStyle.dot }}
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div 
                className="p-4 rounded-lg border-l-3"
                style={{ 
                  borderLeftColor: categoryStyle.dot,
                  backgroundColor: categoryStyle.tint,
                  borderLeftWidth: '3px',
                }}
              >
                <h4 
                  className="text-[11px] font-semibold mb-2 uppercase tracking-wider" 
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
                >
                  Why It Matters
                </h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {article.summary.whyItMatters}
                </p>
              </div>

              <a 
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 text-[13px] hover:opacity-80 transition-opacity"
                style={{ color: categoryStyle.text }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Read full article
              </a>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
