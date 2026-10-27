import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULE_CATALOG, WORKSHEET_LEDGER, type LedgerEntry } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const PARITY = read("docs/WORKSHEET-PARITY.md");
const SPEC = read("docs/ENGINE-SPEC.md");
const STATE_README = read("docs/fixtures/state/README.md");

/** Every row of the ledger tables in docs/WORKSHEET-PARITY.md. */
function markdownRows(): LedgerEntry[] {
  return PARITY.split(/\r?\n/)
    .filter((line) => /^\| WS-/.test(line))
    .map((line) => {
      const [id, form, item, status, refs] = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (status !== "PLANNED" && status !== "EXISTING" && status !== "DONE") throw new Error(`Unknown status in ${line}`);
      return { id: id!, form: form!, item: item!, status, refs: refs! };
    });
}

/** Rule IDs, acceptance fixture IDs (TC-n) and formula IDs (F-n) that ENGINE-SPEC defines. */
const KNOWN_IDS = new Set<string>([
  ...RULE_CATALOG.map((entry) => entry.id),
  ...[...SPEC.matchAll(/^\| (TC-\d+) \|/gm)].map((match) => match[1]!),
  ...[...SPEC.matchAll(/^\| (F-\d+[a-z]?) \|/gm)].map((match) => match[1]!),
]);

function checkableRefs(refs: string): string[] {
  const ids = [...refs.matchAll(/\b[A-Z]+-\d+[a-z]?\b/g)].map((match) => match[0]).filter((id) => KNOWN_IDS.has(id));
  const files = [...refs.matchAll(/`([^`]+\/[^`]+)`/g)].map((match) => match[1]!).filter((path) => existsSync(join(ROOT, path)));
  return [...ids, ...files];
}

function filesUnder(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap((name) => {
    if (name === "node_modules") return [];
    const path = `${dir}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Names given to describe(), it() and test() (including test.describe()) in the engine and web tests. */
function testNames(): string[] {
  const files = [...filesUnder("packages/engine/test"), ...filesUnder("apps/web/test"), ...filesUnder("apps/web/e2e")]
    .filter((path) => /\.(test|spec)\.tsx?$/.test(path));
  return files.flatMap((path) =>
    [...read(path).matchAll(/\b(?:describe|it|test)(?:\.\w+)?\(\s*(["'`])((?:(?!\1).)*)\1/g)].map((match) => match[2]!),
  );
}

/** The files and SHA-256 values in the table of docs/fixtures/state/README.md. */
function stateFiles(): { file: string; sha: string }[] {
  return [...STATE_README.matchAll(/^\| `([^`]+)` \|.*?\| `([0-9a-f]{64})` \|/gm)].map((match) => ({ file: match[1]!, sha: match[2]! }));
}

describe("worksheet parity ledger", () => {
  it("has unique ids of the form WS-X00", () => {
    const ids = WORKSHEET_LEDGER.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !/^WS-[A-Z]\d{2}$/.test(id))).toEqual([]);
  });

  it("matches docs/WORKSHEET-PARITY.md row for row, in both directions", () => {
    const rows = markdownRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(WORKSHEET_LEDGER.map((entry) => ({ ...entry }))).toEqual(rows);
  });

  it("names a rule, a test fixture, a formula or a file that exists for every EXISTING row", () => {
    const unchecked = WORKSHEET_LEDGER.filter((entry) => entry.status === "EXISTING" && checkableRefs(entry.refs).length === 0);
    expect(unchecked.map((entry) => `${entry.id}: ${entry.refs}`)).toEqual([]);
  });

  it("has a test named after every DONE row", () => {
    const names = testNames();
    const untested = WORKSHEET_LEDGER.filter((entry) => entry.status === "DONE" && !names.some((name) => name.includes(entry.id)));
    expect(untested.map((entry) => entry.id)).toEqual([]);
  });
});

describe("state worksheet files", () => {
  it("lists every file in docs/fixtures/state/README.md with its real SHA-256", () => {
    const files = stateFiles();
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const { file, sha } of files) {
      const actual = createHash("sha256").update(readFileSync(join(ROOT, "docs/fixtures/state", file))).digest("hex");
      expect(actual, file).toBe(sha);
    }
  });

  it("lists every file in docs/fixtures/state except the README itself", () => {
    const listed = new Set(stateFiles().map(({ file }) => file));
    const present = filesUnder("docs/fixtures/state").map((path) => path.replace("docs/fixtures/state/", "")).filter((file) => file !== "README.md");
    expect(present.filter((file) => !listed.has(file))).toEqual([]);
  });
});
