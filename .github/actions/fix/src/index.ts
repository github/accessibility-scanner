import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { fixIssue } from "./fixIssue.js";

export default async function () {
  const issueNumbers = JSON.parse(core.getInput('issue_numbers', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });

  const octokit = new Octokit({ auth: token });
  for (const issueNumber of issueNumbers) {
    await fixIssue(octokit, repoWithOwner, issueNumber);
    console.log(`Assigned ${repoWithOwner}#${issueNumber} to Copilot!`);
  }
}
