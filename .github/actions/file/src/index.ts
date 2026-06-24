import type {Finding, ResolvedFiling, RepeatedFiling, FindingGroupIssue, Filing, IssueResponse} from './types.d.js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {throttling} from '@octokit/plugin-throttling'
import {Issue} from './Issue.js'
import {closeIssue} from './closeIssue.js'
import {isNewFiling} from './isNewFiling.js'
import {isRepeatedFiling} from './isRepeatedFiling.js'
import {isResolvedFiling} from './isResolvedFiling.js'
import {openIssue} from './openIssue.js'
import {reopenIssue} from './reopenIssue.js'
import {updateFilingsWithNewFindings} from './updateFilingsWithNewFindings.js'
import {OctokitResponse} from '@octokit/types'
const OctokitWithThrottling = Octokit.plugin(throttling)

// core.getBooleanInput throws on unset inputs, so apply the default first.
function getBooleanInputWithDefault(name: string, defaultValue: boolean): boolean {
  if (!core.getInput(name)) return defaultValue
  return core.getBooleanInput(name)
}

export default async function () {
  core.info("Started 'file' action")
  const findingsFile = core.getInput('findings_file', {required: true})
  const findings: Finding[] = JSON.parse(fs.readFileSync(findingsFile, 'utf8'))
  const repoWithOwner = core.getInput('repository', {required: true})
  const token = core.getInput('token', {required: true})
  const baseUrl = core.getInput('base_url', {required: false})
  const screenshotRepo = core.getInput('screenshot_repository', {required: false}) || repoWithOwner
  const cachedFilingsFile = core.getInput('cached_filings_file', {required: false})
  const cachedFilings: (ResolvedFiling | RepeatedFiling)[] = cachedFilingsFile
    ? JSON.parse(fs.readFileSync(cachedFilingsFile, 'utf8'))
    : []
  const shouldOpenGroupedIssues = core.getBooleanInput('open_grouped_issues')
  const dryRun = core.getBooleanInput('dry_run')
  const fileBestPracticeIssues = getBooleanInputWithDefault('file_best_practice_issues', true)
  const fileExperimentalIssues = getBooleanInputWithDefault('file_experimental_issues', true)
  core.debug(`Input: 'findings_file: ${findingsFile}'`)
  core.debug(`Input: 'repository: ${repoWithOwner}'`)
  core.debug(`Input: 'base_url: ${baseUrl ?? '(default)'}'`)
  core.debug(`Input: 'screenshot_repository: ${screenshotRepo}'`)
  core.debug(`Input: 'cached_filings_file: ${cachedFilingsFile}'`)
  core.debug(`Input: 'open_grouped_issues: ${shouldOpenGroupedIssues}'`)
  core.debug(`Input: 'dry_run: ${dryRun}'`)
  core.debug(`Input: 'file_best_practice_issues: ${fileBestPracticeIssues}'`)
  core.debug(`Input: 'file_experimental_issues: ${fileExperimentalIssues}'`)

  const octokit = new OctokitWithThrottling({
    auth: token,
    baseUrl,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`)
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
    },
  })
  const filings = updateFilingsWithNewFindings(cachedFilings, findings)

  // Suppressed new filings are kept out of the cache
  const suppressedFilings = new Set<Filing>()

  // Track new issues for grouping
  const newIssuesByProblemShort: Record<string, FindingGroupIssue[]> = {}
  const trackingIssueUrls: Record<string, string> = {}
  const dryRunCounts = {open: 0, reopen: 0, close: 0}

  for (const filing of filings) {
    let response: OctokitResponse<IssueResponse> | undefined
    try {
      // Category switches gate only new issues
      if (isNewFiling(filing)) {
        const category = filing.findings[0].category ?? 'wcag'
        if (
          (category === 'best-practice' && !fileBestPracticeIssues) ||
          (category === 'experimental' && !fileExperimentalIssues)
        ) {
          core.info(
            `Skipping new ${category} issue (filing disabled for this category): ${filing.findings[0].problemShort}`,
          )
          suppressedFilings.add(filing)
          continue
        }
      }

      if (dryRun) {
        if (isResolvedFiling(filing)) {
          dryRunCounts.close++
          filing.issue.state = 'closed'
          core.info(`[dry run] Would CLOSE issue: ${filing.issue.url}`)
        } else if (isNewFiling(filing)) {
          dryRunCounts.open++
          ;(filing as Filing).issue = {state: 'open'} as Issue
          core.info(
            `[dry run] Would OPEN a new issue for: ${filing.findings[0].problemShort} (${filing.findings[0].url})`,
          )
        } else if (isRepeatedFiling(filing)) {
          dryRunCounts.reopen++
          filing.issue.state = 'reopened'
          core.info(`[dry run] Would REOPEN issue: ${filing.issue.url}`)
        }
      } else {
        if (isResolvedFiling(filing)) {
          // Close the filing's issue (if necessary)
          response = await closeIssue(octokit, new Issue(filing.issue))
          filing.issue.state = 'closed'
        } else if (isNewFiling(filing)) {
          // Open a new issue for the filing
          response = await openIssue(octokit, repoWithOwner, filing.findings[0], screenshotRepo)
          ;(filing as Filing).issue = {state: 'open'} as Issue

          // Track for grouping
          if (shouldOpenGroupedIssues) {
            const problemShort: string = filing.findings[0].problemShort
            if (!newIssuesByProblemShort[problemShort]) {
              newIssuesByProblemShort[problemShort] = []
            }
            newIssuesByProblemShort[problemShort].push({
              url: response.data.html_url,
              id: response.data.number,
            })
          }
        } else if (isRepeatedFiling(filing)) {
          // Reopen the filing's issue (if necessary) and update the body with the latest finding
          response = await reopenIssue(
            octokit,
            new Issue(filing.issue),
            filing.findings[0],
            repoWithOwner,
            screenshotRepo,
          )
          filing.issue.state = 'reopened'
        }
        if (response?.data && filing.issue) {
          // Update the filing with the latest issue data
          filing.issue.id = response.data.id
          filing.issue.nodeId = response.data.node_id
          filing.issue.url = response.data.html_url
          filing.issue.title = response.data.title
          core.info(
            `Set issue ${response.data.title} (${repoWithOwner}#${response.data.number}) state to ${filing.issue.state}`,
          )
        }
      }
    } catch (error) {
      core.setFailed(`Failed on filing: ${JSON.stringify(filing, null, 2)}\n${error}`)
      process.exit(1)
    }
  }

  // Open tracking issues for groups with >1 new issue and link back from each
  // new issue
  if (shouldOpenGroupedIssues && !dryRun) {
    for (const [problemShort, issues] of Object.entries(newIssuesByProblemShort)) {
      if (issues.length > 1) {
        const capitalizedProblemShort = problemShort[0].toUpperCase() + problemShort.slice(1)
        const title: string = `${capitalizedProblemShort} issues`
        const body: string =
          `# ${capitalizedProblemShort} issues\n\n` + issues.map(issue => `- [ ] ${issue.url}`).join('\n')
        try {
          const trackingResponse = await octokit.request(`POST /repos/${repoWithOwner}/issues`, {
            owner: repoWithOwner.split('/')[0],
            repo: repoWithOwner.split('/')[1],
            title,
            body,
          })
          const trackingUrl: string = trackingResponse.data.html_url
          trackingIssueUrls[problemShort] = trackingUrl
          core.info(`Opened tracking issue for '${capitalizedProblemShort}' with ${issues.length} issues.`)
        } catch (error) {
          core.warning(`Failed to open tracking issue for '${capitalizedProblemShort}': ${error}`)
        }
      }
    }
  }

  if (dryRun) {
    core.info('[dry run] Summary of actions that would be taken:')
    console.table({
      open: dryRunCounts.open,
      reopen: dryRunCounts.reopen,
      close: dryRunCounts.close,
      total: dryRunCounts.open + dryRunCounts.reopen + dryRunCounts.close,
    })
  }

  const filingsPath = path.join(process.env.RUNNER_TEMP || '/tmp', `filings-${crypto.randomUUID()}.json`)
  const outputFilings = suppressedFilings.size > 0 ? filings.filter(f => !suppressedFilings.has(f)) : filings
  fs.writeFileSync(filingsPath, JSON.stringify(outputFilings))
  core.setOutput('filings_file', filingsPath)

  core.debug(`Output: 'filings_file: ${filingsPath}'`)
  core.info("Finished 'file' action")
}
