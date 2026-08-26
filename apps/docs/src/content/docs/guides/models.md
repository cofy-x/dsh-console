---
title: Models and Reasoning
description: Select a DSH model and reasoning effort without restarting the Console.
---

Run `/model` to open the model selector. The dialog lists models exposed by the active DSH runtime, including their canonical context capacity when available.

After selecting a model, choose the supported reasoning effort. The Console switches to a fresh Agent using the selected route without restarting the TUI. A failed switch preserves the active conversation and input.

The footer shows the active model, effective reasoning effort, latest prompt usage, context capacity, and percentage consumed. `/stats` provides the detailed per-model token breakdown.

Model selection is DSH-native: the Console asks DSH to resolve the model and does not call a provider API directly.
