'use client';

export default function NewsCardSkeleton() {
  return (
    <div style={{ borderRadius: 20, padding: 22, background: 'var(--bg-surface)', border: '1px solid var(--border)' }} aria-hidden>
      <div className="skeleton rounded" style={{ height: 12, width: 140, marginBottom: 14 }} />
      <div className="skeleton rounded" style={{ height: 22, width: '92%', marginBottom: 8 }} />
      <div className="skeleton rounded" style={{ height: 22, width: '70%', marginBottom: 16 }} />
      <div className="skeleton rounded" style={{ height: 14, width: '85%', marginBottom: 8 }} />
      <div className="skeleton rounded" style={{ height: 14, width: '60%' }} />
    </div>
  );
}

export function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col" style={{ gap: 12 }} aria-busy="true" aria-label="Loading stories">
      {Array.from({ length: count }).map((_, i) => <NewsCardSkeleton key={i} />)}
    </div>
  );
}
