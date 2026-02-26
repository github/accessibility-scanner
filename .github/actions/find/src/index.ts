import type {AuthContextInput} from './types.js'
import * as core from '@actions/core'
import {AuthContext} from './AuthContext.js'
import {findForUrl} from './findForUrl.js'

export default async function () {
  core.info("Starting 'find' action")
  const urls = core.getMultilineInput('urls', {required: true})
  core.debug(`Input: 'urls: ${JSON.stringify(urls)}'`)
  const authContextInput: AuthContextInput = JSON.parse(core.getInput('auth_context', {required: false}) || '{}')
  const authContext = new AuthContext(authContextInput)

  const includeScreenshots = core.getInput('include_screenshots', {required: false}) !== 'false'
  const reducedMotionInput = core.getInput('reduced_motion', {required: false})
  let reducedMotion: 'reduce' | 'no-preference' | undefined
  if (reducedMotionInput) {
    if (!['reduce', 'no-preference'].includes(reducedMotionInput)) {
      throw new Error("Input 'reduced_motion' must be one of: 'reduce', 'no-preference'")
    }
    reducedMotion = reducedMotionInput as 'reduce' | 'no-preference'
  }
  const colorSchemeInput = core.getInput('color_scheme', {required: false})
  let colorScheme: 'light' | 'dark' | 'no-preference' | undefined
  if (colorSchemeInput) {
    if (!['light', 'dark', 'no-preference'].includes(colorSchemeInput)) {
      throw new Error("Input 'color_scheme' must be one of: 'light', 'dark', 'no-preference'")
    }
    colorScheme = colorSchemeInput as 'light' | 'dark' | 'no-preference'
  }

  const findings = []
  for (const url of urls) {
    core.info(`Preparing to scan ${url}`)
    const findingsForUrl = await findForUrl(url, authContext, includeScreenshots, reducedMotion, colorScheme)
    if (findingsForUrl.length === 0) {
      core.info(`No accessibility gaps were found on ${url}`)
      continue
    }
    findings.push(...findingsForUrl)
    core.info(`Found ${findingsForUrl.length} findings for ${url}`)
  }

  core.setOutput('findings', JSON.stringify(findings))
  core.debug(`Output: 'findings: ${JSON.stringify(findings)}'`)
  core.info(`Found ${findings.length} findings in total`)
  core.info("Finished 'find' action")
}
