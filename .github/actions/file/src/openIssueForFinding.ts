import type { Octokit } from '@octokit/core';
import type { Finding } from './types.d.js';
import * as url from 'node:url'
const URL = url.URL;

export async function openIssueForFinding(octokit: Octokit, repoWithOwner: string, finding: Finding) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];
  const issueNumber = finding.issueUrl?.split('/').pop();
  if (issueNumber) {
    // If an issue already exists, ensure it is open
    return octokit.request(`PATCH /repos/${owner}/${repo}/issues/${issueNumber}`, {
      owner,
      repo,
      issue_number: issueNumber,
      state: 'open'
    });
  } else {
    
    const labels = [`${finding.scannerType} rule: ${finding.id}`, `${finding.scannerType}-scanning-issue`];

    // Otherwise, create a new issue
    const title = `Accessibility issue: ${finding.problemShort[0].toUpperCase() + finding.problemShort.slice(1)} on ${new URL(finding.url).pathname}`;
    const solutionLong = finding.solutionLong
      ?.split("\n")
      .map((line) =>
        !line.trim().startsWith("Fix any") &&
        !line.trim().startsWith("Fix all") &&
        line.trim() !== ""
          ? `- ${line}`
          : line
      )
      .join("\n");
    const body = `
An accessibility scan flagged the element \`${finding.html}\` on ${finding.url} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}
`;

    return octokit.request(`POST /repos/${owner}/${repo}/issues`, {
      owner,
      repo,
      title,
      body,
      labels
    });
  }
}