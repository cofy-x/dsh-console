---
title: 故障排查
description: 排查常见安装、provider、Session、附件和终端问题。
---

## Console 要求配置 credential

使用首次启动的 masked dialog，或者执行 `/provider` 配置支持写入的 DSH credential source。环境变量和其他只读 source 必须在 Console 外部修改。

## 模型不可用

打开 `/model`，选择当前 DSH profile 暴露的 route。恢复 Session 时，如果 DSH 无法再解析历史模型，Console 会明确失败，不会静默替换模型。

## Session 没有出现在列表中

当前 Alpha 只列出当前工作目录中已持久化的顶层 `dsh-console-*` Session。Completion Session 和其他目录中的 Session 会被排除。

## 模型无法使用图片

确认选中的模型支持图片输入，并且用户消息中出现了附件卡片。DSH Console 提交的是规范 image attachment reference，而不是 workspace 路径。模型选择无关文件工具属于模型或工具路由行为，不代表图片接纳失败。

## 终端按键或颜色异常

请在普通 PTY 中运行，确认 `TERM` 能正确描述终端，并尝试其他内置主题。收集诊断时使用 `dsh-console --debug`。DSH Console 不会修改全局 IDE keybinding。
