# DSH Console

[English](README.md) | 简体中文

DSH Console 是一个基于 TypeScript 和 React/Ink 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 终端前端。它在客户端负责终端交互和界面呈现，并使用 DSH 作为 Agent、模型、Session、工具、审批和附件的规范运行时。

> [!WARNING]
>
> DSH Console 目前处于公开 Alpha 阶段。它已经使用真实的 DSH 契约和持久化 Session，但命令和界面细节在首个稳定版本之前仍可能发生变化。

## 当前能力

- 支持 Markdown 和 reasoning 展示的流式多轮对话
- 通过 `/model` 进行 DSH 原生模型选择
- 通过 `@path` 引用和系统剪贴板输入图片
- 展示 DSH 工具调用、结果、审批和问题，并提供 `/tools`
- 基于 DSH 的 Session 持久化，以及 `/new`、`/sessions` 和 `/resume`
- 使用独立 DSH Agent/Session 的 prompt completion
- 支持 `!command` Shell 模式、主题、设置和安全的终端清理
- 可持续运行在普通 PTY 或 Orca 等嵌入式终端中

## 环境要求

- Node.js 24 或更高版本
- 从源码开发时使用 pnpm 11
- 可用的 DSH 安装和 provider 配置

Provider 凭据、模型路由、Session 日志和附件对象均由 DSH 管理。DSH Console 不提供独立的认证或 provider 存储层。

## 从源码运行

```sh
pnpm install --frozen-lockfile
pnpm run build:cli
pnpm start -- --prompt "hello"
```

`pnpm start` 会启动与公开 npm package 相同的 `dsh-console` 入口。Launcher 会在启动交互式界面之前初始化或定位 `dsh-console` DSH profile。

从 npm 安装公开 Alpha：

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console
dsh-console --prompt "hello"
```

为了简化安装流程，Public Alpha 版本会通过 npm 默认的 `latest` 渠道提供，同时发布版本仍保留 `-alpha.x` 预发布标识，以明确表达其成熟度。

## Session 与本地数据

DSH 是 Session 历史的唯一事实源。DSH Console 会列出当前工作目录下可恢复的顶层 `dsh-console-*` Session，并回放其规范 DSH event surface；它不会维护一套并行的客户端 Session 数据库。

当前使用的 DSH home 决定 profile、JSONL Session 日志和附件对象的存储位置。可以通过 `DSH_HOME` 隔离运行环境：

```sh
DSH_HOME=/tmp/dsh-console-home pnpm start -- --prompt "hello"
```

常用交互命令包括：

```text
/model       选择当前 DSH 模型
/new         创建新的对话
/sessions    浏览当前目录下可恢复的 Session
/resume      浏览 Session，或通过完整 Session ID 恢复
/tools       查看当前 DSH Agent 暴露的工具
/theme       选择终端主题
/settings    修改 Console 设置
```

Turn 运行期间，`Ctrl+C` 会取消当前 DSH 操作。空闲时，`Ctrl+C` 会释放运行时、恢复终端并退出。

## 架构

- 在运行时边界使用 DSH 规范类型和服务。
- Console 自有的 View Model 将 React 组件与完整 DSH event schema 隔离。
- Session replay 和实时流式事件共用同一个 projector。
- 图片必须先由 DSH attachment service 接纳，随后才能创建用户 turn；接纳失败时不会静默降级为纯文本输入。
- Prompt completion 使用独立的临时 Agent/Session，绝不会写入当前对话。

公开 package 包含 launcher、编译后的 Console runtime、DSH plugin bundle、许可证和归属声明。DSH runtime plugin 仍由所选 profile 提供。

## Alpha 边界

当前版本暂不提供跨目录 Session 搜索、Session rename/delete/fork、通用文件/PDF/audio/video 附件、原生终端图片协议、Web UI 或独立 provider/auth 层。

## 开发

```sh
pnpm run lint
pnpm run typecheck
pnpm run build:cli
pnpm run test:ci
pnpm run test:integration:dsh
pnpm run test:package
```

`test:integration:dsh` 使用确定性的 fake LLM adapter 组合真实 Cordis/DSH runtime。`test:package` 会打包公开 package，在隔离目录中安装它，初始化隔离的 `DSH_HOME`，并运行已安装的 launcher。

## 许可证与归属

DSH Console 使用 Apache License 2.0。详见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。部分终端 UI 和支持工具衍生自 Gemini CLI，并保留其原始版权声明。
