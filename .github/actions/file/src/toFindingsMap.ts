import type {Finding} from "./types.d.js";

export function toFindingsMap(findings: Finding[]): Map<string, Finding> {
  const map = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${finding.url};${finding.problemShort};${finding.html}`;
    map.set(key, finding);
  }
  return map;
}
