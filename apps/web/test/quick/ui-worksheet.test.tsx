import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { saveQuickState } from "../../src/features/quick-schedule/persistence";
import { manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import { TODAY, renderQuick, setUpQuickTests } from "./ui-helpers";

setUpQuickTests();

/** A plan built by hand and saved to the tab, so the page opens on it. */
function seed(...actions: QuickAction[]): void {
  saveQuickState(actions.reduce((state, action) => reduce(state, action, MO_2026_07).state, manualState(TODAY)));
}

/** Click into a box and paste the text: one input event, so long entries stay quick. */
async function fill(user: UserEvent, box: HTMLElement, text: string): Promise<void> {
  await user.click(box);
  await user.paste(text);
}

async function openWorksheet(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole("tab", { name: "Worksheet" }));
  await screen.findByRole("heading", { name: "Worksheet view" }, { timeout: 5000 });
  return screen.getByRole("tabpanel", { name: "Worksheet" });
}

describe("the Worksheet tab", () => {
  it("sits beside the schedule; the arrow keys move between the two tabs", async () => {
    const { user } = renderQuick();
    const schedule = screen.getByRole("tab", { name: "Schedule" });
    expect(schedule).toHaveAttribute("aria-selected", "true");
    schedule.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Worksheet" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Worksheet" })).toHaveFocus();
    await screen.findByRole("heading", { name: "Worksheet view" }, { timeout: 5000 });
    await user.keyboard("{Home}");
    expect(schedule).toHaveAttribute("aria-selected", "true");
  });
});

describe("WS-H08 and W-3: the banner and edition", () => {
  it("says which edition it follows and that it isn't an official DSDS form", async () => {
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    expect(within(panel).getByText("Follows DSDS-HCBS-3c (10/26). Not an official DSDS form.")).toBeInTheDocument();
    expect(within(panel).queryByText(/Missouri Department of Health and Senior Services/i)).toBeNull();
  });
});

describe("WS-H01, WS-H02, WS-H03, WS-H04, WS-H09 and WS-H11: the header's people fields stay in memory (W-4)", () => {
  it("never writes the name, DCN, phones or emergency contact to storage", async () => {
    seed({ type: "setService", code: "T1019" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" });
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    await fill(user, within(panel).getByRole("textbox", { name: "Participant name" }), "P-TEST-01 NAME");
    await fill(user, within(panel).getByRole("textbox", { name: "DCN" }), "99999999");
    await fill(user, within(panel).getByRole("textbox", { name: "Provider agency phone" }), "555-0100");
    await fill(user, within(panel).getByRole("textbox", { name: "Emergency contact" }), "P-TEST-02 CONTACT");
    await fill(user, within(panel).getByRole("textbox", { name: "Emergency contact phone" }), "555-0101");
    expect(within(panel).getByRole("checkbox", { name: /^CDS: the participant receives/ })).toBeInTheDocument();
    // A care plan change saves the plan; the worksheet's fields must not go with it.
    await user.click(screen.getByRole("tab", { name: "Schedule" }));
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v2")).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 400));
    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    for (const typed of ["P-TEST-01", "99999999", "555-0100", "P-TEST-02", "555-0101"]) expect(stored).not.toContain(typed);
  });
});

describe("WS-H05, WS-H06, WS-H07, WS-H10 and WS-H12: the 3c's header", () => {
  it("has the IHS box, the program with its monthly units, the start date, and a blank signature line", async () => {
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    expect(within(panel).getByRole("checkbox", { name: /^IHS: the participant receives/ })).not.toBeChecked();
    expect(within(panel).getByText("State Plan (CDS tab) · 466 units a month")).toBeInTheDocument();
    expect(within(panel).getByText("Start date (earliest date CDS can begin)")).toBeInTheDocument();
    expect(within(panel).getByText("Signature and date: for the person completing the form")).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "Assessor name (optional, typed by you)" })).toHaveValue("");
  });
});

