import type {Octokit} from '@octokit/core'
import type {Finding} from './types.d.js'
import {generateIssueBody} from './generateIssueBody.js'
import * as url from 'node:url'
const URL = url.URL

/** Max length for GitHub issue titles */
const GITHUB_ISSUE_TITLE_MAX_LENGTH = 256

/**
 * Truncates text to a maximum length, adding an ellipsis if truncated.
 * @param text Original text
 * @param maxLength Maximum length of the returned text (including ellipsis)
 * @returns Either the original text or a truncated version with an ellipsis
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text
}

export async function openIssue(octokit: Octokit, repoWithOwner: string, finding: Finding, screenshotRepo?: string) {
  const owner = repoWithOwner.split('/')[0]
  const repo = repoWithOwner.split('/')[1]

  const labels = [`${finding.scannerType}-scanning-issue`]

  // Add rule type label to distinguish WCAG violations from best practices
  if (finding.ruleType === 'best-practice') {
    labels.push('best-practice')
  } else if (finding.ruleType === 'experimental') {
    labels.push('experimental')
  } else {
    // Default to wcag for any WCAG-tagged rule
    labels.push('wcag-violation')
  }

  // Only include a ruleId label when it's defined
  if (finding.ruleId) {
    labels.push(`${finding.scannerType} rule: ${finding.ruleId}`)
  }

  const title = truncateWithEllipsis(
    `Accessibility issue: ${finding.problemShort[0].toUpperCase() + finding.problemShort.slice(1)} on ${new URL(finding.url).pathname}`,
    GITHUB_ISSUE_TITLE_MAX_LENGTH,
  )

  const body = generateIssueBody(finding, screenshotRepo ?? repoWithOwner)

  return octokit.request(`POST /repos/${owner}/${repo}/issues`, {
    owner,
    repo,
    title,
    body,
    labels,
  })
}
