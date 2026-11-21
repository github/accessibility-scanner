import type playwright from 'playwright'
import {execFile, type ChildProcess} from 'node:child_process'
import * as core from '@actions/core'
import {Deadline} from './deadline.js'

export async function killServer(
  server: playwright.BrowserServer,
  safeUrl: string,
  platform: NodeJS.Platform = process.platform,
): Promise<unknown> {
  try {
    await new Deadline(1000).run(() => server.kill())
  } catch (error) {
    core.error(`Accessibility scan browser cleanup failed for ${safeUrl}`)
    const child = server.process()
    const pid = child.pid
    if (platform === 'win32') {
      if (!pid || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Cannot verify cleanup of the browser process tree for ${safeUrl}`)
      }
      let onExit: () => void = () => {}
      const exited = new Promise<void>(resolve => {
        onExit = resolve
        child.once('exit', onExit)
      })
      let taskkill: ChildProcess | undefined
      try {
        await new Deadline(1000).run(
          () =>
            new Promise<void>((resolve, reject) => {
              taskkill = execFile('taskkill', ['/PID', String(pid), '/T', '/F'], error =>
                error ? reject(error) : resolve(),
              )
            }),
        )
        if (child.exitCode === null && child.signalCode === null) {
          await new Deadline(1000).run(() => exited)
        }
      } catch (killError) {
        taskkill?.kill('SIGKILL')
        throw new Error(`Cannot verify cleanup of the browser process tree for ${safeUrl}`, {cause: killError})
      } finally {
        child.removeListener('exit', onExit)
      }
      return error
    }
    if (!pid) throw new Error(`Cannot verify cleanup of the browser process group for ${safeUrl}`)
    if (child.exitCode !== null || child.signalCode !== null) {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch (killError) {
        if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw new Error(`Cannot verify cleanup of the browser process group for ${safeUrl}`, {cause: killError})
        }
      }
    } else {
      let onExit: () => void = () => {}
      const exited = new Promise<void>(resolve => {
        onExit = resolve
        child.once('exit', onExit)
      })
      try {
        process.kill(-pid, 'SIGKILL')
      } catch (killError) {
        if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
          child.removeListener('exit', onExit)
          throw new Error(`Cannot verify cleanup of the browser process group for ${safeUrl}`, {cause: killError})
        }
      }
      try {
        await new Deadline(1000).run(() => exited)
      } catch (waitError) {
        throw new Error(`Cannot verify cleanup of the browser process group for ${safeUrl}`, {cause: waitError})
      } finally {
        child.removeListener('exit', onExit)
      }
    }
    return error
  }
}
