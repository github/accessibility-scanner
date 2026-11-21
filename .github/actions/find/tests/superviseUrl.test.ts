import {describe, expect, it, vi} from 'vitest'
import {AuthContext} from '../src/AuthContext.js'
import {superviseUrl} from '../src/superviseUrl.js'

const launchServer = vi.hoisted(() => vi.fn())
vi.mock('playwright', () => ({default: {chromium: {launchServer}}}))
vi.mock('../src/scansContextProvider.js', () => ({
  getScansContext: () => ({scansToPerform: [], shouldPerformAxeScan: true, shouldPerformAccesslintScan: false}),
}))

describe('browser startup recovery', () => {
  it('stops instead of continuing when launch cleanup cannot be verified', async () => {
    vi.useFakeTimers()
    launchServer.mockImplementationOnce(() => new Promise(() => {}))
    try {
      const scan = superviseUrl(
        {url: 'https://example.com'},
        new AuthContext({}),
        false,
        undefined,
        undefined,
        false,
        100,
      )
      const result = expect(scan).rejects.toThrow('Cannot verify browser startup cleanup')
      await vi.advanceTimersByTimeAsync(1100)
      await result
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cleans up a browser returned just after the deadline', async () => {
    vi.useFakeTimers()
    const kill = vi.fn().mockResolvedValue(undefined)
    launchServer.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({kill}), 120)))
    try {
      const scan = superviseUrl(
        {url: 'https://example.com'},
        new AuthContext({}),
        false,
        undefined,
        undefined,
        false,
        100,
      )
      await vi.advanceTimersByTimeAsync(120)
      const result = await scan
      expect(result.failures[0].status).toBe('timed_out')
      expect(kill).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
