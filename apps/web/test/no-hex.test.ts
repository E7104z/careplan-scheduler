import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const srcDir = join(root, "src");

const IGNORED = new Set(["styles/tokens.css"]);
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB_HSL = /(?:rgb|hsl)a?\(/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = full.slice(srcDir.length + 1).replace(/\\/g, "/");
    if (IGNORED.has(rel)) return [];
    if (statSync(full).isDirectory()) return walk(full);
    return [full];
  });
}

describe("no color literals outside tokens.css", () => {
  const files = walk(srcDir);

  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(root.length + 1).replace(/\\/g, "/");
    it(`keeps ${rel} free of hex, rgb() and hsl() literals`, () => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      const offenders = lines.filter((line) => {
        // Import paths may contain "#"; an `export const x = "#fff"` must still be caught.
        if (/^\s*import\s/.test(line) || /^\s*export\s.*\sfrom\s+["']/.test(line)) return false;
        if (/^\s*@import\s/.test(line)) return false;
        if (/url\(/.test(line)) return false;
        return HEX.test(line) || RGB_HSL.test(line);
      });
      expect(offenders).toEqual([]);
    });
  }
});
