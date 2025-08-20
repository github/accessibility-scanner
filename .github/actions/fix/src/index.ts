import process from "node:process";
import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { fixIssue } from "./fixIssue.js";

export default async function () {
  core.info("Started 'fix' action");
  const issueUrls = JSON.parse(core.getInput('issue_urls', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });
  core.debug(`Input: 'issue_urls: ${JSON.stringify(issueUrls)}'`);
  core.debug(`Input: 'repository: ${repoWithOwner}'`);

  const octokit = new Octokit({ auth: token });
  for (const issueUrl of issueUrls) {
    try {
      await fixIssue(octokit, repoWithOwner, issueUrl);
      core.info(`Assigned ${repoWithOwner}#${issueUrl.split('/').pop()} to Copilot!`);
    } catch (error) {
      core.setFailed(`Failed to assign ${repoWithOwner}#${issueUrl.split('/').pop()} to Copilot: ${error}`);
      process.exit(1);
    }
  }
  core.info("Finished 'fix' action");
}
