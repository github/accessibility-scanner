import type {Issue as IssueInput, Fixing} from './types.d.js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {throttling} from '@octokit/plugin-throttling'
import {assignIssue} from './assignIssue.js'
import {getLinkedPR} from './getLinkedPR.js'
import {retry} from './retry.js'
import {Issue} from './Issue.js'
const OctokitWithThrottling = Octokit.plugin(throttling)

export default async function () {
  core.info("Started 'fix' action")
  const issuesFile = core.getInput('issues_file', {required: true})
  const issues: IssueInput[] = JSON.parse(fs.readFileSync(issuesFile, 'utf8'))
  const repoWithOwner = core.getInput('repository', {required: true})
  const token = core.getInput('token', {required: true})
  const baseUrl = core.getInput('base_url', {required: false}) || undefined
  core.debug(`Input: 'issues_file: ${issuesFile}'`)
  core.debug(`Input: 'repository: ${repoWithOwner}'`)
  core.debug(`Input: 'base_url: ${baseUrl ?? '(default)'}'`)

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
  const fixings: Fixing[] = issues.map(issue => ({issue})) as Fixing[]

  for (const fixing of fixings) {
    try {
      const issue = new Issue(fixing.issue)
      await assignIssue(octokit, issue)
      core.info(`Assigned ${issue.owner}/${issue.repository}#${issue.issueNumber} to Copilot!`)
      const pullRequest = await retry(() => getLinkedPR(octokit, issue))
      if (pullRequest) {
        fixing.pullRequest = pullRequest
        core.info(`Found linked PR for ${issue.owner}/${issue.repository}#${issue.issueNumber}: ${pullRequest.url}`)
      } else {
        core.info(`No linked PR was found for ${issue.owner}/${issue.repository}#${issue.issueNumber}`)
      }
    } catch (error) {
      core.setFailed(`Failed to assign ${fixing.issue.url} to Copilot: ${error}`)
      process.exit(1)
    }
  }

  const fixingsPath = path.join(process.env.RUNNER_TEMP || '/tmp', `fixings-${crypto.randomUUID()}.json`)
  fs.writeFileSync(fixingsPath, JSON.stringify(fixings))
  core.setOutput('fixings_file', fixingsPath)

  core.debug(`Output: 'fixings_file: ${fixingsPath}'`)
  core.info("Finished 'fix' action")
}
