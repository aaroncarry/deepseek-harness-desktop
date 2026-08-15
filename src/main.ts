/** Electron main process: window ownership plus the managed Harness Web runtime. */

import { app, BrowserWindow, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { HarnessProcess } from './harness-process.js'
import { resolveRuntime } from './runtime.js'
import { isSafeExternalUrl } from './external-url.js'

const sourceDir = dirname(fileURLToPath(import.meta.url))
let harness: HarnessProcess | undefined
let window: BrowserWindow | undefined
const exitAfterLoad = process.env.DSH_DESKTOP_TEST_EXIT_AFTER_LOAD === '1'

if (exitAfterLoad) app.disableHardwareAcceleration()

/** Open exactly one locked-down application window. */
function createWindow(url: URL): BrowserWindow {
  const browser = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    icon: join(sourceDir, '../assets/harness-orca.svg'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(sourceDir, 'preload.js'),
    },
  })
  browser.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isSafeExternalUrl(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  browser.webContents.on('will-navigate', (event, target) => {
    if (target !== url.toString()) event.preventDefault()
  })
  browser.webContents.once('did-finish-load', () => {
    if (!exitAfterLoad) return
    process.stdout.write('dsh-desktop: renderer-loaded\n')
    app.quit()
  })
  browser.once('closed', () => { window = undefined })
  browser.once('ready-to-show', () => browser.show())
  void browser.loadURL(url.toString())
  return browser
}

app.whenReady().then(async () => {
  try {
    harness = new HarnessProcess(resolveRuntime({
      appData: app.getPath('userData'),
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    }))
    harness.onUnexpectedExit(({ code, signal }) => {
      const reason = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`
      void dialog.showMessageBox({
        type: 'error',
        title: 'DeepSeek Harness stopped unexpectedly',
        message: `The local Harness runtime stopped with ${reason}. The desktop app will close.`,
      }).finally(() => app.quit())
    })
    const endpoint = await harness.start()
    window = createWindow(endpoint.url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox({ type: 'error', title: 'DeepSeek Harness Desktop could not start', message })
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (harness === undefined) return
  event.preventDefault()
  const running = harness
  harness = undefined
  void running.stop().finally(() => app.quit())
})

app.on('activate', () => {
  if (window !== undefined || harness === undefined || !harness.ready) return
  void harness.start().then(endpoint => { window = createWindow(endpoint.url) })
})
