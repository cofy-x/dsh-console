---
title: 调试
description: 启用 DSH Console 诊断并查看不会混入 transcript 的日志。
---

启用诊断启动 Console：

```sh
dsh-console --debug
```

通过 workspace script 运行时，参数需要放在脚本分隔符之后：

```sh
pnpm start -- --debug
```

Debug mode 会启用结构化 debug console，并开放用于 React/Ink 渲染诊断的 `/profiler`。诊断输出不会进入 Prompt 或 Session event。

需要为截图或文档固定启动图时，可以使用 `--pokemon <编号>` 选择内置 Pokemon。`DSH_CONSOLE_POKEMON` 提供相同的环境默认值，显式 CLI 参数优先。

Credential 字段属于 masked UI surface。即使其他输入区域启用了按键诊断，masked input 路径也不会输出 credential 字符或粘贴内容。
