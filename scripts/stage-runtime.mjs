/**
 * Build a self-contained release runtime from a DeepSeek Harness checkout.
 *
 * A workspace checkout uses links for its packages. The deploy step resolves
 * the locked production graph, then this script materializes its links into
 * ordinary directories for an Electron resource tree.
 */

import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, realpath, rm, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const [harnessSource, nodeDistribution] = process.argv.slice(2)
if (harnessSource === undefined || nodeDistribution === undefined) {
  throw new Error('Usage: pnpm stage:runtime <deepseek-harness-source> <node-distribution>')
}

const sourceRoot = resolve(harnessSource)
const nodeRoot = resolve(nodeDistribution)
const deployRoot = resolve('.desktop-stage', 'dsh')
const flatRoot = resolve('.desktop-stage', 'flat')

/** Run one command while preserving its diagnostics. */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: false })
}

/** Find the pnpm JavaScript CLI even where Windows exposes only pnpm.cmd. */
async function resolvePnpmCli() {
  if (process.env.DSH_DESKTOP_PNPM_CLI !== undefined) return resolve(process.env.DSH_DESKTOP_PNPM_CLI)
  if (process.platform !== 'win32') {
    if (process.env.npm_execpath !== undefined) return resolve(process.env.npm_execpath)
    throw new Error('pnpm CLI path is unavailable; run through pnpm or set DSH_DESKTOP_PNPM_CLI')
  }
  const command = execFileSync('where.exe', ['pnpm.cmd'], { encoding: 'utf8', shell: false })
    .split(/\r?\n/).find(Boolean)
  if (command === undefined) throw new Error('pnpm.cmd is not on PATH; set DSH_DESKTOP_PNPM_CLI to pnpm.mjs')
  const source = await readFile(command, 'utf8')
  const match = source.match(/%~dp0([^"\r\n]*node_modules\\pnpm\\bin\\pnpm\.(?:mjs|cjs))/i)
  if (match?.[1] === undefined) throw new Error(`Could not resolve pnpm JavaScript CLI from ${command}`)
  return resolve(dirname(command), match[1])
}

/** Copy a pnpm deployment into an ordinary, link-free Node resolution tree. */
async function materializeDeployment() {
  await rm(flatRoot, { recursive: true, force: true })
  await cp(deployRoot, flatRoot, {
    recursive: true,
    filter: (candidate) => basename(candidate) !== 'node_modules',
  })
  const virtualStore = join(deployRoot, 'node_modules', '.pnpm')
  const copied = new Set()
  const copyPackage = async (source) => {
    const resolved = await realpath(source)
    const manifest = JSON.parse(await readFile(join(resolved, 'package.json'), 'utf8'))
    if (typeof manifest.name !== 'string' || copied.has(manifest.name)) return
    copied.add(manifest.name)
    const destination = join(flatRoot, 'node_modules', ...manifest.name.split('/'))
    await mkdir(dirname(destination), { recursive: true })
    await cp(resolved, destination, {
      recursive: true,
      filter: (candidate) => basename(candidate) !== 'node_modules',
    })
  }
  const visit = async (directory, scope = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.bin') continue
      const source = join(directory, entry.name)
      if (entry.name.startsWith('@') && scope.length === 0) {
        await visit(source, entry.name)
        continue
      }
      await copyPackage(source)
    }
  }
  for (const entry of await readdir(virtualStore, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const modules = join(virtualStore, entry.name, 'node_modules')
    if ((await stat(modules).catch(() => undefined))?.isDirectory() === true) await visit(modules)
  }
  for (const group of ['packages', 'vendor']) {
    const groupRoot = join(sourceRoot, group)
    for (const entry of await readdir(groupRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const first = join(groupRoot, entry.name)
      if (group === 'vendor') {
        if ((await stat(join(first, 'package.json')).catch(() => undefined))?.isFile() === true) await copyPackage(first)
        continue
      }
      for (const child of await readdir(first, { withFileTypes: true })) {
        if (!child.isDirectory()) continue
        const packageRoot = join(first, child.name)
        if ((await stat(join(packageRoot, 'package.json')).catch(() => undefined))?.isFile() === true) {
          await copyPackage(packageRoot)
        }
      }
    }
  }
}

for (const candidate of [sourceRoot, nodeRoot]) {
  if ((await stat(candidate).catch(() => undefined))?.isDirectory() !== true) {
    throw new Error(`Runtime input is not a directory: ${candidate}`)
  }
}
await rm(deployRoot, { recursive: true, force: true })
const deployArgs = ['--dir', sourceRoot, '--config.inject-workspace-packages=true', '--filter', '@deepseek-ai/dsh', '--prod', 'deploy', '--ignore-scripts', deployRoot]
if (process.platform === 'win32') {
  // Corepack's pnpm.cmd is the stable entry point on hosted Windows runners;
  // its internal cache layout is not a public path that can be parsed.
  execFileSync('pnpm.cmd', deployArgs, { cwd: sourceRoot, stdio: 'inherit', shell: true })
} else {
  const pnpmCli = await resolvePnpmCli()
  run(process.execPath, [pnpmCli, ...deployArgs], sourceRoot)
}
await materializeDeployment()
run(process.execPath, [resolve('scripts/prepare-runtime.mjs'), nodeRoot, flatRoot], process.cwd())
