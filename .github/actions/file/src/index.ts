import type { Finding } from "./types.d.js";
import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { fileIssueForFinding } from "./fileIssueForFinding.js";

export default async function () {
  const findings: Finding[] = JSON.parse(core.getInput('findings', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });

  const issueNumbers = [];
  const octokit = new Octokit({ auth: token });
  for (const finding of findings) {
    const response = await fileIssueForFinding(octokit, repoWithOwner, finding);
    issueNumbers.push(response.data.number);
    console.log(`Created issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
  }

  core.setOutput("issue_numbers", JSON.stringify(issueNumbers));
}