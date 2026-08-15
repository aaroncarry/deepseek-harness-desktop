import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { HarnessProcess } from '../src/harness-process.js'
import type { HarnessEndpoint } from '../src/types.js'
import { resolveRuntime } from '../src/runtime.js'

const nodeExecutable = process.env.DSH_DESKTOP_NODE
const cliEntrypoint = process.env.DSH_DESKTOP_DSH_BIN
const enabled = nodeExecutable !== undefined && cliEntrypoint !== undefined
const running: HarnessProcess[] = []

afterEach(async () => { await Promise.all(running.splice(0).map(process => process.stop())) })

describe.skipIf(!enabled)('built DeepSeek Harness Web runtime', () => {
  it('serves the assembled browser surface over a managed loopback endpoint', async () => {
    const harness = new HarnessProcess({
      nodeExecutable: nodeExecutable!,
      cliEntrypoint: cliEntrypoint!,
      harnessHome: await mkdtemp(join(tmpdir(), 'dsh-desktop-harness-')),
      workspace: process.cwd(),
      startupTimeoutMs: 75_000,
    })
    running.push(harness)
    const endpoint = await harness.start()
    const response = await fetch(endpoint.url)
    expect(response.ok).toBe(true)
    const html = await response.text()
    expect(html).toContain('__DSH_BOOT__')
    expect(html).toContain('@deepseek-ai/dsh-client-runtime')
  })
})

const packagedResources = join(process.cwd(), 'resources')
const packagedEnabled = existsSync(join(packagedResources, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'bin/node'))
  && existsSync(join(packagedResources, 'runtime', 'dsh', 'lib', 'bin.js'))

describe.skipIf(!packagedEnabled)('staged release runtime', () => {
  it('starts from self-contained resources without the source checkout paths', async () => {
    const appData = await mkdtemp(join(tmpdir(), 'dsh-desktop-package-'))
    const runtime = resolveRuntime({ appData, packaged: true, resourcesPath: packagedResources, environment: {} })
    const harness = new HarnessProcess({ ...runtime, workspace: process.cwd(), startupTimeoutMs: 75_000 })
    running.push(harness)
    let endpoint: HarnessEndpoint
    try {
      endpoint = await harness.start()
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${harness.diagnostics}`)
    }
    await expect(fetch(endpoint.url)).resolves.toMatchObject({ ok: true })
  })
})
