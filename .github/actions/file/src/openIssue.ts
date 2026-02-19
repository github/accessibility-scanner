import type { Octokit } from '@octokit/core';
import type { Finding } from './types.d.js';
import { generateIssueBody } from "./generateIssueBody.js";
import * as url from 'node:url'
const URL = url.URL;

/** Max length for GitHub issue titles */
const GITHUB_ISSUE_TITLE_MAX_LENGTH = 256;

/**
 * Truncates text to a maximum length, adding an ellipsis if truncated.
 * @param text Original text
 * @param maxLength Maximum length of the returned text (including ellipsis)
 * @returns Either the original text or a truncated version with an ellipsis
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

export async function openIssue(octokit: Octokit, repoWithOwner: string, finding: Finding, screenshotRepo?: string) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];

  const labels = [`${finding.scannerType} rule: ${finding.ruleId}`, `${finding.scannerType}-scanning-issue`];
  const title = truncateWithEllipsis(
    `Accessibility issue: ${finding.problemShort[0].toUpperCase() + finding.problemShort.slice(1)} on ${new URL(finding.url).pathname}`,
    GITHUB_ISSUE_TITLE_MAX_LENGTH,
  );

  const body = generateIssueBody(finding, screenshotRepo ?? repoWithOwner);

  return octokit.request(`POST /repos/${owner}/${repo}/issues`, {
    owner,
    repo,
    title,
    body,
    labels
  });
}
