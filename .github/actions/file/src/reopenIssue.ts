import type { Octokit } from '@octokit/core';
import type { Issue } from './Issue.js';
import type { Finding } from "./types.d.js";
import { generateIssueBody } from "./generateIssueBody.js";

export async function reopenIssue(
  octokit: Octokit,
  { owner, repository, issueNumber }: Issue,
  finding?: Finding,
  repoWithOwner?: string,
  screenshotRepo?: string,
) {
  let body = {};
  if (finding && repoWithOwner) {
    body = {
      body: generateIssueBody(finding, screenshotRepo ?? repoWithOwner),
    };
  }

  return octokit.request(
    `PATCH /repos/${owner}/${repository}/issues/${issueNumber}`,
    {
      owner,
      repository,
      issue_number: issueNumber,
      state: "open",
      ...body,
    },
  );
}
