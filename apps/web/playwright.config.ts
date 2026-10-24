import { defineConfig } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "e2e/public",
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --host 127.0.0.1",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});

