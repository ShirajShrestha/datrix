'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { NewsArticle } from '@/components/NewsCard';
import StoryModal from '@/components/StoryModal';
import { buildStoryHref, closeAction, isObjectId, shouldPushStory } from '@/lib/storyModalState';
import { readSaved } from '@/lib/savedArticles';
import { markRead } from '@/lib/reading';

export interface StoryModalApi {
  openStory(a: NewsArticle, queue?: NewsArticle[]): void;
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
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [queue, setQueue] = useState<NewsArticle[]>([]);
  const articleRef = useRef<NewsArticle | null>(null);
  const pushedRef = useRef(false);
  const reqRef = useRef(0);

  const show = useCallback((a: NewsArticle | null) => {
    articleRef.current = a;
    setArticle(a);
    if (a) markRead(a);
  }, []);

  const pushedIdRef = useRef<string | null>(null);
  const closingRef = useRef(false);

  const removeParam = useCallback(() => {
    window.history.replaceState(
      null,
      '',
      buildStoryHref(window.location.pathname, window.location.search, null),
    );
  }, []);

  const openStory = useCallback(
    (a: NewsArticle, q?: NewsArticle[]) => {
      if (!a || typeof a._id !== 'string' || !a._id) return;
      setQueue(Array.isArray(q) ? q.filter((x) => x && typeof x._id === 'string') : []);
      show(a);
      pushedRef.current = true;
      closingRef.current = false;
      if (shouldPushStory(pushedIdRef.current, a._id, window.location.search)) {
        window.history.pushState(
          null,
          '',
          buildStoryHref(window.location.pathname, window.location.search, a._id),
        );
      }
      pushedIdRef.current = a._id;
    },
    [show],
  );

  const closeStory = useCallback(() => {
    if (closingRef.current) return;
    const action = closeAction(pushedRef.current, pushedIdRef.current, window.location.search);
    pushedRef.current = false;
    pushedIdRef.current = null;
    if (articleRef.current) show(null);
    if (action === 'back') {
      closingRef.current = true;
      window.history.back();
    } else if (action === 'strip') {
      removeParam();
    }
  }, [show, removeParam]);

  useEffect(() => {
    const clear = () => {
      closingRef.current = false;
    };
    window.addEventListener('popstate', clear);
    return () => window.removeEventListener('popstate', clear);
  }, []);

  const onUrlChange = useCallback(
    (id: string | null) => {
      const req = ++reqRef.current;
      if (!id) {
        pushedRef.current = false;
        pushedIdRef.current = null;
        closingRef.current = false;
        if (articleRef.current) show(null);
        return;
      }
      if (closingRef.current || articleRef.current?._id === id) return;
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

  // Step to the next story in the queue without adding a history entry, so one Back still closes the reader.
  const idx = article ? queue.findIndex((x) => x._id === article._id) : -1;
  const nextArticle = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;
  const goNext = useCallback(() => {
    if (!nextArticle) return;
    show(nextArticle);
    if (pushedIdRef.current) {
      pushedIdRef.current = nextArticle._id;
      window.history.replaceState(null, '', buildStoryHref(window.location.pathname, window.location.search, nextArticle._id));
    }
  }, [nextArticle, show]);

  const api = useMemo(() => ({ openStory, closeStory }), [openStory, closeStory]);

  return (
    <StoryModalContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <StoryUrlSync onChange={onUrlChange} />
      </Suspense>
      {article && (
        <StoryModal
          key={article._id}
          article={article}
          onClose={closeStory}
          onNext={nextArticle ? goNext : undefined}
          nextTitle={nextArticle?.title}
          position={idx >= 0 ? { index: idx + 1, total: queue.length } : undefined}
        />
      )}
    </StoryModalContext.Provider>
  );
}

export default StoryModalProvider;
