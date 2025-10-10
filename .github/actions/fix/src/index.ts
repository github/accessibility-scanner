import type { Issue as IssueInput, Fixing } from "./types.d.js";
import process from "node:process";
import core from "@actions/core";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { assignIssue } from "./assignIssue.js";
import { getLinkedPR } from "./getLinkedPR.js";
import { sleep } from "./sleep.js";
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
  const fixings: Fixing[] = issues.map((issue) => ({ issue })) as Fixing[];

  for (const fixing of fixings) {
    try {
      const issue = new Issue(fixing.issue);
      await assignIssue(octokit, issue);
      core.info(
        `Assigned ${issue.owner}/${issue.repository}#${issue.issueNumber} to Copilot!`
      );
      await sleep(5000); // Wait for Copilot to open a PR
      const pullRequest = await getLinkedPR(octokit, issue);
      if (pullRequest) {
        fixing.pullRequest = pullRequest;
        core.info(
          `Found linked PR for ${issue.owner}/${issue.repository}#${issue.issueNumber}: ${pullRequest.url}`
        );
      } else {
        core.info(
          `No linked PR was found for ${issue.owner}/${issue.repository}#${issue.issueNumber}`
        );
      }
    } catch (error) {
      core.setFailed(
        `Failed to assign ${fixing.issue.url} to Copilot: ${error}`
      );
      process.exit(1);
    }
  }

  core.setOutput("fixings", JSON.stringify(fixings));
  core.debug(`Output: 'fixings: ${JSON.stringify(fixings)}'`);
  core.info("Finished 'fix' action");
}
