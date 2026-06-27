import {describe, it, expect} from 'vitest'
import {updateFilingsWithNewFindings} from '../src/updateFilingsWithNewFindings.ts'
import type {Finding, RepeatedFiling} from '../src/types.d.ts'

const cachedFinding: Finding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/',
  html: '<span class="post-meta">old markup</span>',
  nodes: [{html: '<span class="post-meta">old markup</span>', target: 'span.post-meta'}],
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright',
  solutionShort: 'ensure the contrast meets WCAG thresholds',
}

const cachedFiling: RepeatedFiling = {
  issue: {
    id: 1,
    nodeId: 'node-1',
    url: 'https://github.com/org/repo/issues/1',
    title: 'Accessibility issue: color contrast on /',
  },
  findings: [cachedFinding],
}

describe('updateFilingsWithNewFindings', () => {
  it('re-matches an axe finding to its existing issue after the element HTML shifts', () => {
    // Same rule and page, but the element's markup shifted; should still map to issue #1.
    const shiftedFinding: Finding = {
      ...cachedFinding,
      html: '<span class="post-meta">old markup wrapped in a new container</span>',
      nodes: [
        {html: '<span class="post-meta">old markup wrapped in a new container</span>', target: 'div > span.post-meta'},
      ],
    }

    const result = updateFilingsWithNewFindings([cachedFiling], [shiftedFinding])

    expect(result).toHaveLength(1)
    const filing = result[0] as RepeatedFiling
    expect(filing.issue.url).toBe('https://github.com/org/repo/issues/1')
    expect(filing.findings).toHaveLength(1)
    expect(filing.findings[0].html).toContain('new container')
  })

  it('files a new issue when a different rule fails on the same page', () => {
    const differentRule: Finding = {
      ...cachedFinding,
      ruleId: 'image-alt',
      html: '<img src="logo.png">',
      nodes: [{html: '<img src="logo.png">', target: 'img'}],
    }

    const result = updateFilingsWithNewFindings([cachedFiling], [differentRule])

    expect(result).toHaveLength(2)
    const newFilings = result.filter(filing => filing.issue === undefined)
    expect(newFilings).toHaveLength(1)
    expect(newFilings[0].findings[0].ruleId).toBe('image-alt')
  })
})

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

  it("defaults to 'finding': axe findings collapse by rule and URL", () => {
    const result = updateFilingsWithNewFindings([], findings)
    // /a color-contrast (x2) share one filing; /b color-contrast is its own.
    expect(result).toHaveLength(2)
    const counts = result.map(f => f.findings.length).sort()
    expect(counts).toEqual([1, 2])
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

  it("'finding' (default) re-matches axe findings to a cached filing by rule and URL", () => {
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
    // Both /a color-contrast findings attach to issues/1; /b opens one new filing.
    expect(result).toHaveLength(2)
    const repeated = result.find(f => f.issue?.url === 'https://github.com/org/repo/issues/1')
    expect(repeated?.findings).toHaveLength(2)
  })
})
