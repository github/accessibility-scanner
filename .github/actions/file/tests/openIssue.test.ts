import {describe, it, expect, vi} from 'vitest'
import {createHash} from 'node:crypto'

// Mock generateIssueBody so we can inspect what screenshotRepo is passed
vi.mock('../src/generateIssueBody.js', () => ({
  generateIssueBody: vi.fn((_finding, screenshotRepo: string) => `body with screenshotRepo=${screenshotRepo}`),
}))

import {openIssue} from '../src/openIssue.ts'
import {generateIssueBody} from '../src/generateIssueBody.ts'

const baseFinding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/page',
  html: '<span>Low contrast</span>',
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright',
  solutionShort: 'ensure the contrast between foreground and background colors meets WCAG thresholds',
}

function mockOctokit() {
  return {
    request: vi.fn().mockResolvedValue({data: {id: 1, html_url: 'https://github.com/org/repo/issues/1'}}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('openIssue', () => {
  it('passes screenshotRepo to generateIssueBody when provided', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/filing-repo', [baseFinding], 'org/workflow-repo')

    expect(generateIssueBody).toHaveBeenCalledWith([baseFinding], 'org/workflow-repo')
  })

  it('falls back to repoWithOwner when screenshotRepo is not provided', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/filing-repo', [baseFinding])

    expect(generateIssueBody).toHaveBeenCalledWith([baseFinding], 'org/filing-repo')
  })

  it('posts to the correct filing repo, not the screenshot repo', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/filing-repo', [baseFinding], 'org/workflow-repo')

    expect(octokit.request).toHaveBeenCalledWith(
      'POST /repos/org/filing-repo/issues',
      expect.objectContaining({
        owner: 'org',
        repo: 'filing-repo',
      }),
    )
  })

  it('includes the correct labels based on the finding', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/repo', [baseFinding])

    expect(octokit.request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        labels: ['axe-scanning-issue', 'axe rule: color-contrast'],
      }),
    )
  })

  it('shortens long rule labels with a deterministic hash suffix', async () => {
    const octokit = mockOctokit()
    const ruleId = 'keyboard-accessible/scrollable-region-with-an-extra-long-description'
    const fullLabel = `axe rule: ${ruleId}`
    await openIssue(octokit, 'org/repo', [{...baseFinding, ruleId}])

    const labels = octokit.request.mock.calls[0][1].labels
    const ruleLabel = labels[1]
    const hash = createHash('sha256').update(fullLabel).digest('hex').slice(0, 4)

    expect(ruleLabel).toBe(`${fullLabel.slice(0, 45)}-${hash}`)
    expect(Array.from(ruleLabel)).toHaveLength(50)
  })

  it('produces distinct labels for different long rule IDs', async () => {
    const firstOctokit = mockOctokit()
    const secondOctokit = mockOctokit()
    const commonPrefix = 'keyboard-accessible/scrollable-region-with-a-long-description-'
    await openIssue(firstOctokit, 'org/repo', [{...baseFinding, ruleId: `${commonPrefix}first`}])
    await openIssue(secondOctokit, 'org/repo', [{...baseFinding, ruleId: `${commonPrefix}second`}])

    const firstLabel = firstOctokit.request.mock.calls[0][1].labels[1]
    const secondLabel = secondOctokit.request.mock.calls[0][1].labels[1]
    expect(firstLabel.slice(0, 45)).toBe(secondLabel.slice(0, 45))
    expect(firstLabel).not.toBe(secondLabel)
  })

  it('adds a category label for non-WCAG findings', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/repo', [{...baseFinding, category: 'best-practice'}])

    expect(octokit.request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        labels: ['axe-scanning-issue', 'axe rule: color-contrast', 'best-practice'],
      }),
    )
  })

  it('does not add a category label for WCAG findings', async () => {
    const octokit = mockOctokit()
    await openIssue(octokit, 'org/repo', [{...baseFinding, category: 'wcag'}])

    const labels = octokit.request.mock.calls[0][1].labels
    expect(labels).not.toContain('wcag')
    expect(labels).not.toContain('best-practice')
    expect(labels).not.toContain('experimental')
  })

  it('truncates long titles with ellipsis', async () => {
    const octokit = mockOctokit()
    const longFinding = {
      ...baseFinding,
      problemShort: 'a'.repeat(300),
    }
    await openIssue(octokit, 'org/repo', [longFinding])

    const callArgs = octokit.request.mock.calls[0][1]
    expect(callArgs.title.length).toBeLessThanOrEqual(256)
    expect(callArgs.title).toMatch(/…$/)
  })

  it('includes an occurrence count in the title when grouping multiple findings', async () => {
    const octokit = mockOctokit()
    const second = {...baseFinding, url: 'https://example.com/other', html: '<span>Another</span>'}
    await openIssue(octokit, 'org/repo', [baseFinding, second])

    const callArgs = octokit.request.mock.calls[0][1]
    expect(callArgs.title).toContain('(2 occurrences)')
    expect(generateIssueBody).toHaveBeenCalledWith([baseFinding, second], 'org/repo')
  })
})
