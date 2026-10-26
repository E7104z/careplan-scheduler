import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";
import { QuickSchedule } from "../../src/features/quick-schedule/QuickSchedule";

export const TODAY = new Date("2026-10-21T12:00:00-05:00");

/**
 * Before fixture B's plan (Dec 1, 2025 to Oct 31, 2026) starts, so its whole plan is still to
 * come. The de-identified fixtures are real plans from 2025, and a schedule covers only months
 * still to come (APP-SPEC 5.3 step 5).
 */
export const BEFORE_B = new Date("2025-11-20T12:00:00-06:00");

/** Fresh tab storage and the clock fixed (only Date is faked, timers stay real), Oct 21, 2026 by default. */
export function setUpQuickTests(today: Date = TODAY): void {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(today);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

export function renderQuick(): { user: UserEvent; unmount: () => void } {
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter>
      <QuickSchedule />
    </MemoryRouter>,
  );
  return { user, unmount: view.unmount };
}

export function pasteBox(): HTMLElement {
  return screen.getByRole("textbox", { name: /^Care plan text/ });
}

/** Paste into the import box the way a person does: click, then paste (no button press). */
export async function pasteText(user: UserEvent, text: string): Promise<void> {
  await user.click(pasteBox());
  await user.paste(text);
}

export function statusPanel(): HTMLElement {
  return screen.getByRole("status", { name: "Schedule status" });
}
