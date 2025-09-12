import process from "node:process";
import core from "@actions/core";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { fixIssue } from "./fixIssue.js";
const OctokitWithThrottling = Octokit.plugin(throttling);

export default async function () {
  core.info("Started 'fix' action");
  const issueUrls = JSON.parse(core.getInput('issue_urls', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });
  core.debug(`Input: 'issue_urls: ${JSON.stringify(issueUrls)}'`);
  core.debug(`Input: 'repository: ${repoWithOwner}'`);

  const octokit = new OctokitWithThrottling({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`);
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
    }
  });
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
