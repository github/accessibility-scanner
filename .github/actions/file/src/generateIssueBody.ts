import type { Finding } from "./types.d.js";

export function generateIssueBody(finding: Finding, screenshotRepo: string): string {
  const solutionLong = finding.solutionLong
      ?.split("\n")
      .map((line: string) =>
        !line.trim().startsWith("Fix any") &&
        !line.trim().startsWith("Fix all") &&
        line.trim() !== ""
          ? `- ${line}`
          : line
      )
      .join("\n");

  let screenshotSection;
  if (finding.screenshotId) {
    const screenshotUrl = `https://github.com/${screenshotRepo}/blob/gh-cache/.screenshots/${finding.screenshotId}.png`;
    screenshotSection = `
[View screenshot](${screenshotUrl})
`;
  }

  const acceptanceCriteria = `## Acceptance Criteria
  - [ ] The specific axe violation reported in this issue is no longer reproducible.
  - [ ] The fix MUST meet WCAG 2.1 guidelines OR the accessibility standards specified by the repository or organization.
  - [ ] A test SHOULD be added to ensure this specific axe violation does not regress.
  - [ ] This PR MUST NOT introduce any new accessibility issues or regressions.
  `;

  const body = `## What
  An accessibility scan flagged the element \`${finding.html}\` on ${finding.url} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

  ${screenshotSection ?? ""}
  To fix this, ${finding.solutionShort}.
  ${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ""}

  ${acceptanceCriteria}
  `;

  return body;
}

