import type { Octokit } from '@octokit/core';
import { Issue } from './Issue.js';

export async function closeIssue(octokit: Octokit, { owner, repository, issueNumber }: Issue) {
  return octokit.request(`PATCH /repos/${owner}/${repository}/issues/${issueNumber}`, {
    owner,
    repository,
    issue_number: issueNumber,
    state: 'closed'
  });
}