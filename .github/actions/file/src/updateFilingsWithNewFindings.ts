import type {Finding, ResolvedFiling, NewFiling, RepeatedFiling, Filing, GroupBy} from './types.d.js'

function getFilingKey(filing: ResolvedFiling | RepeatedFiling): string {
  return filing.issue.url
}

function getFindingKey(finding: Finding, groupBy: GroupBy): string {
  const rule = finding.ruleId ? `${finding.scannerType};${finding.ruleId}` : `${finding.scannerType};${finding.problemUrl}`

  switch (groupBy) {
    case 'rule':
      return rule
    case 'rule+url':
      return `${finding.url};${rule}`
    case 'finding':
    default:
      if (finding.ruleId && finding.html) {
        return `${finding.url};${finding.ruleId};${finding.html}`
      }
      return `${finding.url};${finding.scannerType};${finding.problemUrl}`
  }
}

export function updateFilingsWithNewFindings(
  filings: (ResolvedFiling | RepeatedFiling)[],
  findings: Finding[],
  groupBy: GroupBy = 'finding',
): Filing[] {
  const filingKeys: {
    [key: string]: ResolvedFiling | RepeatedFiling
  } = {}
  const findingKeys: {[key: string]: string} = {}
  const newFilingKeys: {[key: string]: NewFiling} = {}

  // Create maps for filing and finding data from previous runs, for quick lookups
  for (const filing of filings) {
    // Reset findings to empty array; we'll repopulate it as we find matches
    filingKeys[getFilingKey(filing)] = {
      issue: filing.issue,
      findings: [],
    }
    for (const finding of filing.findings) {
      findingKeys[getFindingKey(finding, groupBy)] = getFilingKey(filing)
    }
  }

  for (const finding of findings) {
    const key = getFindingKey(finding, groupBy)
    const filingKey = findingKeys[key]
    if (filingKey) {
      // This finding already has an associated filing; add it to that filing's findings
      ;(filingKeys[filingKey] as RepeatedFiling).findings.push(finding)
    } else if (newFilingKeys[key]) {
      newFilingKeys[key].findings.push(finding)
    } else {
      newFilingKeys[key] = {findings: [finding]}
    }
  }

  const updatedFilings = Object.values(filingKeys)
  return [...updatedFilings, ...Object.values(newFilingKeys)]
}
