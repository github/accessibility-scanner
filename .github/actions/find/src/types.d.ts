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
}

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
}
