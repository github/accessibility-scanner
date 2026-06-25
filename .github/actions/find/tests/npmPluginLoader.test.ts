import {describe, it, expect, vi, beforeEach} from 'vitest'

import * as childProcess from 'child_process'
import * as core from '@actions/core'
import * as pluginManager from '../src/pluginManager/index.js'
import * as npmPluginLoader from '../src/pluginManager/npmPluginLoader.js'
import type {Plugin} from '../src/pluginManager/types.js'

vi.mock('child_process', {spy: true})
vi.mock('@actions/core', {spy: true})
vi.mock('../src/pluginManager/npmPluginLoader.js', {spy: true})

const ALLOWED = '@github/accessibility-scanner-alt-text-plugin'

describe('npmPluginLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  describe('installNpmPackage', () => {
    it('installs with --no-save and --ignore-scripts', () => {
      const execSpy = vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => Buffer.from(''))
      npmPluginLoader.installNpmPackage('some-pkg@1.0.0')
      expect(execSpy).toHaveBeenCalledWith('npm', ['install', 'some-pkg@1.0.0', '--no-save', '--ignore-scripts'], {
        stdio: 'inherit',
      })
    })
  })

  describe('loadPluginViaNpm', () => {
    it('pins the version in the install spec', async () => {
      const execSpy = vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => Buffer.from(''))
      await npmPluginLoader.loadPluginViaNpm({name: 'p', package: 'nonexistent-pkg-xyz', version: '2.3.4'})
      expect(execSpy).toHaveBeenCalledWith(
        'npm',
        ['install', 'nonexistent-pkg-xyz@2.3.4', '--no-save', '--ignore-scripts'],
        {stdio: 'inherit'},
      )
    })

    it('returns undefined and warns when loading fails', async () => {
      vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => Buffer.from(''))
      const warnSpy = vi.spyOn(core, 'warning').mockImplementation(() => {})
      const plugin = await npmPluginLoader.loadPluginViaNpm({name: 'p', package: 'nonexistent-pkg-xyz'})
      expect(plugin).toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})

describe('loadNpmPlugins', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    pluginManager.clearCache()
  })

  it('loads a plugin from a first-party package', async () => {
    vi.spyOn(npmPluginLoader, 'loadPluginViaNpm').mockResolvedValue({name: 'alt-text-scan', default: vi.fn()})
    await pluginManager.loadNpmPlugins([{name: 'alt-text-scan', package: ALLOWED}])
    expect(pluginManager.getPlugins().map(plugin => plugin.name)).toContain('alt-text-scan')
  })

  it('skips and warns when a package is not first-party', async () => {
    const loadSpy = vi.spyOn(npmPluginLoader, 'loadPluginViaNpm').mockResolvedValue(undefined)
    const warnSpy = vi.spyOn(core, 'warning').mockImplementation(() => {})
    await pluginManager.loadNpmPlugins([{name: 'evil', package: 'evil-pkg'}])
    expect(loadSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(pluginManager.getPlugins().length).toBe(0)
  })

  it('skips a package that does not export a valid plugin', async () => {
    vi.spyOn(npmPluginLoader, 'loadPluginViaNpm').mockResolvedValue({name: 'bad'} as unknown as Plugin)
    const warnSpy = vi.spyOn(core, 'warning').mockImplementation(() => {})
    await pluginManager.loadNpmPlugins([{name: 'bad', package: ALLOWED}])
    expect(warnSpy).toHaveBeenCalled()
    expect(pluginManager.getPlugins().length).toBe(0)
  })

  it('skips an NPM plugin whose name collides with an already-loaded plugin', async () => {
    pluginManager.getPlugins().push({name: 'dup', default: vi.fn()})
    vi.spyOn(npmPluginLoader, 'loadPluginViaNpm').mockResolvedValue({name: 'dup', default: vi.fn()})
    await pluginManager.loadNpmPlugins([{name: 'dup', package: ALLOWED}])
    expect(pluginManager.getPlugins().filter(plugin => plugin.name === 'dup').length).toBe(1)
  })
})
