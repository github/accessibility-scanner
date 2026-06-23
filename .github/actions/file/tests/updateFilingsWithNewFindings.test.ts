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
