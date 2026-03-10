import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3006",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 3006",
    url: "http://127.0.0.1:3006",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
