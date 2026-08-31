import type { QueryClient } from '@tanstack/react-query';
import type { UploadHistoryRecord } from '../types';

/**
 * Optimistically appends new upload records to the 'uploadHistory' query cache.
 */
export function addRecordsToUploadHistoryCache(
  queryClient: QueryClient,
  newRecords: UploadHistoryRecord[]
) {
  if (!newRecords || newRecords.length === 0) return;

  queryClient.setQueriesData(
    { queryKey: ['uploadHistory'] },
    (old: any) => {
      if (!old) return old;
      const existing = Array.isArray(old.records) ? old.records : [];
      return {
        ...old,
        records: [...newRecords, ...existing],
      };
    }
  );
}

/**
 * Invalidates the uploadHistory query after a short debounce to allow backend triggers to settle.
 */
export function triggerDelayedUploadHistoryInvalidation(queryClient: QueryClient, delayMs = 800) {
  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
  }, delayMs);
}
