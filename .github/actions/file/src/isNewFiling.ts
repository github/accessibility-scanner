import type { Filing, NewFiling } from "./types.d.js";

export function isNewFiling(filing: Filing): filing is NewFiling {
  // A Filing without an issue is new
  return (
    (!("issue" in filing) || !filing.issue?.url) &&
    "findings" in filing &&
    filing.findings.length > 0
  );
}
