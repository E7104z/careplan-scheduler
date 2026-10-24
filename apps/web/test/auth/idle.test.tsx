import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleDialog } from "../../src/features/auth/IdleDialog";
import { LAST_ACTIVE_KEY, useIdleTimeout } from "../../src/features/auth/useIdleTimeout";

const MINUTE = 60_000;
const START = new Date("2026-10-21T09:00:00-05:00");

function Harness({ onTimeout }: { onTimeout: () => void }) {
  const { secondsLeft, stay } = useIdleTimeout({ enabled: true, onTimeout });
  return <IdleDialog secondsLeft={secondsLeft} onStay={stay} />;
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function warning(): HTMLElement | null {
  return screen.queryByRole("dialog", { name: "You'll be signed out in 2 minutes" });
}

/** Another tab saved activity (APP-SPEC 6.5: the storage event keeps this tab alive). */
function otherTabActive(): void {
  const now = String(Date.now());
  localStorage.setItem(LAST_ACTIVE_KEY, now);
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key: LAST_ACTIVE_KEY, newValue: now }));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("session timeout (APP-SPEC 6.5, AC-20)", () => {
  it("warns at 28 minutes with a countdown, and signs out at 30", () => {
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);

    advance(28 * MINUTE - 2000);
    expect(warning()).not.toBeInTheDocument();

    advance(2000);
    expect(warning()).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("2:00");
    advance(61_000);
    expect(screen.getByRole("timer")).toHaveTextContent("0:59");
    expect(onTimeout).not.toHaveBeenCalled();

    advance(59_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    advance(5 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("activity resets the clock", () => {
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);

    advance(20 * MINUTE);
    fireEvent.keyDown(document.body, { key: "a" });
    advance(27 * MINUTE);
    expect(warning()).not.toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    advance(29 * MINUTE);
    expect(warning()).toBeInTheDocument();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("activity is recorded at most once every 15 seconds", () => {
    render(<Harness onTimeout={vi.fn()} />);
    advance(MINUTE);
    fireEvent.keyDown(document.body, { key: "a" });
    const first = localStorage.getItem(LAST_ACTIVE_KEY);
    expect(first).toBe(String(Date.now()));

    advance(10_000);
    fireEvent.keyDown(document.body, { key: "b" });
    expect(localStorage.getItem(LAST_ACTIVE_KEY)).toBe(first);

    advance(6_000);
    fireEvent.keyDown(document.body, { key: "c" });
    expect(localStorage.getItem(LAST_ACTIVE_KEY)).toBe(String(Date.now()));
  });

  it("activity in another tab keeps this one signed in, and closes the warning", () => {
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);

    advance(27 * MINUTE);
    otherTabActive();
    advance(27 * MINUTE);
    expect(warning()).not.toBeInTheDocument();

    advance(MINUTE + 1000);
    expect(warning()).toBeInTheDocument();
    otherTabActive();
    expect(warning()).not.toBeInTheDocument();
    advance(10 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("\"Stay signed in\" closes the warning and starts the 30 minutes again", () => {
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);

    advance(29 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(warning()).not.toBeInTheDocument();
    advance(27 * MINUTE);
    expect(warning()).not.toBeInTheDocument();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("while the warning shows, a stray key press doesn't count; only Stay signed in does", () => {
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);

    advance(28 * MINUTE + 1000);
    fireEvent.keyDown(document.body, { key: "a" });
    advance(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("a session last active over 30 minutes ago (in any tab) ends as soon as the app opens", () => {
    localStorage.setItem(LAST_ACTIVE_KEY, String(START.getTime() - 45 * MINUTE));
    const onTimeout = vi.fn();
    render(<Harness onTimeout={onTimeout} />);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("a recent time from another tab carries over", () => {
    localStorage.setItem(LAST_ACTIVE_KEY, String(START.getTime() - 20 * MINUTE));
    render(<Harness onTimeout={vi.fn()} />);
    advance(8 * MINUTE + 1000);
    expect(warning()).toBeInTheDocument();
  });
});
