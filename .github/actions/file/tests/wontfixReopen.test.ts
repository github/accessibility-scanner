import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const openIssue = vi.fn()
const reopenIssue = vi.fn()
const closeIssue = vi.fn()
vi.mock('../src/openIssue.js', () => ({openIssue: (...args: unknown[]) => openIssue(...args)}))
vi.mock('../src/reopenIssue.js', () => ({reopenIssue: (...args: unknown[]) => reopenIssue(...args)}))
vi.mock('../src/closeIssue.js', () => ({closeIssue: (...args: unknown[]) => closeIssue(...args)}))

const inputs: Record<string, string> = {}
const infoLines: string[] = []
const warnLines: string[] = []
const outputs: Record<string, string> = {}
vi.mock('@actions/core', () => ({
  getInput: (name: string) => inputs[name] ?? '',
  getBooleanInput: (name: string) => (inputs[name] ?? 'false') === 'true',
  setOutput: (name: string, value: string) => {
    outputs[name] = value
  },
  info: (msg: string) => {
    infoLines.push(msg)
  },
  debug: () => {},
  warning: (msg: string) => {
    warnLines.push(msg)
  },
  setFailed: () => {},
}))

// Feed findings/cached filings in
const files: Record<string, string> = {}
vi.mock('node:fs', () => ({
  default: {
    readFileSync: (p: string) => files[p],
    writeFileSync: (p: string, data: string) => {
      files[p] = data
    },
  },
}))

// Stub Octokit: `request` serves the list of closed `wontfix` issues that
// getWontfixIssueNumbers fetches once up front.
const octokitRequest = vi.fn()
vi.mock('@octokit/core', () => ({
  Octokit: {
    plugin: () =>
      class {
        request = octokitRequest
      },
  },
}))
vi.mock('@octokit/plugin-throttling', () => ({throttling: {}}))

import runFileAction from '../src/index.ts'

const wontfixFinding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/page',
  html: '<span>Low contrast</span>',
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  solutionShort: 'ensure sufficient contrast',
}
const normalFinding = {...wontfixFinding, ruleId: 'heading-order', html: '<h3>Skipped</h3>'}

// Both cached filings' findings reappear this run, so both are repeated
const wontfixCached = {
  issue: {id: 1, nodeId: 'N1', url: 'https://github.com/org/repo/issues/1', title: 'wontfix'},
  findings: [wontfixFinding],
}
const normalCached = {
  issue: {id: 3, nodeId: 'N3', url: 'https://github.com/org/repo/issues/3', title: 'normal'},
  findings: [normalFinding],
}

function setup() {
  files['/tmp/findings.json'] = JSON.stringify([wontfixFinding, normalFinding])
  files['/tmp/cached.json'] = JSON.stringify([wontfixCached, normalCached])
  inputs.findings_file = '/tmp/findings.json'
  inputs.cached_filings_file = '/tmp/cached.json'
  inputs.repository = 'org/repo'
  inputs.token = 'fake-token'
  // Single up-front fetch: only issue 1 is closed and labeled wontfix
  octokitRequest.mockImplementation((route: string) =>
    route.includes('GET /repos/org/repo/issues') ? Promise.resolve({data: [{number: 1}]}) : Promise.resolve({data: {}}),
  )
}

describe('file action — wontfix label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    infoLines.length = 0
    warnLines.length = 0
    for (const k of Object.keys(inputs)) delete inputs[k]
    for (const k of Object.keys(outputs)) delete outputs[k]
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reopens the unlabeled issue but not the one labeled wontfix', async () => {
    setup()

    await runFileAction()

    expect(reopenIssue).toHaveBeenCalledTimes(1)
    const reopenedIssue = reopenIssue.mock.calls[0][1] as {url: string}
    expect(reopenedIssue.url).toBe('https://github.com/org/repo/issues/3')
    expect(openIssue).not.toHaveBeenCalled()
    expect(closeIssue).not.toHaveBeenCalled()
  })

  it('logs that it skipped the wontfix issue', async () => {
    setup()

    await runFileAction()

    expect(infoLines.join('\n')).toContain(
      "Skipping reopen of issue labeled 'wontfix': https://github.com/org/repo/issues/1",
    )
  })

  it('reopens as usual (and warns) when the label check fails', async () => {
    setup()
    // The up-front wontfix fetch fails (e.g. transient API error)
    octokitRequest.mockRejectedValue(new Error('boom'))

    await runFileAction()

    // Both repeated filings should still be reopened rather than aborting the run
    expect(reopenIssue).toHaveBeenCalledTimes(2)
    expect(warnLines.join('\n')).toContain("Could not fetch 'wontfix' issues")
  })

  it('does not reopen retained findings without current evidence', async () => {
    setup()
    files['/tmp/findings.json'] = JSON.stringify([])
    files['/tmp/cached.json'] = JSON.stringify([
      wontfixCached,
      {...normalCached, issue: {...normalCached.issue, state: 'open'}},
    ])
    await runFileAction()

    expect(reopenIssue).not.toHaveBeenCalled()
    expect(closeIssue).not.toHaveBeenCalled()
    const saved = JSON.parse(files[outputs.filings_file])
    expect(saved.find((f: {issue: {url: string}}) => f.issue.url === normalCached.issue.url).findings).toEqual([
      normalFinding,
    ])
    expect(JSON.parse(files[outputs.issues_file])).toEqual([])
  })

  it.each(['open', 'closed'])('updates only open grouped issues when completed portions resolve (%s)', async state => {
    setup()
    const a = {...normalFinding, originalUrl: 'https://example.com/a'}
    const b = {...normalFinding, originalUrl: 'https://example.com/b'}
    files['/tmp/findings.json'] = JSON.stringify([])
    files['/tmp/cached.json'] = JSON.stringify([{...normalCached, findings: [a, b]}])
    files['/tmp/completion.json'] = JSON.stringify({
      schemaVersion: 1,
      complete: false,
      scans: [{requestedUrl: a.originalUrl, scanner: 'axe', status: 'completed'}],
      failures: [],
    })
    inputs.completion_file = '/tmp/completion.json'
    octokitRequest.mockImplementation((route: string) => {
      if (route.includes('GET /repos/org/repo/issues?')) return Promise.resolve({data: []})
      if (route === 'GET /repos/org/repo/issues/3') return Promise.resolve({data: {state}})
      return Promise.resolve({data: []})
    })

    await runFileAction()

    expect(reopenIssue).not.toHaveBeenCalled()
    expect(octokitRequest.mock.calls.some(([route]) => route === 'PATCH /repos/org/repo/issues/3')).toBe(
      state === 'open',
    )
    const saved = JSON.parse(files[outputs.filings_file])
    expect(saved[0].findings).toEqual([b])
    expect(saved[0].issue.state).toBe(state)
    expect(JSON.parse(files[outputs.issues_file])).toEqual([])
  })
})
