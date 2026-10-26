import { useCallback, useEffect, useRef, useState } from "react";

// APP-SPEC 6.5 (D-10): sign out after 30 minutes without activity, with a warning at 28.

const MINUTE = 60_000;
export const IDLE_WARNING_MS = 28 * MINUTE;
export const IDLE_LIMIT_MS = 30 * MINUTE;
/** Activity is recorded at most this often. */
const THROTTLE_MS = 15_000;
/** Shared by every tab, so activity in one keeps the others signed in. */
export const LAST_ACTIVE_KEY = "cps.lastActive";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "focusin"] as const;

function readLastActive(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Records activity now, for every tab. Sign-in calls it so a new session starts its own clock. */
export function markActive(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    // Storage can be blocked; this tab still keeps its own clock.
  }
}

export interface IdleTimeout {
  /** Seconds until sign-out while the warning shows; null otherwise. */
  secondsLeft: number | null;
  /** "Stay signed in". */
  stay: () => void;
}

/**
 * Watches activity in this tab and others (`cps.lastActive` + the `storage` event). At 28
 * minutes idle it reports the seconds left; at 30 it calls `onTimeout` once. A session whose
 * last activity, in any tab, is already over 30 minutes old ends as soon as this starts.
 */
export function useIdleTimeout({ enabled, onTimeout }: { enabled: boolean; onTimeout: () => void }): IdleTimeout {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActive = useRef(0);
  const lastRecorded = useRef(0);
  const warning = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const record = useCallback((now: number) => {
    lastActive.current = now;
    lastRecorded.current = now;
    markActive(now);
  }, []);

  const stay = useCallback(() => {
    record(Date.now());
    warning.current = false;
    setSecondsLeft(null);
  }, [record]);

  useEffect(() => {
    if (!enabled) return;
    let finished = false;
    const stored = readLastActive();
    if (stored === null) record(Date.now());
    else lastActive.current = stored;

    const check = () => {
      if (finished) return;
      const idle = Date.now() - lastActive.current;
      if (idle >= IDLE_LIMIT_MS) {
        finished = true;
        warning.current = false;
        setSecondsLeft(null);
        onTimeoutRef.current();
      } else if (idle >= IDLE_WARNING_MS) {
        warning.current = true;
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idle) / 1000));
      } else if (warning.current) {
        warning.current = false;
        setSecondsLeft(null);
      }
    };

    // While the warning shows, only "Stay signed in" (or another tab) keeps the session.
    const onActivity = () => {
      const now = Date.now();
      if (warning.current || now - lastRecorded.current < THROTTLE_MS) return;
      record(now);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVE_KEY || event.newValue === null) return;
      const other = Number(event.newValue);
      if (Number.isFinite(other) && other > lastActive.current) {
        lastActive.current = other;
        check();
      }
    };

    for (const name of ACTIVITY_EVENTS) document.addEventListener(name, onActivity, { capture: true, passive: true });
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(check, 1000);
    check();
    return () => {
      finished = true;
      for (const name of ACTIVITY_EVENTS) document.removeEventListener(name, onActivity, { capture: true });
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [enabled, record]);

  return { secondsLeft, stay };
}
