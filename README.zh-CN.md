# DeepSeek Harness Desktop

[English](README.md)

DeepSeek Harness Desktop 是 DeepSeek Harness Web 的 Electron 桌面宿主。界面直接使用现有的 Harness Web 产品；本项目负责桌面窗口、独立的 Harness 数据目录、sidecar 生命周期、诊断信息以及跨平台打包。

## 开发

先构建 DeepSeek Harness，再将本项目指向构建后的 CLI：

```powershell
$env:DSH_DESKTOP_NODE = (Get-Command node).Source
$env:DSH_DESKTOP_DSH_BIN = 'D:\Code\deepseek-harness\apps\cli\lib\bin.js'
pnpm install
pnpm start
```

应用会让托管的 Harness Web 服务监听随机的本机回环端口，并将会话、凭据、设置和 profile 存储在 Electron 的用户数据目录下。默认情况下，桌面端不会与单独安装的 CLI 共享 `$DSH_HOME`。

## 验证

```powershell
pnpm check
pnpm test
pnpm test:integration
```

`test:integration` 会启动真实构建的 Harness；当 staged runtime 存在时，也会验证自包含发布运行时。测试会确认每个运行时都能报告有效的本机回环地址。依赖模型的检查还需要显式配置 DeepSeek 凭据。

## 打包

发布打包前，需要从 Harness 源码目录创建生产运行时闭包，并准备匹配目标平台的 Node.js 发行版：

```powershell
pnpm stage:runtime D:\Code\deepseek-harness D:\nodejs
pnpm dist:win
```

stage 命令会解析 Harness 锁定的生产依赖图，将 pnpm 链接物化为普通目录，加入 assembled profile 所需的本地 peer package，并复制到 `resources/runtime/`。macOS 打包需要使用对应的 macOS Node.js 发行版，并在 macOS 上运行相同的命令。安装后的用户不需要另外安装 Node.js 或 pnpm。

项目内置的 GitHub Actions 工作流会在每次变更时运行 Windows、Apple Silicon macOS 和 Intel macOS 检查。手动触发的打包任务当前只生成 Windows NSIS 安装程序；macOS 打包将在后续单独处理原生 DMG 工具链后启用。触发工作流时可通过 `harness_ref` 指定要打包的 Harness 版本。

## 安全模型

桌面端主进程负责本地 Harness sidecar，只接受 sidecar 输出的本机回环地址；渲染器禁用 Node.js 集成和通用 IPC 桥接，并阻止应用内导航到其他页面。新窗口只能将 `http` 和 `https` 链接交给操作系统打开。sidecar 监听随机的本机回环端口，并将状态保存在应用用户数据目录中。
