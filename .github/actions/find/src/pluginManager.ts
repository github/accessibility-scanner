import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {dynamicImport} from './dynamicImport.js'
import type {Finding} from './types.d.js'
import playwright from 'playwright'

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type Plugin = {
  name: string
  default: (options: {page: playwright.Page; addFinding: (findingData: Finding) => void; url: string}) => Promise<void>
}

const plugins: Plugin[] = []
let pluginsLoaded = false

export async function loadPlugins() {
  console.log('loading plugins')

  try {
    if (!pluginsLoaded) {
      await loadBuiltInPlugins()
      await loadCustomPlugins()
    }
  } catch {
    plugins.length = 0
    console.log(abortError)
  } finally {
    pluginsLoaded = true
    return plugins
  }
}

export const abortError = [
  'There was an error while loading plugins.',
  'Clearing all plugins and aborting custom plugin scans.',
  'Please check the logs for hints as to what may have gone wrong.',
].join('\n')

export function clearCache() {
  pluginsLoaded = false
  plugins.length = 0
}

// exported for mocking/testing. not for actual use
export async function loadBuiltInPlugins() {
  console.log('Loading built-in plugins')

  const pluginsPath = '../../../scanner-plugins/'
  await loadPluginsFromPath({
    readPath: path.join(__dirname, pluginsPath),
    importPath: pluginsPath,
  })
}

// exported for mocking/testing. not for actual use
export async function loadCustomPlugins() {
  console.log('Loading custom plugins')

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
      console.log('Found plugin: ', pluginFolder)
      plugins.push(await dynamicImport(path.join(importPath, pluginFolder, '/index.js')))
    }
  } catch (e) {
    // - log errors here for granular info
    console.log('error: ')
    console.log(e)
    // - throw error to handle aborting the plugin scans
    throw e
  }
}
