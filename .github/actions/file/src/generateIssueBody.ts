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

  const acceptanceCriteria = `## Acceptance Criteria
- [ ] The specific violation reported in this issue is no longer reproducible.
- [ ] The fix MUST meet WCAG 2.1 guidelines OR the accessibility standards specified by the repository or organization.
- [ ] A test SHOULD be added to ensure this specific violation does not regress.
- [ ] This PR MUST NOT introduce any new accessibility issues or regressions.`

  const body = `## What
${describeWhat(finding)}

${screenshotSection ?? ''}
To fix this, ${finding.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}

${acceptanceCriteria}
`

  return body
}

function describeWhat(finding: Finding): string {
  const reason = `because ${finding.problemShort}. Learn more about why this was flagged by visiting ${finding.problemUrl}.`

  // Axe findings carry every element that failed the rule. List them all so the
  // issue reflects the full scope of the violation, not just one example node.
  if (finding.nodes && finding.nodes.length > 0) {
    const count = finding.nodes.length
    const subject = count === 1 ? 'an element' : `${count} elements`
    const elementList = finding.nodes
      .map(node => `- \`${node.html}\`${node.target ? ` (selector: \`${node.target}\`)` : ''}`)
      .join('\n')
    const heading = count === 1 ? 'The following element needs' : 'The following elements need'
    return `An accessibility scan flagged ${subject} on ${finding.url} ${reason}\n\n${heading} attention:\n\n${elementList}`
  }

  if (finding.html) {
    return `An accessibility scan flagged the element \`${finding.html}\` ${reason}`
  }

  return `An accessibility scan found an issue on ${finding.url} ${reason}`
}
