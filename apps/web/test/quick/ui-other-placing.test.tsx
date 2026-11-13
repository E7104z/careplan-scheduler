import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

// CP3-4 and CP3-5 on the page, with fixture G on Oct 31, 2026 (its plan runs Nov 2026 to Apr 2027).
setUpQuickTests(new Date("2026-10-31T12:00:00-05:00"));

async function openG() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureG);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT G" });
  // The placing controls are in the dated-side chunk: wait for them.
  await screen.findByRole("group", { name: "Place HDM on the calendar" }, { timeout: 5000 });
  return result;
}

function placing(label: string): HTMLElement {
  return screen.getByRole("group", { name: `Place ${label} on the calendar` });
}

function setDate(group: HTMLElement, value: string): void {
  fireEvent.change(within(group).getByLabelText("Date"), { target: { value } });
}

describe("Services arranged by date (APP-SPEC 5.8)", () => {
  it("each kept authorization offers what it can hold, and nothing more", async () => {
    await openG();
    expect(within(placing("HDM")).getByText("Counted as meals, never as time. No more than 2 a day.")).toBeInTheDocument();
    expect(within(placing("HDM")).getByRole("button", { name: "Add delivery for HDM" })).toBeInTheDocument();
    expect(within(placing("ADC")).getByLabelText("Minutes attended")).toBeInTheDocument();
    expect(within(placing("ADC")).getByLabelText("Transportation minutes")).toBeInTheDocument();
    expect(within(placing("RN")).getByRole("button", { name: "Add visit for RN" })).toBeInTheDocument();
    // Financial management is context only, and the unknown code can hold nothing.
    expect(screen.getByText("Nothing to place: this is authorization context only.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Place FMS on the calendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Place XYZ on the calendar" })).not.toBeInTheDocument();
    expect(within(placing("HDM")).getByLabelText("Date")).toHaveAttribute("min", "2026-11-01");
    expect(within(placing("HDM")).getByLabelText("Date")).toHaveAttribute("max", "2027-04-30");
  });

  it("meals: a delivery is placed in meals, the balance follows, and a third meal that day is refused", async () => {
    const { user } = await openG();
    const group = placing("HDM");
    setDate(group, "2026-11-03");
    await user.type(within(group).getByLabelText("Meals"), "2");
    await user.click(within(group).getByRole("button", { name: "Add delivery for HDM" }));

    expect(await within(group).findByText("Nov 3, 2026 · 2 meals")).toBeInTheDocument();
    expect(within(group).getByText("62 meals in November 2026, 2 placed, 60 left")).toBeInTheDocument();
    expect(screen.getByText("Arranged by date · 1 date placed")).toBeInTheDocument();

    await user.clear(within(group).getByLabelText("Meals"));
    await user.type(within(group).getByLabelText("Meals"), "1");
    await user.click(within(group).getByRole("button", { name: "Add delivery for HDM" }));
    expect(await within(group).findByRole("alert")).toHaveTextContent(
      "Not placed. Home delivered meals are limited to 2 a day. Enter 2 or fewer for Nov 3, 2026.",
    );
    expect(within(group).getByText("62 meals in November 2026, 2 placed, 60 left")).toBeInTheDocument();
  });

  it("adult day care: a day with its transportation is placed as time attended; 41 units is refused", async () => {
    const { user } = await openG();
    const group = placing("ADC");
    setDate(group, "2026-11-02");
    await user.type(within(group).getByLabelText("Minutes attended"), "480");
    await user.type(within(group).getByLabelText("Transportation minutes"), "60");
    await user.click(within(group).getByRole("button", { name: "Add day care day for ADC" }));
    expect(await within(group).findByText("Nov 2, 2026 · 8 h · 60 min transportation")).toBeInTheDocument();
    expect(within(group).getByText("100 h in November 2026, 8 h placed, 92 h left")).toBeInTheDocument();

    setDate(group, "2026-11-03");
    await user.clear(within(group).getByLabelText("Minutes attended"));
    await user.type(within(group).getByLabelText("Minutes attended"), "615");
    await user.click(within(group).getByRole("button", { name: "Add day care day for ADC" }));
    expect(await within(group).findByRole("alert")).toHaveTextContent(
      "Not placed. Enter adult day care in 15-minute steps, at most 10 hours a day and 5 days a week.",
    );
  });

  it("says what is missing before anything is sent: no date, no number", async () => {
    const { user } = await openG();
    const group = placing("HDM");
    await user.click(within(group).getByRole("button", { name: "Add delivery for HDM" }));
    expect(within(group).getByRole("alert")).toHaveTextContent("Pick a date first.");
    setDate(group, "2026-11-03");
    await user.click(within(group).getByRole("button", { name: "Add delivery for HDM" }));
    expect(within(group).getByRole("alert")).toHaveTextContent("Enter the number of meals.");
  });

  it("a placed date can be removed, and a reload keeps what is placed without a name", async () => {
    const { user, unmount } = await openG();
    const group = placing("HDM");
    setDate(group, "2026-11-03");
    await user.type(within(group).getByLabelText("Meals"), "2");
    await user.click(within(group).getByRole("button", { name: "Add delivery for HDM" }));
    await within(group).findByText("Nov 3, 2026 · 2 meals");
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain("MEAL_DELIVERY"));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000007/);

    unmount();
    renderQuick();
    const again = await screen.findByRole("group", { name: "Place HDM on the calendar" });
    expect(within(again).getByText("Nov 3, 2026 · 2 meals")).toBeInTheDocument();
    await user.click(within(again).getByRole("button", { name: "Remove HDM on Nov 3, 2026 · 2 meals" }));
    await waitFor(() => expect(within(again).queryByText("Nov 3, 2026 · 2 meals")).not.toBeInTheDocument());
    expect(screen.getAllByText("Arranged by date")).toHaveLength(3);
  });
});

