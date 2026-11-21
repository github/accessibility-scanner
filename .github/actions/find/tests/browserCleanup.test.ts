import {EventEmitter} from 'node:events'
import {describe, expect, it, vi} from 'vitest'
import type playwright from 'playwright'
import {killServer} from '../src/browserCleanup.js'
import {Deadline} from '../src/deadline.js'

describe('browser cleanup', () => {
  it('clears the deadline timer when work completes', async () => {
    vi.useFakeTimers()
    try {
      await expect(new Deadline(10000).run(async () => 'done')).resolves.toBe('done')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('force-kills the owned process when server cleanup hangs', async () => {
    const child = Object.assign(new EventEmitter(), {pid: 12345, exitCode: null, signalCode: null})
    const server = {
      process: () => child,
      kill: () => new Promise<void>(() => {}),
    } as playwright.BrowserServer
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      child.emit('exit')
      return true
    })
    vi.useFakeTimers()
    try {
      const cleanup = killServer(server, 'example.com')
      await vi.advanceTimersByTimeAsync(1000)
      expect(await cleanup).toBeInstanceOf(Error)
      expect(kill).toHaveBeenCalledWith(process.platform === 'win32' ? 12345 : -12345, 'SIGKILL')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      kill.mockRestore()
      vi.useRealTimers()
    }
  })
})
