import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// apps/web/test -> apps/web -> apps -> repo root
const repoRoot = resolve(import.meta.dirname, "../../..");

// Files allowed to contain the word "vercel". History files (CP5-0 line 46) record what was
// true at the time; docs/PHASE-3-SPEC.md is history by owner decision; .clinerules carries the
// rule that names Vercel to forbid its reintroduction (CP5-0 Step 2); this test is the guard
// itself and must name the word it checks for.
const ALLOWED = [
  ".clinerules",
  "apps/web/test/hosting.test.ts",
  "docs/PHASE-1-",
  "docs/PHASE-2-",
  "docs/PHASE-3-SPEC.md",
  "docs/All Schedules/",
  "docs/COVERAGE-PHASE-2-CLINE-PROMPT.md",
  "docs/CLINE-PROMPTS-PDF-ONLY-AND-COVERAGE-3-5.md",
  "docs/COVERAGE-PHASE-5-CLINE-PROMPTS.md",
];

function gitLines(args: string[]): string[] {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (error) {
    // `git grep -l` exits 1 when nothing matches; the partial output still lists any files.
    const stdout = (error as { stdout?: string }).stdout ?? "";
    return stdout.split(/\r?\n/).filter(Boolean);
  }
}

describe("hosting guard: Vercel is gone", () => {
  it("does not track vercel.json or .vercel", () => {
    const tracked = gitLines(["ls-files"]);
    expect(tracked).not.toContain("vercel.json");
    expect(
      tracked.some((file) => file === ".vercel" || file.startsWith(".vercel/")),
    ).toBe(false);
  });

  it("keeps the word vercel out of every tracked file except the allowed ones", () => {
    const offenders = gitLines(["grep", "-l", "-i", "vercel"]).filter(
      (file) => !ALLOWED.some((prefix) => file.startsWith(prefix)),
    );
    expect(offenders).toEqual([]);
  });

  it("serves the web build output from firebase.json hosting", () => {
    expect(existsSync(join(repoRoot, "firebase.json"))).toBe(true);
    const firebase = JSON.parse(
      readFileSync(join(repoRoot, "firebase.json"), "utf8"),
    ) as { hosting?: { public?: string } };
    expect(firebase.hosting).toBeDefined();
    expect(typeof firebase.hosting?.public).toBe("string");
    const publicDir = firebase.hosting?.public ?? "";
    expect(publicDir.length).toBeGreaterThan(0);
    // `npm run build -w @careplan/web` writes vite's default outDir: dist.
    expect(basename(publicDir)).toBe("dist");
  });

  it("declares no dependency whose name contains vercel", () => {
    const packageFiles = gitLines(["ls-files"]).filter(
      (file) => file === "package.json" || file.endsWith("/package.json"),
    );
    expect(packageFiles.length).toBeGreaterThan(0);
    for (const file of packageFiles) {
      const pkg = JSON.parse(
        readFileSync(join(repoRoot, file), "utf8"),
      ) as {
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };
      const names = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
      expect(
        names.filter((name) => name.toLowerCase().includes("vercel")),
      ).toEqual([]);
    }
  });
});
