import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";
import { QuickSchedule } from "../../src/features/quick-schedule/QuickSchedule";

export const TODAY = new Date("2026-10-21T12:00:00-05:00");

/** Fresh tab storage and the clock fixed at Oct 21, 2026 (only Date is faked, timers stay real). */
export function setUpQuickTests(): void {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TODAY);
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
