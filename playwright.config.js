// @ts-check
const { defineConfig } = require("@playwright/test");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL || "https://testdm-inp.jinkosolar.com";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 180000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "workbuddy-test-results/html-report" }],
  ],
  outputDir: "./workbuddy-test-results/artifacts",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    headless: process.env.HEADLESS !== "false",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: "inp-chromium",
      testMatch: "**/specs/**/*.spec.js",
    },
  ],
});
