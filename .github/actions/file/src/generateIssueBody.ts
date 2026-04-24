import type {Finding} from './types.d.js'

/**
 * Determines if a finding is a WCAG violation or a best practice recommendation.
 */
function getRuleTypeLabel(ruleType?: string): { heading: string; badge: string; isWcag: boolean } {
  if (ruleType === 'best-practice') {
    return {
      heading: 'Best Practice Recommendation',
      badge: '\U0001F4A1 Best Practice',
      isWcag: false,
    }
  }
  if (ruleType === 'experimental') {
    return {
      heading: 'Experimental Rule',
      badge: '\U0001F9EA Experimental',
      isWcag: false,
    }
  }
  // Default to WCAG violation
  return {
    heading: 'WCAG Violation',
    badge: '\U0001F6A8 WCAG Violation',
    isWcag: true,
  }
}

export function generateIssueBody(finding: Finding, screenshotRepo: string): string {
  const ruleTypeLabel = getRuleTypeLabel(finding.ruleType)

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

  const ruleTypeSection = `> **Type:** ${ruleTypeLabel.badge}
>
> ${ruleTypeLabel.isWcag
    ? 'This is a **WCAG conformance failure**. Fixing this issue helps meet WCAG 2.1 accessibility requirements.'
    : 'This is a **best practice recommendation**, not a WCAG conformance failure. Fixing it improves accessibility but is not required for WCAG compliance.'
  }`

  const acceptanceCriteria = `## Acceptance Criteria
- [ ] The specific issue reported in this issue is no longer reproducible.
${ruleTypeLabel.isWcag
    ? '- [ ] The fix MUST meet WCAG 2.1 guidelines OR the accessibility standards specified by the repository or organization.'
    : '- [ ] The fix SHOULD follow recognized accessibility best practices to improve the user experience.'
  }
- [ ] A test SHOULD be added to ensure this specific issue does not regress.
- [ ] This PR MUST NOT introduce any new accessibility issues or regressions.`

  const body = `## ${ruleTypeLabel.heading}
An accessibility scan ${finding.html ? `flagged the element \`${finding.html}\`` : `found an issue on ${finding.url}`} because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.

${ruleTypeSection}

${screenshotSection ?? ''}
To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}

${acceptanceCriteria}
`

  return body
}
