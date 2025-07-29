import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { findResultsForUrl } from "./findResultsForUrl.js";
import { fileIssueForResult } from "./fileIssueForResult.js";
import { fixIssue } from "./fixIssue.js";

const urls = core.getMultilineInput('urls', { required: true });
const repoWithOwner = core.getInput('repository', { required: true });
const token = core.getInput('token', { required: true });

export default async function () {
  for (const url of urls) {
    // Find
    const results = await findResultsForUrl(url);
    if (results.length === 0) {
      console.log(`No accessibility gaps were found on ${url}`);
      continue;
    }
    // File
    const issueNumbers = [];
    const octokit = new Octokit({ auth: token });
    for (const result of results) {
      const response = await fileIssueForResult(octokit, repoWithOwner, result);
      issueNumbers.push(response.data.number);
      console.log(`Created issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
    }
    // Fix
    for (const issueNumber of issueNumbers) {
      await fixIssue(octokit, repoWithOwner, issueNumber);
      console.log(`Assigned ${repoWithOwner}#${issueNumber} to Copilot!`);
    }
  }
}
