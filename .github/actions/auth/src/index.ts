import crypto from "node:crypto";
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

    // Determine storage path for authenticated session state
    // Playwright will create missing directories, if needed
    const actionDirectory = `${url.fileURLToPath(new URL(import.meta.url))}/..`;
    const sessionStatePath = `${
      process.env.RUNNER_TEMP ?? actionDirectory
    }/.auth/${crypto.randomUUID()}/sessionState.json`;

    // Launch a headless browser
    browser = await playwright.chromium.launch({
      headless: true,
      executablePath: process.env.CI ? "/usr/bin/google-chrome" : undefined,
    });
    context = await browser.newContext({
      // Try HTTP Basic authentication
      httpCredentials: {
        username: username,
        password: password,
      },
    });
    page = await context.newPage();

    // Navigate to login page
    core.info("Navigating to login page");
    await page.goto(loginUrl);

    // Check for a login form
    const usernameField = await page.getByLabel(/username/i).first();
    const passwordField = await page.getByLabel(/password/i).first();
    if (
      (await usernameField.count()) > 0 &&
      (await passwordField.count()) > 0
    ) {
      // Try form authentication
      core.info("Filling username");
      await page.getByLabel(/username/i).fill(username);
      core.info("Filling password");
      await page.getByLabel(/password/i).fill(password);
      core.info("Logging in");
      await page
        .getByLabel(/password/i)
        .locator("xpath=ancestor::form")
        .evaluate((form) => (form as HTMLFormElement).submit());
    } else {
      core.info("No login form detected");
      // This occurs if HTTP Basic auth succeeded, or if the page does not require authentication.
    }

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
