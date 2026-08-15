/**
 * Lifecycle owner for the loopback DeepSeek Harness Web process.
 *
 * This module deliberately has no Electron import so its startup, diagnostics,
 * and shutdown behavior can be exercised in an ordinary Node test process.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { once } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { HarnessEndpoint, HarnessLaunchConfig } from './types.js'

const READY_PREFIX = 'dsh web: '
const STDERR_LIMIT = 32_768
const STOP_TIMEOUT_MS = 8_000

type State = 'stopped' | 'starting' | 'ready' | 'stopping'

/** Details recorded when a ready Harness process exits unexpectedly. */
export interface HarnessUnexpectedExit {
  readonly code: number | null
  readonly signal: NodeJS.Signals | null
  readonly diagnostics: string
}

/** A failure that includes the bounded diagnostics from the child process. */
export class HarnessLaunchError extends Error {
  /** @param message - launch failure summary. @param diagnostics - captured stderr and stdout tail. */
  constructor(message: string, readonly diagnostics: string) {
    super(message)
    this.name = 'HarnessLaunchError'
  }
}

/** Append text while retaining the most recent bounded tail. */
function appendTail(current: string, chunk: string): string {
  const combined = current + chunk
  return combined.length <= STDERR_LIMIT ? combined : combined.slice(-STDERR_LIMIT)
}

/** A managed dsh Web process with one start/stop lifecycle at a time. */
export class HarnessProcess {
  #state: State = 'stopped'
  #child: ChildProcessWithoutNullStreams | undefined
  #start: Promise<HarnessEndpoint> | undefined
  #stop: Promise<void> | undefined
  #diagnostics = ''
  #unexpectedExitListeners = new Set<(exit: HarnessUnexpectedExit) => void>()

  /** @param config - immutable launch values for this Desktop instance. */
  constructor(readonly config: HarnessLaunchConfig) {}

  /** Current bounded diagnostics tail, useful for a crash screen and support bundle. */
  get diagnostics(): string {
    return this.#diagnostics
  }

  /** Whether a Harness process is ready for a BrowserWindow to load. */
  get ready(): boolean {
    return this.#state === 'ready'
  }

  /** Subscribe to exits that occur after the Harness reported a ready endpoint. */
  onUnexpectedExit(listener: (exit: HarnessUnexpectedExit) => void): () => void {
    this.#unexpectedExitListeners.add(listener)
    return () => { this.#unexpectedExitListeners.delete(listener) }
  }

  /** Start dsh Web once and resolve after it prints a valid loopback endpoint. */
  start(): Promise<HarnessEndpoint> {
    if (this.#start !== undefined) return this.#start
    if (this.#state !== 'stopped') throw new Error(`Cannot start Harness while ${this.#state}`)
    this.#state = 'starting'
    this.#start = this.#startProcess().catch((error: unknown) => {
      this.#start = undefined
      this.#state = 'stopped'
      throw error
    })
    return this.#start
  }

  /** Gracefully stop the managed process, then force termination only after a bounded wait. */
  async stop(): Promise<void> {
    if (this.#stop !== undefined) return this.#stop
    const child = this.#child
    if (child === undefined) return
    this.#state = 'stopping'
    this.#stop = this.#stopProcess(child).finally(() => {
      this.#child = undefined
      this.#start = undefined
      this.#stop = undefined
      this.#state = 'stopped'
    })
    return this.#stop
  }

  async #startProcess(): Promise<HarnessEndpoint> {
    await mkdir(this.config.harnessHome, { recursive: true })
    const child = spawn(this.config.nodeExecutable, [
      this.config.cliEntrypoint,
      '--profile', 'web',
      '--port', '0',
    ], {
      cwd: this.config.workspace,
      env: { ...process.env, ...this.config.environment, DSH_HOME: this.config.harnessHome },
      shell: false,
      windowsHide: true,
      stdio: 'pipe',
    })
    this.#child = child

    const endpoint = await new Promise<HarnessEndpoint>((resolve, reject) => {
      let settled = false
      let readyReported = false
      let stdoutRemainder = ''
      const settle = (callback: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        callback()
      }
      const fail = (message: string): void => settle(() => reject(new HarnessLaunchError(message, this.#diagnostics)))
      const timeout = setTimeout(() => fail('DeepSeek Harness did not report a ready URL before startup timed out'), this.config.startupTimeoutMs ?? 60_000)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        this.#diagnostics = appendTail(this.#diagnostics, chunk)
        stdoutRemainder += chunk
        const lines = stdoutRemainder.split(/\r?\n/)
        stdoutRemainder = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith(READY_PREFIX)) continue
          try {
            const url = new URL(line.slice(READY_PREFIX.length))
            if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
              fail(`Harness reported a non-loopback URL: ${url}`)
              return
            }
            readyReported = true
            settle(() => resolve({ url }))
          } catch {
            fail(`Harness reported an invalid ready URL: ${line}`)
          }
          return
        }
      })
      child.stderr.on('data', (chunk: string) => { this.#diagnostics = appendTail(this.#diagnostics, chunk) })
      child.once('error', (error) => fail(`Could not start DeepSeek Harness: ${error.message}`))
      child.once('exit', (code, signal) => {
        if (!readyReported) {
          fail(`DeepSeek Harness exited during startup (code=${code ?? 'none'}, signal=${signal ?? 'none'})`)
          return
        }
        if (this.#state === 'stopping') return
        for (const listener of this.#unexpectedExitListeners) listener({ code, signal, diagnostics: this.#diagnostics })
      })
    })
    this.#state = 'ready'
    return endpoint
  }

  async #stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return
    child.kill('SIGTERM')
    const exit = once(child, 'exit').then(() => undefined)
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS))
    await Promise.race([exit, timeout])
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
  }
}
