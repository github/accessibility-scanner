export type FindingNode = {
  html: string
  target?: string
}

export type FindingCategory = 'wcag' | 'best-practice' | 'experimental'

export type Finding = {
  scannerType: string
  category?: FindingCategory
  url: string
  html?: string
  nodes?: FindingNode[]
  problemShort: string
  problemUrl: string
  solutionShort: string
  solutionLong?: string
  screenshotId?: string
  ruleId?: string
  originalUrl: string
}

export type FindingInput = Omit<Finding, 'originalUrl'>

export type Cookie = {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export type LocalStorage = {
  [origin: string]: {
    [key: string]: string
  }
}

export type AuthContextInput = {
  username?: string
  password?: string
  cookies?: Cookie[]
  localStorage?: LocalStorage
}

export type ReducedMotionPreference = 'reduce' | 'no-preference' | null

export type ColorSchemePreference = 'light' | 'dark' | 'no-preference' | null

export type UrlConfig = {
  url: string
  excludeSelectors?: string[]
  waitForSelectors?: string[]
}

export type ScanStatus = 'completed' | 'failed' | 'timed_out' | 'skipped' | 'not_started' | 'unknown'

export type ScanStage =
  | 'planning'
  | 'browser_setup'
  | 'navigation'
  | 'wait_for_selectors'
  | 'plugin_setup'
  | 'scan'
  | 'cleanup'

export type ScanCompletion = {
  requestedUrl: string
  scanner: string
  status: ScanStatus
  stage?: ScanStage
}

export type ScanFailure = {
  requestedUrl: string
  status: 'failed' | 'timed_out' | 'unknown'
  stage: ScanStage
  scanner?: string
}

export type ScanCompletionReport = {
  schemaVersion: 1
  complete: boolean
  scans: ScanCompletion[]
  failures: ScanFailure[]
}

export type UrlScanOutcome = {
  findings: Finding[]
  scans: ScanCompletion[]
  failures: ScanFailure[]
}
