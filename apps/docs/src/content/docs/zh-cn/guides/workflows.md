---
title: 工作流与计划审阅
description: 在终端内审阅 DSH 计划、审批、问题、工具执行和 todo 状态。
---

DSH Console 将工作流决策放在聚焦的终端 Dialog 中，而底层命令、工具、审批、问题和 todo 契约仍由 DeepSeek Harness 负责。

## 进入计划模式

执行 `/plan` 进入当前 DSH profile 提供的计划工作流。DSH 命令会在第一次 Prompt 前按需发现，因此选择 `/plan` 不会创建一个除此之外没有内容的启动 Session。

Agent 提交计划后，Console 会打开 Markdown Plan Review Dialog。选择 **Approve** 离开计划模式，模型从下一步开始执行；输入自定义反馈则请求修改，并在反馈返回模型时继续保留在计划模式。

Plan Review 不会根据一次失败的工具调用猜测模式，也不会创建第二套计划状态。命令是否可用以及状态如何转换，都来自规范 DSH command 和 user-question 契约。

## 跟踪执行

Tool Card 展示规范调用、结果、失败和 presenter metadata。审批与用户问题 Dialog 通过 DSH 返回决策，Todo tray 则展示最新的规范 snapshot，而不是 Console 自己维护的任务列表。

空闲 Turn 结束后仍有未完成 todo，表示模型没有将该条目标记为完成。这是历史状态，不代表有隐藏操作仍在运行。按 `Ctrl+T` 可以查看完整列表。

使用 `/stats` 查看 Session 与模型用量，使用 `/tools` 查看当前工具目录，使用 `/permission` 查看 DSH 暴露的 permission preset。
