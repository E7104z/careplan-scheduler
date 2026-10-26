import { defineConfig } from "vitest/config";

// The tests sit next to the code (src/*.test.ts) so `tsc` checks them too; never run the copies
// `npm run build` compiles into dist/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
