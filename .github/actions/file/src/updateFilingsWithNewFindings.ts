import type {Finding, ResolvedFiling, NewFiling, RepeatedFiling, Filing, GroupBy} from './types.d.js'

function getFilingKey(filing: ResolvedFiling | RepeatedFiling): string {
  return filing.issue.url
}

/**
 * Computes the dedup key for a finding based on the grouping mode.
 * - 'finding' (default): one filing per individual violation (URL + rule + element).
 * - 'rule': one filing per rule, aggregating every occurrence across all URLs.
 * - 'rule+url': one filing per rule per scanned URL.
 */
function getFindingKey(finding: Finding, groupBy: GroupBy): string {
  const rule = finding.ruleId ?? `${finding.scannerType};${finding.problemUrl}`

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
      // This finding already maps to an existing issue; append it to that filing
      ;(filingKeys[filingKey] as RepeatedFiling).findings.push(finding)
    } else if (newFilingKeys[key]) {
      // A new filing for this group already exists this run; append to it
      newFilingKeys[key].findings.push(finding)
    } else {
      // First occurrence of this group with no existing issue; start a new filing
      newFilingKeys[key] = {findings: [finding]}
    }
  }

  const updatedFilings = Object.values(filingKeys)
  return [...updatedFilings, ...Object.values(newFilingKeys)]
}
