import { defineConfig } from "@playwright/test";

// Explicit opt-in: this suite creates and then deletes its own synthetic account.
if (!process.env.PILOT_LIVE_URL)
  throw new Error("Set PILOT_LIVE_URL to the deployed HTTPS origin.");
export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  timeout: 300000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.PILOT_LIVE_URL,
    viewport: { width: 1024, height: 900 },
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    trace: "off",
  },
});
