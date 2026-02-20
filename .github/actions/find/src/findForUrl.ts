import type {Finding} from './types.d.js'
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright'
import {AuthContext} from './AuthContext.js'
import {generateScreenshots} from './generateScreenshots.js'

export async function findForUrl(
  url: string,
  authContext?: AuthContext,
  includeScreenshots: boolean = true,
): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined,
  })
  const contextOptions = authContext?.toPlaywrightBrowserContextOptions() ?? {}
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  await page.goto(url)
  console.log(`Scanning ${page.url()}`)

  let findings: Finding[] = []
  try {
    const rawFindings = await new AxeBuilder({page}).analyze()

    let screenshotId: string | undefined
    if (includeScreenshots) {
      screenshotId = await generateScreenshots(page)
    }

    findings = rawFindings.violations.map(violation => ({
      scannerType: 'axe',
      url,
      html: violation.nodes[0].html.replace(/'/g, '&apos;'),
      problemShort: violation.help.toLowerCase().replace(/'/g, '&apos;'),
      problemUrl: violation.helpUrl.replace(/'/g, '&apos;'),
      ruleId: violation.id,
      solutionShort: violation.description.toLowerCase().replace(/'/g, '&apos;'),
      solutionLong: violation.nodes[0].failureSummary?.replace(/'/g, '&apos;'),
      screenshotId,
    }))
  } catch (e) {
    console.error('Error during accessibility scan:', e)
  }
  await context.close()
  await browser.close()
  return findings
}
