---
title: Session 与恢复
description: 创建、浏览并恢复当前目录中的规范 DSH Session。
---

对话持久化由 DSH 负责。DSH Console 不维护并行的 transcript 数据库。

- `/new` 在当前对话已有内容时经过确认，创建新的 DSH Agent 和空 Session。
- `/sessions` 打开 Dialog，展示当前工作目录中已持久化的顶层 `dsh-console-*` Session。
- `dsh-console --continue` 会在 TUI 接受输入前恢复最近的合格 Session。
- `dsh-console --resume <完整-session-id>` 会恢复指定的合格 Session，并且可以和 `--prompt` 组合使用。

恢复流程读取规范 DSH event log、还原历史模型 route、把可见 surface 投影到 TUI，并从下一个 Turn 继续。切换是事务性的：模型不可用、日志损坏、flush 失败或取消都不会改变当前 Session。

Main Agent 只会在第一次 Prompt 或依赖 Agent 的 DSH 命令确实需要时才创建。因此，打开后未对话便退出不会再持久化空 Session，历史上没有 trajectory event 的 Session 也不会显示在浏览器中。

Completion Session、Side conversation Session、delegated Agent Session 和其他工作目录中的 Session 不会出现在主浏览器中。跨目录搜索、rename、delete 和 fork 暂不属于当前 Alpha。
