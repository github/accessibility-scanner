import type { Filing, ResolvedFiling } from "./types.d.js";

export function isResolvedFiling(filing: Filing): filing is ResolvedFiling {
  // A Filing without findings is resolved
  return (
    (!("findings" in filing) || filing.findings.length === 0) &&
    "issue" in filing &&
    !!filing.issue?.url
  );
}
