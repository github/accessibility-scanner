import {describe, it, expect, vi, beforeEach} from 'vitest'

import * as fs from 'fs'
import * as esbuild from 'esbuild'
import * as dynamicImportModule from '../src/dynamicImport.js'
import * as pluginManager from '../src/pluginManager.js'
import * as core from '@actions/core'

// - enable spying on fs
// https://vitest.dev/guide/browser/#limitations
vi.mock('fs', {spy: true})
vi.mock('esbuild', {spy: true})
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
    vi.spyOn(esbuild, 'build').mockResolvedValue({
      outputFiles: [{text: 'export const name = "compiled-plugin"; export default async function run() {}'}],
    } as unknown as esbuild.BuildResult)
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

  describe('when a custom plugin folder matches a built-in plugin name', () => {
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

    it('skips the built-in name in custom plugins and only loads it once', async () => {
      pluginManager.clearCache()
      const infoSpy = vi.spyOn(core, 'info').mockImplementation(() => {})
      const plugins = await pluginManager.loadPlugins()
      // Built-in loads it, custom skips the folder by name
      expect(plugins.length).toBe(1)
      expect(plugins[0].name).toBe('reflow-scan')
      expect(infoSpy).toHaveBeenCalledWith('Skipping built-in plugin: reflow-scan')
    })
  })

  describe('plugin entry resolution', () => {
    it('prefers index.ts over index.js when both exist', async () => {
      pluginManager.clearCache()
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation(filePath => {
        const pathText = String(filePath)
        if (pathText.endsWith('/folder-a') || pathText.endsWith('/folder-b')) {
          return true
        }

        if (pathText.endsWith('/index.ts')) {
          return true
        }

        if (pathText.endsWith('/index.js')) {
          return true
        }

        return false
      })
      const dynamicImportSpy = vi.spyOn(dynamicImportModule, 'dynamicImport')
      const buildSpy = vi.spyOn(esbuild, 'build')
      const startingBuildCalls = buildSpy.mock.calls.length
      const startingDynamicImportCalls = dynamicImportSpy.mock.calls.length

      await pluginManager.loadPluginsFromPath({pluginsPath: '/tmp/plugins'})

      expect(existsSyncSpy).toHaveBeenCalled()
      expect(buildSpy.mock.calls.length - startingBuildCalls).toBe(2)
      const newDynamicImportCalls = dynamicImportSpy.mock.calls.slice(startingDynamicImportCalls)
      expect(newDynamicImportCalls[0]?.[0]).toMatch(/^data:text\/javascript;base64,/)
      expect(newDynamicImportCalls[1]?.[0]).toMatch(/^data:text\/javascript;base64,/)
    })

    it('falls back to index.js when index.ts does not exist', async () => {
      pluginManager.clearCache()
      vi.spyOn(fs, 'existsSync').mockImplementation(filePath => {
        const pathText = String(filePath)
        if (pathText.endsWith('/folder-a') || pathText.endsWith('/folder-b')) {
          return true
        }

        if (pathText.endsWith('/index.ts')) {
          return false
        }

        if (pathText.endsWith('/index.js')) {
          return true
        }

        return false
      })
      const dynamicImportSpy = vi.spyOn(dynamicImportModule, 'dynamicImport')
      const buildSpy = vi.spyOn(esbuild, 'build')
      const startingBuildCalls = buildSpy.mock.calls.length
      const startingDynamicImportCalls = dynamicImportSpy.mock.calls.length

      await pluginManager.loadPluginsFromPath({pluginsPath: '/tmp/plugins'})

      expect(buildSpy.mock.calls.length - startingBuildCalls).toBe(0)
      const newDynamicImportCalls = dynamicImportSpy.mock.calls.slice(startingDynamicImportCalls)
      expect(newDynamicImportCalls.map(call => call[0])).toEqual([
        '/tmp/plugins/folder-a/index.js',
        '/tmp/plugins/folder-b/index.js',
      ])
    })
  })
})
