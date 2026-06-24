import type {Octokit} from '@octokit/core'
import type {Issue} from './Issue.js'

/** Issues with this label are intentionally closed and should not be reopened. */
export const WONTFIX_LABEL = 'wontfix'

// Fetch every closed wontfix issue once so the per-filing check is a set lookup
export async function getWontfixIssueNumbers(
  octokit: Octokit,
  {owner, repository}: {owner: string; repository: string},
): Promise<Set<number>> {
  const wontfixIssueNumbers = new Set<number>()
  const perPage = 100
  for (let page = 1; ; page++) {
    const response = await octokit.request(`GET /repos/${owner}/${repository}/issues`, {
      owner,
      repo: repository,
      state: 'closed',
      labels: WONTFIX_LABEL,
      per_page: perPage,
      page,
    })
    const issues = (response.data as Array<{number: number; pull_request?: unknown}>) ?? []
    for (const issue of issues) {
      // The issues endpoint also returns pull requests; skip them
      if (!issue.pull_request) {
        wontfixIssueNumbers.add(issue.number)
      }
    }
    if (issues.length < perPage) {
      break
    }
  }
  return wontfixIssueNumbers
}

// The single place to decide whether a repeated filing's issue should reopen
export function shouldReopenIssue(issue: Issue, wontfixIssueNumbers: Set<number>): boolean {
  return !wontfixIssueNumbers.has(issue.issueNumber)
}
