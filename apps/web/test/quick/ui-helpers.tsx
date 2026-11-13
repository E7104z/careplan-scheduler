import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";
import { readPdf } from "../../src/features/import/readPdf";
import { QuickSchedule } from "../../src/features/quick-schedule/QuickSchedule";

// readPdf loads pdf.js; the screens only need what it returns (the e2e suite opens real PDFs).
vi.mock("../../src/features/import/readPdf", () => ({ readPdf: vi.fn() }));

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

/** The stand-in for the PDF reader, for tests that say what a PDF reads as. */
export const readPdfMock = vi.mocked(readPdf);

/** The PDF chooser's file input: the one way a care plan comes in. */
export function pdfChooser(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(/^Choose the PDF/);
}

/**
 * Open a care plan the way a person does: choose its PDF. The reader is stood in for, so `text`
 * is what the PDF's pages read as; the text fixtures reach the screen through the PDF's door.
 */
export async function openCarePlanText(user: UserEvent, text: string): Promise<void> {
  readPdfMock.mockResolvedValueOnce({ kind: "text", text });
  await user.upload(pdfChooser(), new File(["%PDF-1.7"], "care-plan.pdf", { type: "application/pdf" }));
}

export function statusPanel(): HTMLElement {
  return screen.getByRole("status", { name: "Schedule status" });
}
