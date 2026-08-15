/** Resolve the managed runtime location for development and packaged application modes. */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { HarnessLaunchConfig } from './types.js'

/** Values injected by Electron's main process or direct Node tests. */
export interface RuntimeOptions {
  readonly appData: string
  readonly packaged: boolean
  readonly resourcesPath?: string
  readonly workspace?: string
  readonly environment?: NodeJS.ProcessEnv
  /** Platform whose packaged Node layout should be resolved; tests may override the host. */
  readonly platform?: NodeJS.Platform
}

/** Resolve explicit runtime paths; source-checkout paths are never guessed. */
export function resolveRuntime(options: RuntimeOptions): HarnessLaunchConfig {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const workspace = resolve(options.workspace ?? environment.DSH_DESKTOP_WORKSPACE ?? homedir())
  const harnessHome = join(options.appData, 'harness')
  if (options.packaged) {
    const runtimeRoot = join(options.resourcesPath ?? process.resourcesPath, 'runtime')
    const nodeExecutable = platform === 'win32'
      ? join(runtimeRoot, 'node', 'node.exe')
      : join(runtimeRoot, 'node', 'bin', 'node')
    const cliEntrypoint = join(runtimeRoot, 'dsh', 'lib', 'bin.js')
    return { nodeExecutable, cliEntrypoint, harnessHome, workspace }
  }
  const nodeExecutable = environment.DSH_DESKTOP_NODE
  const cliEntrypoint = environment.DSH_DESKTOP_DSH_BIN
  if (nodeExecutable === undefined || cliEntrypoint === undefined) {
    throw new Error('Development requires DSH_DESKTOP_NODE and DSH_DESKTOP_DSH_BIN to point at a built Harness runtime')
  }
  if (!existsSync(nodeExecutable) || !existsSync(cliEntrypoint)) {
    throw new Error('Configured Harness runtime paths do not exist; run the Harness build and update DSH_DESKTOP_NODE / DSH_DESKTOP_DSH_BIN')
  }
  return { nodeExecutable, cliEntrypoint, harnessHome, workspace }
}
