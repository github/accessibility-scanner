import core from '@actions/core'

type ScansContext = {
  scans: Array<string>
  shouldPerformAxeScan: boolean
}
let scansContext: ScansContext | undefined

export function getScansContext() {
  if (!scansContext) {
    const scansJson = core.getInput('scans', {required: false})
    const scans = JSON.parse(scansJson || '{}')

    scansContext = {
      scans,
      // - if no 'scans' input is provided, we default to the existing behavior
      //   (only axe scan) for backwards compatability.
      // - we can enforce using the 'scans' input in a future major release and
      //   mark it as required
      shouldPerformAxeScan: !scansJson || scans.includes('axe'),
    }
  }

  return scansContext
}
