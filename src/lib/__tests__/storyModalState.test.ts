import { describe, it, expect } from 'vitest';
import {
  isObjectId, buildStoryHref, readStoryParam, initialBriefState, briefReducer,
  interpretBriefResponse, shouldFetchBrief,
} from '../storyModalState';
import { toggleSaved } from '../savedArticles';

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
