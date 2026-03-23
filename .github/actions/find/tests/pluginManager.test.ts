import {describe, it, expect, vi, beforeEach} from 'vitest'

import * as fs from 'fs'
import * as dynamicImportModule from '../src/dynamicImport.js'
import * as pluginManager from '../src/pluginManager.js'
import * as core from '@actions/core'

// - enable spying on fs
// https://vitest.dev/guide/browser/#limitations
vi.mock('fs', {spy: true})
vi.mock('../src/pluginManager.js', {spy: true})
vi.mock('@actions/core', {spy: true})

describe('loadPlugins', () => {
  let dynamicImportCallCount = 0
  vi.spyOn(dynamicImportModule, 'dynamicImport').mockImplementation(() => {
    dynamicImportCallCount++
    return Promise.resolve({name: `plugin-${dynamicImportCallCount}`, default: vi.fn()})
  })
  beforeEach(() => {
    dynamicImportCallCount = 0
    // @ts-expect-error - we don't need the full fs readdirsync
    // method signature here
    vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      return ['folder-a', 'folder-b']
    })
    vi.spyOn(fs, 'lstatSync').mockImplementation(() => {
      return {
        isDirectory: () => true,
      } as unknown as fs.Stats
    })
    vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
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
      const logSpy = vi.spyOn(core, 'error').mockImplementation(() => {})
      const plugins = await pluginManager.loadPlugins()
      expect(plugins.length).toBe(0)
      expect(logSpy).toHaveBeenCalledWith(pluginManager.abortError)
    })
  })

  describe('when built-in and custom plugins share the same name', () => {
    beforeEach(() => {
      // @ts-expect-error - we don't need the full fs readdirsync
      // method signature here
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        return ['reflow-scan']
      })
      vi.spyOn(dynamicImportModule, 'dynamicImport').mockImplementation(() => {
        return Promise.resolve({name: 'reflow-scan', default: vi.fn()})
      })
    })

    it('skips the duplicate and only loads the plugin once', async () => {
      pluginManager.clearCache()
      const infoSpy = vi.spyOn(core, 'info').mockImplementation(() => {})
      const plugins = await pluginManager.loadPlugins()
      expect(plugins.length).toBe(1)
      expect(plugins[0].name).toBe('reflow-scan')
      expect(infoSpy).toHaveBeenCalledWith('Skipping duplicate plugin: reflow-scan')
    })
  })
})
