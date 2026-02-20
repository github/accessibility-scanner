import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Page } from "playwright";

// Use GITHUB_WORKSPACE to ensure screenshots are saved in the workflow workspace root
// where the artifact upload step can find them
const SCREENSHOT_DIR = path.join(
  process.env.GITHUB_WORKSPACE || process.cwd(),
  ".screenshots",
);

export const generateScreenshots = async function (page: Page) {
  let screenshotId: string | undefined;
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    console.log(`Created screenshot directory: ${SCREENSHOT_DIR}`);
  } else {
    console.log(`Using existing screenshot directory ${SCREENSHOT_DIR}`);
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

  return screenshotId
}
