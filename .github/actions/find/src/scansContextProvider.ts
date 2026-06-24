import * as core from '@actions/core'

type ScansContext = {
  scansToPerform: Array<string>
  shouldPerformAxeScan: boolean
  shouldPerformAccesslintScan: boolean
  shouldRunPlugins: boolean
}
let scansContext: ScansContext | undefined

export function getScansContext() {
  if (!scansContext) {
    const scansInput = core.getInput('scans', {required: false})
    const scansToPerform = JSON.parse(scansInput || '[]')
    // 'axe' and 'accesslint' are built-in core engines; anything else in the
    // list is treated as a plugin name.
    const coreEngines = ['axe', 'accesslint']
    const pluginScans = scansToPerform.filter((scan: string) => !coreEngines.includes(scan))

    scansContext = {
      scansToPerform,
      // No 'scans' input keeps the existing axe-only default for backwards compatibility.
      shouldPerformAxeScan: !scansInput || scansToPerform.includes('axe'),
      shouldPerformAccesslintScan: scansToPerform.includes('accesslint'),
      shouldRunPlugins: pluginScans.length > 0,
    }
  }

  return scansContext
}

export function clearCache() {
  scansContext = undefined
}
