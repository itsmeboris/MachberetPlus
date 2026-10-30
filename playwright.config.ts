import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/setup.ts",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1024, height: 900 },
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: [
    {
      command: "npm run dev:api -- --persist-to .wrangler/e2e",
      port: 8787,
      reuseExistingServer: false,
    },
    { command: "npm run dev", port: 5173, reuseExistingServer: true },
  ],
  timeout: 60000,
});
