import { describe, it, expect } from 'vitest';
import { parseRssItem } from '@/lib/sources/rss';

const feed = { url: 'https://example.com/rss', source: 'Example' };
const base = { title: 'Hello', link: 'https://example.com/a', isoDate: '2026-10-18T08:00:00.000Z' };

describe('parseRssItem', () => {
  it('reads media:thumbnail', () => {
    const a = parseRssItem({ ...base, 'media:thumbnail': { $: { url: 'https://img.example.com/t.jpg' } } }, feed, 'world');
    expect(a?.imageUrl).toBe('https://img.example.com/t.jpg');
    expect(a?.source).toBe('Example');
    expect(a?.category).toBe('world');
  });
  it('upgrades BBC thumbnail width', () => {
    const a = parseRssItem({ ...base, 'media:thumbnail': { $: { url: 'https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/287a/live/x.jpg' } } }, feed, 'world');
    expect(a?.imageUrl).toBe('https://ichef.bbci.co.uk/ace/standard/800/cpsprodpb/287a/live/x.jpg');
  });
  it('reads media:content', () => {
    const a = parseRssItem({ ...base, 'media:content': [{ $: { url: 'https://img.example.com/c.jpg', medium: 'image' } }] }, feed, 'world');
    expect(a?.imageUrl).toBe('https://img.example.com/c.jpg');
  });
  it('reads enclosure image', () => {
    const a = parseRssItem({ ...base, enclosure: { url: 'https://img.example.com/e.png', type: 'image/png' } }, feed, 'world');
    expect(a?.imageUrl).toBe('https://img.example.com/e.png');
  });
  it('no image -> imageUrl undefined', () => {
    const a = parseRssItem({ ...base, enclosure: { url: 'https://x.com/a.mp3', type: 'audio/mpeg' } }, feed, 'world');
    expect(a).not.toBeNull();
    expect(a?.imageUrl).toBeUndefined();
  });
  it('missing title -> null', () => {
    expect(parseRssItem({ link: base.link, isoDate: base.isoDate }, feed, 'world')).toBeNull();
  });
  it('invalid date -> null', () => {
    expect(parseRssItem({ ...base, isoDate: 'garbage' }, feed, 'world')).toBeNull();
  });
  it('strips HTML from description', () => {
    const a = parseRssItem({ ...base, contentSnippet: undefined, description: '<p>Some <b>bold</b> &amp; text</p>' }, feed, 'world');
    expect(a?.description).toBe('Some bold & text');
  });

  it('rejects non-http image URLs', () => {
    for (const u of ['data:image/png;base64,AAA', 'javascript:alert(1)']) {
      expect(parseRssItem({ ...base, 'media:thumbnail': { $: { url: u } } }, feed, 'world')?.imageUrl).toBeUndefined();
      expect(parseRssItem({ ...base, 'media:content': { $: { url: u, medium: 'image' } } }, feed, 'world')?.imageUrl).toBeUndefined();
      expect(parseRssItem({ ...base, enclosure: { url: u, type: 'image/png' } }, feed, 'world')?.imageUrl).toBeUndefined();
    }
  });
  it('upgrades BBC width on media:content', () => {
    const a = parseRssItem({ ...base, 'media:content': { $: { url: 'https://ichef.bbci.co.uk/news/240/cpsprodpb/a/x.jpg', medium: 'image' } } }, feed, 'world');
    expect(a?.imageUrl).toBe('https://ichef.bbci.co.uk/news/800/cpsprodpb/a/x.jpg');
  });
  it('decodes entities', () => {
    const a = parseRssItem({ ...base, description: 'It&#8217;s &#x2019; &mdash; &amp;lt; ok' }, feed, 'world');
    expect(a?.description).toBe('It\u2019s \u2019 \u2014 &lt; ok');
  });
  it('removes script and style content', () => {
    const a = parseRssItem({ ...base, description: 'A<script>evil()</script><style>.x{}</style><!-- c -->B' }, feed, 'world');
    expect(a?.description).toBe('A B');
  });
  it('falls back to in-HTML img', () => {
    const a = parseRssItem({ ...base, description: '<p><img src="https://img.example.com/h.jpg"></p>' }, feed, 'world');
    expect(a?.imageUrl).toBe('https://img.example.com/h.jpg');
  });
  it('skips tracking pixel and picks first real img', () => {
    const html = '<img src="https://t.example.com/a.gif" width="1" height="1"><img src="https://x.com/pixel.gif"><img data-src="https://img.example.com/real.jpg">';
    expect(parseRssItem({ ...base, 'content:encoded': html }, feed, 'world')?.imageUrl).toBe('https://img.example.com/real.jpg');
    expect(parseRssItem({ ...base, description: '<img src="https://t.example.com/a.gif" width="1" height="1">' }, feed, 'world')?.imageUrl).toBeUndefined();
  });
});
