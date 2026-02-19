import type { Finding, ResolvedFiling, NewFiling, RepeatedFiling, Filing } from "./types.d.js";

function getFilingKey(filing: ResolvedFiling | RepeatedFiling): string {
  return filing.issue.url;
}

function getFindingKey(finding: Finding): string {
  return `${finding.url};${finding.ruleId};${finding.html}`;
}

export function updateFilingsWithNewFindings(
  filings: (ResolvedFiling | RepeatedFiling)[],
  findings: Finding[],
): Filing[] {
  const filingKeys: {
    [key: string]: ResolvedFiling | RepeatedFiling;
  } = {};
  const findingKeys: { [key: string]: string } = {};
  const newFilings: NewFiling[] = [];

  // Create maps for filing and finding data from previous runs, for quick lookups
  for (const filing of filings) {
    // Reset findings to empty array; we'll repopulate it as we find matches
    filingKeys[getFilingKey(filing)] = {
      issue: filing.issue,
      findings: [],
    };
    for (const finding of filing.findings) {
      findingKeys[getFindingKey(finding)] = getFilingKey(filing);
    }
  }

  for (const finding of findings) {
    const filingKey = findingKeys[getFindingKey(finding)];
    if (filingKey) {
      // This finding already has an associated filing; add it to that filing's findings
      (filingKeys[filingKey] as RepeatedFiling).findings.push(finding);
    } else {
      // This finding is new; create a new entry with no associated issue yet
      newFilings.push({ findings: [finding] });
    }
  }

  const updatedFilings = Object.values(filingKeys);
  return [...updatedFilings, ...newFilings];
}
