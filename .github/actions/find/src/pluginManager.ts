import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {dynamicImport} from './dynamicImport.js'
import type {FindingWithContext} from './types.d.js'
import playwright from 'playwright'
import * as core from '@actions/core'

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type PluginDefaultParams = {
  page: playwright.Page
  addFinding: (findingData: FindingWithContext) => void
  // - this will be coming soon
  // runAxeScan: (options: {includeScreenshots: boolean; page: playwright.Page; findings: Finding[]}) => Promise<void>
}

export type Plugin = {
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

  // - this is the path where actions appear when they're used in a workflow/repo
  const pluginsPath = '/home/runner/work/_actions/github/accessibility-scanner/scanner-plugins/'
  await loadPluginsFromPath({
    readPath: pluginsPath,
    importPath: pluginsPath,
  })
}

// exported for mocking/testing. not for actual use
export async function loadCustomPlugins() {
  core.info('Loading custom plugins')

  console.log('current working directory: ' + process.cwd())
  const pluginsPath = process.cwd() + '/.github/scanner-plugins/'
  await loadPluginsFromPath({
    readPath: pluginsPath,
    importPath: pluginsPath,
  })
}

// exported for mocking/testing. not for actual use
export async function loadPluginsFromPath({readPath, importPath}: {readPath: string; importPath: string}) {
  try {
    const res = fs.readdirSync(readPath)
    for (const pluginFolder of res) {
      const pluginFolderPath = path.join(importPath, pluginFolder)
      console.log('plugin folder path: ' + pluginFolderPath)
      if (fs.existsSync(pluginFolderPath) && fs.lstatSync(pluginFolderPath).isDirectory()) {
        core.info(`Found plugin: ${pluginFolder}`)
        plugins.push(await dynamicImport(path.join(importPath, pluginFolder, '/index.js')))
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
