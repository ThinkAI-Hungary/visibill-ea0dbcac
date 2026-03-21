import { useState, useCallback } from 'react';

/**
 * Generic hook to persist filter state in localStorage.
 * Usage:
 *   const [filters, setFilters, clearFilters] = useFilterPersistence('transactionsFilters', defaultFilters);
 */
export function useFilterPersistence<T extends Record<string, unknown>>(
  storageKey: string,
  defaultValues: T
): [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...defaultValues, ...JSON.parse(saved) };
    } catch {}
    return defaultValues;
  });

  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setStateRaw(prev => {
        const next = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const clearState = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStateRaw(defaultValues);
  }, [storageKey, defaultValues]);

  return [state, setState, clearState];
}
