import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {describe, expect, it} from 'vitest'

import {loadPluginViaNpm} from '../src/pluginManager/pluginNpmLoader.js'

const PLUGIN_ROOT = fileURLToPath(new URL('../src/pluginManager/', import.meta.url))

describe('npmPluginLoader integration', () => {
  it('installs and loads a released plugin outside the consumer workspace', {timeout: 120_000}, async () => {
    const originalCwd = process.cwd()
    const originalMinimumReleaseAge = process.env.npm_config_min_release_age
    const consumerWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'accessibility-scanner-consumer-'))

    try {
      process.chdir(consumerWorkspace)
      process.env.npm_config_min_release_age = '0'
      expect(process.cwd()).not.toBe(PLUGIN_ROOT)

      const plugin = await loadPluginViaNpm({
        name: 'alt-text-scan',
        package: '@github/accessibility-scanner-alt-text-plugin',
        version: '1.1.0',
      })

      expect(plugin?.name).toBe('alt-text-scan')
      expect(plugin?.default).toBeTypeOf('function')
      expect(
        fs.existsSync(
          path.join(PLUGIN_ROOT, 'node_modules', '@github', 'accessibility-scanner-alt-text-plugin', 'package.json'),
        ),
      ).toBe(true)
    } finally {
      process.chdir(originalCwd)
      if (originalMinimumReleaseAge === undefined) {
        delete process.env.npm_config_min_release_age
      } else {
        process.env.npm_config_min_release_age = originalMinimumReleaseAge
      }
      fs.rmSync(consumerWorkspace, {recursive: true, force: true})
    }
  })
})
