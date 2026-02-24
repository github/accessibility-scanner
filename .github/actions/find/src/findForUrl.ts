import type {Finding} from './types.d.js'
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright'
import {AuthContext} from './AuthContext.js'
import {generateScreenshots} from './generateScreenshots.js'
import {loadPlugins} from './pluginManager.js'
import {getScansContext} from './scansContextProvider.js'
import axe from 'axe-core'

export async function findForUrl(
  url: string,
  authContext?: AuthContext,
  includeScreenshots: boolean = false,
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
  const addFinding = (findingData: Finding) => {
    findings.push(findingData)
  }

  try {
    const scansContext = getScansContext()

    let rawFindings = {} as axe.AxeResults
    if (scansContext.shouldPerformAxeScan) {
      rawFindings = await new AxeBuilder({page}).analyze()
    }

    const plugins = await loadPlugins()
    for (const plugin of plugins) {
      if (scansContext.scans.includes(plugin.name)) {
        console.log('Running plugin: ', plugin.name)
        await plugin.default({page, addFinding, url})
      } else {
        console.log(`Skipping plugin ${plugin.name} because it is not included in the 'scans' input`)
      }
    }

    let screenshotId: string | undefined
    if (includeScreenshots) {
      screenshotId = await generateScreenshots(page)
    }

    console.log('rawFindings: ', rawFindings)
    findings = rawFindings?.violations.map(violation => ({
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
