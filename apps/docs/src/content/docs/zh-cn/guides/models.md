---
title: 模型与思考等级
description: 无需重启 Console 即可选择 DSH 模型和 reasoning effort。
---

执行 `/model` 打开模型选择器。Dialog 会列出当前 DSH runtime 暴露的模型，并在可用时显示规范的上下文容量。

选中模型后，再选择它支持的 reasoning effort。Console 会使用所选 route 切换到新的 Agent，无需重启 TUI。切换失败时，当前对话和输入保持不变。

Footer 会显示当前模型、实际 reasoning effort、最新 Prompt 用量、上下文容量和占用百分比。`/stats` 提供按模型拆分的详细 token 信息。

模型选择完全基于 DSH：Console 请求 DSH 解析模型，不会直接调用 provider API。
