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
