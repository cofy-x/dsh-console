---
title: DSH 原生架构
description: 理解 DeepSeek Harness 与 DSH Console 之间的所有权边界。
---

DeepSeek Harness 负责 Agent 执行、模型与 provider service、credential、Session、工具、审批、附件、持久化和规范事件。DSH Console 负责终端交互、输入预处理、展示，以及面向这些公开 service 的聚焦 adapter。

在 DSH 边界，runtime adapter 使用官方规范类型。Session projector 将规范 user、assistant、reasoning、image、tool、todo、interruption、error 和 usage event 转换为稳定的 TUI View Model。React 组件不依赖完整 DSH SDK surface。

实时流式显示和 Session replay 使用同一个 projector。DSH JSONL log 与 attachment storage 是唯一持久事实源；Console 不创建第二套对话存储。

Main、Side 与 delegated Agent view 各自保持为独立的规范 DSH Session。`/btw` 创建隔离的 Side conversation，`/agents` 则以只读方式投影 delegated Agent 状态与历史。Console 不会在这些 Session 之间复制事件，也不会运行另一套 Agent scheduler。

附件在 Turn 创建前完成接纳。Agent 与 Session 切换会先准备候选 runtime，只有校验和 flush 成功后才替换当前 runtime。这些边界可以避免失败过程静默改变模型上下文或丢失可见对话。

初始 Main Agent 采用按需创建。Console 可以在不持久化空 Session 的情况下打开设置、发现 DSH 命令或直接退出；只有操作确实需要规范 Agent 状态时才会创建 Agent。
