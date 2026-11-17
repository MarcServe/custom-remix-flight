import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Everything LeadBoosters keeps in the browser lives under this prefix so it can be
 * wiped in one go when the user signs out (or a different user signs in).
 */
export const LB_PREFIX = "lb:";
const DRAFT_PREFIX = `${LB_PREFIX}draft:`;
const OWNER_KEY = `${LB_PREFIX}owner`;
export const QUERY_CACHE_KEY = `${LB_PREFIX}query-cache`;

const safeGet = (k: string): string | null => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* quota or private mode */ } };
const safeRemove = (k: string) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } };

/** Remove every LeadBoosters draft and cached query from this browser. */
export function clearLocalAppData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LB_PREFIX)) keys.push(k);
    }
    keys.forEach(safeRemove);
  } catch { /* ignore */ }
}

/**
 * Called on every auth change: if the signed-in user differs from whoever owns the
 * stored data (or nobody is signed in), the stored data is cleared first.
 * Returns true when data was cleared.
 */
export function claimLocalAppData(userId: string | null): boolean {
  const owner = safeGet(OWNER_KEY);
  if (!userId) { if (owner) { clearLocalAppData(); return true; } return false; }
  if (owner && owner !== userId) { clearLocalAppData(); safeSet(OWNER_KEY, userId); return true; }
  if (!owner) safeSet(OWNER_KEY, userId);
  return false;
}

/**
 * useState that survives a refresh or Back: the value is saved to localStorage
 * (debounced) and restored on mount. Pass `null` as key to disable persistence.
 */
export function usePersistentState<T>(key: string | null, initial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const storageKey = key ? DRAFT_PREFIX + key : null;
  // Callers often pass fresh [] / {} literals; keep the first one so equality checks are stable.
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(() => {
    if (!storageKey) return initial;
    const raw = safeGet(storageKey);
    if (raw == null) return initial;
    try { return JSON.parse(raw) as T; } catch { return initial; }
  });
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const init = initialRef.current;
      const isEmpty = value === init || value === "" || value == null || (Array.isArray(value) && value.length === 0)
        || JSON.stringify(value) === JSON.stringify(init);
      if (isEmpty) safeRemove(storageKey); else safeSet(storageKey, JSON.stringify(value));
    }, 300);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [storageKey, value]);
  const clear = useCallback(() => { if (storageKey) safeRemove(storageKey); setValue(initialRef.current); }, [storageKey]);
  return [value, setValue, clear];
}
