import {execFileSync, spawn} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {beforeAll, describe, expect, it, vi} from 'vitest'
import playwright from 'playwright'
import {AuthContext} from '../src/AuthContext.js'
import {findForUrl} from '../src/findForUrl.js'
import {superviseUrl} from '../src/superviseUrl.js'

const executable = process.env.CI ? '/usr/bin/google-chrome' : playwright.chromium.executablePath()
const root = process.cwd()

describe.skipIf(process.platform === 'win32' || !fs.existsSync(executable))('process recovery', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [
      path.join(root, '.github/actions/find/node_modules/typescript/bin/tsc'),
      '-p',
      path.join(root, '.github/actions/find/tsconfig.json'),
    ])
  })

  it('kills a stopped browser and scans the next URL', async () => {
    const launch = playwright.chromium.launchServer.bind(playwright.chromium)
    let pid = 0
    const spy = vi.spyOn(playwright.chromium, 'launchServer').mockImplementationOnce(async options => {
      const server = await launch(options)
      pid = server.process().pid!
      process.kill(-pid, 'SIGSTOP')
      return server
    })
    const started = Date.now()
    try {
      const failed = await superviseUrl(
        {url: 'data:text/html,<title>First</title>'},
        new AuthContext({}),
        false,
        undefined,
        undefined,
        false,
        3000,
      )
      expect(Date.now() - started).toBeLessThan(8000)
      expect(failed.failures.some(failure => failure.status === 'timed_out')).toBe(true)
      expect(pid).toBeGreaterThan(0)
      expect(() => process.kill(pid, 0)).toThrow()
      pid = 0

      const url = 'data:text/html,<title>Second</title><main>Hello</main>'
      const next = await superviseUrl({url}, new AuthContext({}), false, undefined, undefined, false, 10000)
      expect(next.scans[0].status).toBe('completed')
      expect(next.failures).toEqual([])
      expect(next.findings).toEqual(await findForUrl({url}))
    } finally {
      spy.mockRestore()
      if (pid) {
        try {
          process.kill(-pid, 'SIGKILL')
        } catch {
          // The browser has already exited.
        }
      }
    }
  }, 20000)

  it.each(['plugin', 'screenshot', 'cleanup', 'exit'])(
    'recovers a stuck worker during %s',
    async fault => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-worker-test-'))
      const pluginDir = path.join(dir, '.github/scanner-plugins/hung')
      fs.mkdirSync(pluginDir, {recursive: true})
      fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}')
      const faults = {
        plugin: `
          await addFinding(finding);
          const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
          writeFileSync('descendant.pid', String(child.pid));
          setInterval(() => {}, 1000);
          while (true) {}
        `,
        screenshot: 'page.screenshot = () => new Promise(() => {}); await addFinding(finding)',
        cleanup: 'page.context().close = () => new Promise(() => {}); return',
        exit: `
          const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
          writeFileSync('descendant.pid', String(child.pid));
          process.exit(1);
        `,
      }
      fs.writeFileSync(
        path.join(pluginDir, 'index.js'),
        `
        import {spawn} from 'node:child_process';
        import {writeFileSync} from 'node:fs';
      export const name = 'hung';
      export default async ({page, addFinding}) => {
        const finding = {scannerType: 'hung', url: page.url(), problemShort: 'x', problemUrl: '', solutionShort: ''};
        if (page.url().includes('first')) { ${faults[fault]} }
        else await addFinding(finding);
      }
    `,
      )
      const moduleUrl = pathToFileURL(path.join(root, '.github/actions/find/dist/superviseUrl.js')).href
      const authUrl = pathToFileURL(path.join(root, '.github/actions/find/dist/AuthContext.js')).href
      const script = `
      import {superviseUrl} from ${JSON.stringify(moduleUrl)};
      import {AuthContext} from ${JSON.stringify(authUrl)};
      const scan = (url, timeout) => superviseUrl({url}, new AuthContext({}), true, undefined, undefined, false, timeout);
      const start = Date.now();
      const first = await scan('data:text/html,<title>first</title>', 3000);
      const firstMs = Date.now() - start;
      const next = await scan('data:text/html,<title>second</title>', 10000);
      process.send({first, next, firstMs});
    `
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
        cwd: dir,
        env: {...process.env, INPUT_SCANS: '["hung","axe"]', GITHUB_WORKSPACE: dir},
        stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      })
      let result:
        | {
            first: Awaited<ReturnType<typeof superviseUrl>>
            next: Awaited<ReturnType<typeof superviseUrl>>
            firstMs: number
          }
        | undefined
      child.on('message', message => {
        result = message as typeof result
      })
      try {
        const code = await new Promise<number | null>((resolve, reject) => {
          const timer = setTimeout(() => {
            child.kill('SIGTERM')
            reject(new Error('Supervisor did not exit after the plugin deadline'))
          }, 15000)
          child.once('error', error => {
            clearTimeout(timer)
            reject(error)
          })
          child.once('close', exitCode => {
            clearTimeout(timer)
            resolve(exitCode)
          })
        })
        expect(code).toBe(0)
        expect(result?.firstMs).toBeLessThan(8000)
        if (fault === 'cleanup') {
          expect(result?.first.failures).toContainEqual({
            requestedUrl: 'data:text/html,<title>first</title>',
            status: 'timed_out',
            stage: 'cleanup',
          })
        } else if (fault === 'exit') {
          expect(result?.first.failures[0].status).toBe('failed')
        } else {
          expect(result?.first.scans.find(scan => scan.scanner === 'hung')?.status).toBe('timed_out')
          expect(result?.first.scans.find(scan => scan.scanner === 'axe')?.status).toBe('not_started')
          if (fault === 'screenshot') expect(result?.first.findings).toEqual([])
          if (fault === 'plugin') expect(result?.first.findings).toHaveLength(1)
        }
        if (fault === 'plugin' || fault === 'exit') {
          const pid = Number(fs.readFileSync(path.join(dir, 'descendant.pid'), 'utf8'))
          try {
            const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {encoding: 'utf8'}).trim()
            expect(state.startsWith('Z')).toBe(true)
          } catch (error) {
            expect((error as {status?: number}).status).toBe(1)
          }
        }
        expect(result?.next.scans.find(scan => scan.scanner === 'axe')?.status).toBe('completed')
        expect(result?.next.failures).toEqual([])
        const screenshot = result?.next.findings.find(finding => finding.scannerType === 'hung')?.screenshotId
        expect(screenshot).toBeTruthy()
        expect(fs.existsSync(path.join(dir, '.screenshots', `${screenshot}.png`))).toBe(true)
        const expectedScreenshots = [...(result?.first.findings ?? []), ...(result?.next.findings ?? [])]
          .map(finding => finding.screenshotId)
          .filter(Boolean)
        expect(fs.readdirSync(path.join(dir, '.screenshots')).sort()).toEqual(
          expectedScreenshots.map(id => `${id}.png`).sort(),
        )
      } finally {
        fs.rmSync(dir, {recursive: true, force: true})
      }
    },
    20000,
  )
})
