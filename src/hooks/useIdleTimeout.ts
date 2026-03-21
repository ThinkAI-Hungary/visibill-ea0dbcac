import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
];

const STORAGE_KEY = 'visibill_last_activity';

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining on the countdown (120 → 0) */
  secondsLeft: number;
  /** Call this to dismiss the warning and reset the idle timer */
  stayActive: () => void;
}

/** Read the persisted last-activity timestamp from localStorage */
function getLastActivity(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

/** Write the current time as last-activity to localStorage */
function touchActivity(): void {
  try {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Two-phase idle timeout with localStorage persistence:
 *   Phase 1: After `warningAfterMs` of inactivity → show warning.
 *   Phase 2: Countdown for `countdownSec` seconds → call `onExpire`.
 *
 * Persists the last-activity timestamp in localStorage so:
 * - Page refreshes don't reset the timer
 * - Multiple tabs stay in sync via the `storage` event
 * - If the user returns after >30min, they are signed out immediately
 */
export function useIdleTimeout(
  onExpire: () => void,
  {
    warningAfterMs = 28 * 60 * 1000,  // 28 minutes
    countdownSec = 120,                // 2 minutes
    enabled = true,
  }: {
    warningAfterMs?: number;
    countdownSec?: number;
    enabled?: boolean;
  } = {}
): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(countdownSec);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const totalTimeoutMs = warningAfterMs + countdownSec * 1000; // 30 minutes total

  // ── Calculate remaining time from localStorage ──
  const getRemainingMs = useCallback(() => {
    const elapsed = Date.now() - getLastActivity();
    return Math.max(0, warningAfterMs - elapsed);
  }, [warningAfterMs]);

  // ── Phase 1: Idle detection ──
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!enabled) return;

    const remaining = getRemainingMs();

    if (remaining <= 0) {
      // Already past warning threshold — check if should auto-logout
      const elapsed = Date.now() - getLastActivity();
      if (elapsed >= totalTimeoutMs) {
        // Past 30 min — sign out immediately
        onExpireRef.current();
        return;
      }
      // Between 28-30 min — show warning with adjusted countdown
      const countdownRemaining = Math.max(0, Math.ceil((totalTimeoutMs - elapsed) / 1000));
      if (countdownRemaining <= 0) {
        onExpireRef.current();
        return;
      }
      setSecondsLeft(countdownRemaining);
      setShowWarning(true);
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      setSecondsLeft(countdownSec);
      setShowWarning(true);
    }, remaining);
  }, [warningAfterMs, countdownSec, enabled, getRemainingMs, totalTimeoutMs]);

  // ── Phase 2: Countdown ──
  useEffect(() => {
    if (!showWarning) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setShowWarning(false);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showWarning]);

  // ── Reset (user chose "Stay") ──
  const stayActive = useCallback(() => {
    setShowWarning(false);
    setSecondsLeft(countdownSec);
    touchActivity(); // Persist the reset
    startIdleTimer();
  }, [countdownSec, startIdleTimer]);

  // ── Event listeners for Phase 1 only ──
  useEffect(() => {
    if (!enabled) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    // On mount: touch activity (refresh counts as activity) and start timer
    touchActivity();
    startIdleTimer();

    // Reset idle timer on user activity (Phase 1 only)
    const activityHandler = () => {
      if (!showWarning) {
        touchActivity();
        startIdleTimer();
      }
    };

    IDLE_EVENTS.forEach(event =>
      window.addEventListener(event, activityHandler, { passive: true })
    );

    // ── Multi-tab sync via storage event ──
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        // Another tab updated last_activity — reset our timer
        if (!showWarning) {
          startIdleTimer();
        }
        // If we're showing warning but another tab just had activity, dismiss it
        if (showWarning) {
          const elapsed = Date.now() - parseInt(e.newValue, 10);
          if (elapsed < warningAfterMs) {
            setShowWarning(false);
            setSecondsLeft(countdownSec);
            startIdleTimer();
          }
        }
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(event => window.removeEventListener(event, activityHandler));
      window.removeEventListener('storage', storageHandler);
    };
  }, [startIdleTimer, enabled, showWarning, warningAfterMs, countdownSec]);

  return { showWarning, secondsLeft, stayActive };
}
