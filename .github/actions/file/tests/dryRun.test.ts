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
    expect(log).toMatch(/\[dry run] Would OPEN a new issue for: .*heading-order|Skipped|elements must meet/)
    expect(log).toContain('[dry run] Would REOPEN issue: https://github.com/org/repo/issues/1')
    expect(log).toContain('[dry run] Would CLOSE issue: https://github.com/org/repo/issues/2')
  })

  it('logs a summary line with counts', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    expect(infoLines.join('\n')).toMatch(/\[dry run] \d+ findings: 1 would open, 1 would reopen, 1 would close\./)
  })

  it('still writes the filings_file output in dry run', async () => {
    setup()
    inputs.dry_run = 'true'

    await runFileAction()

    expect(outputs.filings_file).toBeDefined()
  })

  it('does call the mutating helpers when dry_run is false (regression guard)', async () => {
    setup()
    inputs.dry_run = 'false'
    // helpers return a minimal Octokit-style response so index.ts can read response.data
    const resp = {data: {id: 9, node_id: 'N', number: 9, html_url: 'https://github.com/org/repo/issues/9', title: 't'}}
    openIssue.mockResolvedValue(resp)
    reopenIssue.mockResolvedValue(resp)
    closeIssue.mockResolvedValue(resp)

    await runFileAction()

    expect(openIssue).toHaveBeenCalled()
    expect(reopenIssue).toHaveBeenCalled()
    expect(closeIssue).toHaveBeenCalled()
  })
})
