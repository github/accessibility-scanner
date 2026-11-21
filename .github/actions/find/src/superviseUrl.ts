import {execFile, fork, type ChildProcess} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import playwright from 'playwright'
import * as core from '@actions/core'
import {AuthContext} from './AuthContext.js'
import {killServer} from './browserCleanup.js'
import {Deadline, TimeoutError} from './deadline.js'
import {getFailureStatus, planScans, type ScanProgress} from './findForUrl.js'
import {sanitizeUrlLabel} from './scanCompletion.js'
import type {WorkerRequest} from './scanWorker.js'
import type {ColorSchemePreference, ReducedMotionPreference, UrlConfig, UrlScanOutcome} from './types.js'

type WorkerMessage =
  | {type: 'progress'; progress: ScanProgress}
  | {type: 'result'; outcome: UrlScanOutcome}
  | {type: 'error'}

export async function superviseUrl(
  urlConfig: UrlConfig,
  authContext: AuthContext,
  includeScreenshots: boolean,
  reducedMotion: ReducedMotionPreference | undefined,
  colorScheme: ColorSchemePreference | undefined,
  ignoreHttpsErrors: boolean,
  timeoutMs: number,
): Promise<UrlScanOutcome> {
  const {scans} = planScans(urlConfig.url)
  let outcome: UrlScanOutcome = {findings: [], scans, failures: []}
  if (scans.every(scan => scan.status === 'skipped')) return outcome

  const deadline = new Deadline(timeoutMs)
  const safeUrl = sanitizeUrlLabel(urlConfig.url)
  let progress: ScanProgress = {outcome, stage: 'browser_setup'}
  let server: playwright.BrowserServer | undefined
  let pendingLaunch: Promise<playwright.BrowserServer> | undefined
  let worker: ChildProcess | undefined
  let accepting = true
  let screenshotDir: string | undefined
  const screenshotRoot = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), '.screenshots')

  try {
    if (includeScreenshots) fs.mkdirSync(screenshotRoot, {recursive: true})
    screenshotDir = fs.mkdtempSync(path.join(includeScreenshots ? screenshotRoot : os.tmpdir(), '.accessibility-scan-'))
    server = await deadline.run(() => {
      pendingLaunch = playwright.chromium.launchServer({
        headless: true,
        executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined,
        timeout: Math.max(1, deadline.remaining()),
      })
      return pendingLaunch
    })
    if (deadline.remaining() === 0) throw new TimeoutError()
    worker = fork(new URL('../dist/scanWorker.js', import.meta.url), {
      env: {...process.env, SCANNER_SCREENSHOT_DIR: screenshotDir},
      execArgv: [],
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    const request: WorkerRequest = {
      endpoint: server.wsEndpoint(),
      urlConfig,
      authContext,
      includeScreenshots,
      reducedMotion,
      colorScheme,
      ignoreHttpsErrors,
    }
    const result = new Promise<UrlScanOutcome>((resolve, reject) => {
      worker!.on('message', (message: WorkerMessage | null) => {
        if (!accepting || deadline.controller.signal.aborted || deadline.remaining() === 0 || !message) return
        if (message.type === 'progress') {
          const findings = progress.outcome.findings
          findings.push(...message.progress.outcome.findings)
          progress = {...message.progress, outcome: {...message.progress.outcome, findings}}
        }
        if (message.type === 'result') resolve(message.outcome)
        if (message.type === 'error') reject(new Error('URL worker failed'))
      })
      worker!.once('error', reject)
      worker!.once('exit', () => reject(new Error('URL worker exited unexpectedly')))
      worker!.send(request, error => {
        if (error) reject(error)
      })
    })
    void result.catch(() => {})
    outcome = await deadline.run(() => result)
  } catch (error) {
    outcome = progress.outcome
    const status = getFailureStatus(error)
    const scan = outcome.scans.find(item => item.scanner === progress.scanner && item.status === 'not_started')
    if (scan) {
      scan.status = status
      scan.stage = progress.stage
    } else {
      for (const item of outcome.scans) {
        if (item.status === 'not_started') item.stage = progress.stage
      }
    }
    outcome.failures.push({
      requestedUrl: urlConfig.url,
      status,
      stage: progress.stage,
      ...(scan ? {scanner: scan.scanner} : {}),
    })
    core.error(`Accessibility scan ${status} during ${progress.stage} for ${safeUrl}`)
  } finally {
    accepting = false
    let workerError: unknown
    let browserError: unknown
    if (worker) {
      try {
        await stopWorker(worker)
      } catch (error) {
        workerError = error
        core.error(`Could not terminate URL worker for ${safeUrl}: ${String(error)}`)
      }
    }
    if (!server && pendingLaunch) {
      try {
        server = await new Deadline(1000).run(() => pendingLaunch!)
      } catch (error) {
        if (error instanceof TimeoutError) {
          void pendingLaunch
            .then(
              lateServer => killServer(lateServer, safeUrl),
              () => undefined,
            )
            .catch(lateError => core.error(`Could not terminate browser for ${safeUrl}: ${String(lateError)}`))
          browserError = new Error(`Cannot verify browser startup cleanup for ${safeUrl}`)
        }
      }
    }
    if (server) {
      try {
        const error = await killServer(server, safeUrl)
        if (error)
          outcome.failures.push({requestedUrl: urlConfig.url, status: getFailureStatus(error), stage: 'cleanup'})
      } catch (error) {
        browserError = error
      }
    }
    if (workerError) throw workerError
    if (screenshotDir) {
      try {
        const findingsWithScreenshots = outcome.findings.filter(finding => finding.screenshotId)
        if (findingsWithScreenshots.length) {
          for (const finding of findingsWithScreenshots) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finding.screenshotId!)) {
              throw new Error('Invalid screenshot ID')
            }
            const filename = `${finding.screenshotId}.png`
            fs.renameSync(path.join(screenshotDir, filename), path.join(screenshotRoot, filename))
          }
        }
      } catch (error) {
        core.error(`Accessibility scan screenshot publication failed for ${safeUrl}: ${String(error)}`)
        outcome.failures.push({requestedUrl: urlConfig.url, status: 'failed', stage: 'cleanup'})
      } finally {
        try {
          fs.rmSync(screenshotDir, {recursive: true, force: true})
        } catch (error) {
          core.error(`Accessibility scan screenshot cleanup failed for ${safeUrl}: ${String(error)}`)
          outcome.failures.push({requestedUrl: urlConfig.url, status: 'failed', stage: 'cleanup'})
        }
      }
    }
    if (browserError) throw browserError
  }
  return outcome
}