describe("WS-M02, WS-C13 and WS-I07: computed cells are read-only; the total turns red over the maximum; the ILW tab adds the BFP note", () => {
  it("shows the over-maximum message and offers the ILW tab, which takes the plan there through the guard", async () => {
    seed({ type: "addTask", taskCode: "BATHING", name: "Bathing" });
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    const minutes = within(panel).getByRole("textbox", { name: "Bathing, minutes a day" });
    await user.clear(minutes);
    await user.type(minutes, "600{Enter}");
    await within(panel).findByText(/Over the 641-unit maximum/);
    expect(within(panel).getByText(/Over the 641-unit maximum/)).toHaveClass("text-block");
    const table = within(panel).getByRole("table", { name: /CDS tab/ });
    // The only entries in the table are the task's minutes and its description; computed columns are text.
    expect(within(table).getAllByRole("textbox").map((box) => box.getAttribute("aria-label") ?? box.closest("label")?.textContent)).toEqual(["Bathing, minutes a day", "Bathing: description of needs"]);
    await user.click(within(panel).getByRole("button", { name: "See it on the ILW worksheet" }));
    await within(panel).findByText("Follows DSDS-HCBS-3c (07/26). Not an official DSDS form.");
    expect(within(panel).getByText("ILW requests go to the Bureau of Federal Programs. BFP approval is required before authorizing ILW.")).toBeInTheDocument();
  });
});

describe("WS-C16, WS-C17 and WS-M04: descriptions, comments and notes", () => {
  it("has a description of needs per task, a Comments box and the manual's notes", async () => {
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    await fill(user, within(panel).getByRole("textbox", { name: "Bathing: description of needs" }), "Needs help in and out of the tub.");
    expect(within(panel).getByRole("textbox", { name: "Bathing: description of needs" })).toHaveValue("Needs help in and out of the tub.");
    await fill(user, within(panel).getByRole("textbox", { name: "Comments" }), "Reviewed with the participant.");
    expect(within(panel).getByText("Services on the worksheet are task-oriented and generally authorized on an ongoing basis.")).toBeInTheDocument();
  });
});

describe("WS-X05 and WS-M01: show the math", () => {
  it("reveals each total's formula, with the average-participant and 31-day notes", async () => {
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    expect(within(panel).queryByText(/min ÷ 15 ×/)).toBeNull();
    await user.click(within(panel).getByRole("button", { name: "Show the math" }));
    expect(within(panel).getByRole("button", { name: "Show the math" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getAllByText(/min ÷ 15 ×/).length).toBeGreaterThan(5);
    expect(within(panel).getByText("DSDS's suggested times and frequencies are for an average or typical participant.")).toBeInTheDocument();
    expect(within(panel).getByText("Based on a 31-day month.")).toBeInTheDocument();
  });
});

describe("WS-X06 the reconcile line", () => {
  it("compares the worksheet's 31-day total with the schedule's month and Fusion's figure", async () => {
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    expect(within(panel).getByText(/^Worksheet \(31-day basis\): 466 units · Schedule, \w+ \d{4}: \d+ units · Fusion: \d+ units\.$/)).toBeInTheDocument();
  });
});

describe("WS-A01, WS-A03, WS-A08 and WS-M05: the 3a's boxes and blocks", () => {
  it("shows RCF/ALF boxes, the derived Med Rel box, the nurse block and the ILW-request note", async () => {
    seed({ type: "setService", code: "T1019" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, { type: "addTask", taskCode: "CLEAN_KITCHEN", name: "Clean Kitchen" });
    const { user } = renderQuick();
    const panel = await openWorksheet(user);
    expect(within(panel).getAllByRole("checkbox", { name: /^RCF\/ALF/ })).toHaveLength(4);
    expect(within(panel).getByRole("checkbox", { name: /^Medically related household tasks/ })).toBeChecked();
    expect(within(panel).getByText("Under Personal Care")).toBeInTheDocument();
    await fill(user, within(panel).getByRole("textbox", { name: "Visits a month" }), "2");
    expect(within(panel).getByText(/\$121\.98/)).toBeInTheDocument();
    expect(within(panel).getByText(/upload the 3a to the electronic case record only when it is used for an ILW authorization/)).toBeInTheDocument();
    expect(within(panel).getByText("DSDS staff signature and date")).toBeInTheDocument();
  });
});
