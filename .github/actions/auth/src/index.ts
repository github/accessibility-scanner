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
        username,
        password,
      },
    });
    page = await context.newPage();

    // Navigate to login page
    core.info("Navigating to login page");
    await page.goto(loginUrl);

    // Check for a login form
    const [usernameField, passwordField] = await Promise.all([
      page.getByLabel(/username/i).first(),
      page.getByLabel(/password/i).first(),
    ]);
    const [usernameFieldExists, passwordFieldExists] = await Promise.all([
      usernameField.count(),
      passwordField.count(),
    ]);
    if (usernameFieldExists && passwordFieldExists) {
      // Try form authentication
      core.info("Filling username");
      await usernameField.fill(username);
      core.info("Filling password");
      await passwordField.fill(password);
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
    core.info(`Wrote authenticated session state to ${sessionStatePath}`);
    core.setOutput(
      "playwright_context_options",
      JSON.stringify({
        httpCredentials: { username, password },
        storageState: sessionStatePath,
      })
    );
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
