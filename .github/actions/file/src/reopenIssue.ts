import type { Octokit } from "@octokit/core";
import type { Issue } from "./Issue.js";

export async function reopenIssue(octokit: Octokit, { owner, repository, issueNumber }: Issue) {
  return octokit.request(`PATCH /repos/${owner}/${repository}/issues/${issueNumber}`, {
    owner,
    repository,
    issue_number: issueNumber,
    state: "open",
  });
}
