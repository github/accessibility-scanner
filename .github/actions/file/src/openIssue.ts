import type { Octokit } from '@octokit/core';
import type { Finding } from './types.d.js';
import * as url from 'node:url'
const URL = url.URL;

export async function openIssue(octokit: Octokit, repoWithOwner: string, finding: Finding) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];

  const labels = [`${finding.scannerType} rule: ${finding.ruleId}`, `${finding.scannerType}-scanning-issue`];
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
  const acceptanceCriteria = `## Acceptance Criteria
- [ ] The specific axe violation reported in this issue is no longer reproducible.
- [ ] The fix MUST meet WCAG 2.1 guidelines OR the accessibility standards specified by the repository or organization.
- [ ] A test SHOULD be added to ensure this specific axe violation does not regress.
- [ ] This PR MUST NOT introduce any new accessibility issues or regressions.
`;
  const body = `## What
An accessibility scan flagged the element \`${finding.html}\` on ${finding.url} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}

${acceptanceCriteria}
`;

  return octokit.request(`POST /repos/${owner}/${repo}/issues`, {
    owner,
    repo,
    title,
    body,
    labels
  });
}
