import type {Finding} from './types.d.js'

export function generateIssueBody(findingOrFindings: Finding | Finding[], screenshotRepo: string): string {
  const findings = Array.isArray(findingOrFindings) ? findingOrFindings : [findingOrFindings]
  const finding = findings[0]

  const solutionLong = finding.solutionLong
    ?.split('\n')
    .map((line: string) =>
      !line.trim().startsWith('Fix any') && !line.trim().startsWith('Fix all') && line.trim() !== ''
        ? `- ${line}`
        : line,
    )
    .join('\n')

  let screenshotSection
  if (finding.screenshotId) {
    const screenshotUrl = `https://github.com/${screenshotRepo}/blob/gh-cache/.screenshots/${finding.screenshotId}.png`
    screenshotSection = `
[View screenshot](${screenshotUrl})
`
  }

  // When this issue groups multiple findings, list each occurrence as a checklist item.
  let occurrencesSection = ''
  if (findings.length > 1) {
    const items = findings.map(f => `- [ ] ${f.html ? `\`${f.html}\` on ${f.url}` : f.url}`).join('\n')
    occurrencesSection = `
## Occurrences (${findings.length})

${items}
`
  }

  const acceptanceCriteria = `## Acceptance Criteria
- [ ] The specific violation reported in this issue is no longer reproducible.
- [ ] The fix MUST meet WCAG 2.1 guidelines OR the accessibility standards specified by the repository or organization.
- [ ] A test SHOULD be added to ensure this specific violation does not regress.
- [ ] This PR MUST NOT introduce any new accessibility issues or regressions.`

  const body = `## What
An accessibility scan ${finding.html ? `flagged the element \`${finding.html}\`` : `found an issue on ${finding.url}`} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

${screenshotSection ?? ''}
To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}
${occurrencesSection}
${acceptanceCriteria}
`

  return body
}
