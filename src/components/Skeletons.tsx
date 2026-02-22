'use client';

export default function NewsCardSkeleton() {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl overflow-hidden animate-pulse">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 bg-zinc-800 rounded-full" />
            <div className="h-5 w-20 bg-zinc-800 rounded-full" />
          </div>
        </div>

        <div className="h-6 bg-zinc-800 rounded w-full mb-2" />
        <div className="h-6 bg-zinc-800 rounded w-3/4 mb-3" />

        <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
        <div className="h-4 bg-zinc-800 rounded w-5/6 mb-4" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 bg-zinc-800 rounded" />
            <div className="h-3 w-16 bg-zinc-800 rounded" />
          </div>
          <div className="h-3 w-24 bg-zinc-800 rounded" />
        </div>
      </div>
    </div>
  );
}

export function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}
