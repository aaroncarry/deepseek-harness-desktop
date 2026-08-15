/** Apply the black Harness orca icon with rcedit, which supports large Electron executables. */

import { join } from 'node:path'

/** Set the executable icon after Electron Builder has assembled a Windows application. */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const { rcedit } = await import('rcedit')
  const icon = join(context.packager.projectDir, 'assets', 'harness-orca.ico')
  const executable = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  await rcedit(executable, { icon })
}
