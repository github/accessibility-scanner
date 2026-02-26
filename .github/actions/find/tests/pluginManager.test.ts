import {describe, it, expect, vi, beforeEach} from 'vitest'

import * as fs from 'fs'
import * as dynamicImportModule from '../src/dynamicImport.js'
import * as pluginManager from '../src/pluginManager.js'

// - enable spying on fs
// https://vitest.dev/guide/browser/#limitations
vi.mock('fs', {spy: true})
vi.mock('../src/pluginManager.js', {spy: true})

describe('loadPlugins', () => {
  vi.spyOn(dynamicImportModule, 'dynamicImport').mockImplementation(path => Promise.resolve(path))
  beforeEach(() => {
    // @ts-expect-error - we don't need the full fs readdirsync
    // method signature here
    vi.spyOn(fs, 'readdirSync').mockImplementation(readPath => {
      return [readPath + '/plugin-1', readPath + '/plugin-2']
    })
    vi.spyOn(fs, 'lstatSync').mockImplementation(() => {
      return {
        isDirectory: () => true,
      } as unknown as fs.Stats
    })
  })

  describe('when plugins are not loaded', () => {
    it('loads them', async () => {
      pluginManager.clearCache()
      const plugins = await pluginManager.loadPlugins()
      expect(dynamicImportModule.dynamicImport).toHaveBeenCalledTimes(4)
      expect(plugins.length).toBe(4)
    })
  })

  describe('when plugins are already loaded', () => {
    it('caches them and doesnt load them again', async () => {
      pluginManager.clearCache()
      await pluginManager.loadPlugins()
      await pluginManager.loadPlugins()
      expect(pluginManager.loadBuiltInPlugins).toHaveBeenCalledTimes(0)
      expect(pluginManager.loadCustomPlugins).toHaveBeenCalledTimes(0)
    })
  })

  describe('when there is an error loading plugins', () => {
    beforeEach(() => {
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('test error')
      })
    })

    it('Aborts loading all plugins', async () => {
      pluginManager.clearCache()
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const plugins = await pluginManager.loadPlugins()
      expect(plugins.length).toBe(0)
      expect(consoleLogSpy).toHaveBeenCalledWith(pluginManager.abortError)
    })
  })
})
