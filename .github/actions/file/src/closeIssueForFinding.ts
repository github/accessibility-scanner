import type { Octokit } from '@octokit/core';
import type { Finding } from './types.d.js';

export async function closeIssueForFinding(octokit: Octokit, repoWithOwner: string, finding: Finding) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];
  const issueNumber = finding.issueUrl?.split('/').pop();
  if (!issueNumber) {
    throw new Error(`Invalid issue URL: ${finding.issueUrl}`);
  }
  return octokit.request(`PATCH /repos/${owner}/${repo}/issues/${issueNumber}`, {
    owner,
    repo,
    issue_number: issueNumber,
    state: 'closed'
  });
}