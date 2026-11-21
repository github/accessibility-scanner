export class TimeoutError extends Error {
  constructor() {
    super('URL deadline exceeded')
    this.name = 'TimeoutError'
  }
}

export class Deadline {
  readonly controller = new AbortController()
  private readonly end: number

  constructor(milliseconds: number) {
    this.end = performance.now() + milliseconds
  }

  remaining() {
    return Math.max(0, this.end - performance.now())
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const remaining = this.remaining()
    if (this.controller.signal.aborted || remaining === 0) {
      this.controller.abort()
      throw new TimeoutError()
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        Promise.resolve().then(operation),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.controller.abort()
            reject(new TimeoutError())
          }, remaining)
        }),
      ])
      if (this.remaining() === 0) {
        this.controller.abort()
        throw new TimeoutError()
      }
      return result
    } finally {
      clearTimeout(timer)
    }
  }
}
