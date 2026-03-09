import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {Page} from 'playwright'
import core from '@actions/core'

// Use GITHUB_WORKSPACE to ensure screenshots are saved in the workflow workspace root
// where the artifact upload step can find them
const SCREENSHOT_DIR = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), '.screenshots')

export const generateScreenshots = async function (page: Page) {
  let screenshotId: string | undefined
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, {recursive: true})
    core.info(`Created screenshot directory: ${SCREENSHOT_DIR}`)
  } else {
    core.info(`Using existing screenshot directory ${SCREENSHOT_DIR}`)
  }

  try {
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    })

    screenshotId = crypto.randomUUID()
    const filename = `${screenshotId}.png`
    const filepath = path.join(SCREENSHOT_DIR, filename)

    fs.writeFileSync(filepath, screenshotBuffer)
    core.info(`Screenshot saved: ${filename}`)
  } catch (error) {
    core.error(`Failed to capture/save screenshot: ${error}`)
    screenshotId = undefined
  }

  return screenshotId
}
