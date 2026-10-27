import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WATCH = fileURLToPath(new URL("../../../scripts/state/watch.mjs", import.meta.url));

describe("WS-X09 the weekly watch for a changed DSDS worksheet", () => {
  it("reads the .xlsx links from the saved manual pages and the hashes from the fixtures README (no network)", () => {
    const output = execFileSync(process.execPath, [WATCH, "--self-test"], { encoding: "utf8" });
    expect(output).toContain("self-test passed");
  });
});
