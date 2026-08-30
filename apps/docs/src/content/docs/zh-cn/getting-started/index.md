---
title: 快速开始
description: 安装 DSH Console、配置第一个 provider credential 并提交 Prompt。
---

DSH Console 需要 Node.js 24 或更高版本以及可用的终端。按默认方式安装 DeepSeek Harness 和 DSH Console：

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console
dsh-console
```

Launcher 会初始化或定位 `dsh-console` DSH profile，并打开交互式 TUI。如果选中的 DeepSeek provider 尚未配置 credential，Console 会在提交第一个 Prompt 之前打开 masked setup dialog。

此版本已验证从 npm 默认的 DSH `0.1.1-rc.2` 到当前源码 release `0.1.2-alpha.1`。只有新 DSH release 通过 API 审计和集成测试后才会提升声明的兼容上界；安装命令本身保持不固定版本。

也可以直接带 Prompt 启动：

```sh
dsh-console --prompt "解释这个仓库"
```

可以恢复当前目录最近的可恢复 Session，或在提交可选的初始 Prompt 前恢复精确的 Session ID：

```sh
dsh-console --continue
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef --prompt "继续这项工作"
```

Credential 通过 DSH credential service 写入。DSH Console 不维护独立认证存储，也不会把 credential 写入 Prompt 或 Session event。

## 第一次交互

输入 Prompt 并按 Enter。Assistant 文本会流式进入 transcript，reasoning、工具、todo、附件和 usage 则投影到各自的 TUI 区域。

输入 `/` 可以发现 Console 内置命令和当前 DSH profile 提供的命令。`/plan` 等 DSH 命令在第一次 Prompt 之前也可以使用，并且不会因此创建无内容的持久 Session。

Turn 运行期间，`Ctrl+C` 会取消 DSH 操作。空闲时，`Ctrl+C` 会释放 runtime、恢复终端并退出。

## 隔离环境

`DSH_HOME` 控制当前 profile、JSONL Session 日志、credential 和附件对象。测试时可以使用隔离路径：

```sh
DSH_HOME=/tmp/dsh-console-home dsh-console --prompt "hello"
```

接下来可以了解如何[选择模型与思考等级](/zh-cn/guides/models/)、[恢复持久 Session](/zh-cn/guides/sessions/)或[审阅 Agent 计划](/zh-cn/guides/workflows/)。
