---
title: 工具与权限
description: 查看当前 DSH 工具目录、结果、审批和权限 preset。
---

工具调用和结果通过规范 DSH Session event 到达。Console 会把调用、结构化结果、错误和 presenter metadata 投影为 Tool Card，而不是让 React 直接渲染原始 SDK 对象。

Tool Card Header 默认保持紧凑。只有真实截断的标题或 Shell 命令才可以从 Header 原位置展开，规范 arguments 和 result detail 留在 Card 正文中，不会在标题里重复。

执行 `/tools` 浏览当前 DSH Agent 可见的工具。执行 `/permission` 查看或选择 DSH runtime 暴露的 permission preset。

当 DSH 请求审批或提出用户问题时，Console 会打开专用 Dialog，并通过对应 DSH service 返回响应。工具执行和策略强制仍由 DSH 负责。

Todo tray 展示最新的规范 DSH todo snapshot。Turn 结束后仍有未完成条目，表示模型没有将它标记为完成，不代表 Console 仍有工作在后台运行。按 `Ctrl+T` 可以展开或收起完整列表。

在本地命令前添加 `!` 可进入 Shell mode。Shell mode 只在本地执行，不会把命令或输出作为模型 Prompt 提交。
