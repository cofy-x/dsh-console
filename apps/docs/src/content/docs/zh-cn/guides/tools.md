---
title: 工具与权限
description: 查看当前 DSH 工具目录、结果、审批和权限 preset。
---

工具调用和结果通过规范 DSH Session event 到达。Console 会把调用、结构化结果、错误和 presenter metadata 投影为 Tool Card，而不是让 React 直接渲染原始 SDK 对象。

执行 `/tools` 浏览当前 DSH Agent 可见的工具。执行 `/permission` 查看或选择 DSH runtime 暴露的 permission preset。

当 DSH 请求审批或提出用户问题时，Console 会打开专用 Dialog，并通过对应 DSH service 返回响应。工具执行和策略强制仍由 DSH 负责。

在本地命令前添加 `!` 可进入 Shell mode。Shell mode 只在本地执行，不会把命令或输出作为模型 Prompt 提交。
