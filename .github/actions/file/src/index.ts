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
  const closedIssues: Issue[] = [];
  const openedIssues: Issue[] = [];
  const repeatedIssues: Issue[] = [];
  /** @deprecated Use `closedIssues` instead. */
  const closedIssueUrls: string[] = [];
  /** @deprecated Use `openedIssues` instead. */
  const openedIssueUrls: string[] = [];
  /** @deprecated Use `repeatedIssues` instead. */
  const repeatedIssueUrls: string[] = [];

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
        closedIssueUrls.push(response.data.html_url);
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
        repeatedIssueUrls.push(response.data.html_url);
        core.info(`Repeated issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      } else {
        // New finding was found in the latest run, so create its issue
        openedIssues.push({
          id: response.data.id,
          nodeId: response.data.node_id,
          url: response.data.html_url,
          title: response.data.title,
        });
        openedIssueUrls.push(response.data.html_url);
        core.info(`Created issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      }
    } catch (error) {
      core.setFailed(`Failed to open/reopen issue for finding: ${error}`);
      process.exit(1);
    }
  }

  core.setOutput("closed_issues", JSON.stringify(closedIssues));
  core.setOutput("opened_issues", JSON.stringify(openedIssues));
  core.setOutput("repeated_issues", JSON.stringify(repeatedIssues));
  core.setOutput("findings", JSON.stringify(findings));
  core.debug(`Output: 'closed_issues: ${JSON.stringify(closedIssues)}'`);
  core.debug(`Output: 'opened_issues: ${JSON.stringify(openedIssues)}'`);
  core.debug(`Output: 'repeated_issues: ${JSON.stringify(repeatedIssues)}'`);
  core.debug(`Output: 'findings: ${JSON.stringify(findings)}'`);

  // Deprecated outputs
  core.setOutput("closed_issue_urls", JSON.stringify(closedIssueUrls));
  core.setOutput("opened_issue_urls", JSON.stringify(openedIssueUrls));
  core.setOutput("repeated_issue_urls", JSON.stringify(repeatedIssueUrls));
  core.warning("The 'closed_issue_urls' output is deprecated and will be removed in v2. If you use the 'closed_issue_urls' output, please migrate to the 'closed_issues' output.");
  core.debug(`Output: 'closed_issue_urls: ${JSON.stringify(closedIssueUrls)}'`);
  core.warning("The 'opened_issue_urls' output is deprecated and will be removed in v2. If you use the 'opened_issue_urls' output, please migrate to the 'opened_issues' output.");
  core.debug(`Output: 'opened_issue_urls: ${JSON.stringify(openedIssueUrls)}'`);
  core.warning("The 'repeated_issue_urls' output is deprecated and will be removed in v2. If you use the 'repeated_issue_urls' output, please migrate to the 'repeated_issues' output.");
  core.debug(`Output: 'repeated_issue_urls: ${JSON.stringify(repeatedIssueUrls)}'`);

  core.info("Finished 'file' action");
}
