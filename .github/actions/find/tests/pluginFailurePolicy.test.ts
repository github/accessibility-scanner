import {beforeEach, describe, expect, it, vi} from 'vitest'
import * as core from '@actions/core'
import fs from 'node:fs'
import {AxeBuilder} from '@axe-core/playwright'
import {accesslintAudit} from '@accesslint/playwright'
import find from '../src/index.js'
import {clearCache} from '../src/scansContextProvider.js'
import {generateScreenshots} from '../src/generateScreenshots.js'
import type {Plugin} from '../src/pluginManager/types.js'
import type {FindingInput} from '../src/types.d.js'

const mocks = vi.hoisted(() => {
  const page = {goto: vi.fn(), url: vi.fn(() => 'https://example.com')}
  const contextClose = vi.fn()
  const browserClose = vi.fn()
  const newPage = vi.fn(() => page)
  return {
    inputs: {} as Record<string, string>,
    plugins: [] as Plugin[],
    loadPlugins: vi.fn(),
    invokePlugin: vi.fn(),
    page,
    contextClose,
    browserClose,
    newPage,
    launch: vi.fn(() => ({
      newContext: vi.fn(() => ({newPage, close: contextClose})),
      close: browserClose,
    })),
  }
})

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => mocks.inputs[name] ?? ''),
  getMultilineInput: vi.fn(() => []),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  setOutput: vi.fn(),
}))
vi.mock('node:fs', {spy: true})
vi.mock('playwright', () => ({default: {chromium: {launch: mocks.launch}}}))
vi.mock('../src/pluginManager/index.js', () => ({
  loadPlugins: mocks.loadPlugins,
  invokePlugin: mocks.invokePlugin,
}))
vi.mock('@axe-core/playwright', () => {
  const builder = vi.fn()
  builder.prototype.analyze = vi.fn(async () => ({violations: []}))
  return {AxeBuilder: builder}
})
vi.mock('@accesslint/playwright', () => ({
  accesslintAudit: vi.fn(async () => ({violations: []})),
}))
vi.mock('../src/generateScreenshots.js', () => ({
  generateScreenshots: vi.fn(),
}))

const finding: FindingInput = {
  scannerType: 'custom',
  url: 'https://example.com',
  html: '<button></button>',
  problemShort: 'button needs a label',
  problemUrl: 'https://example.com/rules/label',
  ruleId: 'label',
  solutionShort: 'add a label',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearCache()
  for (const key of Object.keys(mocks.inputs)) delete mocks.inputs[key]
  mocks.inputs.url_configs = JSON.stringify([
    {url: 'https://example.com/first'},
    {url: 'https://example.com/second'},
    {url: 'https://example.com/third'},
  ])
  mocks.inputs.include_screenshots = 'false'
  mocks.plugins = []
  mocks.loadPlugins.mockImplementation(async () => mocks.plugins)
  mocks.invokePlugin.mockImplementation(({plugin, page, addFinding}) => plugin.default({page, addFinding}))
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
})

function expectNoPublication() {
  expect(fs.writeFileSync).not.toHaveBeenCalled()
  expect(core.setOutput).not.toHaveBeenCalled()
}

