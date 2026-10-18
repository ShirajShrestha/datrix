import { useSyncExternalStore } from 'react';

/** false during SSR and the hydration pass, true afterwards on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
