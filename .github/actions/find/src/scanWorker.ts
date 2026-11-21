import {AuthContext} from './AuthContext.js'
import {findForUrlWithOutcome} from './findForUrl.js'
import type {AuthContextInput, ColorSchemePreference, ReducedMotionPreference, UrlConfig} from './types.js'

export type WorkerRequest = {
  endpoint: string
  urlConfig: UrlConfig
  authContext?: AuthContextInput
  includeScreenshots: boolean
  reducedMotion?: ReducedMotionPreference
  colorScheme?: ColorSchemePreference
  ignoreHttpsErrors: boolean
}

process.once('message', async (request: WorkerRequest) => {
  try {
    let findingsSent = 0
    const outcome = await findForUrlWithOutcome(
      request.urlConfig,
      new AuthContext(request.authContext ?? {}),
      request.includeScreenshots,
      request.reducedMotion,
      request.colorScheme,
      request.ignoreHttpsErrors,
      {
        endpoint: request.endpoint,
        onProgress: progress => {
          const findings = progress.outcome.findings.slice(findingsSent)
          findingsSent = progress.outcome.findings.length
          process.send?.({
            type: 'progress',
            progress: {...progress, outcome: {...progress.outcome, findings}},
          })
        },
      },
    )
    process.send?.({type: 'result', outcome})
  } catch {
    process.send?.({type: 'error'})
  }
})
