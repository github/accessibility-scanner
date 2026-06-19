import {describe, it, expect, vi} from 'vitest'
import * as core from '@actions/core'
import {findForUrl} from '../src/findForUrl.js'
import {AxeBuilder} from '@axe-core/playwright'
import axe from 'axe-core'
import * as pluginManager from '../src/pluginManager/index.js'
import type {Plugin} from '../src/pluginManager/types.js'
import {clearCache} from '../src/scansContextProvider.js'

vi.mock('@actions/core', {spy: true})
vi.mock('playwright', () => ({
  default: {
    chromium: {
      launch: () => ({
        newContext: () => ({
          newPage: () => ({
            pageUrl: '',
            goto: () => {},
            url: () => {},
          }),
          close: () => {},
        }),
        close: () => {},
      }),
    },
  },
}))

vi.mock('@axe-core/playwright', () => {
  const AxeBuilderMock = vi.fn()
  const rawFinding = {violations: []} as unknown as axe.AxeResults
  AxeBuilderMock.prototype.analyze = vi.fn(() => Promise.resolve(rawFinding))
  return {AxeBuilder: AxeBuilderMock}
})

let actionInput: string = ''
let loadedPlugins: Plugin[] = []

function clearAll() {
  clearCache()
  vi.clearAllMocks()
}

describe('findForUrl', () => {
  vi.spyOn(core, 'getInput').mockImplementation(() => actionInput)
  vi.spyOn(pluginManager, 'loadPlugins').mockImplementation(() => Promise.resolve(loadedPlugins))
  vi.spyOn(pluginManager, 'invokePlugin')

  async function axeOnlyTest() {
    clearAll()

    await findForUrl('test.com')
    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
    expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(0)
    expect(pluginManager.invokePlugin).toHaveBeenCalledTimes(0)
  }

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

        await findForUrl('test.com')
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

        await findForUrl('test.com')
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

      await findForUrl('test.com')
      expect(loadedPlugins[0].default).toHaveBeenCalledTimes(1)
      expect(loadedPlugins[1].default).toHaveBeenCalledTimes(0)
    })
  })

  describe('axe finding categorization', () => {
    function axeViolation(tags: string[]) {
      return {
        id: 'some-rule',
        help: 'Help',
        helpUrl: 'https://example.com',
        description: 'Description',
        tags,
        nodes: [{html: '<div></div>', failureSummary: 'summary'}],
      }
    }

    async function categoryFor(tags: string[]) {
      clearAll()
      actionInput = JSON.stringify(['axe'])
      vi.mocked(AxeBuilder.prototype.analyze).mockResolvedValueOnce({
        violations: [axeViolation(tags)],
      } as unknown as axe.AxeResults)

      const findings = await findForUrl('test.com')
      return findings[0].category
    }

    it('categorizes a violation with only wcag tags as wcag', async () => {
      expect(await categoryFor(['wcag2a', 'wcag111'])).toBe('wcag')
    })

    it('categorizes a violation with a best-practice tag as best-practice', async () => {
      expect(await categoryFor(['cat.semantics', 'best-practice'])).toBe('best-practice')
    })

    it('categorizes a violation with an experimental tag as experimental, even alongside wcag tags', async () => {
      expect(await categoryFor(['wcag2a', 'experimental'])).toBe('experimental')
    })
  })
})
