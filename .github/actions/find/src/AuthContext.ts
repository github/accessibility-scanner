import type playwright from 'playwright'
import type {Cookie, LocalStorage, AuthContextInput} from './types.js'

export class AuthContext implements AuthContextInput {
  readonly username?: string
  readonly password?: string
  readonly cookies?: Cookie[]
  readonly localStorage?: LocalStorage

  constructor({username, password, cookies, localStorage}: AuthContextInput) {
    this.username = username
    this.password = password
    this.cookies = cookies
    this.localStorage = localStorage
  }

  toPlaywrightBrowserContextOptions(): playwright.BrowserContextOptions {
    const playwrightBrowserContextOptions: playwright.BrowserContextOptions = {}
    if (this.username && this.password) {
      playwrightBrowserContextOptions.httpCredentials = {
        username: this.username,
        password: this.password,
      }
    }
    if (this.cookies || this.localStorage) {
      playwrightBrowserContextOptions.storageState = {
        // Add default values for fields Playwright requires which aren’t actually required by the Cookie API.
        cookies:
          this.cookies?.map(cookie => ({
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
            ...cookie,
          })) ?? [],
        // Transform the localStorage object into the shape Playwright expects.
        origins:
          Object.entries(this.localStorage ?? {}).map(([origin, kv]) => ({
            origin,
            localStorage: Object.entries(kv).map(([name, value]) => ({
              name,
              value,
            })),
          })) ?? [],
      }
    }
    return playwrightBrowserContextOptions
  }
}
