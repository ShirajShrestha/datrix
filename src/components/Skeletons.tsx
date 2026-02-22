'use client';

export default function NewsCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border)] p-5 pl-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-12 bg-[var(--bg-elevated)] rounded-sm" />
          <div className="h-5 w-16 bg-[var(--bg-elevated)] rounded-sm" />
        </div>
      </div>

      <div className="h-[22px] bg-[var(--bg-elevated)] rounded w-full mb-2" />
      <div className="h-[22px] bg-[var(--bg-elevated)] rounded w-3/4 mb-3" />

      <div className="h-4 bg-[var(--bg-elevated)] rounded w-full mb-2" />
      <div className="h-4 bg-[var(--bg-elevated)] rounded w-5/6 mb-4" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-12 bg-[var(--bg-elevated)] rounded" />
        </div>
        <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded" />
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
