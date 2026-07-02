import * as core from '@actions/core'
import type {NpmPluginRequest} from './pluginManager/types.js'

type ScansContext = {
  scansToPerform: Array<string>
  npmPlugins: NpmPluginRequest[]
  shouldPerformAxeScan: boolean
  shouldRunPlugins: boolean
}
let scansContext: ScansContext | undefined

// A scans entry is either a plain name (core engine or local plugin folder) or
// an object describing an NPM-published plugin to install and load.
type ScanEntry = string | {name?: unknown; package?: unknown; version?: unknown}

export function getScansContext() {
  if (!scansContext) {
    const scansInput = core.getInput('scans', {required: false})
    const parsed = JSON.parse(scansInput || '[]')
    if (!Array.isArray(parsed)) {
      throw new Error(`'scans' input must be a JSON array, got: ${scansInput}`)
    }
    const rawScans = parsed as ScanEntry[]

    // scansToPerform holds the name of every scan/plugin to run
    const scansToPerform: string[] = []
    const npmPlugins: NpmPluginRequest[] = []
    for (const entry of rawScans) {
      if (typeof entry === 'string') {
        scansToPerform.push(entry)
      } else if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.name === 'string' &&
        typeof entry.package === 'string'
      ) {
        scansToPerform.push(entry.name)
        npmPlugins.push({
          name: entry.name,
          package: entry.package,
          version: typeof entry.version === 'string' ? entry.version : undefined,
        })
      } else {
        core.warning(`Ignoring invalid 'scans' entry: ${JSON.stringify(entry)}`)
      }
    }

    // - if we don't have a scans input
    //   or we do have a scans input, but it only has 1 item and its 'axe'
    //   then we only want to run 'axe' and not the plugins
    // - keep in mind, 'onlyAxeScan' is not the same as 'shouldPerformAxeScan'
    const onlyAxeScan = scansToPerform.length === 0 || (scansToPerform.length === 1 && scansToPerform[0] === 'axe')

    scansContext = {
      scansToPerform,
      npmPlugins,
      // - if no 'scans' input is provided, we default to the existing behavior
      //   (only axe scan) for backwards compatability.
      // - we can enforce using the 'scans' input in a future major release and
      //   mark it as required
      shouldPerformAxeScan: !scansInput || scansToPerform.includes('axe'),
      shouldRunPlugins: scansToPerform.length > 0 && !onlyAxeScan,
    }
  }

  return scansContext
}

export function clearCache() {
  scansContext = undefined
}
