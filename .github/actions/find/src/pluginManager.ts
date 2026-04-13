import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import * as esbuild from 'esbuild'
import {dynamicImport} from './dynamicImport.js'
import type {Finding} from './types.d.js'
import playwright from 'playwright'
import * as core from '@actions/core'

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type PluginDefaultParams = {
  page: playwright.Page
  addFinding: (findingData: Finding) => Promise<void>
}

type Plugin = {
  name: string
  default: (options: PluginDefaultParams) => Promise<void>
}

// Built-in plugin names shipped with the scanner.
// Used to skip duplicates when loading custom plugins.
const BUILT_IN_PLUGINS = ['reflow-scan']

const plugins: Plugin[] = []
let pluginsLoaded = false

export async function loadPlugins() {
  try {
    if (!pluginsLoaded) {
      core.info('loading plugins')
      await loadBuiltInPlugins()
      await loadCustomPlugins()
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

  const pluginsPath = path.join(__dirname, '../../../scanner-plugins/')
  await loadPluginsFromPath({pluginsPath})
}

// exported for mocking/testing. not for actual use
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

// exported for mocking/testing. not for actual use
export async function loadPluginsFromPath({
  pluginsPath,
  skipBuiltInPlugins,
}: {
  pluginsPath: string
  skipBuiltInPlugins?: string[]
}) {
  try {
    const res = fs.readdirSync(pluginsPath)
    for (const pluginFolder of res) {
      const pluginFolderPath = path.join(pluginsPath, pluginFolder)

      if (fs.existsSync(pluginFolderPath) && fs.lstatSync(pluginFolderPath).isDirectory()) {
        let plugin = await loadPluginViaTsFile(pluginFolderPath)

        if (!plugin) {
          plugin = await loadPluginViaJsFile(pluginFolderPath)
        }

        if (!plugin) {
          core.info(`Skipping plugin folder without index.ts or index.js: ${pluginFolder}`)
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

async function loadPluginViaTsFile(pluginFolderPath: string) {
  const pluginEntryPath = path.join(pluginFolderPath, 'index.ts')
  if (!fs.existsSync(pluginEntryPath)) {
    core.info(`No index.ts found for plugin at path: ${pluginFolderPath}`)
    return
  }

  const esbuildResult = await esbuild.build({
    entryPoints: [pluginEntryPath],
    write: false,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: 'inline',
  })

  const outputFileContents = esbuildResult.outputFiles[0]?.text
  if (!outputFileContents) {
    core.info(`esbuild produced no output for plugin: ${pluginEntryPath}`)
    return
  }

  const base64CompiledPlugin = Buffer.from(outputFileContents).toString('base64')
  return dynamicImport(`data:text/javascript;base64,${base64CompiledPlugin}`)
}

async function loadPluginViaJsFile(pluginFolderPath: string) {
  const pluginEntryPath = path.join(pluginFolderPath, 'index.js')
  if (!fs.existsSync(pluginEntryPath)) {
    core.info(`No index.js found for plugin at path: ${pluginFolderPath}`)
    return
  }

  return dynamicImport(pluginEntryPath)
}

type InvokePluginParams = PluginDefaultParams & {
  plugin: Plugin
}
export function invokePlugin({plugin, page, addFinding}: InvokePluginParams) {
  return plugin.default({page, addFinding})
}
