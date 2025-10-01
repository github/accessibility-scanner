import crypto from "node:crypto";
import fs from "node:fs/promises";
import process from "node:process";
import * as url from "node:url";
import core from "@actions/core";
import playwright from "playwright";

export default async function () {
  core.info("Starting 'auth' action");

  let browser: playwright.Browser | undefined;
  let context: playwright.BrowserContext | undefined;
  let page: playwright.Page | undefined;
  try {
    // Get inputs
    const loginUrl = core.getInput("login_url", { required: true });
    const username = core.getInput("username", { required: true });
    const password = core.getInput("password", { required: true });
    core.setSecret(password);

    // Create a temporary directory for authenticated session state
    const actionDirectory = `${url.fileURLToPath(new URL(import.meta.url))}/..`;
    const sessionStateDirectory = `${
      process.env.RUNNER_TEMP ?? actionDirectory
    }/.auth/${crypto.randomUUID()}`;
    await fs.mkdir(sessionStateDirectory, { recursive: true });
    const sessionStatePath = `${sessionStateDirectory}/sessionState.json`;

    // Launch a headless browser
    browser = await playwright.chromium.launch({
      headless: true,
      executablePath: process.env.CI ? "/usr/bin/google-chrome" : undefined,
    });
    context = await browser.newContext();
    page = await context.newPage();

    // Log in
    core.info("Navigating to login page");
    await page.goto(loginUrl);
    core.info("Filling username");
    await page.getByLabel(/username/i).fill(username);
    core.info("Filling password");
    await page.getByLabel(/password/i).fill(password);
    core.info("Logging in");
    await page
      .getByLabel(/password/i)
      .locator("xpath=ancestor::form")
      .evaluate((form) => (form as HTMLFormElement).submit());

    // Write authenticated session state to a file and output its path
    await context.storageState({ path: sessionStatePath });
    core.setOutput("session_state_path", sessionStatePath);
    core.info(`Wrote authenticated session state to ${sessionStatePath}`);
  } catch (error) {
    if (page) {
      core.info(`Errored at page URL: ${page.url()}`);
    }
    core.setFailed(`${error}`);
    process.exit(1);
  } finally {
    // Clean up
    await context?.close();
    await browser?.close();
  }

  core.info("Finished 'auth' action");
}
