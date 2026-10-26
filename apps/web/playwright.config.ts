import { defineConfig } from "@playwright/test";

const PUBLIC_URL = "http://127.0.0.1:4173";
// The emulator build (apps/web/.env.emulator) talks to the Auth and Firestore emulators, which
// `firebase emulators:exec` starts around `npm run test:e2e:emulated`.
const EMULATED_URL = "http://127.0.0.1:4174";

export default defineConfig({
  use: {
    baseURL: PUBLIC_URL,
  },
  webServer: [
    {
      command: "npm run build && npx vite preview --port 4173 --host 127.0.0.1",
      url: PUBLIC_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run build:emulated && npx vite preview --outDir dist-emulated --port 4174 --host 127.0.0.1",
      url: EMULATED_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop", testDir: "e2e/public", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "phone",
      testDir: "e2e/public",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "emulated",
      testDir: "e2e/emulated",
      use: { baseURL: EMULATED_URL, viewport: { width: 1280, height: 800 } },
    },
  ],
});
