import type {
  ColorSchemePreference,
  Finding,
  FindingCategory,
  FindingInput,
  ReducedMotionPreference,
  ScanCompletion,
  ScanFailure,
  ScanStage,
  UrlScanOutcome,
  UrlConfig,
} from './types.d.js'
import {AxeBuilder} from '@axe-core/playwright'
import {accesslintAudit} from '@accesslint/playwright'
import playwright from 'playwright'
import {AuthContext} from './AuthContext.js'
import {generateScreenshots} from './generateScreenshots.js'
import {loadPlugins, invokePlugin} from './pluginManager/index.js'
import type {Plugin} from './pluginManager/types.js'
import {getScansContext} from './scansContextProvider.js'
import * as core from '@actions/core'
import {sanitizeLabel, sanitizeUrlLabel} from './scanCompletion.js'

const SELECTOR_WAIT_TIMEOUT = 30000

export type ScanProgress = {outcome: UrlScanOutcome; stage: ScanStage; scanner?: string}
type ScanExecution = {endpoint: string; onProgress: (progress: ScanProgress) => void}

export async function findForUrl(
  urlConfig: UrlConfig,
  authContext?: AuthContext,
  includeScreenshots: boolean = false,
  reducedMotion?: ReducedMotionPreference,
  colorScheme?: ColorSchemePreference,
  ignoreHttpsErrors: boolean = false,
): Promise<Finding[]> {
  const {findings, fatalError} = await scanUrlForOutcome(
    urlConfig,
    authContext,
    includeScreenshots,
    reducedMotion,
    colorScheme,
    ignoreHttpsErrors,
  )
  if (fatalError !== undefined) throw fatalError
  return findings
}

export async function findForUrlWithOutcome(
  urlConfig: UrlConfig,
  authContext?: AuthContext,
  includeScreenshots: boolean = false,
  reducedMotion?: ReducedMotionPreference,
  colorScheme?: ColorSchemePreference,
  ignoreHttpsErrors: boolean = false,
  execution?: ScanExecution,
): Promise<UrlScanOutcome> {
  const {findings, scans, failures} = await scanUrlForOutcome(
    urlConfig,
    authContext,
    includeScreenshots,
    reducedMotion,
    colorScheme,
    ignoreHttpsErrors,
    execution,
  )
  return {findings, scans, failures}
}

async function scanUrlForOutcome(
  urlConfig: UrlConfig,
  authContext?: AuthContext,
  includeScreenshots: boolean = false,
  reducedMotion?: ReducedMotionPreference,
  colorScheme?: ColorSchemePreference,
  ignoreHttpsErrors: boolean = false,
  execution?: ScanExecution,
): Promise<UrlScanOutcome & {fatalError?: unknown}> {
  const {url, excludeSelectors, waitForSelectors} = urlConfig
  const {scans, requestedPlugins} = planScans(url)
  const failures: ScanFailure[] = []
  const findings: Finding[] = []

  if (scans.every(scan => scan.status === 'skipped')) {
    return {findings, scans, failures}
  }

  const safeUrl = sanitizeUrlLabel(url)
  let stage: ScanStage = 'browser_setup'
  let activeScanner: string | undefined
  let browser: playwright.Browser | undefined
  let context: playwright.BrowserContext | undefined
  let page: playwright.Page | undefined
  let canScan = false
  let fatalError: unknown
  const progress = () => execution?.onProgress({outcome: {findings, scans, failures}, stage, scanner: activeScanner})
  const setStage = (next: ScanStage, scanner?: string) => {
    stage = next
    activeScanner = scanner
    progress()
  }

  const scanWithFindings = async (
    scan: ScanCompletion,
    run: (addFinding: (findingData: FindingInput) => Promise<void>) => Promise<void>,
  ) => {
    let active = true
    const addFinding = async (findingData: FindingInput) => {
      if (!active) return
      const screenshotId = includeScreenshots ? await generateScreenshots(page!, () => active) : undefined
      if (!active) return
      findings.push({...findingData, screenshotId, originalUrl: url})
      progress()
    }
    setStage('scan', scan.scanner)
    try {
      return await runScanner(scan, 'scan', failures, () => run(addFinding))
    } finally {
      active = false
      activeScanner = undefined
      progress()
    }
  }

  try {
    try {
      if (execution) {
        browser = await playwright.chromium.connect(execution.endpoint)
      } else {
        browser = await playwright.chromium.launch({
          headless: true,
          executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined,
        })
      }
      const contextOptions = {
        ...(authContext?.toPlaywrightBrowserContextOptions() ?? {}),
        ...(reducedMotion ? {reducedMotion} : {}),
        ...(colorScheme ? {colorScheme} : {}),
        ...(ignoreHttpsErrors ? {ignoreHTTPSErrors: true} : {}),
      }
      context = await browser.newContext(contextOptions)
      page = await context.newPage()

      setStage('navigation')
      await page.goto(url)
      setStage('wait_for_selectors')
      await Promise.all(
        (waitForSelectors ?? []).map(selector =>
          page!.locator(selector).waitFor({state: 'visible', timeout: SELECTOR_WAIT_TIMEOUT}),
        ),
      )
      canScan = true
    } catch (error) {
      fatalError = error
      const status = getFailureStatus(error)
      failures.push({requestedUrl: url, status, stage})
      for (const scan of scans) {
        if (scan.status === 'not_started') {
          scan.stage = stage
        }
      }
      core.error(`Accessibility scan could not start at ${stage} for ${safeUrl}`)
      progress()
    }

    if (canScan && page) {
      const pluginScans = scans.filter(scan => requestedPlugins.includes(scan.scanner))
      if (pluginScans.length > 0) {
        let plugins: Plugin[] = []
        setStage('plugin_setup')
        try {
          plugins = await loadPlugins()
        } catch (error) {
          for (const scan of pluginScans) {
            markScanFailure(scan, 'plugin_setup', error, failures)
          }
          progress()
        }
        for (const scan of pluginScans) {
          if (scan.status !== 'not_started') continue
          const plugin = plugins.find(candidate => candidate.name === scan.scanner)
          if (!plugin) {
            markScanFailure(scan, 'plugin_setup', new Error('plugin unavailable'), failures)
            progress()
            continue
          }
          core.info(`Running plugin: ${sanitizeLabel(plugin.name)}`)
          const unsafePage = await scanWithFindings(scan, addFinding => invokePlugin({plugin, page: page!, addFinding}))
          if (unsafePage) {
            canScan = false
            break
          }
        }
      }

      const axeScan = scans.find(scan => scan.scanner === 'axe')
      if (canScan && axeScan?.status === 'not_started') {
        await scanWithFindings(axeScan, addFinding => runAxeScan({page: page!, addFinding, excludeSelectors}))
      }

      const accesslintScan = scans.find(scan => scan.scanner === 'accesslint')
      if (canScan && accesslintScan?.status === 'not_started') {
        await scanWithFindings(accesslintScan, addFinding => runAccesslintScan({page: page!, addFinding}))
      }
    }
  } finally {
    setStage('cleanup')
    for (const [resource, close] of [
      ['context', () => context?.close()],
      ['browser', () => browser?.close()],
    ] as const) {
      try {
        await close()
      } catch (error) {
        const status = getFailureStatus(error)
        failures.push({requestedUrl: url, status, stage: 'cleanup'})
        fatalError ??= error
        core.error(`Accessibility scan cleanup failed for ${safeUrl} (${resource})`)
        progress()
      }
    }
  }

  return {findings: [...findings], scans, failures, fatalError}
}

