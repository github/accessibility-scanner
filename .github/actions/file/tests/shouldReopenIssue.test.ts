import {describe, it, expect, vi, beforeEach} from 'vitest'

import {getWontfixIssueNumbers, shouldReopenIssue, WONTFIX_LABEL} from '../src/shouldReopenIssue.ts'
import {Issue} from '../src/Issue.ts'

function issueAt(issueNumber: number): Issue {
  return new Issue({
    id: issueNumber,
    nodeId: `node-${issueNumber}`,
    url: `https://github.com/org/filing-repo/issues/${issueNumber}`,
    title: `Accessibility issue ${issueNumber}`,
    state: 'closed',
  })
}

// `pages` is consumed one response per request call, in order.
function mockOctokit(pages: Array<Array<{number: number; pull_request?: unknown}>>) {
  const request = vi.fn()
  for (const page of pages) {
    request.mockResolvedValueOnce({data: page})
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {request} as any
}

describe('getWontfixIssueNumbers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the numbers of closed wontfix issues as a set', async () => {
    const octokit = mockOctokit([[{number: 1}, {number: 5}, {number: 9}]])

    const result = await getWontfixIssueNumbers(octokit, {owner: 'org', repository: 'repo'})

    expect(result).toEqual(new Set([1, 5, 9]))
  })

  it('requests closed issues filtered by the wontfix label', async () => {
    const octokit = mockOctokit([[]])

    await getWontfixIssueNumbers(octokit, {owner: 'org', repository: 'repo'})

    expect(octokit.request).toHaveBeenCalledWith(
      'GET /repos/org/repo/issues',
      expect.objectContaining({state: 'closed', labels: WONTFIX_LABEL}),
    )
  })

  it('returns an empty set when no issues are labeled wontfix', async () => {
    const octokit = mockOctokit([[]])

    const result = await getWontfixIssueNumbers(octokit, {owner: 'org', repository: 'repo'})

    expect(result.size).toBe(0)
  })

  it('paginates until a short page is returned', async () => {
    const firstPage = Array.from({length: 100}, (_, i) => ({number: i + 1}))
    const octokit = mockOctokit([firstPage, [{number: 101}]])

    const result = await getWontfixIssueNumbers(octokit, {owner: 'org', repository: 'repo'})

    expect(octokit.request).toHaveBeenCalledTimes(2)
    expect(result.has(1)).toBe(true)
    expect(result.has(101)).toBe(true)
  })

  it('ignores pull requests returned by the issues endpoint', async () => {
    const octokit = mockOctokit([[{number: 2}, {number: 3, pull_request: {url: 'https://example.com/pull/3'}}]])

    const result = await getWontfixIssueNumbers(octokit, {owner: 'org', repository: 'repo'})

    expect(result).toEqual(new Set([2]))
  })
})

describe('shouldReopenIssue', () => {
  it('returns false when the issue is in the wontfix set', () => {
    expect(shouldReopenIssue(issueAt(7), new Set([7]))).toBe(false)
  })

  it('returns true when the issue is not in the wontfix set', () => {
    expect(shouldReopenIssue(issueAt(7), new Set([1, 2, 3]))).toBe(true)
  })

  it('returns true when the wontfix set is empty', () => {
    expect(shouldReopenIssue(issueAt(7), new Set())).toBe(true)
  })
})
