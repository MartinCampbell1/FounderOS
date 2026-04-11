import { defineConfig, devices } from "@playwright/test";

const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const port = Number(process.env.FOUNDEROS_WEB_PORT ?? "3737");
const baseURL = `http://${host}:${port}`;
const shellAdminToken =
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN ?? "shell-playwright-admin-token";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    headless: true,
    extraHTTPHeaders: {
      "x-founderos-shell-admin-token": shellAdminToken,
    },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      FOUNDEROS_WEB_HOST: host,
      FOUNDEROS_WEB_PORT: String(port),
      FOUNDEROS_SHELL_ADMIN_TOKEN: shellAdminToken,
    },
  },
});
