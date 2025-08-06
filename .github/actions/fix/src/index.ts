import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { fixIssue } from "./fixIssue.js";

export default async function () {
  const issueUrls = JSON.parse(core.getInput('issue_urls', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });

  const octokit = new Octokit({ auth: token });
  for (const issueUrl of issueUrls) {
    await fixIssue(octokit, repoWithOwner, issueUrl);
    console.log(`Assigned ${repoWithOwner}#${issueUrl.split('/').pop()} to Copilot!`);
  }
}
