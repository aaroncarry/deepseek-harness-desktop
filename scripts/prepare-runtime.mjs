/**
 * Prepare the release-only runtime directory.
 *
 * The caller supplies a prebuilt Node distribution and a deployable Harness
 * runtime. Keeping this explicit prevents a release from silently packaging a
 * developer checkout or an Electron-incompatible Node binary.
 */

import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const [nodeSource, harnessSource] = process.argv.slice(2)
if (nodeSource === undefined || harnessSource === undefined) {
  throw new Error('Usage: pnpm prepare:runtime <node-distribution> <harness-runtime-directory>')
}
for (const candidate of [nodeSource, harnessSource]) {
  const info = await stat(resolve(candidate)).catch(() => undefined)
  if (info?.isDirectory() !== true) throw new Error(`Runtime input is not a directory: ${candidate}`)
}
const harnessEntrypoint = resolve(harnessSource, 'lib', 'bin.js')
if ((await stat(harnessEntrypoint).catch(() => undefined))?.isFile() !== true) {
  throw new Error(`Harness runtime must be a pnpm deploy output containing lib/bin.js: ${harnessSource}`)
}
const destination = resolve('resources/runtime')
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(resolve(nodeSource), resolve(destination, 'node'), { recursive: true, dereference: true })
// pnpm deploy uses symlinks in its node_modules graph. Release resources must
// contain real files so Windows installs do not require Developer Mode or a
// symlink privilege at extraction time.
await cp(resolve(harnessSource), resolve(destination, 'dsh'), { recursive: true, dereference: true })
