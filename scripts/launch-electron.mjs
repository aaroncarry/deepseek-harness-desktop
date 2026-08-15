/** Launch Electron directly from its downloaded distribution without invoking its downloader on every run. */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const executable = process.platform === 'win32'
  ? join('node_modules', 'electron', 'dist', 'electron.exe')
  : join('node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
if (!existsSync(executable)) {
  throw new Error(`Electron binary is missing at ${executable}; run pnpm install with Electron's platform binary available`)
}
const child = spawn(executable, ['.'], { stdio: 'inherit', env: process.env, shell: false })
child.once('exit', (code, signal) => {
  if (signal !== null) process.exitCode = 1
  else process.exitCode = code ?? 1
})
