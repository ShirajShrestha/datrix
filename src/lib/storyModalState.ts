/** Pure helpers for the story modal: id validation, URL building, brief state. */

export interface BriefData {
  whatHappened: string;
  whyItMatters?: string;
  background?: string;
  provider?: string;
}

export function isObjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
}

/** Href for the current page with `story` set to `id`, or removed when null. Other params are preserved. */
export function buildStoryHref(pathname: string, search: string, id: string | null): string {
  const params = new URLSearchParams(search);
  if (id) params.set('story', id);
  else params.delete('story');
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readStoryParam(search: string): string | null {
  const v = new URLSearchParams(search).get('story');
  return v && v.length <= 64 ? v : null;
}

/** How to close: 'back' only if the current URL still holds the story entry we pushed. */
export function closeAction(
  pushed: boolean,
  pushedId: string | null,
  search: string,
): 'back' | 'strip' | 'none' {
  const current = readStoryParam(search);
  if (current === null) return 'none';
  return pushed && pushedId !== null && current === pushedId ? 'back' : 'strip';
}

/** Skip pushing a duplicate entry when we already pushed this id and the URL holds it. */
export function shouldPushStory(pushedId: string | null, id: string, search: string): boolean {
  return !(pushedId === id && readStoryParam(search) === id);
}

export type BriefState =
  | { status: 'loading' }
  | { status: 'ready'; brief: BriefData }
  | { status: 'fallback'; text: string }
  | { status: 'error' }
  | { status: 'none' };

export type BriefAction =
  | { type: 'ready'; brief: BriefData }
  | { type: 'fallback'; text: string }
  | { type: 'error' };

/** Initial state: stored brief shows immediately; legacy ids never fetch; otherwise loading. */
export function initialBriefState(article: { _id: string; brief?: BriefData }): BriefState {
  if (article.brief && typeof article.brief.whatHappened === 'string') {
    return { status: 'ready', brief: article.brief };
  }
  return isObjectId(article._id) ? { status: 'loading' } : { status: 'none' };
}

export function shouldFetchBrief(state: BriefState): boolean {
  return state.status === 'loading';
}

export function briefReducer(_state: BriefState, action: BriefAction): BriefState {
  switch (action.type) {
    case 'ready':
      return { status: 'ready', brief: action.brief };
    case 'fallback':
      return { status: 'fallback', text: action.text };
    default:
      return { status: 'error' };
  }
}

/** Turn a brief endpoint response into a reducer action; never throws. */
export function interpretBriefResponse(ok: boolean, json: unknown): BriefAction {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (!ok || j.success !== true) return { type: 'error' };
  const b = j.brief as BriefData | null | undefined;
  if (b && typeof b === 'object' && typeof b.whatHappened === 'string' && b.whatHappened) {
    return { type: 'ready', brief: b };
  }
  if (j.fallback === true && typeof j.text === 'string' && j.text.trim()) {
    return { type: 'fallback', text: j.text };
  }
  return { type: 'error' };
}
