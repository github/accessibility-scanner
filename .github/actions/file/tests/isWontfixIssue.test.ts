import {describe, it, expect, vi, beforeEach} from 'vitest'

import {isWontfixIssue, WONTFIX_LABEL} from '../src/isWontfixIssue.ts'
import {Issue} from '../src/Issue.ts'

const testIssue = new Issue({
  id: 42,
  nodeId: 'MDU6SXNzdWU0Mg==',
  url: 'https://github.com/org/filing-repo/issues/7',
  title: 'Accessibility issue: test',
  state: 'closed',
})

function mockOctokit(labels: unknown) {
  return {
    request: vi.fn().mockResolvedValue({data: {labels}}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('isWontfixIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when the issue has the wontfix label (object form)', async () => {
    const octokit = mockOctokit([{name: 'bug'}, {name: WONTFIX_LABEL}])

    expect(await isWontfixIssue(octokit, testIssue)).toBe(true)
  })

  it('returns true when the issue has the wontfix label (string form)', async () => {
    const octokit = mockOctokit(['bug', WONTFIX_LABEL])

    expect(await isWontfixIssue(octokit, testIssue)).toBe(true)
  })

  it('returns false when the issue has no wontfix label', async () => {
    const octokit = mockOctokit([{name: 'bug'}])

    expect(await isWontfixIssue(octokit, testIssue)).toBe(false)
  })

  it('returns false when the issue has no labels', async () => {
    const octokit = mockOctokit(undefined)

    expect(await isWontfixIssue(octokit, testIssue)).toBe(false)
  })

  it('requests the issue at the correct URL', async () => {
    const octokit = mockOctokit([])

    await isWontfixIssue(octokit, testIssue)

    expect(octokit.request).toHaveBeenCalledWith(
      'GET /repos/org/filing-repo/issues/7',
      expect.objectContaining({issue_number: 7}),
    )
  })
})
