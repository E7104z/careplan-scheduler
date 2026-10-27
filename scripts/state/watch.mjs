#!/usr/bin/env node
// Weekly check that DSDS's worksheets and their manual pages have not changed (Phase 3, Prompt 9).
//
//   node scripts/state/watch.mjs               report only; exit 1 if a download fails
//   node scripts/state/watch.mjs --open-issue  also open or update the GitHub issue (needs gh and GH_TOKEN)
//   node scripts/state/watch.mjs --self-test   check the link reader on the saved pages; no network
//
// Reads the two HCBS Manual pages, finds their .xlsx links, downloads each file and compares its
// SHA-256 and URL with docs/fixtures/state/README.md. Never commits and never opens a pull request.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, "docs", "fixtures", "state");
const MANUAL = "https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/";
export const PAGES = [
  { name: "HCBS-3a", url: `${MANUAL}400-home-and-community-based-services-10`, saved: "manual-hcbs3a-in-home-services-worksheet.html", file: "4.00appendix3da3aform.xlsx" },
  { name: "HCBS-3c", url: `${MANUAL}400-home-and-community-based-services-11`, saved: "manual-hcbs3c-cds-worksheet.html", file: "4.00appendix4da-3cform.xlsx" },
];
export const ISSUE_TITLE = "DSDS changed a worksheet";

/** Every .xlsx link on a page, as absolute URLs: plain links and the Office viewer's `src=` links. */
export function xlsxLinks(html, pageUrl) {
  const links = new Set();
  for (const [, raw] of html.matchAll(/href="([^"]+)"/g)) {
    const href = raw.replaceAll("&amp;", "&");
    const viewer = /[?&]src=([^&]+)/.exec(href);
    const target = viewer && /officeapps\.live\.com/.test(href) ? decodeURIComponent(viewer[1]) : href;
    const url = new URL(target, pageUrl);
    if (/\.xlsx$/i.test(url.pathname)) links.add(`${url.origin}${url.pathname}`);
  }
  return [...links].sort();
}

/** The page's "Revised - <date>" line, or null. */
export function revisedDate(html) {
  return /Revised\s*-\s*([A-Za-z]+\s+\d{4})/.exec(html.replace(/<[^>]+>/g, " "))?.[1] ?? null;
}

/** README rows: file name → { url, sha }; the URL is the first https link in the row's source cell. */
export function readmeFiles(markdown) {
  const files = new Map();
  for (const [, file, source, sha] of markdown.matchAll(/^\| `([^`]+)` \| (.*?) \| `([0-9a-f]{64})` \|/gm)) {
    files.set(file, { url: /https:\/\/\S+\.xlsx/.exec(source)?.[0] ?? null, sha });
  }
  return files;
}

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "CarePlan Scheduler state-forms watch" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Compare the live pages and files with the README; returns the changes found (empty = none). */
export async function check() {
  const known = readmeFiles(readFileSync(join(STATE, "README.md"), "utf8"));
  const changes = [];
  for (const page of PAGES) {
    const html = (await download(page.url)).toString("utf8");
    const was = known.get(page.file);
    if (!was) throw new Error(`README.md has no row for ${page.file}`);
    const links = xlsxLinks(html, page.url);
    if (links.length === 0) throw new Error(`${page.url} has no .xlsx link`);
    const revised = revisedDate(html);
    for (const link of links) {
      const sha = createHash("sha256").update(await download(link)).digest("hex");
      if (link !== was.url || sha !== was.sha) {
        changes.push({ form: page.name, file: page.file, page: page.url, revised, oldUrl: was.url, newUrl: link, oldSha: was.sha, newSha: sha });
      }
    }
  }
  return changes;
}

export function issueBody(changes) {
  const rows = changes.map((c) =>
    `| ${c.form} | ${c.oldUrl === c.newUrl ? c.newUrl : `${c.oldUrl} → ${c.newUrl}`} | \`${c.oldSha}\` | \`${c.newSha}\` | ${c.revised ?? "not shown"} |`);
  return [
    "The weekly check found a worksheet on health.mo.gov that differs from `docs/fixtures/state/README.md`.",
    "",
    "| Form | File | Old SHA-256 | New SHA-256 | Page says Revised |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "Next: download the new file into `docs/fixtures/state/`, rerun `scripts/state/make-golden.py` (3c) or",
    "`make-golden-3a.py` (3a) and `extract-guidance.py`, read the differences, update the rule pack, and let the",
    "golden tests say exactly what changed.",
  ].join("\n");
}

function openOrUpdateIssue(changes) {
  const body = issueBody(changes);
  const open = JSON.parse(execFileSync("gh", ["issue", "list", "--state", "open", "--search", `"${ISSUE_TITLE}" in:title`, "--json", "number,title"], { encoding: "utf8" }));
  const existing = open.find((issue) => issue.title === ISSUE_TITLE);
  if (existing) execFileSync("gh", ["issue", "comment", String(existing.number), "--body", body], { stdio: "inherit" });
  else execFileSync("gh", ["issue", "create", "--title", ISSUE_TITLE, "--body", body], { stdio: "inherit" });
}

function selfTest() {
  const failures = [];
  const expect = (what, actual, wanted) => {
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) failures.push(`${what}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`);
  };
  const known = readmeFiles(readFileSync(join(STATE, "README.md"), "utf8"));
  for (const page of PAGES) {
    const html = readFileSync(join(STATE, "pages", page.saved), "utf8");
    expect(`${page.name} links`, xlsxLinks(html, page.url), [known.get(page.file)?.url]);
    expect(`${page.name} revised date`, typeof revisedDate(html), "string");
  }
  expect("viewer link", xlsxLinks('<a href="https://view.officeapps.live.com/op/view.aspx?src=https%3A%2F%2Fhealth.mo.gov%2Fa%2Fb.xlsx&amp;wdOrigin=BROWSELINK">x</a>', "https://health.mo.gov/p"), ["https://health.mo.gov/a/b.xlsx"]);
  expect("relative link", xlsxLinks('<a href="/sites/x.xlsx">x</a> <a href="/x.pdf">y</a>', "https://health.mo.gov/p"), ["https://health.mo.gov/sites/x.xlsx"]);
  expect("revised", revisedDate("<p>Revised - <b>July 2026</b></p>"), "July 2026");
  expect("README rows", known.size >= 2 && [...known.values()].every((row) => /^[0-9a-f]{64}$/.test(row.sha)), true);
  expect("issue body", issueBody([{ form: "HCBS-3c", file: "f.xlsx", page: "p", revised: null, oldUrl: "u", newUrl: "u", oldSha: "a", newSha: "b" }]).includes("| HCBS-3c | u | `a` | `b` | not shown |"), true);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`self-test passed: ${PAGES.length} saved pages, link reader, README reader, issue body`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--self-test")) return selfTest();
  const changes = await check();
  if (changes.length === 0) {
    console.log("No change: both worksheets match docs/fixtures/state/README.md.");
    return;
  }
  console.log(issueBody(changes));
  if (args.has("--open-issue")) openOrUpdateIssue(changes);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