describe('plugin_failure_policy action entry point', () => {
  it.each(['', 'log-and-continue'])('preserves partial findings and subsequent URLs for policy %j', async policy => {
    mocks.inputs.plugin_failure_policy = policy
    mocks.inputs.scans = '["custom", "later", "axe", "accesslint"]'
    mocks.plugins = [
      {
        name: 'custom',
        default: vi.fn<Plugin['default']>(async ({addFinding}) => {
          await addFinding(finding)
          throw new Error('synthetic plugin failure')
        }),
      },
      {name: 'later', default: vi.fn()},
    ]

    await find()

    expect(mocks.newPage).toHaveBeenCalledTimes(3)
    expect(mocks.plugins[0].default).toHaveBeenCalledTimes(3)
    expect(mocks.plugins[1].default).not.toHaveBeenCalled()
    expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
    expect(accesslintAudit).not.toHaveBeenCalled()
    expect(core.error).toHaveBeenCalledTimes(3)
    expect(core.error).toHaveBeenCalledWith('Error during accessibility scan: Error: synthetic plugin failure')
    expect(fs.writeFileSync).toHaveBeenCalledOnce()
    const results = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    expect(results).toEqual(
      ['first', 'second', 'third'].map(suffix => ({
        ...finding,
        originalUrl: `https://example.com/${suffix}`,
      })),
    )
    expect(core.setOutput).toHaveBeenCalledWith('findings_file', expect.any(String))
    expect(mocks.contextClose).toHaveBeenCalledTimes(3)
    expect(mocks.browserClose).toHaveBeenCalledTimes(3)
  })

  it('aborts on a plugin rejection without publishing findings from any URL', async () => {
    const fault = new Error('synthetic plugin failure')
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.scans = '["custom", "later", "axe", "accesslint"]'
    mocks.plugins = [
      {
        name: 'custom',
        default: vi
          .fn<Plugin['default']>(async ({addFinding}) => {
            await addFinding(finding)
            throw fault
          })
          .mockImplementationOnce(async ({addFinding}) => {
            await addFinding(finding)
          }),
      },
      {name: 'later', default: vi.fn()},
    ]

    await expect(find()).rejects.toMatchObject({
      message:
        "Plugin failure while running plugin 'custom' on https://example.com/second: Error: synthetic plugin failure",
      cause: fault,
    })

    expect(mocks.newPage).toHaveBeenCalledTimes(2)
    expect(mocks.plugins[1].default).toHaveBeenCalledTimes(1)
    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
    expect(accesslintAudit).toHaveBeenCalledTimes(1)
    expect(core.error).toHaveBeenCalledWith(`Error during accessibility scan: ${fault}`)
    expect(mocks.contextClose).toHaveBeenCalledTimes(2)
    expect(mocks.browserClose).toHaveBeenCalledTimes(2)
    expectNoPublication()
  })

  it('aborts on a synchronous plugin throw', async () => {
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.scans = '["custom", "axe"]'
    mocks.plugins = [
      {
        name: 'custom',
        default: vi.fn(() => {
          throw new Error('synchronous fault')
        }),
      },
    ]

    await expect(find()).rejects.toThrow("Plugin failure while running plugin 'custom'")
    expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
    expect(mocks.browserClose).toHaveBeenCalledOnce()
    expectNoPublication()
  })

  it('aborts when a plugin propagates a finding callback failure', async () => {
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.include_screenshots = 'true'
    mocks.inputs.scans = '["custom", "axe"]'
    mocks.plugins = [{name: 'custom', default: vi.fn<Plugin['default']>(async ({addFinding}) => addFinding(finding))}]
    vi.mocked(generateScreenshots).mockRejectedValueOnce(new Error('screenshot fault'))

    await expect(find()).rejects.toThrow("Plugin failure while running plugin 'custom'")

    expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
    expect(mocks.browserClose).toHaveBeenCalledOnce()
    expectNoPublication()
  })

  it.each([
    ['built-in', '["built-in-check", "healthy", "axe", "accesslint"]'],
    ['local', '["local-check", "healthy", "axe", "accesslint"]'],
    ['NPM', '[{"name":"npm-check","package":"@example/plugin"}, "healthy", "axe", "accesslint"]'],
  ])('rejects an unavailable requested %s plugin before any scanning', async (_source, scans) => {
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.scans = scans
    mocks.plugins = [{name: 'healthy', default: vi.fn()}]

    await expect(find()).rejects.toThrow('Requested plugins are unavailable:')

    expect(mocks.invokePlugin).not.toHaveBeenCalled()
    expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
    expect(accesslintAudit).not.toHaveBeenCalled()
    expect(mocks.newPage).toHaveBeenCalledOnce()
    expect(mocks.contextClose).toHaveBeenCalledOnce()
    expect(mocks.browserClose).toHaveBeenCalledOnce()
    expectNoPublication()
  })

  it('keeps skipped/unavailable requested plugins compatible in continue mode', async () => {
    mocks.inputs.scans = '["unavailable", "axe"]'

    await find()

    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(3)
    expect(core.setOutput).toHaveBeenCalledOnce()
  })

  it.each(['log-and-continue', 'abort'])('handles plugin loader rejection in %s mode', async policy => {
    mocks.inputs.plugin_failure_policy = policy
    mocks.inputs.scans = '["custom", "axe"]'
    mocks.loadPlugins.mockRejectedValue(new Error('loader fault'))

    if (policy === 'abort') {
      await expect(find()).rejects.toThrow('Plugin failure while loading requested plugins')
      expect(mocks.newPage).toHaveBeenCalledOnce()
      expectNoPublication()
    } else {
      await find()
      expect(mocks.newPage).toHaveBeenCalledTimes(3)
      expect(core.setOutput).toHaveBeenCalledOnce()
    }
    expect(core.error).toHaveBeenCalledWith('Error during accessibility scan: Error: loader fault')
    expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
  })

  it('publishes healthy built-in/local/NPM plugin findings in abort mode', async () => {
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.scans =
      '["built-in-check","local-check",{"name":"npm-check","package":"@example/plugin"},"axe","accesslint"]'
    mocks.plugins = ['built-in-check', 'local-check', 'npm-check'].map(name => ({
      name,
      default: vi.fn<Plugin['default']>(async ({addFinding}) => addFinding(finding)),
    }))

    await find()

    expect(mocks.invokePlugin).toHaveBeenCalledTimes(9)
    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(3)
    expect(accesslintAudit).toHaveBeenCalledTimes(3)
    expect(core.setOutput).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)).toHaveLength(9)
  })

  it.each(['axe', 'accesslint'])('preserves %s failure handling even in abort mode', async engine => {
    mocks.inputs.plugin_failure_policy = 'abort'
    mocks.inputs.scans = JSON.stringify(['healthy', engine])
    mocks.plugins = [{name: 'healthy', default: vi.fn<Plugin['default']>(async ({addFinding}) => addFinding(finding))}]
    const fault = new Error('core engine fault')
    if (engine === 'axe') vi.mocked(AxeBuilder.prototype.analyze).mockRejectedValueOnce(fault)
    else vi.mocked(accesslintAudit).mockRejectedValueOnce(fault)

    await find()

    expect(mocks.newPage).toHaveBeenCalledTimes(3)
    expect(core.error).toHaveBeenCalledWith(`Error during accessibility scan: ${fault}`)
    expect(core.setOutput).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)).toHaveLength(3)
  })

  it.each(['continue', 'ABORT', 'invalid'])('rejects invalid value %j before scanning or publishing', async value => {
    mocks.inputs.plugin_failure_policy = value

    await expect(find()).rejects.toThrow("Input 'plugin_failure_policy' must be one of: 'log-and-continue', 'abort'.")

    expect(mocks.launch).not.toHaveBeenCalled()
    expectNoPublication()
  })

  it('declares the default on both actions and forwards the composite input to find', () => {
    const root = fs.readFileSync(new URL('../../../../action.yml', import.meta.url), 'utf8')
    const action = fs.readFileSync(new URL('../action.yml', import.meta.url), 'utf8')
    for (const metadata of [root, action]) {
      expect(metadata).toMatch(/  plugin_failure_policy:\n(?:    .*\n)*    default: 'log-and-continue'/)
    }
    expect(root).toContain('        plugin_failure_policy: ${{ inputs.plugin_failure_policy }}')
  })
})
