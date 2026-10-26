/**
 * Client-side "highlight" extraction for visual card variants. Only text already in the article is
 * used: a quoted phrase becomes a quote card, a money/percent figure in the headline becomes a number card.
 * No speaker attribution is guessed.
 */

export interface HighlightSource {
  title: string;
  description?: string;
  summary?: { tldr?: string; bullets?: string[] };
}

const QUOTE_RE = /[“"]([^“”"]{12,180})[”"]/g;

/** A quoted phrase of 6–24 words (shorter quotes are usually titles or scare quotes), or null. Prefers the description, then the tldr, then the title. */
export function extractQuote(a: HighlightSource): string | null {
  const texts = [a.description, a.summary?.tldr, a.title];
  for (const t of texts) {
    if (typeof t !== 'string') continue;
    for (const m of t.matchAll(QUOTE_RE)) {
      const q = m[1].trim().replace(/[,;:]$/, '');
      const words = q.split(/\s+/).length;
      if (words >= 6 && words <= 24) return q;
    }
  }
  return null;
}

// £55m, $1.2bn, €300 million, 12%, 3.5 per cent, $4 trillion
const FIGURE_RE =
  /(?:[£$€¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:bn|m|k|tn|trillion|billion|million)?\b|\b\d[\d,]*(?:\.\d+)?\s?(?:%|per ?cent\b|percent\b)|\b\d[\d,]*(?:\.\d+)?\s(?:trillion|billion|million)\b)/i;

/** A money or percentage figure from the headline (headline only, so the card always has context). */
export function extractFigure(a: HighlightSource): string | null {
  if (typeof a.title !== 'string') return null;
  const m = a.title.match(FIGURE_RE);
  if (!m) return null;
  return m[0].replace(/\s+/g, ' ').replace(/ ?per ?cent$|percent$/i, '%').trim();
}

/** The headline with the figure removed would read oddly, so the card shows both: this trims for display. */
export function cleanQuote(q: string): string {
  const t = q.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
