import type { IssueInput } from "./types.d.js";
import process from "node:process";
import core from "@actions/core";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { fixIssue } from "./fixIssue.js";
import { Issue } from "./Issue.js";
const OctokitWithThrottling = Octokit.plugin(throttling);

export default async function () {
  core.info("Started 'fix' action");
  const issues: IssueInput[] = JSON.parse(
    core.getInput("issues", { required: true }) || "[]"
  );
  const repoWithOwner = core.getInput("repository", { required: true });
  const token = core.getInput("token", { required: true });
  core.debug(`Input: 'issues: ${JSON.stringify(issues)}'`);
  core.debug(`Input: 'repository: ${repoWithOwner}'`);

  const octokit = new OctokitWithThrottling({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Secondary rate limit hit for request ${options.method} ${options.url}`
        );
        if (retryCount < 3) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
    },
  });
  for (const issueInput of issues) {
    try {
      const issue = new Issue(issueInput);
      await fixIssue(octokit, issue);
      core.info(
        `Assigned ${issue.owner}/${issue.repository}#${issue.issueNumber} to Copilot!`
      );
    } catch (error) {
      core.setFailed(`Failed to assign ${issueInput.url} to Copilot: ${error}`);
      process.exit(1);
    }
  }
  core.info("Finished 'fix' action");
}
