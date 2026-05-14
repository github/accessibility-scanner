import type {AuthContextInput, ColorSchemePreference, ReducedMotionPreference, UrlConfig} from './types.js'
import fs from 'node:fs'
import path from 'node:path'
import * as core from '@actions/core'
import {AuthContext} from './AuthContext.js'
import {findForUrl} from './findForUrl.js'

export default async function () {
  core.info("Starting 'find' action")
  const urlConfigs = loadUrlConfigs()
  const urls = loadUrls({urlConfigs})
  const reducedMotion = loadReducedMotion()
  const colorScheme = loadColorScheme()

  const actualUrls = urlConfigs || urls || []

  const authContextInput: AuthContextInput = JSON.parse(core.getInput('auth_context', {required: false}) || '{}')
  const authContext = new AuthContext(authContextInput)
  const includeScreenshots = core.getInput('include_screenshots', {required: false}) !== 'false'

  const findings = []
  for (const urlConfig of actualUrls) {
    const {url} = urlConfig
    core.info(`Preparing to scan ${url}`)
    const findingsForUrl = await findForUrl(urlConfig, authContext, includeScreenshots, reducedMotion, colorScheme)
    if (findingsForUrl.length === 0) {
      core.info(`No accessibility gaps were found on ${url}`)
      continue
    }
    findings.push(...findingsForUrl)
    core.info(`Found ${findingsForUrl.length} findings for ${url}`)
  }

  const findingsPath = path.join(process.env.RUNNER_TEMP || '/tmp', `findings-${crypto.randomUUID()}.json`)
  fs.writeFileSync(findingsPath, JSON.stringify(findings))
  core.setOutput('findings_file', findingsPath)

  core.debug(`Output: 'findings_file: ${findingsPath}'`)
  core.info(`Found ${findings.length} findings in total`)
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
  core.debug(`Input: 'urls: ${JSON.stringify(urls)}'`)

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
