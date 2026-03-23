import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/lib/constants';

// ── Constants ──────────────────────────────────────────────
const STORAGE_KEY = STORAGE_KEYS.LAST_ACTIVE;
const ABSOLUTE_LIMIT_MS = 4 * 60 * 60 * 1000;   // 4 hours
const WARNING_AFTER_MS  = 28 * 60 * 1000;        // 28 minutes
const COUNTDOWN_SEC     = 120;                     // 2 minutes
const THROTTLE_MS       = 1000;                    // max 1 write/sec

const IDLE_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll',
];

// ── Helpers ────────────────────────────────────────────────
function getLastActive(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function setLastActive(ts: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, ts.toString());
  } catch {}
}

// ── Return type ────────────────────────────────────────────
export interface SessionGuardState {
  showWarning: boolean;
  secondsLeft: number;
  stayActive: () => void;
}

/**
 * Unified session guard hook.  Must be called **once** inside AuthContext.
 *
 * 1. Absolute expiry  – if `now - lastActive > 4 h` → instant signOut.
 * 2. Idle warning     – after 28 min of inactivity → modal.
 * 3. Countdown        – 120 s → auto signOut.
 * 4. Throttled writes – at most 1 localStorage write per second.
 * 5. Multi-tab sync   – `storage` event resets the timer cross-tab.
 */
export function useSessionGuard(
  signOut: () => Promise<void>,
  enabled: boolean,
): SessionGuardState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);

  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWriteRef    = useRef(0);
  const signOutRef      = useRef(signOut);
  signOutRef.current    = signOut;

  const totalTimeoutMs = WARNING_AFTER_MS + COUNTDOWN_SEC * 1000; // 30 min

  // ── Absolute expiry check (runs once on mount) ──
  useEffect(() => {
    if (!enabled) return;
    const elapsed = Date.now() - getLastActive();
    if (elapsed >= ABSOLUTE_LIMIT_MS) {
      // Stale session — sign out before anything renders
      signOutRef.current();
    }
  }, [enabled]);

  // ── Remaining ms until warning ──
  const getRemainingMs = useCallback(() => {
    return Math.max(0, WARNING_AFTER_MS - (Date.now() - getLastActive()));
  }, []);

  // ── Phase 1: schedule idle timer ──
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!enabled) return;

    const remaining = getRemainingMs();

    if (remaining <= 0) {
      const elapsed = Date.now() - getLastActive();
      if (elapsed >= totalTimeoutMs) {
        signOutRef.current();
        return;
      }
      // Between 28-30 min — show warning with adjusted countdown
      const cdRemaining = Math.max(0, Math.ceil((totalTimeoutMs - elapsed) / 1000));
      if (cdRemaining <= 0) {
        signOutRef.current();
        return;
      }
      setSecondsLeft(cdRemaining);
      setShowWarning(true);
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      setSecondsLeft(COUNTDOWN_SEC);
      setShowWarning(true);
    }, remaining);
  }, [enabled, getRemainingMs, totalTimeoutMs]);

  // ── Phase 2: countdown ──
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
          signOutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showWarning]);

  // ── "Stay" handler ──
  const stayActive = useCallback(() => {
    setShowWarning(false);
    setSecondsLeft(COUNTDOWN_SEC);
    setLastActive();
    // Refresh Supabase session token
    supabase.auth.refreshSession().catch(() => {});
    startIdleTimer();
  }, [startIdleTimer]);

  // ── Throttled activity writer ──
  const touchActivityThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current >= THROTTLE_MS) {
      lastWriteRef.current = now;
      setLastActive(now);
    }
  }, []);

  // ── Event listeners + multi-tab sync ──
  useEffect(() => {
    if (!enabled) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    // Touch on mount (page refresh = activity)
    setLastActive();
    startIdleTimer();

    // User interaction → reset idle (Phase 1 only)
    const activityHandler = () => {
      if (!showWarning) {
        touchActivityThrottled();
        startIdleTimer();
      }
    };

    IDLE_EVENTS.forEach(ev =>
      window.addEventListener(ev, activityHandler, { passive: true }),
    );

    // ── Multi-tab sync ──
    const storageHandler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const otherTabTs = parseInt(e.newValue, 10);
      const elapsed = Date.now() - otherTabTs;

      if (showWarning && elapsed < WARNING_AFTER_MS) {
        // Another tab had recent activity → dismiss warning
        setShowWarning(false);
        setSecondsLeft(COUNTDOWN_SEC);
        startIdleTimer();
      } else if (!showWarning) {
        startIdleTimer();
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(ev => window.removeEventListener(ev, activityHandler));
      window.removeEventListener('storage', storageHandler);
    };
  }, [startIdleTimer, enabled, showWarning, touchActivityThrottled]);

  return { showWarning, secondsLeft, stayActive };
}
