import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';
import { AuthContext } from './AuthContext.js';
import fs from "node:fs";
import path from "node:path";

// Use GITHUB_WORKSPACE to ensure screenshots are saved in the workflow workspace root
// where the artifact upload step can find them
const SCREENSHOT_DIR = path.join(
  process.env.GITHUB_WORKSPACE || process.cwd(),
  ".screenshots",
);

export async function findForUrl(
  url: string,
  authContext?: AuthContext,
  includeScreenshots: boolean = true,
): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CI ? "/usr/bin/google-chrome" : undefined,
  });
  const contextOptions = authContext?.toPlaywrightBrowserContextOptions() ?? {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(url);
  console.log(`Scanning ${page.url()}`);

  let findings: Finding[] = [];
  try {
    const rawFindings = await new AxeBuilder({ page }).analyze();

    let screenshotId: string | undefined;

    if (includeScreenshots) {
      // Ensure screenshot directory exists
      if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        console.log(`Created screenshot directory: ${SCREENSHOT_DIR}`);
      }

      try {
        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          type: "png",
        });

        screenshotId = crypto.randomUUID();
        const filename = `${screenshotId}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);

        fs.writeFileSync(filepath, screenshotBuffer);
        console.log(`Screenshot saved: ${filename}`);
      } catch (error) {
        console.error("Failed to capture/save screenshot:", error);
        screenshotId = undefined;
      }
    }

    findings = rawFindings.violations.map((violation) => ({
      scannerType: "axe",
      url,
      html: violation.nodes[0].html.replace(/'/g, "&apos;"),
      problemShort: violation.help.toLowerCase().replace(/'/g, "&apos;"),
      problemUrl: violation.helpUrl.replace(/'/g, "&apos;"),
      ruleId: violation.id,
      solutionShort: violation.description
        .toLowerCase()
        .replace(/'/g, "&apos;"),
      solutionLong: violation.nodes[0].failureSummary?.replace(/'/g, "&apos;"),
      screenshotId,
    }));
  } catch (e) {
    // do something with the error
  }
  await context.close();
  await browser.close();
  return findings;
}
