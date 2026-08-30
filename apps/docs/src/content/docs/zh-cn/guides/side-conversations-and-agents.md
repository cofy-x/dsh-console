---
title: 侧边对话与 Agent
description: 发起并行侧边问题，并以只读方式查看 delegated Agent 历史。
---

## 侧边对话

执行 `/btw <问题>` 可以在不中断 Main Agent 的情况下打开临时、多轮的 Side conversation。Side 有自己的规范 DSH Agent 与 Session，可以继续追问，也可以在 Main 工作时并行运行。

按 `Ctrl+/` 在 Main 与 Side 之间切换。Footer 会标识当前对话，并显示 Main 正在工作还是空闲。Side 输出不会进入 Main conversation context，Side Session 也不会出现在主 `/sessions` 浏览器中。

Side 适合澄清、探索或并行问题；需要保留在主要项目上下文中的修改和决策应继续在 Main 中完成。

## Delegated Agent

执行 `/agents` 打开 DSH 原生 Agent 目录。目录会显示层级 delegation、实时运行状态，以及与当前 runtime 关联的已完成 Agent。

选中 Agent 后按 Enter 可以查看它的规范对话历史。History view 为只读：可以审阅 Prompt、工具、reasoning、结果、错误、usage 和完成状态，但 Console 不会向 delegated Agent 注入消息或修改它的 Session。

Subagent 执行与持久化仍由 DSH 负责。Console 只观察规范状态和事件，不创建并行的 subagent scheduler 或 transcript store。