describe("Context authorizations: optional reminders, never shifts (CP3-5)", () => {
  // Fixture G with its context authorization made ILW case management (T2024U6), which may hold a reminder.
  const withCaseManagement = fixtureG.replaceAll("T2040U6", "T2024U6");

  it("case management takes a dated reminder with the person's note, and it counts toward nothing", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, withCaseManagement);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT G" });
    const group = await screen.findByRole("group", { name: "Place FMS on the calendar" });
    expect(within(group).getByText("A reminder is a note on a date. It is never a visit and is never billed.")).toBeInTheDocument();
    // Only a date and a note: there is no quantity to enter on a context authorization.
    expect(within(group).queryByLabelText("Meals")).not.toBeInTheDocument();
    expect(within(group).queryByLabelText("Minutes attended")).not.toBeInTheDocument();

    setDate(group, "2026-11-10");
    await user.type(within(group).getByLabelText("Note (optional)"), "Call the case manager");
    await user.click(within(group).getByRole("button", { name: "Add reminder for FMS" }));
    expect(await within(group).findByText("Nov 10, 2026 · Reminder, not a visit · Call the case manager")).toBeInTheDocument();
    // No balance line and no "dates placed": a reminder is not a date of service.
    expect(within(group).queryByText(/placed, .* left/)).not.toBeInTheDocument();
    expect(screen.getByText("No caregiver time")).toBeInTheDocument();
    expect(screen.queryByText(/No caregiver time · /)).not.toBeInTheDocument();
  });

  it("a reminder needs no note", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, withCaseManagement);
    const group = await screen.findByRole("group", { name: "Place FMS on the calendar" });
    setDate(group, "2026-12-01");
    await user.click(within(group).getByRole("button", { name: "Add reminder for FMS" }));
    expect(await within(group).findByText("Dec 1, 2026 · Reminder, not a visit")).toBeInTheDocument();
  });
});
