// Each phase has its own budget; the full check can wait at most 20 seconds.
export const OPERATION_TIMEOUT_MS = 5000

class ReflowOperationError extends Error {
  constructor(
    readonly operation: string,
    message: string,
    readonly timedOut: boolean,
    options?: ErrorOptions,
  ) {
    super(`${operation} ${message}`, options)
    this.name = 'ReflowOperationError'
  }
}

export class ReflowScanError extends Error {
  constructor(
    readonly operation: string,
    cause: ReflowOperationError,
    readonly cleanupError: ReflowOperationError | undefined,
    readonly pageStateUnsafe: boolean,
  ) {
    const cleanupMessage = cleanupError ? `; viewport restoration also failed: ${cleanupError.message}` : ''
    const unsafeMessage = pageStateUnsafe ? '; page state may be unsafe and will not be reused' : ''
    super(`${cause.message}${cleanupMessage}${unsafeMessage}`, {cause})
    this.name = 'ReflowScanError'
  }
}

export default async function reflowScan({page, addFinding} = {}) {
  let originalViewport
  try {
    originalViewport = page.viewportSize()
  } catch (error) {
    throw new ReflowScanError(
      'viewport capture',
      new ReflowOperationError('viewport capture', `failed: ${errorMessage(error)}`, false, {cause: error}),
      undefined,
      false,
    )
  }

  if (!originalViewport) {
    throw new ReflowScanError(
      'viewport capture',
      new ReflowOperationError('viewport capture', 'is unavailable; cannot safely change the viewport', false),
      undefined,
      false,
    )
  }

  const url = page.url()
  let resizeAttempted = false
  let operationError
  let cleanupError

  try {
    resizeAttempted = true
    await runBounded('viewport resize', () => page.setViewportSize({width: 320, height: 256}))

    const {scrollWidth, clientWidth} = await runBounded('overflow evaluation', () =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      })),
    )

    if (scrollWidth > clientWidth + 1) {
      await runBounded('finding callback', () =>
        addFinding({
          scannerType: 'reflow-scan',
          url,
          problemShort: 'needs review: page presents a horizontal scrollbar at a 320px wide viewport',
          problemUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
          solutionShort:
            'verify if sections of content can be viewed within the 320px wide viewport without needing to scroll in two dimensions to read the content of an individual section',
          solutionLong: `The page has a scroll width of ${scrollWidth}px but a client width of only ${clientWidth}px at a 320px wide viewport, resulting in a horizontal scrollbar. Ensure that multi-line text does not require scrolling in two-dimensions to read, as this would be a violation of WCAG Success Criterion 1.4.10 (Reflow).`,
        }),
      )
    }
  } catch (error) {
    operationError =
      error instanceof ReflowOperationError
        ? error
        : new ReflowOperationError('reflow scan', `failed: ${errorMessage(error)}`, false, {cause: error})
  } finally {
    if (resizeAttempted) {
      try {
        await runBounded('viewport restoration', () => page.setViewportSize(originalViewport))
      } catch (error) {
        cleanupError =
          error instanceof ReflowOperationError
            ? error
            : new ReflowOperationError('viewport restoration', `failed: ${errorMessage(error)}`, false, {
                cause: error,
              })
      }
    }
  }

  if (operationError || cleanupError) {
    const failure = operationError ?? cleanupError
    throw new ReflowScanError(
      failure.operation,
      failure,
      operationError ? cleanupError : undefined,
      failure.timedOut || cleanupError !== undefined,
    )
  }
}

async function runBounded<T>(operation: string, action: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ReflowOperationError(operation, `timed out after ${OPERATION_TIMEOUT_MS}ms`, true)),
      OPERATION_TIMEOUT_MS,
    )
  })

  try {
    return await Promise.race([
      Promise.resolve()
        .then(action)
        .catch(cause => {
          throw new ReflowOperationError(operation, `failed: ${errorMessage(cause)}`, false, {cause})
        }),
      timeout,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const name = 'reflow-scan'
