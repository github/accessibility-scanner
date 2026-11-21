import type playwright from 'playwright'
import * as core from '@actions/core'
import {Deadline} from './deadline.js'

export async function killServer(server: playwright.BrowserServer, safeUrl: string): Promise<unknown> {
  try {
    await new Deadline(1000).run(() => server.kill())
  } catch (error) {
    core.error(`Accessibility scan browser cleanup failed for ${safeUrl}`)
    const child = server.process()
    const pid = child.pid
    if (pid && child.exitCode === null && child.signalCode === null) {
      let onExit: () => void = () => {}
      const exited = new Promise<void>(resolve => {
        onExit = resolve
        child.once('exit', onExit)
      })
      try {
        process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL')
      } catch (killError) {
        if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
          try {
            process.kill(pid, 'SIGKILL')
          } catch (fallbackError) {
            if ((fallbackError as NodeJS.ErrnoException).code !== 'ESRCH') {
              core.error(`Could not terminate browser for ${safeUrl}: ${String(fallbackError)}`)
            }
          }
        }
      }
      try {
        await new Deadline(1000).run(() => exited)
      } catch {
        core.error(`Browser process did not exit promptly for ${safeUrl}`)
      } finally {
        child.removeListener('exit', onExit)
      }
    }
    return error
  }
}
