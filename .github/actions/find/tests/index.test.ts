import {beforeEach, describe, expect, it, vi} from 'vitest'
import * as core from '@actions/core'
import find from '../src/index.js'

const mocks = vi.hoisted(() => ({
  inputs: {} as Record<string, string>,
  findForUrlWithOutcome: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => mocks.inputs[name] ?? ''),
  getMultilineInput: vi.fn(() => []),
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  setOutput: vi.fn(),
}))

vi.mock('node:fs', () => ({
  default: {
    writeFileSync: mocks.writeFileSync,
  },
}))

vi.mock('../src/superviseUrl.js', () => ({
  superviseUrl: mocks.findForUrlWithOutcome,
}))

describe('url_configs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const name of Object.keys(mocks.inputs)) delete mocks.inputs[name]
    mocks.findForUrlWithOutcome.mockImplementation((urlConfig: {url: string}) =>
      Promise.resolve({
        findings: [],
        scans: [
          {requestedUrl: urlConfig.url, scanner: 'axe', status: 'completed'},
          {requestedUrl: urlConfig.url, scanner: 'accesslint', status: 'skipped'},
        ],
        failures: [],
      }),
    )
  })

  it('passes waitForSelectors through to the URL scan', async () => {
    const urlConfig = {
      url: 'https://example.com',
      excludeSelectors: ['iframe'],
      waitForSelectors: ['#app', '[data-ready]'],
    }
    mocks.inputs.url_configs = JSON.stringify([urlConfig])
    mocks.inputs.include_screenshots = 'false'

    await find()

    expect(mocks.findForUrlWithOutcome).toHaveBeenCalledWith(
      urlConfig,
      expect.anything(),
      false,
      undefined,
      undefined,
      false,
      120000,
    )
    expect(core.setOutput).toHaveBeenCalledWith('scan_complete', 'true')
  })

  it.each(['0', '-1', '1.5', 'abc', '2147483648'])('rejects invalid URL deadline %s', async timeout => {
    mocks.inputs.url_configs = JSON.stringify([{url: 'https://example.com'}])
    mocks.inputs.url_timeout_ms = timeout
    await expect(find()).rejects.toThrow("Input 'url_timeout_ms' must be a positive integer")
    expect(mocks.findForUrlWithOutcome).not.toHaveBeenCalled()
  })

  it('passes the configured deadline to each URL scan', async () => {
    mocks.inputs.url_configs = JSON.stringify([{url: 'https://example.com'}])
    mocks.inputs.url_timeout_ms = '90000'
    await find()
    expect(mocks.findForUrlWithOutcome).toHaveBeenCalledWith(
      {url: 'https://example.com'},
      expect.anything(),
      true,
      undefined,
      undefined,
      false,
      90000,
    )
  })

  it('stops when an owned process tree cannot be recovered', async () => {
    mocks.inputs.url_configs = JSON.stringify([{url: 'https://one.example'}, {url: 'https://two.example'}])
    mocks.findForUrlWithOutcome.mockRejectedValueOnce(new Error('Cannot verify cleanup'))
    await expect(find()).rejects.toThrow('Cannot verify cleanup')
    expect(mocks.findForUrlWithOutcome).toHaveBeenCalledTimes(1)
  })

  it('rejects waitForSelectors values that are not arrays of strings', async () => {
    mocks.inputs.url_configs = JSON.stringify([{url: 'https://example.com', waitForSelectors: ['#app', 42]}])

    await expect(find()).rejects.toThrow(
      "Invalid 'url_configs' input: Each 'waitForSelectors' field in 'url_configs' must be an array of CSS selector strings.",
    )
    expect(mocks.findForUrlWithOutcome).not.toHaveBeenCalled()
  })

  it('writes findings and completion reports separately and exposes sanitized incomplete outcomes', async () => {
    const requestedUrl = 'https://example.com/private/path?token=secret'
    mocks.inputs.url_configs = JSON.stringify([{url: requestedUrl}])
    mocks.inputs.include_screenshots = 'false'
    mocks.findForUrlWithOutcome.mockResolvedValue({
      findings: [{scannerType: 'axe', url: 'https://example.com/final', originalUrl: requestedUrl}],
      scans: [
        {requestedUrl, scanner: 'axe', status: 'failed', stage: 'scan'},
        {requestedUrl, scanner: 'accesslint', status: 'not_started', stage: 'scan'},
      ],
      failures: [{requestedUrl, scanner: 'axe', status: 'failed', stage: 'scan'}],
    })

    await find()

    expect(core.setOutput).toHaveBeenCalledWith('scan_complete', 'false')
    const summary = vi.mocked(core.setOutput).mock.calls.find(([name]) => name === 'scan_summary')?.[1]
    expect(summary).toContain('example.com/axe (scan: failed)')
    expect(summary).not.toContain('/private/path')
    expect(summary).not.toContain('secret')
    const completionFile = vi.mocked(core.setOutput).mock.calls.find(([name]) => name === 'completion_file')?.[1]
    expect(completionFile).toEqual(expect.stringContaining('scan-completion-'))
    const serializedFiles = mocks.writeFileSync.mock.calls.map(([, contents]) => String(contents))
    expect(serializedFiles).toContain(
      JSON.stringify([{scannerType: 'axe', url: 'https://example.com/final', originalUrl: requestedUrl}]),
    )
    expect(serializedFiles.some(contents => contents.includes('"schemaVersion":1'))).toBe(true)
  })

  it('marks a run with no selected scanner incomplete', async () => {
    const urlConfig = {url: 'https://example.com'}
    mocks.inputs.url_configs = JSON.stringify([urlConfig])
    mocks.findForUrlWithOutcome.mockResolvedValue({
      findings: [],
      scans: [
        {requestedUrl: urlConfig.url, scanner: 'axe', status: 'skipped'},
        {requestedUrl: urlConfig.url, scanner: 'accesslint', status: 'skipped'},
      ],
      failures: [],
    })

    await find()

    expect(core.setOutput).toHaveBeenCalledWith('scan_complete', 'false')
    expect(core.setOutput).toHaveBeenCalledWith(
      'scan_summary',
      'Incomplete scan coverage: no accessibility scanner was selected.',
    )
  })
})
