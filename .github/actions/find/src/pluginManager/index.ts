import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import * as core from '@actions/core'
import {loadPluginViaJsFile, loadPluginViaTsFile} from './pluginFileLoaders.js'
import {loadPluginViaNpm} from './pluginNpmLoader.js'
import type {NpmPluginRequest, Plugin, PluginDefaultParams} from './types.js'

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Built-in plugin names shipped with the scanner.
// Used to skip duplicates when loading custom plugins.
const BUILT_IN_PLUGINS = ['reflow-scan', 'test-js-file-plugin-load']

export const plugins: Plugin[] = []
// Required for unit tests.
export function getPlugins() {
  return plugins
}
let pluginsLoaded = false

export async function loadPlugins(npmPlugins: NpmPluginRequest[] = []) {
  try {
    if (!pluginsLoaded) {
      core.info('loading plugins')
      await loadBuiltInPlugins()
      await loadCustomPlugins()
      await loadNpmPlugins(npmPlugins)
    }
  } catch {
    plugins.length = 0
    core.error(abortError)
  } finally {
    pluginsLoaded = true
    return plugins
  }
}

export const abortError = `
There was an error while loading plugins.
Clearing all plugins and aborting custom plugin scans.
Please check the logs for hints as to what may have gone wrong.
`

export function clearCache() {
  pluginsLoaded = false
  plugins.length = 0
}

// exported for mocking/testing. not for actual use
export async function loadBuiltInPlugins() {
  core.info('Loading built-in plugins')

  const pluginsPath = path.join(__dirname, '../../../../scanner-plugins/')
  await loadPluginsFromPath({pluginsPath})
}

// export to be used for mocking/testing. not for actual use
export async function loadCustomPlugins() {
  core.info('Loading custom plugins')
  const pluginsPath = path.join(process.cwd(), '.github/scanner-plugins/')

  // - currently, the plugin manager will abort loading
  //   all plugins if there's an error
  // - the problem with this is that if a scanner user doesn't
  //   have custom plugins, they won't have a 'scanner-plugins' folder
  //   which will cause an error and abort loading all plugins, including built-in ones
  // - so for custom plugins, if the path doesn't exist, we can return early
  //   and not abort the loading of built-in plugins
  if (!fs.existsSync(pluginsPath)) {
    core.info('No custom plugins found.')
    return
  }

  await loadPluginsFromPath({pluginsPath, skipBuiltInPlugins: BUILT_IN_PLUGINS})
}

// First-party packages allowed to be installed and loaded from NPM.
const FIRST_PARTY_NPM_PLUGINS = ['@github/accessibility-scanner-alt-text-plugin']

// exported for mocking/testing. not for actual use
export async function loadNpmPlugins(npmPlugins: NpmPluginRequest[]) {
  if (npmPlugins.length === 0) {
    return
  }
  core.info('Loading NPM plugins')

  for (const request of npmPlugins) {
    // Only install first-party packages.
    if (!FIRST_PARTY_NPM_PLUGINS.includes(request.package)) {
      core.warning(`Skipping NPM plugin '${request.package}' because it is not a first-party package`)
      continue
    }

    const plugin = await loadPluginViaNpm(request)
    if (!plugin) {
      continue
    }

    // Validate the package actually exports a usable plugin.
    if (typeof plugin.name !== 'string' || typeof plugin.default !== 'function') {
      core.warning(`Skipping NPM plugin '${request.package}' because it does not export a valid plugin`)
      continue
    }

    // Mismatch means the plugin would load but never run.
    if (plugin.name !== request.name) {
      core.warning(
        `Skipping NPM plugin '${request.package}' because it exported name '${plugin.name}', which does not match requested name '${request.name}'`,
      )
      continue
    }

    // Built-in and local plugins take precedence over NPM ones of the same name.
    if (plugins.some(existing => existing.name === plugin.name)) {
      core.info(`Skipping NPM plugin '${plugin.name}' because a plugin with that name is already loaded`)
      continue
    }

    core.info(`Found NPM plugin: ${plugin.name}`)
    plugins.push(plugin)
  }
}

// exported for mocking/testing. not for actual use
export async function loadPluginsFromPath({
  pluginsPath,
  skipBuiltInPlugins,
}: {
  pluginsPath: string
  skipBuiltInPlugins?: string[]
}) {
  try {
    const folders = fs.readdirSync(pluginsPath)
    for (const pluginFolder of folders) {
      const pluginFolderPath = path.join(pluginsPath, pluginFolder)

      if (fs.existsSync(pluginFolderPath) && fs.lstatSync(pluginFolderPath).isDirectory()) {
        let plugin = await loadPluginViaTsFile(pluginFolderPath)

        if (!plugin) {
          plugin = await loadPluginViaJsFile(pluginFolderPath)
        }

        if (!plugin) {
          core.info(`Skipping plugin without index.ts or index.js file: ${pluginFolder}`)
          continue
        }

        if (skipBuiltInPlugins?.includes(plugin.name)) {
          core.info(`Skipping built-in plugin: ${plugin.name}`)
          continue
        }

        core.info(`Found plugin: ${plugin.name}`)
        plugins.push(plugin)
      }
    }
  } catch (e) {
    // - log errors here for granular info
    core.error('error: ')
    core.error(e as Error)
    // - throw error to handle aborting the plugin scans
    throw e
  }
}

type InvokePluginParams = PluginDefaultParams & {
  plugin: Plugin
}
export function invokePlugin({plugin, page, addFinding}: InvokePluginParams) {
  return plugin.default({page, addFinding})
}
