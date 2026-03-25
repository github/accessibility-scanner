import {beforeEach, describe, expect, it, vi} from 'vitest'

const {octokitCtorMock, getInputMock, getBooleanInputMock} = vi.hoisted(() => ({
  octokitCtorMock: vi.fn(),
  getInputMock: vi.fn(),
  getBooleanInputMock: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: getInputMock,
  getBooleanInput: getBooleanInputMock,
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

describe('file action index', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('passes baseUrl to Octokit when base_url input is provided', async () => {
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'findings':
          return '[]'
        case 'repository':
          return 'org/repo'
        case 'token':
          return 'token'
        case 'base_url':
          return 'https://ghe.example.com/api/v3'
        case 'cached_filings':
          return '[]'
        default:
          return ''
      }
    })
    getBooleanInputMock.mockReturnValue(false)

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
        case 'findings':
          return '[]'
        case 'repository':
          return 'org/repo'
        case 'token':
          return 'token'
        case 'cached_filings':
          return '[]'
        default:
          return ''
      }
    })
    getBooleanInputMock.mockReturnValue(false)

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