async function stopWorker(worker: ChildProcess) {
  if (worker.exitCode !== null || worker.signalCode !== null) {
    if (process.platform === 'win32') {
      throw new Error('Cannot verify cleanup of an exited URL worker process tree on Windows')
    }
    if (worker.pid) {
      try {
        process.kill(-worker.pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    return
  }
  let onExit: () => void = () => {}
  const exited = new Promise<void>(resolve => {
    onExit = resolve
    worker.once('exit', onExit)
  })
  try {
    if (!worker.pid) throw new Error('URL worker PID unavailable')
    if (process.platform === 'win32') {
      let taskkill: ChildProcess | undefined
      try {
        await new Deadline(1000).run(
          () =>
            new Promise<void>((resolve, reject) => {
              taskkill = execFile('taskkill', ['/PID', String(worker.pid), '/T', '/F'], error =>
                error ? reject(error) : resolve(),
              )
            }),
        )
      } catch (error) {
        taskkill?.kill('SIGKILL')
        if (worker.exitCode === null && worker.signalCode === null) {
          worker.kill('SIGKILL')
          await new Deadline(1000).run(() => exited)
        }
        throw new Error('Cannot verify cleanup of the URL worker process tree on Windows', {cause: error})
      }
    } else {
      try {
        process.kill(-worker.pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    await new Deadline(1000).run(() => exited)
  } finally {
    worker.removeListener('exit', onExit)
  }
}
