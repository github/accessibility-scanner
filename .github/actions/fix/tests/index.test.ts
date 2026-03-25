import {beforeEach, describe, expect, it, vi} from 'vitest'

const {octokitCtorMock, getInputMock} = vi.hoisted(() => ({
  octokitCtorMock: vi.fn(),
  getInputMock: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: getInputMock,
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}))

vi.mock('@octokit/core', () => ({
  Octokit: {
    plugin: vi.fn(() => octokitCtorMock),
  },
}))

vi.mock('@octokit/plugin-throttling', () => ({
  throttling: vi.fn(),
}))

describe('fix action index', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('passes baseUrl to Octokit when base_url input is provided', async () => {
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'issues':
          return '[]'
        case 'repository':
          return 'org/repo'
        case 'token':
          return 'token'
        case 'base_url':
          return 'https://ghe.example.com/api/v3'
        default:
          return ''
      }
    })

    const {default: run} = await import('../src/index.ts')
    await run()

    expect(octokitCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: 'token',
        baseUrl: 'https://ghe.example.com/api/v3',
      }),
    )
  })

  it('uses Octokit default API URL when base_url input is not provided', async () => {
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'issues':
          return '[]'
        case 'repository':
          return 'org/repo'
        case 'token':
          return 'token'
        default:
          return ''
      }
    })

    const {default: run} = await import('../src/index.ts')
    await run()

    expect(octokitCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: 'token',
        baseUrl: undefined,
      }),
    )
  })
})
