import type {Finding, ResolvedFiling, NewFiling, RepeatedFiling, Filing, ScanCompletionReport} from './types.d.js'
import type {GroupBy} from './groupBy.js'
import {isDeepStrictEqual} from 'node:util'

function sameOccurrence(a: Finding, b: Finding): boolean {
  const first = {...a}
  const second = {...b}
  delete first.screenshotId
  delete second.screenshotId
  return isDeepStrictEqual(first, second)
}

function getFilingKey(filing: ResolvedFiling | RepeatedFiling): string {
  return filing.issue.url
}

function getFindingKey(finding: Finding, groupBy: GroupBy): string {
  const rule = finding.ruleId
    ? `${finding.scannerType};${finding.ruleId}`
    : `${finding.scannerType};${finding.problemUrl}`

  switch (groupBy) {
    case 'rule':
      return rule
    case 'rule+url':
      return `${finding.url};${rule}`
    case 'finding':
    default:
      // Axe groups every failing element under one rule, so key on the rule, not the
      // element's HTML, which shifts with DOM changes and re-files tracked issues.
      if (finding.scannerType === 'axe' && finding.ruleId) {
        return `${finding.url};axe;${finding.ruleId}`
      }
      if (finding.ruleId && finding.html) {
        return `${finding.url};${finding.scannerType};${finding.ruleId};${finding.html}`
      }
      return `${finding.url};${finding.scannerType};${finding.problemUrl}`
  }
}

export function updateFilingsWithNewFindings(
  filings: (ResolvedFiling | RepeatedFiling)[],
  findings: Finding[],
  groupBy: GroupBy = 'finding',
  completion?: ScanCompletionReport,
): Filing[] {
  const filingKeys: {
    [key: string]: ResolvedFiling | RepeatedFiling
  } = {}
  const findingKeys: {[key: string]: string} = {}
  const newFilingKeys: {[key: string]: NewFiling} = {}
  const currentFindings = new Set(findings)

  // Create maps for filing and finding data from previous runs, for quick lookups
  for (const filing of filings) {
    // Retain findings unless their exact requested URL and scanner completed.
    filingKeys[getFilingKey(filing)] = {
      issue: filing.issue,
      findings: filing.findings.filter(finding => {
        if (!finding.originalUrl || completion?.schemaVersion !== 1) return true
        const scans = completion.scans.filter(
          scan => scan.requestedUrl === finding.originalUrl && scan.scanner === finding.scannerType,
        )
        return (
          scans.length === 0 ||
          scans.some(scan => scan.status !== 'completed') ||
          completion.failures.some(
            failure =>
              failure.requestedUrl === finding.originalUrl &&
              (!failure.scanner || failure.scanner === finding.scannerType),
          )
        )
      }),
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
      const current = (filingKeys[filingKey] as RepeatedFiling).findings
      const duplicate = current.findIndex(cached => !currentFindings.has(cached) && sameOccurrence(cached, finding))
      if (duplicate !== -1) current.splice(duplicate, 1)
      current.push(finding)
    } else if (newFilingKeys[key]) {
      newFilingKeys[key].findings.push(finding)
    } else {
      newFilingKeys[key] = {findings: [finding]}
    }
  }

  const updatedFilings = Object.values(filingKeys)
  return [...updatedFilings, ...Object.values(newFilingKeys)]
}
