import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
];

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining on the countdown (120 → 0) */
  secondsLeft: number;
  /** Call this to dismiss the warning and reset the idle timer */
  stayActive: () => void;
}

/**
 * Two-phase idle timeout:
 *   Phase 1: After `warningAfterMs` of inactivity → show warning.
 *   Phase 2: Countdown for `countdownSec` seconds → call `onExpire`.
 *
 * User activity resets Phase 1. Activity is NOT tracked during the warning phase.
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

  // ── Phase 1: Idle detection ──
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!enabled) return;
    idleTimerRef.current = setTimeout(() => {
      // Enter Phase 2: Show warning + start countdown
      setSecondsLeft(countdownSec);
      setShowWarning(true);
    }, warningAfterMs);
  }, [warningAfterMs, countdownSec, enabled]);

  // ── Phase 2: Countdown ──
  useEffect(() => {
    if (!showWarning) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Time's up
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

    startIdleTimer();

    // Only reset idle timer on activity when warning is NOT shown
    const handler = () => {
      if (!showWarning) startIdleTimer();
    };
    IDLE_EVENTS.forEach(event =>
      window.addEventListener(event, handler, { passive: true })
    );

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(event => window.removeEventListener(event, handler));
    };
  }, [startIdleTimer, enabled, showWarning]);

  return { showWarning, secondsLeft, stayActive };
}
