import type {Finding} from './types.d.js'

export function generateIssueBody(finding: Finding, screenshotRepo: string): string {
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

  const categoryNotice =
    finding.category && finding.category !== 'wcag'
      ? `> [!NOTE]\n> This is ${
          finding.category === 'experimental' ? 'an experimental check' : 'a best-practice recommendation'
        }, not a definite WCAG failure.\n\n`
      : ''

  const standardsLine =
    finding.category && finding.category !== 'wcag'
      ? '- [ ] The fix MUST meet the accessibility standards specified by the repository or organization (WCAG 2.2 if applicable).'
      : '- [ ] The fix MUST meet WCAG 2.2 guidelines OR the accessibility standards specified by the repository or organization.'

  const acceptanceCriteria = `## Acceptance Criteria
- [ ] The specific violation reported in this issue is no longer reproducible.
${standardsLine}
- [ ] A test SHOULD be added to ensure this specific violation does not regress.
- [ ] This PR MUST NOT introduce any new accessibility issues or regressions.`

  const body = `${categoryNotice}## What
An accessibility scan ${finding.html ? `flagged the element \`${finding.html}\`` : `found an issue on ${finding.url}`} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

${screenshotSection ?? ''}
To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}

${acceptanceCriteria}
`

  return body
}
