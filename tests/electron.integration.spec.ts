import { describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const nodeExecutable = process.env.DSH_DESKTOP_NODE
const cliEntrypoint = process.env.DSH_DESKTOP_DSH_BIN
const launcher = join(process.cwd(), 'scripts', 'launch-electron.mjs')
const electron = join(process.cwd(), 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'Electron.app')
const enabled = nodeExecutable !== undefined && cliEntrypoint !== undefined && existsSync(electron)

describe.skipIf(!enabled)('Electron desktop shell', () => {
  it('loads the live Harness Web page in a locked-down BrowserWindow and stops cleanly', async () => {
    const child = spawn(nodeExecutable!, [launcher], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DSH_DESKTOP_NODE: nodeExecutable,
        DSH_DESKTOP_DSH_BIN: cliEntrypoint,
        DSH_DESKTOP_TEST_EXIT_AFTER_LOAD: '1',
      },
      shell: false,
      stdio: 'pipe',
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { output += chunk })
    child.stderr.on('data', (chunk: string) => { output += chunk })
    const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null]
    expect(signal).toBeNull()
    expect(code).toBe(0)
    expect(output).toContain('dsh-desktop: renderer-loaded')
  })
})
