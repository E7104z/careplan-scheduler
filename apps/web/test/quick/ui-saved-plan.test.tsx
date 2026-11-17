import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileText } from "../../src/lib/download";
import { BEFORE_B, openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

// APP-SPEC 5.9: save the plan as an encrypted file, then open it again. The passphrase is made up.
setUpQuickTests(BEFORE_B);

const PASSPHRASE = "blue kitchen table by the window";

/** Each file the page downloaded: its name and what it holds. */
let downloads: { name: string; blob: Blob }[] = [];

beforeEach(() => {
  downloads = [];
  let made: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    made = blob;
    return "blob:http://localhost/plan";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download && made) downloads.push({ name: this.download, blob: made });
  });
});

afterEach(() => vi.restoreAllMocks());

async function buildB(user: UserEvent): Promise<void> {
  await openCarePlanText(user, fixtureB);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
}

async function savePlanFile(user: UserEvent): Promise<File> {
  await user.click(screen.getByRole("button", { name: "Save plan" }));
  const dialog = await screen.findByRole("dialog", { name: "Save this care plan" }, { timeout: 5000 });
  await user.type(within(dialog).getByLabelText(/^Passphrase/), PASSPHRASE);
  await user.type(within(dialog).getByLabelText("Type the passphrase again"), PASSPHRASE);
  await user.click(within(dialog).getByRole("button", { name: "Save plan file" }));
  await waitFor(() => expect(downloads).toHaveLength(1), { timeout: 5000 });
  return new File([await readFileText(downloads[0]!.blob)], downloads[0]!.name);
}

describe("Quick Schedule: save the plan and open it again (APP-SPEC 5.9)", () => {
  it("the example has nothing to save; an opened plan does", async () => {
    const { user } = renderQuick();
    expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
    await buildB(user);
    expect(screen.getByRole("button", { name: "Save plan" })).toBeEnabled();
  });

  it("asks for a long passphrase, typed twice the same", async () => {
    const { user } = renderQuick();
    await buildB(user);
    await user.click(screen.getByRole("button", { name: "Save plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Save this care plan" }, { timeout: 5000 });

    await user.type(within(dialog).getByLabelText(/^Passphrase/), "too short");
    await user.click(within(dialog).getByRole("button", { name: "Save plan file" }));
    expect(within(dialog).getByText(/^Use at least 15 characters/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/^Passphrase/));
    await user.type(within(dialog).getByLabelText(/^Passphrase/), PASSPHRASE);
    await user.type(within(dialog).getByLabelText("Type the passphrase again"), `${PASSPHRASE}!`);
    await user.click(within(dialog).getByRole("button", { name: "Save plan file" }));
    expect(within(dialog).getByText("The two passphrases don't match. Type the same one in both boxes.")).toBeInTheDocument();
    expect(downloads).toHaveLength(0);
  });

  it("saves an encrypted file named by the date, and it opens with its passphrase, name included", async () => {
    const { user } = renderQuick();
    await buildB(user);
    const file = await savePlanFile(user);
    expect(file.name).toBe("Care plan 2025-11-20.careplan");
    expect(await screen.findByText("Saved Care plan 2025-11-20.careplan")).toBeInTheDocument();
    const text = await readFileText(file);
    expect(text).not.toMatch(/SAMPLE PARTICIPANT|10000002/);

    // Start again from the example, then open the saved file.
    sessionStorage.clear();
    await user.click(screen.getAllByRole("button", { name: "New care plan" })[0]!);
    await user.upload(screen.getByLabelText("Saved plan file"), file);
    const dialog = await screen.findByRole("dialog", { name: "Open a saved plan" }, { timeout: 5000 });
    expect(within(dialog).getByText("Type the passphrase for Care plan 2025-11-20.careplan.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Passphrase"), "not the passphrase at all");
    await user.click(within(dialog).getByRole("button", { name: "Open plan" }));
    expect(await within(dialog).findByRole("alert", {}, { timeout: 5000 })).toHaveTextContent(
      "That passphrase doesn't open this file. Check it and try again.",
    );

    await user.clear(within(dialog).getByLabelText("Passphrase"));
    await user.type(within(dialog).getByLabelText("Passphrase"), PASSPHRASE);
    await user.click(within(dialog).getByRole("button", { name: "Open plan" }));
    expect(await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Quick Schedule" }));
    // The tab's own copy still never holds the name or DCN.
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).not.toBeNull());
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000002/);
  });

  it("a file that isn't a plan file says so", async () => {
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText("Saved plan file"), new File(["%PDF-1.7"], "care-plan.careplan"));
    const dialog = await screen.findByRole("dialog", { name: "Open a saved plan" }, { timeout: 5000 });
    await user.type(within(dialog).getByLabelText("Passphrase"), PASSPHRASE);
    await user.click(within(dialog).getByRole("button", { name: "Open plan" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This isn't a CarePlan Scheduler plan file. Choose a file that ends in .careplan.",
    );
  });
});
