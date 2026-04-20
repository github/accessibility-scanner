import * as fs from 'fs'
import * as path from 'path'
import * as esbuild from 'esbuild'
import {dynamicImport} from '../dynamicImport.js'
import * as core from '@actions/core'
import type { Plugin } from './types.js'

// - these functions had to be moved into a separate file
//   because vitest will not mock the implementation of functions
//   that are in the same file as the function under test.
// - https://vitest.dev/guide/mocking/modules.html#mocking-modules-pitfalls
export async function loadPluginViaTsFile(pluginFolderPath: string): Promise<Plugin | undefined> {
  const pluginEntryPath = path.join(pluginFolderPath, 'index.ts')
  if (!fs.existsSync(pluginEntryPath)) {
    core.info(`No index.ts found for plugin at path: ${pluginFolderPath}`)
    return
  }

  try {
    core.info(`index.ts found for plugin at path: ${pluginFolderPath}`)
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
  } catch {
    core.warning(`Error loading plugin at path: ${pluginEntryPath}`)
  }
}

export async function loadPluginViaJsFile(pluginFolderPath: string): Promise<Plugin | undefined> {
  const pluginEntryPath = path.join(pluginFolderPath, 'index.js')
  if (!fs.existsSync(pluginEntryPath)) {
    core.info(`No index.js found for plugin at path: ${pluginFolderPath}`)
    return
  }

  core.info(`index.js found for plugin at path: ${pluginFolderPath}`)
  return dynamicImport(pluginEntryPath)
}
