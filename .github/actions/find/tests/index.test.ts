import {beforeEach, describe, expect, it, vi} from 'vitest'
import find from '../src/index.js'

const mocks = vi.hoisted(() => ({
  inputs: {} as Record<string, string>,
  findForUrl: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => mocks.inputs[name] ?? ''),
  getMultilineInput: vi.fn(() => []),
  debug: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
}))

vi.mock('node:fs', () => ({
  default: {
    writeFileSync: mocks.writeFileSync,
  },
}))

vi.mock('../src/findForUrl.js', () => ({
  findForUrl: mocks.findForUrl,
}))

describe('url_configs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const name of Object.keys(mocks.inputs)) delete mocks.inputs[name]
    mocks.findForUrl.mockResolvedValue([])
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

    expect(mocks.findForUrl).toHaveBeenCalledWith(urlConfig, expect.anything(), false, undefined, undefined)
  })

  it('rejects waitForSelectors values that are not arrays of strings', async () => {
    mocks.inputs.url_configs = JSON.stringify([{url: 'https://example.com', waitForSelectors: ['#app', 42]}])

    await expect(find()).rejects.toThrow(
      "Invalid 'url_configs' input: Each 'waitForSelectors' field in 'url_configs' must be an array of CSS selector strings.",
    )
    expect(mocks.findForUrl).not.toHaveBeenCalled()
  })
})
