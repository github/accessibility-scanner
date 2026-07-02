import type {Finding} from '../types.d.js'
import playwright from 'playwright'

export type PluginDefaultParams = {
  page: playwright.Page
  addFinding: (findingData: Finding) => Promise<void>
}

export type Plugin = {
  name: string
  default: (options: PluginDefaultParams) => Promise<void>
}

// A plugin requested from an NPM package rather than a local folder.
export type NpmPluginRequest = {
  name: string
  package: string
  version?: string
}
