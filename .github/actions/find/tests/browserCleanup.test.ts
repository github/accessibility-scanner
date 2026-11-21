import {EventEmitter} from 'node:events'
import {describe, expect, it, vi} from 'vitest'
import type playwright from 'playwright'
import {killServer} from '../src/browserCleanup.js'
import {Deadline} from '../src/deadline.js'

const taskkill = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({execFile: taskkill}))

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
      const cleanup = killServer(server, 'example.com', 'linux')
      await vi.advanceTimersByTimeAsync(1000)
      expect(await cleanup).toBeInstanceOf(Error)
      expect(kill).toHaveBeenCalledWith(-12345, 'SIGKILL')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      kill.mockRestore()
      vi.useRealTimers()
    }
  })

  it('uses taskkill for the Windows browser tree', async () => {
    const child = Object.assign(new EventEmitter(), {
      pid: 12345,
      exitCode: null,
      signalCode: null as NodeJS.Signals | null,
    })

    const server = {
      process: () => child,
      kill: () => Promise.reject(new Error('close failed')),
    } as playwright.BrowserServer
    taskkill.mockImplementation((_command, _args, callback) => {
      queueMicrotask(() => {
        child.signalCode = 'SIGKILL'
        child.emit('exit')
        callback(null)
      })
      return {kill: vi.fn()}
    })
    expect(await killServer(server, 'example.com', 'win32')).toBeInstanceOf(Error)
    expect(taskkill).toHaveBeenCalledWith('taskkill', ['/PID', '12345', '/T', '/F'], expect.any(Function))
  })

  it('refuses continuation when Windows browser-tree termination fails', async () => {
    const child = Object.assign(new EventEmitter(), {pid: 12345, exitCode: null, signalCode: null})
    const server = {
      process: () => child,
      kill: () => Promise.reject(new Error('close failed')),
    } as playwright.BrowserServer
    taskkill.mockImplementation((_command, _args, callback) => {
      queueMicrotask(() => callback(new Error('taskkill failed')))
      return {kill: vi.fn()}
    })
    await expect(killServer(server, 'example.com', 'win32')).rejects.toThrow(
      'Cannot verify cleanup of the browser process tree',
    )
  })

  it('refuses continuation when POSIX process-group termination fails', async () => {
    const child = Object.assign(new EventEmitter(), {pid: 12345, exitCode: null, signalCode: null})
    const server = {
      process: () => child,
      kill: () => Promise.reject(new Error('close failed')),
    } as playwright.BrowserServer
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('permission denied'), {code: 'EPERM'})
    })
    try {
      await expect(killServer(server, 'example.com', 'linux')).rejects.toThrow(
        'Cannot verify cleanup of the browser process group',
      )
      expect(kill).toHaveBeenCalledOnce()
      expect(kill).toHaveBeenCalledWith(-12345, 'SIGKILL')
    } finally {
      kill.mockRestore()
    }
  })

  it('terminates the browser group without waiting when its leader has exited', async () => {
    const child = Object.assign(new EventEmitter(), {pid: 12345, exitCode: 1, signalCode: null})
    const server = {
      process: () => child,
      kill: () => Promise.reject(new Error('close failed')),
    } as playwright.BrowserServer
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
    try {
      expect(await killServer(server, 'example.com', 'linux')).toBeInstanceOf(Error)
      expect(kill).toHaveBeenCalledWith(-12345, 'SIGKILL')
    } finally {
      kill.mockRestore()
    }
  })
})
