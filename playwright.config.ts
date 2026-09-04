import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.HISTORY_TEST_BASE_URL ?? "http://localhost:3105",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.HISTORY_TEST_BASE_URL ? undefined : {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:3105",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
