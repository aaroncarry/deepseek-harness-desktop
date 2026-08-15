import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HarnessLaunchError, HarnessProcess } from '../src/harness-process.js'

const fixture = fileURLToPath(new URL('./fixtures/fake-dsh.mjs', import.meta.url))
const running: HarnessProcess[] = []

afterEach(async () => { await Promise.all(running.splice(0).map(process => process.stop())) })

function config(home: string, environment: Record<string, string | undefined> = {}) {
  return {
    nodeExecutable: process.execPath,
    cliEntrypoint: fixture,
    harnessHome: home,
    workspace: dirname(fixture),
    environment,
    startupTimeoutMs: 1_000,
  }
}

describe('HarnessProcess', () => {
  it('waits for a loopback ready URL and terminates the child', async () => {
    const process = new HarnessProcess(config(await mkdtemp(join(tmpdir(), 'dsh-desktop-'))))
    running.push(process)
    await expect(process.start()).resolves.toMatchObject({ url: new URL('http://127.0.0.1:42000') })
    expect(process.ready).toBe(true)
    await process.stop()
    expect(process.ready).toBe(false)
  })

  it('rejects a non-loopback endpoint before exposing it to Electron', async () => {
    const process = new HarnessProcess(config(await mkdtemp(join(tmpdir(), 'dsh-desktop-')), {
      FAKE_DSH_URL: 'https://example.invalid',
    }))
    running.push(process)
    await expect(process.start()).rejects.toBeInstanceOf(HarnessLaunchError)
  })

  it('reports an exit after a ready endpoint', async () => {
    const process = new HarnessProcess(config(await mkdtemp(join(tmpdir(), 'dsh-desktop-')), {
      FAKE_DSH_EXIT_AFTER_READY: '1',
    }))
    const exited = new Promise(resolve => process.onUnexpectedExit(resolve))
    await process.start()
    await expect(exited).resolves.toMatchObject({ code: 23 })
  })

  it('fails with a startup diagnostic when no endpoint is reported', async () => {
    const process = new HarnessProcess(config(await mkdtemp(join(tmpdir(), 'dsh-desktop-')), {
      FAKE_DSH_READY_DELAY_MS: '5000',
    }))
    running.push(process)
    await expect(process.start()).rejects.toThrow('startup timed out')
  })
})
