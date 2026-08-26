---
title: DSH 原生架构
description: 理解 DeepSeek Harness 与 DSH Console 之间的所有权边界。
---

DeepSeek Harness 负责 Agent 执行、模型与 provider service、credential、Session、工具、审批、附件、持久化和规范事件。DSH Console 负责终端交互、输入预处理、展示，以及面向这些公开 service 的聚焦 adapter。

在 DSH 边界，runtime adapter 使用官方规范类型。Session projector 将规范 user、assistant、reasoning、image、tool、todo、interruption、error 和 usage event 转换为稳定的 TUI View Model。React 组件不依赖完整 DSH SDK surface。

实时流式显示和 Session replay 使用同一个 projector。DSH JSONL log 与 attachment storage 是唯一持久事实源；Console 不创建第二套对话存储。

附件在 Turn 创建前完成接纳。Agent 与 Session 切换会先准备候选 runtime，只有校验和 flush 成功后才替换当前 runtime。这些边界可以避免失败过程静默改变模型上下文或丢失可见对话。
