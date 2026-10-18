'use client';

import { createContext, useContext } from 'react';
import type { NewsArticle } from '@/components/NewsCard';

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