export function planScans(url: string) {
  const scansContext = getScansContext()
  const requestedPlugins = [
    ...new Set(scansContext.scansToPerform.filter(name => name !== 'axe' && name !== 'accesslint')),
  ]
  const scans: ScanCompletion[] = ['axe', 'accesslint', ...requestedPlugins].map(scanner => ({
    requestedUrl: url,
    scanner,
    status:
      (scanner === 'axe' && scansContext.shouldPerformAxeScan) ||
      (scanner === 'accesslint' && scansContext.shouldPerformAccesslintScan) ||
      requestedPlugins.includes(scanner)
        ? 'not_started'
        : 'skipped',
  }))
  return {scans, requestedPlugins}
}

async function runScanner(scan: ScanCompletion, stage: ScanStage, failures: ScanFailure[], run: () => Promise<void>) {
  try {
    await run()
    scan.status = 'completed'
  } catch (error) {
    markScanFailure(scan, stage, error, failures)
    return (
      typeof error === 'object' &&
      error !== null &&
      (('pageStateUnsafe' in error && error.pageStateUnsafe === true) ||
        ('viewportMayBeDirty' in error && error.viewportMayBeDirty === true))
    )
  }
  return false
}

function markScanFailure(scan: ScanCompletion, stage: ScanStage, error: unknown, failures: ScanFailure[]) {
  const status = getFailureStatus(error)
  scan.status = status
  scan.stage = stage
  failures.push({requestedUrl: scan.requestedUrl, scanner: scan.scanner, status, stage})
  core.error(
    `Accessibility scan failed during ${stage} for ${sanitizeUrlLabel(scan.requestedUrl)} (${sanitizeLabel(scan.scanner)})`,
  )
}

export function getFailureStatus(error: unknown): 'failed' | 'timed_out' {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string' &&
    error.name.toLowerCase().includes('timeout')
  ) {
    return 'timed_out'
  }
  if (error instanceof Error && /\b(?:timeout|timed out)\b/i.test(error.message)) return 'timed_out'
  return 'failed'
}

async function runAxeScan({
  page,
  addFinding,
  excludeSelectors,
}: {
  page: playwright.Page
  addFinding: (findingData: FindingInput, options?: {includeScreenshots?: boolean}) => Promise<void>
  excludeSelectors?: string[]
}) {
  const url = page.url()
  core.info(`Scanning ${sanitizeUrlLabel(url)}`)
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
  addFinding: (findingData: FindingInput, options?: {includeScreenshots?: boolean}) => Promise<void>
}) {
  const url = page.url()
  core.info(`Scanning ${sanitizeUrlLabel(url)} with AccessLint`)

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
