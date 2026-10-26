import { useSyncExternalStore } from 'react';

// Wall clock, refreshed every minute so day boundaries (streaks, "today") roll over while the page is open.
let nowCache = 0;
function subscribeNow(cb: () => void) {
  const id = window.setInterval(() => {
    nowCache = Date.now();
    cb();
  }, 60_000);
  return () => window.clearInterval(id);
}
function getNow() {
  if (!nowCache) nowCache = Date.now();
  return nowCache;
}

/** Current time in ms on the client (minute resolution); 0 during SSR and hydration. */
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, getNow, () => 0);
}

const noop = () => () => {};
/** True when the browser can speak text aloud (Web Speech API). */
export function useCanSpeak(): boolean {
  return useSyncExternalStore(noop, () => 'speechSynthesis' in window, () => false);
}
