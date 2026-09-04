---
title: 命令
description: DSH Console slash command 和本地 Shell mode 参考。
---

| 命令          | 用途                                       |
| :------------ | :----------------------------------------- |
| `/about`      | 显示 Console 和 DSH runtime 信息           |
| `/agents`     | 浏览 delegated Agent 并打开只读规范历史    |
| `/btw <问题>` | 打开或继续多轮 Side conversation           |
| `/help`       | 显示 Console 与当前 DSH profile 可用的命令 |
| `/model`      | 选择当前 DSH 模型和 reasoning effort       |
| `/new`        | 创建新的 DSH Session                       |
| `/permission` | 查看或修改当前 DSH permission preset       |
| `/plan`       | 当前 DSH profile 提供时进入计划模式        |
| `/provider`   | 查看或更新支持的 DSH provider credential   |
| `/quit`       | 释放 runtime 并退出                        |
| `/sessions`   | 浏览当前目录中可恢复的 Main Session        |
| `/settings`   | 查看和修改 Console 设置                    |
| `/stats`      | 显示当前 DSH Session 派生的指标            |
| `/theme`      | 修改终端主题                               |
| `/tools`      | 查看当前 DSH Agent 可见的工具              |
| `/vim`        | 切换 Vim input mode                        |
| `/profiler`   | 在 debug mode 下切换渲染诊断               |
| `!command`    | 执行本地 Shell 命令，不提交模型 Prompt     |

`/plan` 是 DSH command，而不是 Console 内置命令。Profile plugin 可以增减 DSH command，`/help` 与 Slash completion 会反映当前 runtime 的实际内容。

## 快捷键

| 快捷键   | 用途                                                       |
| :------- | :--------------------------------------------------------- |
| `Ctrl+/` | Side 存在时在 Main 与 Side conversation 之间切换           |
| `Ctrl+T` | 展开或收起完整 Todo tray                                   |
| `Ctrl+C` | 清空输入、取消当前准备或运行，或者在空闲时请求安全退出     |
| `Tab`    | 在可用时接受或浏览 Prompt、路径与 Slash command completion |

取消行为取决于当前上下文。附件准备期间，`Ctrl+C` 会中止准备并恢复 Prompt；Turn 运行期间会取消当前 DSH 操作；空闲时则请求安全退出。
