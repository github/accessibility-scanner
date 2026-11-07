import {afterEach, describe, expect, it, vi} from 'vitest'
import reflowScan, {OPERATION_TIMEOUT_MS} from '../../../scanner-plugins/reflow-scan/index.js'

const originalViewport = {width: 1280, height: 720}

function createPage({scrollWidth = 320, clientWidth = 320} = {}) {
  return {
    viewportSize: vi.fn(() => originalViewport),
    url: vi.fn(() => 'https://example.com'),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({scrollWidth, clientWidth}),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('reflow scan', () => {
  it('restores the original viewport when no overflow is found', async () => {
    const page = createPage()
    const addFinding = vi.fn()

    await reflowScan({page, addFinding})

    expect(page.setViewportSize).toHaveBeenNthCalledWith(1, {width: 320, height: 256})
    expect(page.setViewportSize).toHaveBeenNthCalledWith(2, originalViewport)
    expect(addFinding).not.toHaveBeenCalled()
  })

  it('preserves the overflow finding and restores the original viewport', async () => {
    const page = createPage({scrollWidth: 400, clientWidth: 320})
    const addFinding = vi.fn().mockResolvedValue(undefined)

    await reflowScan({page, addFinding})

    expect(addFinding).toHaveBeenCalledWith(
      expect.objectContaining({
        scannerType: 'reflow-scan',
        url: 'https://example.com',
        problemShort: 'needs review: page presents a horizontal scrollbar at a 320px wide viewport',
        solutionLong: expect.stringContaining('scroll width of 400px but a client width of only 320px'),
      }),
    )
    expect(page.setViewportSize).toHaveBeenLastCalledWith(originalViewport)
  })

  it.each([
    [
      'viewport resize',
      (page: ReturnType<typeof createPage>) => page.setViewportSize.mockRejectedValueOnce(new Error('resize')),
    ],
    [
      'overflow evaluation',
      (page: ReturnType<typeof createPage>) => page.evaluate.mockRejectedValueOnce(new Error('evaluate')),
    ],
    [
      'finding callback',
      (page: ReturnType<typeof createPage>) =>
        page.evaluate.mockResolvedValueOnce({scrollWidth: 400, clientWidth: 320}),
    ],
  ])('reports a rejected %s and attempts restoration', async (operation, configurePage) => {
    const page = createPage()
    configurePage(page)
    const addFinding = vi.fn().mockRejectedValue(new Error('finding'))

    await expect(reflowScan({page, addFinding})).rejects.toMatchObject({
      name: 'ReflowScanError',
      operation,
    })

    expect(page.setViewportSize).toHaveBeenCalledTimes(2)
  })

  it('reports restoration failure after a successful check', async () => {
    const page = createPage()
    page.setViewportSize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('restore'))

    await expect(reflowScan({page, addFinding: vi.fn()})).rejects.toMatchObject({
      name: 'ReflowScanError',
      operation: 'viewport restoration',
      pageStateUnsafe: true,
    })
  })

  it('preserves the scan error when viewport restoration also fails', async () => {
    const page = createPage()
    const scanError = new Error('resize')
    const restoreError = new Error('restore')
    page.setViewportSize.mockRejectedValueOnce(scanError).mockRejectedValueOnce(restoreError)

    await expect(reflowScan({page, addFinding: vi.fn()})).rejects.toMatchObject({
      name: 'ReflowScanError',
      operation: 'viewport resize',
      cause: expect.objectContaining({cause: scanError}),
      cleanupError: expect.objectContaining({cause: restoreError}),
      pageStateUnsafe: true,
    })
  })

  it.each(['viewport resize', 'overflow evaluation', 'finding callback', 'viewport restoration'])(
    'bounds a non-returning %s operation',
    async operation => {
      vi.useFakeTimers()
      const page = createPage({scrollWidth: 400, clientWidth: 320})
      const never = () => new Promise<never>(() => {})

      if (operation === 'viewport resize') {
        page.setViewportSize.mockImplementationOnce(never)
      } else if (operation === 'overflow evaluation') {
        page.evaluate.mockImplementationOnce(never)
      } else if (operation === 'finding callback') {
        page.evaluate.mockResolvedValueOnce({scrollWidth: 400, clientWidth: 320})
      } else {
        page.setViewportSize.mockResolvedValueOnce(undefined).mockImplementationOnce(never)
      }

      const addFinding = operation === 'finding callback' ? vi.fn(never) : vi.fn().mockResolvedValue(undefined)
      const scan = reflowScan({page, addFinding})
      const rejection = expect(scan).rejects.toMatchObject({
        name: 'ReflowScanError',
        operation,
        pageStateUnsafe: true,
      })

      await vi.advanceTimersByTimeAsync(OPERATION_TIMEOUT_MS)

      await rejection
    },
  )

  it('does not change the page when its original viewport is unavailable', async () => {
    const page = createPage()
    page.viewportSize.mockReturnValue(null)

    await expect(reflowScan({page, addFinding: vi.fn()})).rejects.toMatchObject({
      name: 'ReflowScanError',
      operation: 'viewport capture',
    })

    expect(page.setViewportSize).not.toHaveBeenCalled()
  })
})
