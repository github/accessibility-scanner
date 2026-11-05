import type {Octokit} from '@octokit/core'
import type {Finding} from './types.d.js'
import {generateIssueBody} from './generateIssueBody.js'
import {createHash} from 'node:crypto'
import * as url from 'node:url'
const URL = url.URL

/** Max length for GitHub issue titles */
const GITHUB_ISSUE_TITLE_MAX_LENGTH = 256
/** Max length for GitHub label names */
const GITHUB_LABEL_NAME_MAX_LENGTH = 50
const RULE_LABEL_HASH_LENGTH = 4

function createRuleLabel(scannerType: string, ruleId: string): string {
  const label = `${scannerType} rule: ${ruleId}`
  const characters = Array.from(label)

  if (characters.length <= GITHUB_LABEL_NAME_MAX_LENGTH) {
    return label
  }

  const hash = createHash('sha256').update(label).digest('hex').slice(0, RULE_LABEL_HASH_LENGTH)
  const prefixLength = GITHUB_LABEL_NAME_MAX_LENGTH - hash.length - 1
  return `${characters.slice(0, prefixLength).join('')}-${hash}`
}

/**
 * Truncates text to a maximum length, adding an ellipsis if truncated.
 * @param text Original text
 * @param maxLength Maximum length of the returned text (including ellipsis)
 * @returns Either the original text or a truncated version with an ellipsis
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text
}

export async function openIssue(octokit: Octokit, repoWithOwner: string, findings: Finding[], screenshotRepo?: string) {
  const owner = repoWithOwner.split('/')[0]
  const repo = repoWithOwner.split('/')[1]
  const primary = findings[0]

  const labels = [`${primary.scannerType}-scanning-issue`]
  // Only include a ruleId label when it's defined
  if (primary.ruleId) {
    labels.push(createRuleLabel(primary.scannerType, primary.ruleId))
  }
  // Flag non-WCAG findings so they can be filtered or triaged separately
  if (primary.category && primary.category !== 'wcag') {
    labels.push(primary.category)
  }

  const count = findings.length
  const titleSuffix = count > 1 ? ` (${count} occurrences)` : ` on ${new URL(primary.url).pathname}`
  const title = truncateWithEllipsis(
    `Accessibility issue: ${primary.problemShort[0].toUpperCase() + primary.problemShort.slice(1)}${titleSuffix}`,
    GITHUB_ISSUE_TITLE_MAX_LENGTH,
  )

  const body = generateIssueBody(findings, screenshotRepo ?? repoWithOwner)

  return octokit.request(`POST /repos/${owner}/${repo}/issues`, {
    owner,
    repo,
    title,
    body,
    labels,
  })
}
