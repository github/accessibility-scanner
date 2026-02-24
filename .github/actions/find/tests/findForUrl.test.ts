import {describe, it, expect, vi} from 'vitest'
import core from '@actions/core'
import {findForUrl} from '../src/findForUrl.js'
import AxeBuilder from '@axe-core/playwright'
import axe from 'axe-core'
import * as pluginManager from '../src/pluginManager.js'
import {clearCache} from '../src/scansContextProvider.js'

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
  return {default: AxeBuilderMock}
})

let actionInput: string = ''
let loadedPlugins: pluginManager.Plugin[] = []

function clearAll() {
  clearCache()
  vi.clearAllMocks()
}

describe('findForUrl', () => {
  vi.spyOn(core, 'getInput').mockImplementation(() => actionInput)
  vi.spyOn(pluginManager, 'loadPlugins').mockImplementation(() => Promise.resolve(loadedPlugins))

  async function axeOnlyTest() {
    clearAll()

    await findForUrl('test.com')
    expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
    expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(0)
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
        actionInput = JSON.stringify(['axe', 'custom-scan'])
        clearAll()

        await findForUrl('test.com')
        expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(1)
        expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the list does not include axe', () => {
      it('only runs plugins', async () => {
        actionInput = JSON.stringify(['custom-scan'])
        clearAll()

        await findForUrl('test.com')
        expect(AxeBuilder.prototype.analyze).toHaveBeenCalledTimes(0)
        expect(pluginManager.loadPlugins).toHaveBeenCalledTimes(1)
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
})
