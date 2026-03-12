import type {ColorSchemePreference, Finding, ReducedMotionPreference} from './types.d.js'
import {AxeBuilder} from '@axe-core/playwright'
import playwright from 'playwright'
import {AuthContext} from './AuthContext.js'
import {generateScreenshots} from './generateScreenshots.js'
import {loadPlugins, invokePlugin} from './pluginManager.js'
import {getScansContext} from './scansContextProvider.js'
import * as core from '@actions/core'

export async function findForUrl(
  url: string,
  authContext?: AuthContext,
  includeScreenshotsInput: boolean = false,
  reducedMotion?: ReducedMotionPreference,
  colorScheme?: ColorSchemePreference,
): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined,
  })
  const contextOptions = {
    ...(authContext?.toPlaywrightBrowserContextOptions() ?? {}),
    ...(reducedMotion ? {reducedMotion} : {}),
    ...(colorScheme ? {colorScheme} : {}),
  }
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  await page.goto(url)

  const findings: Finding[] = []
  const addFinding = async (
    findingData: Finding,
    {includeScreenshots = false}: {includeScreenshots?: boolean} = {},
  ) => {
    let screenshotId
    if (includeScreenshotsInput || includeScreenshots) {
      screenshotId = await generateScreenshots(page)
    }
    findings.push({...findingData, screenshotId})
  }

  try {
    const scansContext = getScansContext()

    if (scansContext.shouldRunPlugins) {
      const plugins = await loadPlugins()
      for (const plugin of plugins) {
        if (scansContext.scansToPerform.includes(plugin.name)) {
          core.info(`Running plugin: ${plugin.name}`)
          await invokePlugin({
            plugin,
            page,
            addFinding,
            // - this will be coming soon
            // runAxeScan: () => runAxeScan({page, includeScreenshots: includeScreenshotsInput, findings}),
          })
        } else {
          core.info(`Skipping plugin ${plugin.name} because it is not included in the 'scans' input`)
        }
      }
    }

    if (scansContext.shouldPerformAxeScan) {
      runAxeScan({
        includeScreenshots: includeScreenshotsInput,
        page,
        findings,
      })
    }
  } catch (e) {
    core.error(`Error during accessibility scan: ${e}`)
  }
  await context.close()
  await browser.close()
  return findings
}

async function runAxeScan({
  includeScreenshots,
  page,
  findings,
}: {
  includeScreenshots: boolean
  page: playwright.Page
  findings: Finding[]
}) {
  const url = page.url()
  core.info(`Scanning ${url}`)
  const rawFindings = await new AxeBuilder({page}).analyze()
  let screenshotId: string | undefined
  if (includeScreenshots) {
    screenshotId = await generateScreenshots(page)
  }

  const axeFindings = rawFindings?.violations.map(violation => ({
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
  findings.push(...(axeFindings || []))
}
