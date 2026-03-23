import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
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
  url: string
}

type Plugin = {
  name: string
  default: (options: PluginDefaultParams) => Promise<void>
}

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
  // - the problem with this is that if a scanner user doesnt
  //   have custom plugins, they won't have a 'scanner-plugins' folder
  //   which will cause an error and abort loading all plugins, including built-in ones
  // - so for custom plugins, if the path doesn't exist, we can return early
  //   and not abort the loading of built-in plugins
  if (!fs.existsSync(pluginsPath)) {
    core.info('No custom plugins found.')
    return
  }

  await loadPluginsFromPath({pluginsPath})
}

// exported for mocking/testing. not for actual use
export async function loadPluginsFromPath({pluginsPath}: {pluginsPath: string}) {
  try {
    const res = fs.readdirSync(pluginsPath)
    for (const pluginFolder of res) {
      const pluginFolderPath = path.join(pluginsPath, pluginFolder)

      if (fs.existsSync(pluginFolderPath) && fs.lstatSync(pluginFolderPath).isDirectory()) {
        core.info(`Found plugin: ${pluginFolder}`)
        plugins.push(await dynamicImport(path.join(pluginsPath, pluginFolder, 'index.js')))
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
export function invokePlugin({plugin, page, addFinding, url}: InvokePluginParams) {
  return plugin.default({page, addFinding, url})
}
