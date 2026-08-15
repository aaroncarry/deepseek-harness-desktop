import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { resolveRuntime } from '../src/runtime.js'

describe('resolveRuntime', () => {
  it('requires explicit development runtime paths', () => {
    expect(() => resolveRuntime({ appData: 'C:/data', packaged: false, environment: {} })).toThrow('DSH_DESKTOP_NODE')
  })

  it('uses the packaged runtime layout without reading development environment variables', () => {
    const runtime = resolveRuntime({ appData: 'C:/data', packaged: true, resourcesPath: 'C:/resources', environment: {} })
    expect(runtime.harnessHome).toBe(join('C:/data', 'harness'))
    expect(runtime.cliEntrypoint).toContain('C:')
    expect(runtime.workspace).toBeDefined()
  })

  it('uses the macOS Node distribution layout for a packaged application', () => {
    const runtime = resolveRuntime({
      appData: '/Users/test/Library/Application Support/dsh-desktop',
      packaged: true,
      resourcesPath: '/Applications/DeepSeek Harness Desktop.app/Contents/Resources',
      environment: {},
      platform: 'darwin',
    })
    expect(runtime.nodeExecutable.replaceAll('\\', '/'))
      .toBe('/Applications/DeepSeek Harness Desktop.app/Contents/Resources/runtime/node/bin/node')
    expect(runtime.cliEntrypoint.replaceAll('\\', '/'))
      .toBe('/Applications/DeepSeek Harness Desktop.app/Contents/Resources/runtime/dsh/lib/bin.js')
  })
})
