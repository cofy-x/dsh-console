---
title: CLI 与环境
description: DSH Console 启动参数、环境隔离和确定性启动设置。
---

## 启动参数

| 参数                    | 用途                                         |
| :---------------------- | :------------------------------------------- |
| `-p, --prompt <text>`   | 启动后提交初始 Prompt                        |
| `-c, --continue`        | 恢复当前目录最近的合格 Main Session          |
| `--resume <session-id>` | 恢复当前目录中指定的合格 Main Session        |
| `--pokemon <number>`    | 为本次启动选择内置 Pokemon 图案              |
| `-d, --debug`           | 启用诊断和仅在 debug mode 可用的 `/profiler` |
| `-h, --help`            | 显示 CLI help                                |

`--continue` 与 `--resume` 互斥。两者都可以和 `--prompt` 组合；Console 会先以事务方式完成恢复，再提交该 Prompt。

```sh
dsh-console --continue --prompt "总结上次停下的位置"
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef
dsh-console --pokemon 25
```

## 环境变量

| 环境变量              | 用途                                                       |
| :-------------------- | :--------------------------------------------------------- |
| `DSH_HOME`            | 选择 DSH profile、credential、JSONL Session 日志和附件存储 |
| `DSH_CONSOLE_POKEMON` | 选择默认内置 Pokemon；`--pokemon` 优先                     |

隔离测试时使用单独的 `DSH_HOME`。它会切换完整 DSH 环境，因此默认 Home 中的 Session 与 credential 有意不可见。

```sh
DSH_HOME=/tmp/dsh-console-home dsh-console --prompt "hello"
```

DSH Console 使用 `dsh-console` profile，并把当前工作目录作为 Session scope 的一部分。因此，当 workspace build 使用不同的 `DSH_HOME`、profile composition 或工作目录时，它看到的 Session 列表可以与已安装 launcher 不同。

## DSH executable 与兼容性

Launcher 会在 profile 安装或启动前检查 `PATH` 实际选择的 `dsh` executable。此版本最低要求 DSH `0.2.1-alpha.1`，最大测试版本为 `0.2.1-alpha.1`。过旧、缺失、不可执行或版本输出无效的安装会阻止启动；较新版本只显示非阻断警告。

较新版本能否加载插件仍由 DSH 自身的兼容检查决定；Console 不会自动授予版本例外或绕过 Host 限制。

```sh
dsh --version
command -v dsh # macOS/Linux
npm install --global @deepseek-ai/dsh@0.2.1-alpha.1
```

PowerShell 使用 `(Get-Command dsh).Source`，Command Prompt 使用 `where dsh`。兼容的 prerelease 可能不同于 npm `latest`，因此请保留修复命令中的精确版本。发布版 launcher 解析已安装 package，而源码 checkout 中的 `pnpm start` 解析当前 checkout。

## 选择已有 DSH profile

Launcher 默认使用自行管理的 `dsh-console` profile。要沿用已有 DSH profile 的 provider、模型和工具，请把 launcher 参数放在 Console 参数之前：

```sh
dsh-console --profile my-profile --prompt "hello"
```

请先通过 DSH 创建该 profile，例如 `dsh plugin --profile my-profile add @cofy-x/dsh-console@0.1.0-rc.1`（DSH 插件管理需要 `PATH` 中有 `pnpm`）。Launcher 只在选定 profile 中更新 Console bundle，其余参数继续转发给 DSH。优先级为 `--profile`、`DSH_CONSOLE_PROFILE`、默认的 `dsh-console`。所选 profile 缺失或无效时会报错，不会创建它或回退到默认 profile。Provider 配置、凭据、package 和 patch 仍归 DSH 管理。同一个 `DSH_HOME` 下的 profile 共享 Session、凭据、设置和附件；需要隔离时请使用不同的 `DSH_HOME`。
