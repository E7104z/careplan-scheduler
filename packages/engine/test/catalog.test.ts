import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULE_CATALOG, ruleById, type RuleArea, type Severity } from "../src/index.js";

const SPEC = readFileSync(fileURLToPath(new URL("../../../docs/ENGINE-SPEC.md", import.meta.url)), "utf8");
const RULES_DIR = fileURLToPath(new URL("../src/rules/", import.meta.url));
const STATEPARITY_RULES = fileURLToPath(new URL("../src/stateparity/rules.ts", import.meta.url));

const AREAS: Record<string, RuleArea> = {
  Authorization: "Authorization",
  Schedule: "Schedule",
  "Conflicts and eligibility": "Conflicts and eligibility",
  "C.2 Worksheet rules": "Worksheet",
};

const SEVERITIES: readonly Severity[] = ["BLOCK", "WARN", "INFO", "REVIEW"];

interface SpecRow {
  id: string;
  area: RuleArea;
  rule: string;
  severity: string;
  status: string;
  source: string;
}

/** The spec's text from `heading` up to the next heading at its level or above. */
function sectionOf(heading: string): string {
  const start = SPEC.indexOf(`\n${heading}`);
  if (start < 0) throw new Error(`ENGINE-SPEC has no "${heading}"`);
  const level = heading.indexOf(" ");
  const ends = [...SPEC.slice(start + 1).matchAll(/\n(#{2,6}) /g)].filter((match) => match[1]!.length <= level);
  return ends.length === 0 ? SPEC.slice(start) : SPEC.slice(start, start + 1 + ends[0]!.index);
}

/**
 * Rows of the three tables under "## 5. Rules" and of Amendment C's worksheet rules, each tagged
 * with its "###" area heading.
 */
function specRows(): SpecRow[] {
  const rows: SpecRow[] = [];
  let area: RuleArea | undefined;
  for (const line of `${sectionOf("## 5. Rules")}\n${sectionOf("### C.2 Worksheet rules")}`.split(/\r?\n/)) {
    const heading = /^### (.+?) \(/.exec(line);
    if (heading) {
      area = AREAS[heading[1]!];
      continue;
    }
    if (!/^\| [A-Z]+-[A-Z]?\d+ \|/.test(line)) continue;
    const [id, rule, severity, status, source] = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!area) throw new Error(`Rule row before an area heading: ${line}`);
    rows.push({ id: id!, area, rule: rule!, severity: severity!, status: status!, source: source! });
  }
  return rows;
}

function toSeverity(value: string): Severity {
  const severity = SEVERITIES.find((s) => s === value);
  if (!severity) throw new Error(`Unknown severity ${value}`);
  return severity;
}

/** "BLOCK / WARN" → ["BLOCK","WARN"]; "per matrix" → ["BLOCK","REVIEW"]; "—" → []. */
function severitiesFrom(cell: string): Severity[] {
  if (cell === "—") return [];
  if (cell === "per matrix") return ["BLOCK", "REVIEW"];
  return cell.split(" / ").map(toSeverity);
}

const ROWS = specRows();

describe("RULE_CATALOG matches ENGINE-SPEC section 5", () => {
  it("reads all four rule tables from the spec", () => {
    expect(new Set(ROWS.map((row) => row.area))).toEqual(
      new Set<RuleArea>(["Authorization", "Schedule", "Conflicts and eligibility", "Worksheet"]),
    );
    expect(ROWS.length).toBeGreaterThan(0);
  });

  it("has the same rule IDs in table order", () => {
    expect(RULE_CATALOG.map((entry) => entry.id)).toEqual(ROWS.map((row) => row.id));
  });

  it("copies area, rule text, status and source character for character", () => {
    expect(RULE_CATALOG.map(({ id, area, rule, status, source }) => ({ id, area, rule, status, source }))).toEqual(
      ROWS.map(({ id, area, rule, status, source }) => ({ id, area, rule, status, source })),
    );
  });

  it("takes severities from the Severity column", () => {
    expect(RULE_CATALOG.map(({ id, severities }) => ({ id, severities }))).toEqual(
      ROWS.map(({ id, severity }) => ({ id, severities: severitiesFrom(severity) })),
    );
  });

  it("maps the special Severity cells", () => {
    expect(ruleById("AUTH-09")?.severities).toEqual(["BLOCK", "REVIEW", "WARN"]);
    expect(ruleById("CON-02")?.severities).toEqual(["BLOCK", "REVIEW"]);
    expect(ruleById("SCH-15")?.severities).toEqual([]);
    expect(ruleById("SCH-17")?.severities).toEqual([]);
    expect(ruleById("CON-17")?.severities).toEqual(["REVIEW"]);
  });

  it("ruleById finds an entry and returns undefined for an unknown ID", () => {
    expect(ruleById("SCH-08")?.area).toBe("Schedule");
    expect(ruleById("SCH-99")).toBeUndefined();
  });

  it("lists every ruleId literal used in src/rules and src/stateparity/rules.ts", () => {
    const ids = new Set(RULE_CATALOG.map((entry) => entry.id));
    const files = [...readdirSync(RULES_DIR).map((file) => `${RULES_DIR}${file}`), STATEPARITY_RULES];
    const used = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/ruleId: "([^"]+)"/g)].map((match) => match[1]!),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((id) => !ids.has(id))).toEqual([]);
  });
});
