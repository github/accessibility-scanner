import type {Finding} from './types.d.js'
import playwright from 'playwright'

type PluginDefaultParams = {
  page: playwright.Page
  addFinding: (findingData: Finding) => Promise<void>
}

export type Plugin = {
  name: string
  default: (options: PluginDefaultParams) => Promise<void>
}
