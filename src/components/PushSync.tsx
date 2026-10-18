"use client";

import { useEffect, useRef } from "react";
import { effectiveCategories, usePrefs } from "@/lib/prefs";
import { syncPush } from "@/lib/pushClient";
import { useHydrated } from "@/lib/useHydrated";

/** Keeps the server-side push subscription in step with local prefs. Renders nothing. */
export default function PushSync() {
  const hydrated = useHydrated();
  const [prefs, setPrefs] = usePrefs();
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });
  const cats = effectiveCategories(prefs).join(",");
  const { notifyEnabled, notifyTime } = prefs;
  const first = useRef(true);

  useEffect(() => {
    if (!hydrated || !notifyEnabled) return;
    const t = setTimeout(
      () => {
        syncPush(prefsRef.current, () => prefsRef.current.notifyEnabled).then((status) => {
          if (status === "denied") setPrefs({ notifyEnabled: false });
        });
      },
      first.current ? 0 : 800
    );
    first.current = false;
    return () => clearTimeout(t);
  }, [hydrated, notifyEnabled, cats, notifyTime, setPrefs]);

  return null;
}
