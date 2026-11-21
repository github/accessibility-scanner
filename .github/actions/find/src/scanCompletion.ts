import type {ScanCompletion, ScanCompletionReport, ScanFailure} from './types.d.js'

export function createScanCompletionReport(scans: ScanCompletion[], failures: ScanFailure[]): ScanCompletionReport {
  const requestedUrls = new Set(scans.map(scan => scan.requestedUrl))
  const everyUrlHasCompletedScan = [...requestedUrls].every(requestedUrl =>
    scans.some(scan => scan.requestedUrl === requestedUrl && scan.status === 'completed'),
  )
  const scansHaveFinalStatus = scans.every(scan => scan.status === 'completed' || scan.status === 'skipped')
  return {
    schemaVersion: 1,
    complete: requestedUrls.size > 0 && everyUrlHasCompletedScan && scansHaveFinalStatus && failures.length === 0,
    scans,
    failures,
  }
}

export function summarizeScanCompletion(report: ScanCompletionReport): string {
  if (report.complete) return 'All configured accessibility scans completed.'

  const incompleteScans = report.scans.filter(scan => scan.status !== 'completed' && scan.status !== 'skipped').length
  const requestedUrls = new Set(report.scans.map(scan => scan.requestedUrl))
  const uncoveredUrls = [...requestedUrls].filter(
    requestedUrl => !report.scans.some(scan => scan.requestedUrl === requestedUrl && scan.status === 'completed'),
  )
  if (report.failures.length === 0 && report.scans.every(scan => scan.status === 'skipped')) {
    return 'Incomplete scan coverage: no accessibility scanner was selected.'
  }

  const details = report.failures.map(failure => {
    const url = sanitizeUrlLabel(failure.requestedUrl)
    const scanner = failure.scanner ? `/${sanitizeLabel(failure.scanner)}` : ''
    return `${url}${scanner} (${failure.stage}: ${failure.status})`
  })
  for (const scan of report.scans) {
    if (
      scan.status !== 'completed' &&
      scan.status !== 'skipped' &&
      !report.failures.some(failure => failure.requestedUrl === scan.requestedUrl)
    ) {
      details.push(
        `${sanitizeUrlLabel(scan.requestedUrl)}/${sanitizeLabel(scan.scanner)} (${scan.stage ?? 'unknown'}: ${scan.status})`,
      )
    }
  }
  for (const requestedUrl of uncoveredUrls) {
    if (!report.failures.some(failure => failure.requestedUrl === requestedUrl)) {
      details.push(`${sanitizeUrlLabel(requestedUrl)} (no scanner completed)`)
    }
  }
  const shownDetails = details.slice(0, 5)
  const remaining = details.length - shownDetails.length
  const suffix = remaining > 0 ? `; and ${remaining} more` : ''
  const failureDetails = shownDetails.length > 0 ? `: ${shownDetails.join('; ')}${suffix}` : ''
  return `Incomplete scan coverage (${incompleteScans} scanner checks incomplete)${failureDetails}.`
}

export function sanitizeUrlLabel(value: string): string {
  try {
    const hostname = new URL(value).hostname.replace(/[^A-Za-z0-9.:[\]-]/g, '')
    return hostname || 'URL'
  } catch {
    return 'URL'
  }
}

export function sanitizeLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40) || 'scanner'
}
