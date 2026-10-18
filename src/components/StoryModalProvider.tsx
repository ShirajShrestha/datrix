'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { NewsArticle } from '@/components/NewsCard';
import StoryModal from '@/components/StoryModal';
import { buildStoryHref, isObjectId } from '@/lib/storyModalState';
import { readSaved } from '@/lib/savedArticles';

export interface StoryModalApi {
  openStory(a: NewsArticle): void;
  closeStory(): void;
}

export const StoryModalContext = createContext<StoryModalApi>({
  openStory: () => {},
  closeStory: () => {},
});

export function useStoryModal(): StoryModalApi {
  return useContext(StoryModalContext);
}

/** Reads ?story= (needs Suspense) and reports changes to the provider. */
function StoryUrlSync({ onChange }: { onChange: (id: string | null) => void }) {
  const params = useSearchParams();
  const raw = params.get('story');
  const id = raw && raw.length <= 64 ? raw : null;
  useEffect(() => {
    onChange(id);
  }, [id, onChange]);
  return null;
}

export function StoryModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const articleRef = useRef<NewsArticle | null>(null);
  const pushedRef = useRef(false);
  const reqRef = useRef(0);

  const show = useCallback((a: NewsArticle | null) => {
    articleRef.current = a;
    setArticle(a);
  }, []);

  const removeParam = useCallback(() => {
    router.replace(buildStoryHref(window.location.pathname, window.location.search, null), { scroll: false });
  }, [router]);

  const openStory = useCallback(
    (a: NewsArticle) => {
      if (!a || typeof a._id !== 'string' || !a._id) return;
      show(a);
      pushedRef.current = true;
      router.push(buildStoryHref(window.location.pathname, window.location.search, a._id), { scroll: false });
    },
    [router, show],
  );

  const closeStory = useCallback(() => {
    const wasPushed = pushedRef.current;
    pushedRef.current = false;
    show(null);
    if (wasPushed) router.back();
    else if (new URLSearchParams(window.location.search).has('story')) removeParam();
  }, [router, show, removeParam]);

  const onUrlChange = useCallback(
    (id: string | null) => {
      const req = ++reqRef.current;
      if (!id) {
        pushedRef.current = false;
        if (articleRef.current) show(null);
        return;
      }
      if (articleRef.current?._id === id) return;
      // Snapshot first (saved articles), else fetch real ids.
      const snap = readSaved<NewsArticle>().find((a) => a._id === id);
      if (snap && !isObjectId(id)) {
        show(snap);
        return;
      }
      if (!isObjectId(id)) {
        removeParam();
        return;
      }
      (async () => {
        try {
          const res = await fetch(`/api/articles/${id}`);
          const json = await res.json().catch(() => null);
          if (req !== reqRef.current) return;
          if (res.ok && json?.success && json.article) show(json.article as NewsArticle);
          else if (snap) show(snap);
          else removeParam();
        } catch {
          if (req !== reqRef.current) return;
          if (snap) show(snap);
          else removeParam();
        }
      })();
    },
    [show, removeParam],
  );

  const api = useMemo(() => ({ openStory, closeStory }), [openStory, closeStory]);

  return (
    <StoryModalContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <StoryUrlSync onChange={onUrlChange} />
      </Suspense>
      {article && <StoryModal key={article._id} article={article} onClose={closeStory} />}
    </StoryModalContext.Provider>
  );
}

export default StoryModalProvider;
