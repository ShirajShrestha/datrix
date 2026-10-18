import { describe, it, expect } from 'vitest';
import {
  isObjectId, buildStoryHref, readStoryParam, initialBriefState, briefReducer,
  interpretBriefResponse, shouldFetchBrief, closeAction, shouldPushStory,
} from '../storyModalState';
import { toggleSaved, readSaved, toggleSavedStored, SAVED_CHANGED_EVENT } from '../savedArticles';

const id = 'a'.repeat(24);

describe('isObjectId', () => {
  it('accepts 24 hex only', () => {
    expect(isObjectId(id)).toBe(true);
    expect(isObjectId('zzz')).toBe(false);
    expect(isObjectId('a'.repeat(23))).toBe(false);
    expect(isObjectId('g'.repeat(24))).toBe(false);
    expect(isObjectId(undefined)).toBe(false);
  });
});

describe('buildStoryHref / readStoryParam', () => {
  it('sets and removes while preserving other params', () => {
    expect(buildStoryHref('/', '?cat=tech', id)).toBe(`/?cat=tech&story=${id}`);
    expect(buildStoryHref('/', `?cat=tech&story=${id}`, null)).toBe('/?cat=tech');
    expect(buildStoryHref('/saved', `?story=${id}`, null)).toBe('/saved');
  });
  it('reads param', () => {
    expect(readStoryParam(`?story=${id}`)).toBe(id);
    expect(readStoryParam('')).toBeNull();
  });
});

describe('brief state', () => {
  it('uses stored brief immediately', () => {
    const s = initialBriefState({ _id: id, brief: { whatHappened: 'x' } });
    expect(s.status).toBe('ready');
    expect(shouldFetchBrief(s)).toBe(false);
  });
  it('loads for valid ids, none for legacy ids', () => {
    expect(initialBriefState({ _id: id }).status).toBe('loading');
    expect(shouldFetchBrief(initialBriefState({ _id: id }))).toBe(true);
    expect(initialBriefState({ _id: 'legacy-1' }).status).toBe('none');
  });
  it('interprets responses', () => {
    expect(interpretBriefResponse(true, { success: true, brief: { whatHappened: 'w' } }).type).toBe('ready');
    expect(interpretBriefResponse(true, { success: true, brief: null, fallback: true, text: 'fb' })).toEqual({ type: 'fallback', text: 'fb' });
    expect(interpretBriefResponse(false, { success: false }).type).toBe('error');
    expect(interpretBriefResponse(true, null).type).toBe('error');
    expect(interpretBriefResponse(true, { success: true, brief: null }).type).toBe('error');
  });
  it('reduces', () => {
    expect(briefReducer({ status: 'loading' }, { type: 'error' }).status).toBe('error');
    expect(briefReducer({ status: 'loading' }, { type: 'fallback', text: 't' })).toEqual({ status: 'fallback', text: 't' });
  });
});

describe('toggleSaved', () => {
  it('adds with isSaved and removes by id', () => {
    const a = { _id: '1', t: 'x' };
    const added = toggleSaved([], a);
    expect(added).toEqual([{ _id: '1', t: 'x', isSaved: true }]);
    expect(toggleSaved(added, a)).toEqual([]);
  });
});

describe('closeAction', () => {
  it('goes back only when our pushed entry is current', () => {
    expect(closeAction(true, id, `?story=${id}`)).toBe('back');
    expect(closeAction(true, id, '?story=other')).toBe('strip');
    expect(closeAction(false, null, `?story=${id}`)).toBe('strip');
    expect(closeAction(true, id, '')).toBe('none');
  });
});

describe('savedArticles storage', () => {
  it('filters non-objects, dispatches event, reports real state', async () => {
    const store: Record<string, string> = { newsintel_saved_articles: JSON.stringify([null, 5, { _id: '9' }]) };
    const events: string[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    g.window = { dispatchEvent: (e: Event) => { events.push(e.type); return true; } };
    g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    expect(readSaved()).toEqual([{ _id: '9' }]);
    expect(toggleSavedStored({ _id: '1' })).toBe(true);
    expect(events).toEqual([SAVED_CHANGED_EVENT]);
    g.localStorage = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    expect(toggleSavedStored({ _id: '1' })).toBe(false);
    delete g.window; delete g.localStorage;
  });
});

describe('shouldPushStory', () => {
  it('skips duplicate pushes', () => {
    expect(shouldPushStory(id, id, `?story=${id}`)).toBe(false);
    expect(shouldPushStory(null, id, `?story=${id}`)).toBe(true);
    expect(shouldPushStory(id, id, '')).toBe(true);
  });
});
