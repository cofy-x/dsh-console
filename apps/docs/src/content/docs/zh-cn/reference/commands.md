---
title: 命令
description: DSH Console slash command 和本地 Shell mode 参考。
---

| 命令                   | 用途                                     |
| :--------------------- | :--------------------------------------- |
| `/about`               | 显示 Console 和 DSH runtime 信息         |
| `/help`                | 显示可用命令                             |
| `/model`               | 选择当前 DSH 模型和 reasoning effort     |
| `/new`                 | 创建新的 DSH Session                     |
| `/permission`          | 查看或修改当前 DSH permission preset     |
| `/provider`            | 查看或更新支持的 DSH provider credential |
| `/quit`                | 释放 runtime 并退出                      |
| `/resume [session-id]` | 浏览 Session 或通过完整 Session ID 恢复  |
| `/sessions`            | 浏览当前目录中可恢复的 Session           |
| `/settings`            | 查看和修改 Console 设置                  |
| `/stats`               | 显示当前 DSH Session 派生的指标          |
| `/theme`               | 修改终端主题                             |
| `/tools`               | 查看当前 DSH Agent 可见的工具            |
| `/vim`                 | 切换 Vim 输入模式                        |
| `/profiler`            | 在 debug mode 下切换渲染诊断             |
| `!command`             | 执行本地 Shell 命令，不提交模型 Prompt   |

Turn 运行期间，`Ctrl+C` 会取消操作。附件准备期间会中止准备并恢复 Prompt。空闲时会安全退出。
