import type {AuthContextInput, ColorSchemePreference, ReducedMotionPreference, UrlConfig} from './types.js'
import fs from 'node:fs'
import path from 'node:path'
import * as core from '@actions/core'
import {AuthContext} from './AuthContext.js'
import {superviseUrl} from './superviseUrl.js'
import {createScanCompletionReport, sanitizeUrlLabel, summarizeScanCompletion} from './scanCompletion.js'
import type {ScanCompletion, ScanFailure} from './types.js'

export default async function () {
  core.info("Starting 'find' action")
  const urlConfigs = loadUrlConfigs()
  const urls = loadUrls({urlConfigs})
  const reducedMotion = loadReducedMotion()
  const colorScheme = loadColorScheme()
  const ignoreHttpsErrors = loadIgnoreHttpsErrors()
  const urlTimeoutMs = loadUrlTimeout()

  const actualUrls = urlConfigs || urls || []

  const authContextInput: AuthContextInput = JSON.parse(core.getInput('auth_context', {required: false}) || '{}')
  const authContext = new AuthContext(authContextInput)
  const includeScreenshots = core.getInput('include_screenshots', {required: false}) !== 'false'

  const findings = []
  const scans: ScanCompletion[] = []
  const failures: ScanFailure[] = []
  for (const urlConfig of actualUrls) {
    const {url} = urlConfig
    core.info(`Preparing to scan ${sanitizeUrlLabel(url)}`)
    const outcome = await superviseUrl(
      urlConfig,
      authContext,
      includeScreenshots,
      reducedMotion,
      colorScheme,
      ignoreHttpsErrors,
      urlTimeoutMs,
    )
    findings.push(...outcome.findings)
    scans.push(...outcome.scans)
    failures.push(...outcome.failures)
    core.info(`Found ${outcome.findings.length} findings for ${sanitizeUrlLabel(url)}`)
  }

  const report = createScanCompletionReport(scans, failures)
  const summary = summarizeScanCompletion(report)
  const findingsPath = path.join(process.env.RUNNER_TEMP || '/tmp', `findings-${crypto.randomUUID()}.json`)
  const completionPath = path.join(process.env.RUNNER_TEMP || '/tmp', `scan-completion-${crypto.randomUUID()}.json`)
  fs.writeFileSync(findingsPath, JSON.stringify(findings))
  fs.writeFileSync(completionPath, JSON.stringify(report))
  core.setOutput('findings_file', findingsPath)
  core.setOutput('completion_file', completionPath)
  core.setOutput('scan_complete', String(report.complete))
  core.setOutput('scan_summary', summary)

  core.debug(`Output: 'findings_file: ${findingsPath}'`)
  core.debug(`Output: 'completion_file: ${completionPath}'`)
  core.info(`Found ${findings.length} findings in total`)
  if (!report.complete) core.warning(summary)
  core.info("Finished 'find' action")
}

function loadUrlConfigs() {
  const urlConfigInput = core.getInput('url_configs', {required: false})
  if (!urlConfigInput) return

  try {
    const parsed = JSON.parse(urlConfigInput)

    if (!Array.isArray(parsed)) {
      throw new Error("Input 'url_configs' must be a JSON array.")
    }

    for (const item of parsed) {
      if (typeof item !== 'object' || item === null || typeof item.url !== 'string') {
        throw new Error("Each entry in 'url_configs' must be an object with a 'url' string field.")
      }
      if (
        item.waitForSelectors !== undefined &&
        (!Array.isArray(item.waitForSelectors) ||
          item.waitForSelectors.some((selector: unknown) => typeof selector !== 'string'))
      ) {
        throw new Error("Each 'waitForSelectors' field in 'url_configs' must be an array of CSS selector strings.")
      }
    }

    return parsed as UrlConfig[]
  } catch (e) {
    throw new Error(`Invalid 'url_configs' input: ${(e as Error).message}`)
  }
}

function loadUrls({urlConfigs}: {urlConfigs?: UrlConfig[]} = {}) {
  // - no need to process this input if url_configs is provided
  if (urlConfigs) return

  const urls: string[] = core.getMultilineInput('urls', {required: false})
  core.debug(`Input: 'urls: ${urls.length} URL(s)'`)

  if (urls.length === 0) {
    throw new Error("Either 'urls' or 'url_configs' input must be provided.")
  }

  return urls.map(url => ({url})) as UrlConfig[]
}

function loadReducedMotion() {
  const reducedMotionInput = core.getInput('reduced_motion', {required: false})
  if (!reducedMotionInput) return

  if (!['reduce', 'no-preference', null].includes(reducedMotionInput)) {
    throw new Error(
      "Input 'reduced_motion' must be one of: 'reduce', 'no-preference', or null per Playwright documentation.",
    )
  }
  return reducedMotionInput as ReducedMotionPreference
}

function loadColorScheme() {
  const colorSchemeInput = core.getInput('color_scheme', {required: false})
  if (!colorSchemeInput) return

  if (!['light', 'dark', 'no-preference', null].includes(colorSchemeInput)) {
    throw new Error(
      "Input 'color_scheme' must be one of: 'light', 'dark', 'no-preference', or null per Playwright documentation.",
    )
  }

  return colorSchemeInput as ColorSchemePreference
}

function loadIgnoreHttpsErrors() {
  return core.getInput('ignore_https_errors', {required: false}).toLowerCase() === 'true'
}

function loadUrlTimeout() {
  const input = core.getInput('url_timeout_ms', {required: false}) || '120000'
  const value = Number(input)
  if (!/^[0-9]+$/.test(input) || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new Error("Input 'url_timeout_ms' must be a positive integer no greater than 2147483647.")
  }
  return value
}
