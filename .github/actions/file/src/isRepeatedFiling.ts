import type {Filing, RepeatedFiling} from './types.d.js'

export function isRepeatedFiling(filing: Filing): filing is RepeatedFiling {
  // A Filing with an issue and findings is a repeated filing
  return 'findings' in filing && filing.findings.length > 0 && 'issue' in filing && !!filing.issue?.url
}
