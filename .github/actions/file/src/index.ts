import type {Finding, ResolvedFiling, RepeatedFiling, FindingGroupIssue, Filing, IssueResponse} from './types.d.js'
import process from 'node:process'
import core from '@actions/core'
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

export default async function () {
  core.info("Started 'file' action")
  const findings: Finding[] = JSON.parse(core.getInput('findings', {required: true}))
  const repoWithOwner = core.getInput('repository', {required: true})
  const token = core.getInput('token', {required: true})
  const screenshotRepo = core.getInput('screenshot_repository', {required: false}) || repoWithOwner
  const cachedFilings: (ResolvedFiling | RepeatedFiling)[] = JSON.parse(
    core.getInput('cached_filings', {required: false}) || '[]',
  )
  const shouldOpenGroupedIssues = core.getBooleanInput('open_grouped_issues')
  core.debug(`Input: 'findings: ${JSON.stringify(findings)}'`)
  core.debug(`Input: 'repository: ${repoWithOwner}'`)
  core.debug(`Input: 'screenshot_repository: ${screenshotRepo}'`)
  core.debug(`Input: 'cached_filings: ${JSON.stringify(cachedFilings)}'`)
  core.debug(`Input: 'open_grouped_issues: ${shouldOpenGroupedIssues}'`)

  const octokit = new OctokitWithThrottling({
    auth: token,
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

  // Track new issues for grouping
  const newIssuesByProblemShort: Record<string, FindingGroupIssue[]> = {}
  const trackingIssueUrls: Record<string, string> = {}

  for (const filing of filings) {
    let response: OctokitResponse<IssueResponse> | undefined
    try {
      if (isResolvedFiling(filing)) {
        // Close the filing’s issue (if necessary)
        response = await closeIssue(octokit, new Issue(filing.issue))
        filing.issue.state = 'closed'
      } else if (isNewFiling(filing)) {
        // Open a new issue for the filing
        response = await openIssue(octokit, repoWithOwner, filing.findings[0], screenshotRepo)
        ;(filing as Filing).issue = {state: 'open'} as Issue

        // Track for grouping
        if (shouldOpenGroupedIssues) {
          core.info(`Tracking new issue for grouping: ${filing.findings[0].problemShort}`)
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
    } catch (error) {
      core.setFailed(`Failed on filing: ${filing}\n${error}`)
      process.exit(1)
    }
  }

  // Open tracking issues for groups with >1 new issue and link back from each
  // new issue
  if (shouldOpenGroupedIssues) {
    core.info(`New issues by problem short: ${JSON.stringify(newIssuesByProblemShort)}`)
    for (const [problemShort, issues] of Object.entries(newIssuesByProblemShort)) {
      if (issues.length > 1) {
        const title: string = `${problemShort} issues`
        const body: string = `# ${problemShort} issues\n\n` + issues.map(issue => `- [ ] ${issue.url}`).join('\n')
        try {
          const trackingResponse = await octokit.request(`POST /repos/${repoWithOwner}/issues`, {
            owner: repoWithOwner.split('/')[0],
            repo: repoWithOwner.split('/')[1],
            title,
            body,
          })
          const trackingUrl: string = trackingResponse.data.html_url
          trackingIssueUrls[problemShort] = trackingUrl
          core.info(`Opened tracking issue for '${problemShort}' with ${issues.length} issues.`)
        } catch (error) {
          core.warning(`Failed to open tracking issue for '${problemShort}': ${error}`)
        }
      }
    }
  }

  core.setOutput('filings', JSON.stringify(filings))
  core.debug(`Output: 'filings: ${JSON.stringify(filings)}'`)
  core.info("Finished 'file' action")
}
