'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, Bookmark, ExternalLink, Sparkles } from 'lucide-react';

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
}

const categoryColors: Record<string, string> = {
  ai: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tech: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  economy: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  world: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const categoryIcons: Record<string, string> = {
  ai: '🤖',
  tech: '💻',
  economy: '📈',
  world: '🌍',
};

export default function NewsCard({ article, onSave }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(article.isSaved || false);

  const importanceLevel = article.importanceScore >= 0.75 ? 'HIGH' : article.importanceScore >= 0.5 ? 'MEDIUM' : 'LOW';
  const importanceColor = article.importanceScore >= 0.75 
    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
    : article.importanceScore >= 0.5 
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    onSave?.(article);
  };

  return (
    <div 
      className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl overflow-hidden hover:border-zinc-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 cursor-pointer group"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${importanceColor}`}>
              {importanceLevel}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${categoryColors[article.category] || categoryColors.world}`}>
              {categoryIcons[article.category] || '📰'} {article.category.toUpperCase()}
            </span>
          </div>
          <button 
            onClick={handleSave}
            className={`p-2 rounded-lg transition-colors ${isSaved ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <h3 className="text-lg font-semibold text-zinc-100 leading-tight mb-2 group-hover:text-white transition-colors">
          {article.title}
        </h3>

        {article.summary?.tldr && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-3 line-clamp-2">
            {article.summary.tldr}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-400">{article.source}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <span>Read more</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {isExpanded && article.summary && (
        <div className="border-t border-zinc-800/50 p-5 bg-zinc-800/20 animate-in slide-in-from-top-2 duration-300">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Key Points
              </h4>
              <ul className="space-y-2">
                {article.summary.bullets.map((bullet, idx) => (
                  <li key={idx} className="text-sm text-zinc-400 flex items-start gap-2">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Why It Matters</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {article.summary.whyItMatters}
              </p>
            </div>

            <a 
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Read full article
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
