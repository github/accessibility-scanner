import {describe, it, expect, vi} from 'vitest'
import * as pluginManager from '../src/pluginManager.js'
import * as fs from 'fs'


// Mock generateIssueBody so we can inspect what screenshotRepo is passed
// vi.mock('../src/pluginManager.js', () => ({
//   loadPlugins,
//   loadBuiltInPlugins: vi.fn(() => Promise.resolve()),
//   loadCustomPlugins: vi.fn(() => Promise.resolve())
// }))

describe('loadPlugins', () => {
    vi.spyOn(pluginManager, 'importWrapper').mockImplementation(() => '')

    describe('when plugins are not loaded', () => {
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => ['plugin-1', 'plugin-2'])

      it('loads them', async () => {
        const plugins = await pluginManager.loadPlugins()
        expect(pluginManager.importWrapper).toHaveBeenCalledTimes(2)
        expect(plugins.length).toBe(2)
      })
    })

    // describe('when plugins are loaded', () => {
    //   it('theyre cached and not loaded again', async () => {

    //   })
    // })

})
