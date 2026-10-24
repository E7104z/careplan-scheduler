import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "../src/ui/Button";
import { DayToggle } from "../src/ui/DayToggle";
import { Dialog } from "../src/ui/Dialog";
import { EmptyState } from "../src/ui/EmptyState";
import { Field } from "../src/ui/Field";
import { FileDrop } from "../src/ui/FileDrop";
import { Logo } from "../src/ui/Logo";
import { Menu } from "../src/ui/Menu";
import { NumberField } from "../src/ui/NumberField";
import { Panel } from "../src/ui/Panel";
import { Select } from "../src/ui/Select";
import { SeverityPill } from "../src/ui/SeverityPill";
import { SkipLink } from "../src/ui/SkipLink";
import { Spinner } from "../src/ui/Spinner";
import { Textarea } from "../src/ui/Textarea";
import { Toast, ToastProvider, ToastViewport } from "../src/ui/Toast";

describe("Button", () => {
  it("renders with the right role and accessible name", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("renders primary with the brand class", () => {
    render(<Button variant="primary">Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass("bg-brand");
  });

  it("sets aria-busy and keeps the label for screen readers while busy", () => {
    render(<Button busy>Save changes</Button>);
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });
});

describe("Field", () => {
  it("wires aria-describedby and aria-invalid", () => {
    render(
      <Field label="Units" hint="Whole minutes" error="Enter a number" required>
        <NumberField />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Units" });
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    for (const id of describedBy?.split(" ") ?? []) {
      expect(document.getElementById(id)).not.toBeNull();
    }

    expect(screen.getByText("Whole minutes, Required")).toBeInTheDocument();
    expect(screen.getByText("Enter a number")).toBeInTheDocument();
  });
});

describe("NumberField, Select and Textarea", () => {
  it("render with the right roles and names", () => {
    render(
      <>
        <NumberField aria-label="Units" />
        <Select aria-label="Agency">
          <option>North County</option>
        </Select>
        <Textarea aria-label="Notes" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Agency" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  });
});

describe("DayToggle", () => {
  it("sets aria-pressed and full day-name labels", () => {
    render(<DayToggle value={[true, false, false, true, false, false, false]} />);
    expect(screen.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "true");
  });

  it("names its group, so a task's days aren't announced as the care days", () => {
    render(
      <>
        <DayToggle value={[false, true, true, true, true, true, false]} />
        <DayToggle label="Bathing days" value={[false, true, false, false, false, false, false]} />
      </>,
    );
    expect(screen.getByRole("group", { name: "Care days" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bathing days" })).toBeInTheDocument();
  });
});

describe("Textarea paste", () => {
  it("hands the box's text up once the browser has inserted the paste (APP-SPEC 4.2)", async () => {
    const user = userEvent.setup();
    const pasted: string[] = [];
    render(<Textarea aria-label="Care plan" onPasteText={(text) => pasted.push(text)} />);
    await user.click(screen.getByRole("textbox", { name: "Care plan" }));
    await user.paste("455 units\tBathing\t45\t7");
    await user.type(screen.getByRole("textbox", { name: "Care plan" }), "x");
    expect(pasted).toEqual(["455 units\tBathing\t45\t7"]);
  });
});

describe("SeverityPill", () => {
  it("renders an icon and a word for all four severities", () => {
    const cases: [string, string][] = [
      ["BLOCK", "Must fix"],
      ["REVIEW", "Needs review"],
      ["WARN", "Check"],
      ["INFO", "Good to know"],
    ];
    render(
      <>
        <SeverityPill severity="BLOCK" />
        <SeverityPill severity="REVIEW" />
        <SeverityPill severity="WARN" />
        <SeverityPill severity="INFO" />
      </>,
    );
    for (const [, label] of cases) {
      const pill = screen.getByText(label).closest("span");
      expect(pill?.querySelector("svg")).not.toBeNull();
    }
  });
});

describe("Panel", () => {
  it("renders a heading with the title", () => {
    render(<Panel title="Week of Nov 3, 2026" />);
    expect(screen.getByRole("heading", { name: "Week of Nov 3, 2026" })).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("opens with the dialog role and the title as its name", async () => {
    const user = userEvent.setup();
    render(
      <Dialog title="Remove task" trigger={<Button>Remove</Button>}>
        <p>Are you sure?</p>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("dialog", { name: "Remove task" })).toBeInTheDocument();
  });
});

describe("Toast", () => {
  it("announces its message with role status", () => {
    render(
      <ToastProvider>
        <Toast open onOpenChange={() => {}} message="Invite link copied" />
        <ToastViewport />
      </ToastProvider>,
    );
    const statuses = screen.getAllByRole("status");
    expect(
      statuses.some((el) => el.textContent?.includes("Invite link copied")),
    ).toBe(true);
  });
});

describe("Menu", () => {
  it("opens a menu with items", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        trigger={<Button>Account</Button>}
        items={[{ label: "Sign out" }, { label: "Settings" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("EmptyState, FileDrop, SkipLink, Logo and Spinner", () => {
  it("render their content", () => {
    const { container } = render(
      <>
        <EmptyState title="Your team will appear here." />
        <FileDrop onFile={() => {}} title="Choose a file" />
        <SkipLink />
        <Logo />
        <Spinner />
      </>,
    );
    expect(screen.getByText("Your team will appear here.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose a file/).tagName).toBe("INPUT");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeInTheDocument();
    expect(screen.getByText("CarePlan Scheduler")).toBeInTheDocument();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });
});
