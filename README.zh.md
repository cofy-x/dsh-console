# DSH Console

[English](README.md) | 简体中文

DSH Console 是一个基于 TypeScript 和 React/Ink 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 原生终端前端。你可以在终端中与 Agent 对话、查看工具执行、切换模型并恢复 Session。

![DSH Console 创建并运行 Python 程序](docs/assets/dsh-console-preview.jpg)

> [!WARNING]
>
> DSH Console 目前处于公开 Alpha 阶段。它已经使用真实的 DSH 契约和持久化 Session，但命令和界面细节在首个稳定版本之前仍可能发生变化。

## 快速开始

使用 Node.js 24 或更高版本安装 DeepSeek Harness 和 DSH Console：

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console
dsh-console
```

`dsh-console` launcher 会初始化或定位对应的 DSH profile，然后启动交互式 TUI。

也可以直接带 Prompt 启动：

```sh
dsh-console --prompt "hello"
```

可以续接当前目录下最新的可恢复 Session，或通过完整 Session ID 精确恢复；两种方式都可以在恢复后立即提交 Prompt：

```sh
dsh-console --continue
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef --prompt "继续这项工作"
```

如果 DeepSeek 官方 provider 缺少可由 DSH 配置的凭据，DSH Console 会在提交首个 Prompt 之前打开 masked setup dialog，并通过 DSH 写入凭据。只读环境凭据和尚未提供 Console setup adapter 的 provider 继续使用其既有 DSH 配置路径。DSH Console 不会维护独立的凭据存储。

Public Alpha 使用 `0.1.0-alpha.x` 等预发布版本号，同时通过 npm 默认的 `latest` 渠道提供，因此安装时不需要额外指定 dist-tag。

## 主要能力

- 支持 Markdown、reasoning、中断和 usage 展示的流式多轮对话
- 展示 DSH 工具调用、结果、审批、问题和 todo 状态，并提供可浏览的 `/tools` 目录
- 支持 DSH 原生模型选择、通过 `@path` 或剪贴板输入图片，以及隔离的 prompt completion
- 支持启动续接，并使用 `/new`、`/sessions` 和 `/resume` 管理持久化 DSH Session
- 支持本地 Shell 模式、主题、设置、安全的终端清理，以及在普通 PTY 或 Orca 等嵌入式终端中持续运行

## 交互命令

| 命令                   | 用途                                     |
| :--------------------- | :--------------------------------------- |
| `/model`               | 选择当前 DSH 模型                        |
| `/new`                 | 创建新的对话                             |
| `/sessions`            | 浏览当前目录下可恢复的 Session           |
| `/resume [session-id]` | 浏览 Session，或通过完整 Session ID 恢复 |
| `/tools`               | 查看当前 DSH Agent 暴露的工具            |
| `/theme`               | 选择终端主题                             |
| `/settings`            | 修改 Console 设置                        |
| `!command`             | 在本地执行命令，不提交给模型             |

Turn 运行期间，`Ctrl+C` 会取消当前 DSH 操作。空闲时，`Ctrl+C` 会释放运行时、恢复终端并退出。

## Session 与本地数据

DSH 是对话历史的唯一事实源。DSH Console 会列出当前工作目录下可恢复的顶层 `dsh-console-*` Session，回放其规范 DSH event surface，并通过 DSH 恢复 Session。它不会维护一套并行的客户端 Session 数据库。

当前使用的 `DSH_HOME` 决定 profile、JSONL Session 日志和附件对象的存储位置。可以通过它隔离运行环境：

```sh
DSH_HOME=/tmp/dsh-console-home dsh-console --prompt "hello"
```

## DSH 原生设计

DeepSeek Harness 负责 Agent 执行、模型、provider 设置和凭据、Session、工具、审批、附件、持久化和规范事件。DSH Console 负责终端交互、输入预处理、界面呈现，以及面向这些公开 DSH 服务的专用 adapter。

- Runtime adapter 使用 DSH 官方规范类型，并在 React 渲染前将其投影成稳定的 Console View Model。
- Session replay 和实时流式事件共用同一个 projector，使文本、reasoning、工具、todo 状态、usage、错误和中断保持一致。
- 图片必须先由 DSH attachment service 接纳，随后才能创建用户 Turn；接纳失败时不会静默降级为纯文本输入。
- Prompt completion 使用独立的临时 Agent/Session，绝不会写入当前对话。

公开 package 包含 launcher、编译后的 Console runtime、DSH plugin bundle、许可证和归属声明。Runtime plugin 仍由所选 DSH profile 提供。

## Alpha 边界

当前版本暂不提供跨目录 Session 搜索、Session rename/delete/fork、通用文件/PDF/audio/video 附件、原生终端图片协议、Web UI 或独立 provider/auth 层。

## 开发

安装 workspace，并运行与公开 package 相同的入口：

```sh
pnpm install --frozen-lockfile
pnpm run build:cli
pnpm start -- --prompt "hello"
```

开发需要 Node.js 24 或更高版本以及 pnpm 11。主要质量检查包括：

```sh
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build:cli
pnpm run test:ci
pnpm run test:integration:dsh
pnpm run test:package
```

`format:check` 会增量检查已变更文件且不会修改工作树。`test:integration:dsh` 使用确定性的 fake LLM adapter 组合真实 Cordis/DSH runtime。`test:package` 会打包公开 package，在隔离目录中安装它，初始化隔离的 `DSH_HOME`，并运行已安装的 launcher。

## 许可证与归属

DSH Console 使用 Apache License 2.0。详见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。部分终端 UI 和支持工具衍生自 Gemini CLI，并保留其原始版权声明。
