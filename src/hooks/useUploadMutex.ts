import { useRef, useState, useCallback } from 'react';

/**
 * Hook that provides a synchronous mutex guard for upload operations.
 * 
 * React's async setState batching means setUploading(true) doesn't block
 * the next call immediately — this ref provides instant protection against
 * rapid multi-clicks spawning parallel upload loops.
 * 
 * @see Thinkerman incident, Jun 26-27 2026: 5-8x parallel uploads from rapid clicks
 */
export function useUploadMutex() {
  const [uploading, setUploading] = useState(false);
  const mutexRef = useRef(false);

  /**
   * Attempts to acquire the upload lock.
   * Returns true if lock acquired, false if already locked.
   * This is SYNCHRONOUS — unlike setState, it blocks immediately.
   */
  const acquire = useCallback((): boolean => {
    if (mutexRef.current) return false;
    mutexRef.current = true;
    setUploading(true);
    return true;
  }, []);

  /**
   * Releases the upload lock. Must be called in a finally block.
   */
  const release = useCallback(() => {
    mutexRef.current = false;
    setUploading(false);
  }, []);

  return { uploading, acquire, release, isLocked: () => mutexRef.current };
}
