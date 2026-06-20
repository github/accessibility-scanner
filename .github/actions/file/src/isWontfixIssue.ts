import type {Octokit} from '@octokit/core'
import type {Issue} from './Issue.js'

/** Issues with this label are intentionally closed and should not be reopened. */
export const WONTFIX_LABEL = 'wontfix'

type IssueLabel = string | {name?: string}

export async function isWontfixIssue(octokit: Octokit, {owner, repository, issueNumber}: Issue): Promise<boolean> {
  const response = await octokit.request(`GET /repos/${owner}/${repository}/issues/${issueNumber}`, {
    owner,
    repository,
    issue_number: issueNumber,
  })
  const labels = ((response.data as {labels?: IssueLabel[]}).labels ?? []) as IssueLabel[]
  return labels.some(label => (typeof label === 'string' ? label : label.name) === WONTFIX_LABEL)
}
