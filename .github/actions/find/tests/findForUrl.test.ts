import {describe, it, expect, vi} from 'vitest'
import * as core from '@actions/core'
import {findForUrl} from '../src/findForUrl.js'
import {AxeBuilder} from '@axe-core/playwright'
import axe from 'axe-core'
import * as pluginManager from '../src/pluginManager/index.js'
import type {Plugin} from '../src/pluginManager/types.js'
import {clearCache} from '../src/scansContextProvider.js'

const playwrightMocks = vi.hoisted(() => {
  const pageGoto = vi.fn()
  const locatorWaitFor = vi.fn()
  const pageLocator = vi.fn(() => ({
    waitFor: locatorWaitFor,
  }))
  const pageUrl = vi.fn()
  const contextClose = vi.fn()
  const browserClose = vi.fn()
  const contextNewPage = vi.fn(() => ({
    goto: pageGoto,
    locator: pageLocator,
    url: pageUrl,
  }))
  const browserNewContext = vi.fn(() => ({
    newPage: contextNewPage,
    close: contextClose,
  }))
  const browserLaunch = vi.fn(() => ({
    newContext: browserNewContext,
    close: browserClose,
  }))

  return {
    browserLaunch,
    browserNewContext,
    contextNewPage,
    pageGoto,
    pageLocator,
    locatorWaitFor,
    pageUrl,
    contextClose,
    browserClose,
  }
})

const pluginMocks = vi.hoisted(() => ({
  loadPlugins: vi.fn(),
  invokePlugin: vi.fn(),
}))

vi.mock('@actions/core', {spy: true})
vi.mock('playwright', () => ({
  default: {
    chromium: {
      launch: playwrightMocks.browserLaunch,
    },
  },
}))

vi.mock('@axe-core/playwright', () => {
  const AxeBuilderMock = vi.fn()
  const rawFinding = {violations: []} as unknown as axe.AxeResults
  AxeBuilderMock.prototype.analyze = vi.fn(() => Promise.resolve(rawFinding))
  return {AxeBuilder: AxeBuilderMock}
})
vi.mock('../src/pluginManager/index.js', () => pluginMocks)

let actionInput: string = ''
let loadedPlugins: Plugin[] = []

function clearAll() {
  clearCache()
  vi.clearAllMocks()
  playwrightMocks.pageGoto.mockResolvedValue(undefined)
  playwrightMocks.locatorWaitFor.mockResolvedValue(undefined)
  playwrightMocks.pageUrl.mockReturnValue('test.com')
}

describe('findForUrl', () => {
  vi.spyOn(core, 'getInput').mockImplementation(() => actionInput)
  vi.mocked(pluginManager.loadPlugins).mockImplementation(() => Promise.resolve(loadedPlugins))
  vi.mocked(pluginManager.invokePlugin).mockImplementation(({plugin, page, addFinding}) =>
    plugin.default({page, addFinding}),
  )

  async function axeOnlyTest() {
    clearAll()

    await findForUrl({url: 'test.com'})
    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
    expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(0)
    expect(pluginManager.invokePlugin).toHaveBeenCalledTimes(0)
  }

  describe('page load handling', () => {
    it('uses the default navigation readiness when no selectors are configured', async () => {
      actionInput = ''
      clearAll()

      await findForUrl({url: 'test.com'})

      expect(playwrightMocks.pageGoto).toHaveBeenCalledWith('test.com')
      expect(playwrightMocks.pageLocator).not.toHaveBeenCalled()
      expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
    })

    it('waits for each configured selector after navigation and before scanning', async () => {
      actionInput = ''
      clearAll()

      await findForUrl({url: 'test.com', waitForSelectors: ['#app', '[data-ready]']})

      expect(playwrightMocks.pageLocator).toHaveBeenNthCalledWith(1, '#app')
      expect(playwrightMocks.pageLocator).toHaveBeenNthCalledWith(2, '[data-ready]')
      expect(playwrightMocks.locatorWaitFor).toHaveBeenNthCalledWith(1, {state: 'visible', timeout: 30000})
      expect(playwrightMocks.locatorWaitFor).toHaveBeenNthCalledWith(2, {state: 'visible', timeout: 30000})
      expect(playwrightMocks.pageGoto.mock.invocationCallOrder[0]).toBeLessThan(
        playwrightMocks.locatorWaitFor.mock.invocationCallOrder[0],
      )
      expect(playwrightMocks.locatorWaitFor.mock.invocationCallOrder[1]).toBeLessThan(
        AxeBuilder.prototype.analyze.mock.invocationCallOrder[0],
      )
    })

    it('does not scan when a configured selector times out', async () => {
      const timeoutError = new Error('Timeout 30000ms exceeded')
      actionInput = ''
      clearAll()
      playwrightMocks.locatorWaitFor.mockRejectedValueOnce(timeoutError)

      await expect(findForUrl({url: 'test.com', waitForSelectors: ['#app']})).rejects.toThrow(timeoutError)

      expect(AxeBuilder.prototype.analyze).not.toHaveBeenCalled()
    })
  })

  describe('when no scans list is provided', () => {
    it('defaults to running only axe scan', async () => {
      actionInput = ''
      await axeOnlyTest()
    })
  })

  describe('when a scans list is provided', () => {
    describe('and the list _only_ includes axe', () => {
      it('runs only the axe scan', async () => {
        actionInput = JSON.stringify(['axe'])
        await axeOnlyTest()
      })
    })

    describe('and the list includes axe and other scans', () => {
      it('runs axe and plugins', async () => {
        loadedPlugins = [
          {name: 'custom-scan-1', default: vi.fn()},
          {name: 'custom-scan-2', default: vi.fn()},
        ]

        actionInput = JSON.stringify(['axe', 'custom-scan-1'])
        clearAll()

        await findForUrl({url: 'test.com'})
        expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
        expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(1)
        expect(pluginManager.invokePlugin).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the list does not include axe', () => {
      it('only runs plugins', async () => {
        loadedPlugins = [
          {name: 'custom-scan-1', default: vi.fn()},
          {name: 'custom-scan-2', default: vi.fn()},
        ]

        actionInput = JSON.stringify(['custom-scan-1', 'custom-scan-2'])
        clearAll()

        await findForUrl({url: 'test.com'})
        expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(0)
        expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(1)
        expect(pluginManager.invokePlugin).toHaveBeenCalledTimes(2)
      })
    })

    it('should only run scans that are included in the list', async () => {
      loadedPlugins = [
        {name: 'custom-scan-1', default: vi.fn()},
        {name: 'custom-scan-2', default: vi.fn()},
      ]
      actionInput = JSON.stringify(['custom-scan-1'])
      clearAll()

      await findForUrl({url: 'test.com'})
      expect(loadedPlugins[0].default).toHaveBeenCalledTimes(1)
      expect(loadedPlugins[1].default).toHaveBeenCalledTimes(0)
    })
  })
})
