import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * APP-SPEC 10: preload the one font file every page uses (Public Sans, latin subset), so text
 * doesn't wait for the stylesheet to ask for it. The build fails if the file isn't there.
 */
function preloadLatinFont(): Plugin {
  return {
    name: "preload-latin-font",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        const file = Object.keys(context.bundle ?? {}).find((name) =>
          /public-sans-latin-wght-normal-[\w-]+\.woff2$/.test(name),
        );
        if (!file) throw new Error("preload-latin-font: the Public Sans latin font file is missing from the build");
        return {
          html,
          tags: [
            {
              tag: "link",
              attrs: { rel: "preload", href: `/${file}`, as: "font", type: "font/woff2", crossorigin: "" },
              injectTo: "head",
            },
          ],
        };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadLatinFont()],
  resolve: {
    alias: {
      "@fixtures": fileURLToPath(new URL("../../docs/fixtures", import.meta.url)),
    },
  },
  build: {
    manifest: true,
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // The printed schedule reads its colors from tokens.css (?raw); vitest blanks other CSS.
    css: { include: [/tokens\.css/] },
    include: ["test/**/*.test.{ts,tsx}"],
    // Quick Schedule is a large page under jsdom, and the files run in parallel: a test that walks
    // it with many role queries needs more than the 5 s default on a busy machine.
    testTimeout: 15_000,
  },
});
