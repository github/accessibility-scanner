import {describe, it, expect, vi, beforeEach} from 'vitest'

import * as fs from 'fs'
import * as esbuild from 'esbuild'
import * as dynamicImportModule from '../src/dynamicImport.js'
import * as pluginManager from '../src/pluginManager'
import * as core from '@actions/core'
import * as pluginLoaders from '../src/pluginManager/pluginFileLoaders.js'

// - enable spying on fs
// https://vitest.dev/guide/browser/#limitations
vi.mock('fs', {spy: true})
vi.mock('esbuild', {spy: true})
vi.mock('../src/pluginManager', {spy: true})
vi.mock('@actions/core', {spy: true})

describe('pluginManager', () => {
  describe('loadPlugins', () => {
    let dynamicImportCallCount = 0
    vi.spyOn(dynamicImportModule, 'dynamicImport').mockImplementation(() => {
      dynamicImportCallCount++
      return Promise.resolve({name: `plugin-${dynamicImportCallCount}`, default: vi.fn()})
    })
    beforeEach(() => {
      dynamicImportCallCount = 0
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
  })

  describe('loadPluginsFromPath', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    function sharedSetup() {
      vi.spyOn(core, 'info').mockImplementation(() => {})
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        return ['folder-a']
      })
      vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
      vi.spyOn(fs, 'lstatSync').mockImplementation(() => {
        return {
          isDirectory: () => true,
        } as unknown as fs.Stats
      })
    }

    describe('when a plugin folder does not have index.ts or index.js file', () => {
      it('skips the plugin', async () => {
        sharedSetup()
        vi.spyOn(pluginLoaders, 'loadPluginViaTsFile').mockImplementation(() => Promise.resolve(undefined))
        vi.spyOn(pluginLoaders, 'loadPluginViaJsFile').mockImplementation(() => Promise.resolve(undefined))

        pluginManager.clearCache()
        await pluginManager.loadPluginsFromPath({ pluginsPath: 'fake-path' })

        expect(pluginManager.getPlugins().length).toBe(0)
        expect(pluginLoaders.loadPluginViaJsFile).toHaveBeenCalledOnce();
        expect(pluginLoaders.loadPluginViaTsFile).toHaveBeenCalledOnce();
        expect(core.info.mock.calls[0][0]).toBe('Skipping plugin without index.ts or index.js file: folder-a')
      })
    })

    describe('when a plugin folder has an index.ts file', () => {
      it('loads the plugin via the ts file loader', async () => {
        sharedSetup()
        pluginManager.clearCache()

        vi.spyOn(pluginLoaders, 'loadPluginViaTsFile').mockImplementation(() => Promise.resolve({name: 'test-plugin', default: vi.fn()}))
        vi.spyOn(pluginLoaders, 'loadPluginViaJsFile').mockImplementation(() => Promise.resolve(undefined))

        await pluginManager.loadPluginsFromPath({ pluginsPath: 'fake-path' })

        expect(pluginManager.getPlugins().length).toBe(1)
        expect(pluginLoaders.loadPluginViaJsFile).not.toHaveBeenCalled();
        expect(pluginLoaders.loadPluginViaTsFile).toHaveBeenCalledOnce();
        expect(core.info.mock.calls[0][0]).toBe('Found plugin: test-plugin')
      })
    })

    describe('when a plugin folder has an index.js file only', () => {
      it('loads the plugin via the js file loader', async () => {
        sharedSetup()
        pluginManager.clearCache()

        vi.spyOn(pluginLoaders, 'loadPluginViaTsFile').mockImplementation(() => Promise.resolve(undefined))
        vi.spyOn(pluginLoaders, 'loadPluginViaJsFile').mockImplementation(() => Promise.resolve({name: 'test-plugin', default: vi.fn()}))

        await pluginManager.loadPluginsFromPath({ pluginsPath: 'fake-path' })

        expect(pluginManager.getPlugins().length).toBe(1)
        expect(pluginLoaders.loadPluginViaJsFile).toHaveBeenCalledOnce();
        expect(pluginLoaders.loadPluginViaTsFile).toHaveBeenCalledOnce();
        expect(core.info.mock.calls[0][0]).toBe('Found plugin: test-plugin')
      })
    })
  })

})
