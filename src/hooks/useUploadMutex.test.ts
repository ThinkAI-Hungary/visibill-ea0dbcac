import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUploadMutex } from './useUploadMutex';

describe('useUploadMutex', () => {
  it('should start unlocked', () => {
    const { result } = renderHook(() => useUploadMutex());
    expect(result.current.uploading).toBe(false);
    expect(result.current.isLocked()).toBe(false);
  });

  it('should acquire lock on first call', () => {
    const { result } = renderHook(() => useUploadMutex());

    let acquired: boolean;
    act(() => {
      acquired = result.current.acquire();
    });

    expect(acquired!).toBe(true);
    expect(result.current.uploading).toBe(true);
    expect(result.current.isLocked()).toBe(true);
  });

  it('should REJECT second acquire while locked (core mutex test)', () => {
    const { result } = renderHook(() => useUploadMutex());

    act(() => {
      result.current.acquire(); // 1st call — acquired
    });

    let secondAcquire: boolean;
    act(() => {
      secondAcquire = result.current.acquire(); // 2nd call — should be blocked
    });

    expect(secondAcquire!).toBe(false);
    expect(result.current.isLocked()).toBe(true);
  });

  it('should reject 5 rapid calls (simulates Thinkerman multi-click)', () => {
    const { result } = renderHook(() => useUploadMutex());
    const results: boolean[] = [];

    act(() => {
      // Simulate 5 rapid clicks — all within the same React batch
      for (let i = 0; i < 5; i++) {
        results.push(result.current.acquire());
      }
    });

    // Only the FIRST should succeed
    expect(results).toEqual([true, false, false, false, false]);
    expect(result.current.isLocked()).toBe(true);
  });

  it('should allow re-acquire after release', () => {
    const { result } = renderHook(() => useUploadMutex());

    act(() => {
      result.current.acquire();
    });
    expect(result.current.isLocked()).toBe(true);

    act(() => {
      result.current.release();
    });
    expect(result.current.uploading).toBe(false);
    expect(result.current.isLocked()).toBe(false);

    let reacquired: boolean;
    act(() => {
      reacquired = result.current.acquire();
    });
    expect(reacquired!).toBe(true);
    expect(result.current.isLocked()).toBe(true);
  });

  it('should protect async upload simulation', async () => {
    const { result } = renderHook(() => useUploadMutex());
    let callCount = 0;

    // Simulate the upload function pattern
    const simulatedUpload = async () => {
      if (!result.current.acquire()) return; // mutex guard
      try {
        callCount++;
        // Simulate async work (file upload)
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        result.current.release();
      }
    };

    // Fire 5 parallel calls (like 5 rapid button clicks)
    await act(async () => {
      await Promise.all([
        simulatedUpload(),
        simulatedUpload(),
        simulatedUpload(),
        simulatedUpload(),
        simulatedUpload(),
      ]);
    });

    // Only 1 should have executed
    expect(callCount).toBe(1);
    expect(result.current.isLocked()).toBe(false);
  });
});
