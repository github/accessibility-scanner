import core from '@actions/core'

type ScansContext = {
  scansToPerform: Array<string>
  shouldPerformAxeScan: boolean
  shouldRunPlugins: boolean
}
let scansContext: ScansContext | undefined

export function getScansContext() {
  if (!scansContext) {
    const scansJson = core.getInput('scans', {required: false})
    const scansToPerform = JSON.parse(scansJson || '{}')
    // - if we dont have a scans input
    //   or we do have a scans input, but it only has 1 item and its 'axe'
    //   then we only want to run 'axe' and not the plugins
    // - keep in mind, 'onlyAxeScan' is not the same as 'shouldPerformAxeScan'
    const onlyAxeScan = scansToPerform.length === 0 || (scansToPerform.length === 1 && scansToPerform[0] === 'axe')

    scansContext = {
      scansToPerform,
      // - if no 'scans' input is provided, we default to the existing behavior
      //   (only axe scan) for backwards compatability.
      // - we can enforce using the 'scans' input in a future major release and
      //   mark it as required
      shouldPerformAxeScan: !scansJson || scansToPerform.includes('axe'),
      shouldRunPlugins: scansToPerform.length > 0 && !onlyAxeScan,
    }
  }

  return scansContext
}

export function clearCache() {
  scansContext = undefined
}
