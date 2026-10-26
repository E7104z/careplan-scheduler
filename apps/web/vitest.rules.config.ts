import { defineConfig } from "vitest/config";

// Firestore rules tests only (APP-SPEC section 8): node, no setup file, run inside
// `firebase emulators:exec`. No passWithNoTests: an empty run must not count as AC-17.
export default defineConfig({
  test: {
    include: ["rules-test/**/*.test.ts"],
    environment: "node",
  },
});
