import type {AuthContextInput, ColorSchemePreference, ReducedMotionPreference, UrlConfig} from './types.js'
import fs from 'node:fs'
import path from 'node:path'
import * as core from '@actions/core'
import {AuthContext} from './AuthContext.js'
import {findForUrl} from './findForUrl.js'

export default async function () {
  core.info("Starting 'find' action")
  const urlConfigInput = core.getInput('url_config', {required: false})
  let urlConfigs: UrlConfig[] | undefined
  if (urlConfigInput) {
    try {
      const parsed = JSON.parse(urlConfigInput)
      if (!Array.isArray(parsed)) {
        throw new Error("Input 'url_config' must be a JSON array.")
      }
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null || typeof item.url !== 'string') {
          throw new Error("Each entry in 'url_config' must be an object with a 'url' string field.")
        }
      }
      urlConfigs = parsed as UrlConfig[]
    } catch (e) {
      throw new Error(`Invalid 'url_config' input: ${(e as Error).message}`)
    }
  }

  let urls: string[]
  if (urlConfigs) {
    core.debug(`Input: 'url_config: ${JSON.stringify(urlConfigs)}'`)
    urls = urlConfigs.map(c => c.url)
  } else {
    urls = core.getMultilineInput('urls', {required: false})
    core.debug(`Input: 'urls: ${JSON.stringify(urls)}'`)
    if (urls.length === 0) {
      throw new Error("Either 'urls' or 'url_config' input must be provided.")
    }
  }

  const authContextInput: AuthContextInput = JSON.parse(core.getInput('auth_context', {required: false}) || '{}')
  const authContext = new AuthContext(authContextInput)

  const includeScreenshots = core.getInput('include_screenshots', {required: false}) !== 'false'
  const reducedMotionInput = core.getInput('reduced_motion', {required: false})
  let reducedMotion: ReducedMotionPreference | undefined
  if (reducedMotionInput) {
    if (!['reduce', 'no-preference', null].includes(reducedMotionInput)) {
      throw new Error(
        "Input 'reduced_motion' must be one of: 'reduce', 'no-preference', or null per Playwright documentation.",
      )
    }
    reducedMotion = reducedMotionInput as ReducedMotionPreference
  }
  const colorSchemeInput = core.getInput('color_scheme', {required: false})
  let colorScheme: ColorSchemePreference | undefined
  if (colorSchemeInput) {
    if (!['light', 'dark', 'no-preference', null].includes(colorSchemeInput)) {
      throw new Error(
        "Input 'color_scheme' must be one of: 'light', 'dark', 'no-preference', or null per Playwright documentation.",
      )
    }
    colorScheme = colorSchemeInput as ColorSchemePreference
  }

  const findings = []
  for (const url of urls) {
    core.info(`Preparing to scan ${url}`)
    const excludeSelectors = urlConfigs?.find(c => c.url === url)?.excludeSelectors
    const findingsForUrl = await findForUrl(url, authContext, includeScreenshots, reducedMotion, colorScheme, excludeSelectors)
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
