import type { Finding, Issue } from "./types.d.js";
import process from "node:process";
import core from "@actions/core";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { toFindingsMap } from "./toFindingsMap.js"
import { closeIssueForFinding } from "./closeIssueForFinding.js";
import { openIssueForFinding } from "./openIssueForFinding.js";
const OctokitWithThrottling = Octokit.plugin(throttling);

export default async function () {
  core.info("Started 'file' action");
  const findings: Finding[] = JSON.parse(core.getInput('findings', { required: true }));
  const repoWithOwner = core.getInput('repository', { required: true });
  const token = core.getInput('token', { required: true });
  const cachedFindings: Finding[] = JSON.parse(core.getInput('cached_findings', { required: false }) || "[]");
  core.debug(`Input: 'findings: ${JSON.stringify(findings)}'`);
  core.debug(`Input: 'repository: ${repoWithOwner}'`);
  core.debug(`Input: 'cached_findings: ${JSON.stringify(cachedFindings)}'`);

  const findingsMap = toFindingsMap(findings);
  const cachedFindingsMap = toFindingsMap(cachedFindings);

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
  /** @deprecated */
  const closedIssues: Issue[] = [];
  /** @deprecated */
  const openedIssues: Issue[] = [];
  /** @deprecated */
  const repeatedIssues: Issue[] = [];

  for (const cachedFinding of cachedFindings) {
    if (!findingsMap.has(`${cachedFinding.url};${cachedFinding.problemShort};${cachedFinding.html}`)) {
      try {
        // Finding was not found in the latest run, so close its issue (if necessary)
        const response = await closeIssueForFinding(octokit, repoWithOwner, cachedFinding);
        closedIssues.push({
          id: response.data.id,
          nodeId: response.data.node_id,
          url: response.data.html_url,
          title: response.data.title,
        });
        core.info(`Closed issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      } catch (error) {
        core.setFailed(`Failed to close issue for finding: ${error}`);
        process.exit(1);
      }
    }
  }

  for (const finding of findings) {
    const cachedIssueUrl = cachedFindingsMap.get(`${finding.url};${finding.problemShort};${finding.html}`)?.issueUrl
    finding.issueUrl = cachedIssueUrl;
    try {
      const response = await openIssueForFinding(octokit, repoWithOwner, finding);
      finding.issueUrl = response.data.html_url;
      if (response.data.html_url === cachedIssueUrl) {
        // Finding was found in previous and latest runs, so reopen its issue (if necessary)
        repeatedIssues.push({
          id: response.data.id,
          nodeId: response.data.node_id,
          url: response.data.html_url,
          title: response.data.title,
        });
        core.info(`Repeated issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      } else {
        // New finding was found in the latest run, so create its issue
        openedIssues.push({
          id: response.data.id,
          nodeId: response.data.node_id,
          url: response.data.html_url,
          title: response.data.title,
        });
        core.info(`Created issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      }
    } catch (error) {
      core.setFailed(`Failed to open/reopen issue for finding: ${error}`);
      process.exit(1);
    }
  }

  // Deprecated outputs
  core.setOutput("closed_issues", JSON.stringify(closedIssues));
  core.setOutput("opened_issues", JSON.stringify(openedIssues));
  core.setOutput("repeated_issues", JSON.stringify(repeatedIssues));
  core.setOutput("findings", JSON.stringify(findings));
  core.debug(`Output: 'closed_issues: ${JSON.stringify(closedIssues)}'`);
  core.debug(`Output: 'opened_issues: ${JSON.stringify(openedIssues)}'`);
  core.debug(`Output: 'repeated_issues: ${JSON.stringify(repeatedIssues)}'`);
  core.debug(`Output: 'findings: ${JSON.stringify(findings)}'`);
  core.warning("The 'closed_issues' output is deprecated and will be removed in v2.");
  core.warning("The 'opened_issues' output is deprecated and will be removed in v2.");
  core.warning("The 'repeated_issues' output is deprecated and will be removed in v2.");
  core.warning("The 'findings' output is deprecated and will be removed in v2.");

  core.info("Finished 'file' action");
}
