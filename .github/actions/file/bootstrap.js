#!/usr/bin/env node
//@ts-check

import fs from 'node:fs'
import * as url from 'node:url'
import { spawn } from 'node:child_process'

function spawnPromisified(command, args, options) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options)
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (data) => {
      console.log(data)
    })
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (data) => {
      console.error(data)
    })
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(code)
      } else {
        resolve(code)
      }
    })
  })
}

await (async () => {
  // If dependencies are not vendored-in, install them at runtime.
  try {
    await fs.accessSync(
      url.fileURLToPath(new URL('./node_modules', import.meta.url)),
      fs.constants.R_OK
    )
  } catch {
    try {
      await spawnPromisified('npm', ['ci'], {
        cwd: url.fileURLToPath(new URL('.', import.meta.url))
      })
    } catch {
      process.exit(1)
    }
  } finally {
    // Compile TypeScript.
    try {
      await spawnPromisified('npm', ['run', 'build'], {
        cwd: url.fileURLToPath(new URL('.', import.meta.url))
      })
    } catch {
      process.exit(1)
    }
    // Run the main script.
    const action = await import('./dist/index.js')
    await action.default()
  }
})()