import {describe, it, expect, vi, beforeEach} from 'vitest'

// Mock generateIssueBody so we can inspect what screenshotRepo is passed
vi.mock('../src/generateIssueBody.js', () => ({
  generateIssueBody: vi.fn((_finding, screenshotRepo: string) => `body with screenshotRepo=${screenshotRepo}`),
}))

import {reopenIssue} from '../src/reopenIssue.ts'
import {generateIssueBody} from '../src/generateIssueBody.ts'
import {Issue} from '../src/Issue.ts'

const baseFinding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/page',
  html: '<span>Low contrast</span>',
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright',
  solutionShort: 'ensure the contrast between foreground and background colors meets WCAG thresholds',
}

const testIssue = new Issue({
  id: 42,
  nodeId: 'MDU6SXNzdWU0Mg==',
  url: 'https://github.com/org/filing-repo/issues/7',
  title: 'Accessibility issue: test',
  state: 'closed',
})

function mockOctokit() {
  return {
    request: vi.fn().mockResolvedValue({data: {id: 42, html_url: 'https://github.com/org/filing-repo/issues/7'}}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('reopenIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes screenshotRepo to generateIssueBody when provided', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue, baseFinding, 'org/filing-repo', 'org/workflow-repo')

    expect(generateIssueBody).toHaveBeenCalledWith(baseFinding, 'org/workflow-repo')
  })

  it('falls back to repoWithOwner when screenshotRepo is not provided', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue, baseFinding, 'org/filing-repo')

    expect(generateIssueBody).toHaveBeenCalledWith(baseFinding, 'org/filing-repo')
  })

  it('does not generate a body when finding is not provided', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue)

    expect(generateIssueBody).not.toHaveBeenCalled()
    expect(octokit.request).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({body: expect.anything()}),
    )
  })

  it('does not generate a body when repoWithOwner is not provided', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue, baseFinding)

    expect(generateIssueBody).not.toHaveBeenCalled()
  })

  it('sends PATCH to the correct issue URL with state open', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue, baseFinding, 'org/filing-repo', 'org/workflow-repo')

    expect(octokit.request).toHaveBeenCalledWith(
      'PATCH /repos/org/filing-repo/issues/7',
      expect.objectContaining({
        state: 'open',
        issue_number: 7,
      }),
    )
  })

  it('includes generated body when finding and repoWithOwner are provided', async () => {
    const octokit = mockOctokit()
    await reopenIssue(octokit, testIssue, baseFinding, 'org/filing-repo', 'org/workflow-repo')

    expect(octokit.request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: 'body with screenshotRepo=org/workflow-repo',
      }),
    )
  })
})
