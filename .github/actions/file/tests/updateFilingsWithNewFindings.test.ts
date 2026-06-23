import {describe, it, expect} from 'vitest'
import {updateFilingsWithNewFindings} from '../src/updateFilingsWithNewFindings.ts'

const colorContrastFinding = (url: string, html: string) => ({
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url,
  html,
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  solutionShort: 'ensure sufficient contrast',
})

describe('updateFilingsWithNewFindings — group_by', () => {
  const findings = [
    colorContrastFinding('https://example.com/a', '<span>1</span>'),
    colorContrastFinding('https://example.com/a', '<span>2</span>'),
    colorContrastFinding('https://example.com/b', '<span>3</span>'),
  ]

  it("defaults to 'finding': one filing per individual violation", () => {
    const result = updateFilingsWithNewFindings([], findings)
    expect(result).toHaveLength(3)
    for (const filing of result) expect(filing.findings).toHaveLength(1)
  })

  it("'rule': collapses all occurrences of a rule into a single filing", () => {
    const result = updateFilingsWithNewFindings([], findings, 'rule')
    expect(result).toHaveLength(1)
    expect(result[0].findings).toHaveLength(3)
  })

  it("'rule+url': one filing per rule per URL", () => {
    const result = updateFilingsWithNewFindings([], findings, 'rule+url')
    expect(result).toHaveLength(2)
    const counts = result.map(f => f.findings.length).sort()
    expect(counts).toEqual([1, 2]) // 2 on /a, 1 on /b
  })

  it("'rule': appends new occurrences to an existing cached filing instead of opening a new issue", () => {
    const cached = [
      {
        issue: {
          id: 1,
          nodeId: 'N1',
          url: 'https://github.com/org/repo/issues/1',
          title: 'color-contrast',
        },
        findings: [colorContrastFinding('https://example.com/a', '<span>1</span>')],
      },
    ]
    const result = updateFilingsWithNewFindings(cached, findings, 'rule')
    // No brand-new filing; all three findings attach to the cached issue.
    expect(result).toHaveLength(1)
    expect(result[0].issue?.url).toBe('https://github.com/org/repo/issues/1')
    expect(result[0].findings).toHaveLength(3)
  })

  it("keeps distinct rules separate under 'rule'", () => {
    const mixed = [
      colorContrastFinding('https://example.com/a', '<span>1</span>'),
      {...colorContrastFinding('https://example.com/a', '<h3>x</h3>'), ruleId: 'heading-order'},
    ]
    const result = updateFilingsWithNewFindings([], mixed, 'rule')
    expect(result).toHaveLength(2)
  })

  it("'rule': does not merge findings from different scanners that share a ruleId", () => {
    const a = {
      ...colorContrastFinding('https://example.com/a', '<span>1</span>'),
      scannerType: 'axe',
      ruleId: 'duplicate-id',
    }
    const b = {
      ...colorContrastFinding('https://example.com/a', '<span>2</span>'),
      scannerType: 'reflow',
      ruleId: 'duplicate-id',
    }
    const result = updateFilingsWithNewFindings([], [a, b], 'rule')
    expect(result).toHaveLength(2)
  })

  it("'finding' (default) preserves the original 1:1 behavior with cached filings", () => {
    const cached = [
      {
        issue: {
          id: 1,
          nodeId: 'N1',
          url: 'https://github.com/org/repo/issues/1',
          title: 'color-contrast',
        },
        findings: [colorContrastFinding('https://example.com/a', '<span>1</span>')],
      },
    ]
    const result = updateFilingsWithNewFindings(cached, findings)
    // One repeated filing (issues/1) plus two brand-new filings.
    expect(result).toHaveLength(3)
    const repeated = result.find(f => f.issue?.url === 'https://github.com/org/repo/issues/1')
    expect(repeated?.findings).toHaveLength(1)
  })
})
