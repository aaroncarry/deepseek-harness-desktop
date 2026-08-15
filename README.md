# DeepSeek Harness Desktop

Electron desktop host for a DeepSeek Harness Web runtime. The renderer is the existing Harness Web product; this project owns the desktop window, a dedicated Harness home, sidecar lifecycle, diagnostics, and platform packaging.

## Development

Build DeepSeek Harness first, then point this project at its built CLI:

```powershell
$env:DSH_DESKTOP_NODE = (Get-Command node).Source
$env:DSH_DESKTOP_DSH_BIN = 'D:\Code\deepseek-harness\apps\cli\lib\bin.js'
pnpm install
pnpm start
```

The app binds its managed runtime to a random loopback port and stores sessions, credentials, settings, and profiles below the Electron user-data directory. It does not share `$DSH_HOME` with a separately installed CLI by default.

## Validation

```powershell
pnpm check
pnpm test
pnpm test:integration
```

`test:integration` starts both the real built Harness and, when staged resources exist, the self-contained release runtime. It verifies that each reaches a loopback ready endpoint. Model-backed checks additionally require an explicitly configured DeepSeek credential.

## Packaging

For release packaging, create a production Harness closure from its source checkout and a matching platform Node distribution:

```powershell
pnpm stage:runtime D:\Code\deepseek-harness D:\nodejs
pnpm dist:win
```

The stage command resolves Harness's locked production graph, materializes pnpm links into ordinary directories, includes local peer packages required by the assembled profile, and copies the closure into `resources/runtime/`. macOS uses the corresponding macOS Node distribution and runs the same command on macOS. Both installers use the self-contained runtime; the end-user machine does not need Node or pnpm.

The included GitHub Actions workflow runs checks on Windows, Apple Silicon macOS, and Intel macOS for each change. Its manual packaging job checks out the matching Harness revision and creates a native NSIS installer plus separate Apple Silicon and Intel macOS disk images. Set the `harness_ref` input to the release revision being packaged.

## Security model

The desktop main process owns the local Harness sidecar. It accepts only the loopback URL the sidecar prints, gives the renderer no Node integration or generic IPC bridge, and blocks in-window navigation. New windows may hand off only `http` and `https` links to the operating system. The sidecar binds a random loopback port and keeps its state under the app's user-data directory.
