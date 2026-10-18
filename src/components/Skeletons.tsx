'use client';

export default function NewsCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border)] p-4 sm:p-5 animate-pulse">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-44 shrink-0 bg-[var(--bg-elevated)] rounded-lg" style={{ aspectRatio: '16 / 9' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-12 bg-[var(--bg-elevated)] rounded-sm" />
            <div className="h-5 w-16 bg-[var(--bg-elevated)] rounded-sm" />
          </div>
          <div className="h-[22px] bg-[var(--bg-elevated)] rounded w-full mb-2" />
          <div className="h-[22px] bg-[var(--bg-elevated)] rounded w-3/4 mb-3" />
          <div className="h-4 bg-[var(--bg-elevated)] rounded w-5/6 mb-4" />
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded" />
            <div className="h-3 w-12 bg-[var(--bg-elevated)] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}
