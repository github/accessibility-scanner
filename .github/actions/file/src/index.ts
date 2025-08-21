import type { Finding } from "./types.d.js";
import process from "node:process";
import core from "@actions/core";
import { Octokit } from '@octokit/core';
import { toFindingsMap } from "./toFindingsMap.js"
import { closeIssueForFinding } from "./closeIssueForFinding.js";
import { openIssueForFinding } from "./openIssueForFinding.js";

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

  const octokit = new Octokit({ auth: token });
  const closedIssueUrls = [];
  const openedIssueUrls = [];
  const repeatIssueUrls = [];

  for (const cachedFinding of cachedFindings) {
    if (!findingsMap.has(`${cachedFinding.url};${cachedFinding.problemShort};${cachedFinding.html}`)) {
      try {
        // Finding was not found in the latest run, so close its issue (if necessary)
        const response = await closeIssueForFinding(octokit, repoWithOwner, cachedFinding);
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
        repeatIssueUrls.push(response.data.html_url);
        core.info(`Repeated issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      } else {
        // New finding was found in the latest run, so create its issue
        openedIssueUrls.push(response.data.html_url);
        core.info(`Created issue: ${response.data.title} (${repoWithOwner}#${response.data.number})`);
      }
    } catch (error) {
      core.setFailed(`Failed to open/reopen issue for finding: ${error}`);
      process.exit(1);
    }
  }

  core.setOutput("closed_issue_urls", JSON.stringify(closedIssueUrls));
  core.setOutput("opened_issue_urls", JSON.stringify(openedIssueUrls));
  core.setOutput("repeated_issue_urls", JSON.stringify(repeatIssueUrls));
  core.setOutput("findings", JSON.stringify(findings));
  core.debug(`Output: 'closed_issue_urls: ${JSON.stringify(closedIssueUrls)}'`);
  core.debug(`Output: 'opened_issue_urls: ${JSON.stringify(openedIssueUrls)}'`);
  core.debug(`Output: 'repeated_issue_urls: ${JSON.stringify(repeatIssueUrls)}'`);
  core.debug(`Output: 'findings: ${JSON.stringify(findings)}'`);
  core.info("Finished 'file' action");
}
