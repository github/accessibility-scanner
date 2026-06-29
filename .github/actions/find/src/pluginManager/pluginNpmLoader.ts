import {execFileSync} from 'child_process'
import * as core from '@actions/core'
import type {NpmPluginRequest, Plugin} from './types.js'

// Install the package at runtime.
export function installNpmPackage(spec: string) {
  execFileSync('npm', ['install', spec, '--no-save', '--no-package-lock', '--ignore-scripts'], {stdio: 'inherit'})
}

// Install and import a single NPM-published plugin
export async function loadPluginViaNpm(request: NpmPluginRequest): Promise<Plugin | undefined> {
  const spec = request.version ? `${request.package}@${request.version}` : request.package
  try {
    core.info(`Installing NPM plugin: ${spec}`)
    installNpmPackage(spec)
    // Import the bare package specifier as-is; pathToFileURL would mangle it.
    const imported = await import(request.package)
    return imported as Plugin
  } catch (e) {
    core.warning(`Failed to load NPM plugin '${spec}': ${e}`)
    return undefined
  }
}
