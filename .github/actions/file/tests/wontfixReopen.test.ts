import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const openIssue = vi.fn()
const reopenIssue = vi.fn()
const closeIssue = vi.fn()
vi.mock('../src/openIssue.js', () => ({openIssue: (...args: unknown[]) => openIssue(...args)}))
vi.mock('../src/reopenIssue.js', () => ({reopenIssue: (...args: unknown[]) => reopenIssue(...args)}))
vi.mock('../src/closeIssue.js', () => ({closeIssue: (...args: unknown[]) => closeIssue(...args)}))

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

// Stub Octokit: `request` serves the GET that isWontfixIssue makes
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
  // GET issue: issue 1 is labeled wontfix, issue 3 is not
  octokitRequest.mockImplementation((route: string) =>
    route.includes('/issues/1')
      ? Promise.resolve({data: {labels: [{name: 'wontfix'}]}})
      : Promise.resolve({data: {labels: []}}),
  )
}

describe('file action — wontfix label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    infoLines.length = 0
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
})
