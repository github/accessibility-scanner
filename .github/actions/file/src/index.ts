import type { Finding, ResolvedFiling, RepeatedFiling } from "./types.d.js";
import process from "node:process";
import core from "@actions/core";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { Issue } from "./Issue.js";
import { closeIssue } from "./closeIssue.js";
import { isNewFiling } from "./isNewFiling.js";
import { isRepeatedFiling } from "./isRepeatedFiling.js";
import { isResolvedFiling } from "./isResolvedFiling.js";
import { openIssue } from "./openIssue.js";
import { reopenIssue } from "./reopenIssue.js";
import { updateFilingsWithNewFindings } from "./updateFilingsWithNewFindings.js";
const OctokitWithThrottling = Octokit.plugin(throttling);

export default async function () {
  core.info("Started 'file' action");
  const findings: Finding[] = JSON.parse(core.getInput("findings", { required: true }));
  const repoWithOwner = core.getInput("repository", { required: true });
  const token = core.getInput("token", { required: true });
  const cachedFilings: (ResolvedFiling | RepeatedFiling)[] = JSON.parse(
    core.getInput("cached_filings", { required: false }) || "[]",
  );
  core.debug(`Input: 'findings: ${JSON.stringify(findings)}'`);
  core.debug(`Input: 'repository: ${repoWithOwner}'`);
  core.debug(`Input: 'cached_filings: ${JSON.stringify(cachedFilings)}'`);

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
    },
  });
  const filings = updateFilingsWithNewFindings(cachedFilings, findings);

  for (const filing of filings) {
    let response;
    try {
      if (isResolvedFiling(filing)) {
        // Close the filing’s issue (if necessary)
        response = await closeIssue(octokit, new Issue(filing.issue));
        filing.issue.state = "closed";
      } else if (isNewFiling(filing)) {
        // Open a new issue for the filing
        response = await openIssue(octokit, repoWithOwner, filing.findings[0]);
        (filing as unknown as { issue: Partial<Issue> }).issue = { state: "open" };
      } else if (isRepeatedFiling(filing)) {
        // Reopen the filing’s issue (if necessary)
        response = await reopenIssue(octokit, new Issue(filing.issue));
        filing.issue.state = "reopened";
      }
      if (response?.data && filing.issue) {
        // Update the filing with the latest issue data
        filing.issue.id = response.data.id;
        filing.issue.nodeId = response.data.node_id;
        filing.issue.url = response.data.html_url;
        filing.issue.title = response.data.title;
        core.info(
          `Set issue ${response.data.title} (${repoWithOwner}#${response.data.number}) state to ${filing.issue.state}`,
        );
      }
    } catch (error) {
      core.setFailed(`Failed on filing: ${filing}\n${error}`);
      process.exit(1);
    }
  }

  core.setOutput("filings", JSON.stringify(filings));
  core.debug(`Output: 'filings: ${JSON.stringify(filings)}'`);
  core.info("Finished 'file' action");
}
