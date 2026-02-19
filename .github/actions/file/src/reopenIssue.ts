import type { Octokit } from '@octokit/core';
import type { Issue } from './Issue.js';
import type { Finding } from "./types.d.js";
import { generateIssueBody } from "./generateIssueBody.js";

export async function reopenIssue(
  octokit: Octokit,
  { owner, repository, issueNumber }: Issue,
  finding?: Finding,
  repoWithOwner?: string,
) {
  const body =
    finding && repoWithOwner
      ? generateIssueBody(finding, repoWithOwner)
      : undefined;
  return octokit.request(
    `PATCH /repos/${owner}/${repository}/issues/${issueNumber}`,
    {
      owner,
      repository,
      issue_number: issueNumber,
      state: "open",
      ...(body ? { body } : {}),
    },
  );
}
