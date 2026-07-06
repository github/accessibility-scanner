import type {ColorSchemePreference, Finding, FindingCategory, ReducedMotionPreference, UrlConfig} from './types.d.js'
import {AxeBuilder} from '@axe-core/playwright'
import {accesslintAudit} from '@accesslint/playwright'
import playwright from 'playwright'
import {AuthContext} from './AuthContext.js'
import {generateScreenshots} from './generateScreenshots.js'
import {loadPlugins, invokePlugin} from './pluginManager/index.js'
import {getScansContext} from './scansContextProvider.js'
import * as core from '@actions/core'

export async function findForUrl(
  urlConfig: UrlConfig,
  authContext?: AuthContext,
  includeScreenshots: boolean = false,
  reducedMotion?: ReducedMotionPreference,
  colorScheme?: ColorSchemePreference,
): Promise<Finding[]> {
  const {url, excludeSelectors} = urlConfig
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
  const addFinding = async (findingData: Finding) => {
    let screenshotId
    if (includeScreenshots) {
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
          })
        } else {
          core.info(`Skipping plugin ${plugin.name} because it is not included in the 'scans' input`)
        }
      }
    }

    if (scansContext.shouldPerformAxeScan) {
      await runAxeScan({page, addFinding, excludeSelectors})
    }

    if (scansContext.shouldPerformAccesslintScan) {
      await runAccesslintScan({page, addFinding})
    }
  } catch (e) {
    core.error(`Error during accessibility scan: ${e}`)
  }
  await context.close()
  await browser.close()
  return findings
}

async function runAxeScan({
  page,
  addFinding,
  excludeSelectors,
}: {
  page: playwright.Page
  addFinding: (findingData: Finding, options?: {includeScreenshots?: boolean}) => Promise<void>
  excludeSelectors?: string[]
}) {
  const url = page.url()
  core.info(`Scanning ${url}`)
  const axeBuilder = new AxeBuilder({page})
  excludeSelectors?.forEach(selector => axeBuilder.exclude(selector))

  const rawFindings = await axeBuilder.analyze()

  if (rawFindings) {
    for (const violation of rawFindings.violations) {
      // Capture every failing element, not just the first, so one issue covers the rule.
      await addFinding({
        scannerType: 'axe',
        category: categorizeAxeViolation(violation.tags),
        url,
        html: violation.nodes[0].html.replace(/'/g, '&apos;'),
        nodes: violation.nodes.map(node => ({
          html: node.html.replace(/'/g, '&apos;'),
          target: node.target.map(part => (Array.isArray(part) ? part.join(' ') : part)).join(' '),
        })),
        problemShort: violation.help.toLowerCase().replace(/'/g, '&apos;'),
        problemUrl: violation.helpUrl.replace(/'/g, '&apos;'),
        ruleId: violation.id,
        solutionShort: violation.description.toLowerCase().replace(/'/g, '&apos;'),
        solutionLong: violation.nodes[0].failureSummary?.replace(/'/g, '&apos;'),
      })
    }
  }
}

async function runAccesslintScan({
  page,
  addFinding,
}: {
  page: playwright.Page
  addFinding: (findingData: Finding, options?: {includeScreenshots?: boolean}) => Promise<void>
}) {
  const url = page.url()
  core.info(`Scanning ${url} with AccessLint`)

  // One violation per element; no per-rule docs URL, so problemUrl is the core rules table
  const {violations} = await accesslintAudit(page as Parameters<typeof accesslintAudit>[0])
  for (const violation of violations) {
    await addFinding({
      scannerType: 'accesslint',
      url,
      html: violation.html.replace(/'/g, '&apos;'),
      problemShort: violation.message.toLowerCase().replace(/'/g, '&apos;'),
      problemUrl: 'https://github.com/AccessLint/accesslint/blob/main/core/README.md#rules-1',
      ruleId: violation.ruleId,
      solutionShort:
        `resolve the ${violation.ruleId} violation that accesslint flagged on \`${violation.selector}\``.replace(
          /'/g,
          '&apos;',
        ),
    })
  }
}

// Maps an Axe violation's tags to a conformance tier. Experimental is checked
// first because some experimental rules also carry a wcag* tag.
function categorizeAxeViolation(tags: string[]): FindingCategory {
  if (tags.includes('experimental')) return 'experimental'
  if (tags.includes('best-practice')) return 'best-practice'
  return 'wcag'
}
