import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

// --- Mock the issue-mutating helpers so we can assert they are NEVER called in dry run ---
const openIssue = vi.fn()
const reopenIssue = vi.fn()
const closeIssue = vi.fn()
vi.mock('../src/openIssue.js', () => ({openIssue: (...args: unknown[]) => openIssue(...args)}))
vi.mock('../src/reopenIssue.js', () => ({reopenIssue: (...args: unknown[]) => reopenIssue(...args)}))
vi.mock('../src/closeIssue.js', () => ({closeIssue: (...args: unknown[]) => closeIssue(...args)}))

// --- Mock @actions/core: control inputs, capture logs/outputs ---
const inputs: Record<string, string> = {}
const infoLines: string[] = []
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
  warning: () => {},
  setFailed: () => {},
}))

// --- Mock fs: feed findings/cached filings in, swallow the output write ---
const files: Record<string, string> = {}
vi.mock('node:fs', () => ({
  default: {
    readFileSync: (p: string) => files[p],
    writeFileSync: (p: string, data: string) => {
      files[p] = data
    },
  },
}))

// --- Stub Octokit so constructing it in index.ts doesn't do anything real ---
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

const finding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/page',
  html: '<span>Low contrast</span>',
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  solutionShort: 'ensure sufficient contrast',
}

// A second finding with no matching cached filing -> NEW (open)
const newFinding = {...finding, ruleId: 'heading-order', html: '<h3>Skipped</h3>'}

// A cached filing whose finding matches `finding` -> REPEATED (reopen)
const repeatedCached = {
  issue: {id: 1, nodeId: 'N1', url: 'https://github.com/org/repo/issues/1', title: 'repeat'},
  findings: [finding],
}

// A cached filing with NO matching finding this run -> RESOLVED (close)
const resolvedCached = {
  issue: {id: 2, nodeId: 'N2', url: 'https://github.com/org/repo/issues/2', title: 'resolved'},
  findings: [{...finding, ruleId: 'landmark-one-main', html: '<div>old</div>'}],
}

function setup() {
  // findings file: includes `finding` (matches repeatedCached) and `newFinding` (brand new)
  files['/tmp/findings.json'] = JSON.stringify([finding, newFinding])
  // cached filings: one repeated, one resolved (its finding is absent from findings file)
  files['/tmp/cached.json'] = JSON.stringify([repeatedCached, resolvedCached])
  inputs.findings_file = '/tmp/findings.json'
  inputs.cached_filings_file = '/tmp/cached.json'
  inputs.repository = 'org/repo'
  inputs.token = 'fake-token'
}

describe('file action — dry_run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    infoLines.length = 0
    for (const k of Object.keys(inputs)) delete inputs[k]
    for (const k of Object.keys(outputs)) delete outputs[k]
    vi.spyOn(console, 'table').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not open, reopen, or close any issues when dry_run is true', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    expect(openIssue).not.toHaveBeenCalled()
    expect(reopenIssue).not.toHaveBeenCalled()
    expect(closeIssue).not.toHaveBeenCalled()
    expect(octokitRequest).not.toHaveBeenCalled()
  })

  it('logs the intended action for each filing type', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    const log = infoLines.join('\n')
    expect(log).toContain(
      '[dry run] Would OPEN a new issue for: elements must meet minimum color contrast ratio thresholds (https://example.com/page)',
    )
    expect(log).toContain('[dry run] Would REOPEN issue: https://github.com/org/repo/issues/1')
    expect(log).toContain('[dry run] Would CLOSE issue: https://github.com/org/repo/issues/2')
  })

  it('logs a summary table with counts', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    expect(vi.mocked(console.table)).toHaveBeenCalledWith(
      expect.objectContaining({open: 1, reopen: 1, close: 1, total: 3}),
    )
  })

  it('still writes the filings_file output in dry run', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    expect(outputs.filings_file).toBeDefined()
  })

  it('updates in-memory issue state for an accurate preview without mutating remotely', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    // The path written is `${RUNNER_TEMP||'/tmp'}/filings-<uuid>.json`; grab it from the output.
    const writtenPath = outputs.filings_file
    const writtenFilings = JSON.parse(files[writtenPath])

    // Resolved cached filing (issues/2) -> would be CLOSED
    const resolved = writtenFilings.find(
      (f: {issue?: {url?: string}}) => f.issue?.url === 'https://github.com/org/repo/issues/2',
    )
    expect(resolved?.issue.state).toBe('closed')

    // Repeated cached filing (issues/1) -> would be REOPENED
    const repeated = writtenFilings.find(
      (f: {issue?: {url?: string}}) => f.issue?.url === 'https://github.com/org/repo/issues/1',
    )
    expect(repeated?.issue.state).toBe('reopened')

    // New filing -> issue object created with state 'open'
    const opened = writtenFilings.find((f: {issue?: {state?: string}}) => f.issue?.state === 'open')
    expect(opened).toBeDefined()

    // And confirm we still didn't actually mutate anything remotely
    expect(openIssue).not.toHaveBeenCalled()
    expect(reopenIssue).not.toHaveBeenCalled()
    expect(closeIssue).not.toHaveBeenCalled()
  })

  it('does call the mutating helpers when dry_run is false (regression guard)', async () => {
    setup()
    inputs.dry_run = 'false'
    // helpers return a minimal Octokit-style response so index.ts can read response.data
    const resp = {data: {id: 9, node_id: 'N', number: 9, html_url: 'https://github.com/org/repo/issues/9', title: 't'}}
    openIssue.mockResolvedValue(resp)
    reopenIssue.mockResolvedValue(resp)
    closeIssue.mockResolvedValue(resp)
    // the wontfix-label check issues a GET before reopening; return no labels so the reopen proceeds
    octokitRequest.mockResolvedValue({data: {labels: []}})

    await runFileAction()

    expect(openIssue).toHaveBeenCalled()
    expect(reopenIssue).toHaveBeenCalled()
    expect(closeIssue).toHaveBeenCalled()
  })
})
