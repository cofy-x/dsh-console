---
title: 图片附件
description: 通过路径或剪贴板将图片提交给 DSH attachment service。
---

使用 `@path/to/image.png` 引用 workspace 中支持的图片，或者从剪贴板粘贴图片。DSH Console 会保留文本和图片的顺序、校验本地路径，并在创建用户 Turn 之前通过 DSH attachment service 接纳图片。

支持 PNG、JPEG、WebP 和 GIF。目录引用只展开文本文件；PDF、audio、video 和通用二进制文件不会作为图片输入接纳。

图片接纳失败或被取消时，Console 会恢复原始 Prompt，不会发送纯文本降级请求。终端使用附件元数据卡片展示图片，不要求原生图片协议。
