---
title: Image Attachments
description: Submit images through the DSH attachment service from a path or clipboard.
---

Reference a supported workspace image with `@path/to/image.png`, or paste an image from the clipboard. DSH Console preserves the text and image order, validates local paths, and admits the image through the DSH attachment service before creating the user turn.

Supported image formats are PNG, JPEG, WebP, and GIF. Directory references expand text files only; PDFs, audio, video, and generic binary files are not accepted as image input.

If image admission fails or is cancelled, the Console restores the original prompt and does not send a text-only fallback. The terminal renders an attachment metadata card because native image protocols are not required.
