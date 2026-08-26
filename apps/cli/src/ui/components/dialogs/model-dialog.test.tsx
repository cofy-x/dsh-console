/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { act } from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '../../../test-utils/async.js';
import type {
  ModelSelectionRuntime,
  ModelSelectionView,
} from '../../model-selection-runtime.js';
import type { ProviderSetupRuntime } from '../../provider-setup-runtime.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import { ModelDialog } from './model-dialog.js';

vi.mock('../shared/radio-button-select.js', () => ({
  RadioButtonSelect: vi.fn(() => null),
}));

vi.mock('../../hooks/input/use-keypress.js', () => ({
  useKeypress: vi.fn(),
}));

const mockedRadioButtonSelect = vi.mocked(RadioButtonSelect);

const textModel = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  name: 'DeepSeek Chat',
  inputModalities: ['text'] as const,
  contextWindow: 128_000,
};

const visionModel = {
  provider: 'deepseek',
  model: 'deepseek-vision',
  name: 'DeepSeek Vision',
  inputModalities: ['text', 'image'] as const,
  contextWindow: 1_000_000,
  reasoning: {
    efforts: [
      { id: 'low', name: 'Low' },
      { id: 'high', name: 'High' },
    ],
    defaultEffort: 'high',
  },
};

function modelRuntime(
  hasConversation = false,
  current: ModelSelectionView = textModel,
): ModelSelectionRuntime {
  return {
    getSnapshot: () => ({ current, default: current }),
    subscribe: () => () => {},
    listModels: vi.fn(async () => [textModel, visionModel]),
    hasConversation: vi.fn(() => hasConversation),
    setModel: vi.fn(async (selection) => ({
      ...visionModel,
      reasoning: {
        ...visionModel.reasoning,
        ...(selection.reasoningEffort === undefined
          ? {}
          : { selectedEffort: selection.reasoningEffort }),
      },
    })),
    assertCurrentSupportsImages: vi.fn(async () => {}),
  };
}

function providerRuntime(): ProviderSetupRuntime {
  const missing = {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    status: 'missing' as const,
    credentialLabel: 'DEEPSEEK_API_KEY',
    writable: true,
  };
  return {
    getSnapshot: () => ({ current: missing }),
    subscribe: () => () => {},
    listProviders: vi.fn(async () => [missing]),
    describeProvider: vi.fn(async () => missing),
    configure: vi.fn(async () => ({ ...missing, status: 'configured' as const })),
  };
}

async function selectVisionModel(): Promise<void> {
  await waitFor(() => {
    expect(mockedRadioButtonSelect).toHaveBeenCalled();
  });
  const onSelect = mockedRadioButtonSelect.mock.calls[0]?.[0].onSelect;
  expect(onSelect).toBeDefined();
  await act(async () => {
    onSelect?.(visionModel);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function selectReasoningEffort(reasoningEffort?: string): Promise<void> {
  await waitFor(() => {
    expect(mockedRadioButtonSelect.mock.calls.length).toBeGreaterThan(1);
  });
  const calls = mockedRadioButtonSelect.mock.calls;
  const onSelect = calls[calls.length - 1]?.[0].onSelect;
  expect(onSelect).toBeDefined();
  await act(async () => {
    onSelect?.(reasoningEffort);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderDialog(
  element: React.ReactElement,
): Promise<ReturnType<typeof render>> {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(element);
    await Promise.resolve();
  });
  return view;
}

describe('ModelDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders canonical model details and switches an empty Session directly', async () => {
    const runtime = modelRuntime();
    const onSwitched = vi.fn();
    const { lastFrame } = await renderDialog(
      <ModelDialog runtime={runtime} onClose={vi.fn()} onSwitched={onSwitched} />,
    );

    await waitFor(() => {
      expect(lastFrame()).toContain('DeepSeek Chat');
      expect(lastFrame()).toContain('deepseek-chat');
      expect(lastFrame()).toContain('Context window');
      expect(lastFrame()).toContain('128k tokens');
    });
    await selectVisionModel();
    await waitFor(() => expect(lastFrame()).toContain('Select Reasoning Effort'));
    await selectReasoningEffort('low');
    await waitFor(() => {
      expect(runtime.setModel).toHaveBeenCalledWith({
        provider: 'deepseek',
        model: 'deepseek-vision',
        reasoningEffort: 'low',
      });
      expect(onSwitched).toHaveBeenCalledWith(expect.objectContaining({
        reasoning: expect.objectContaining({ selectedEffort: 'low' }),
      }));
    });
  });

  it('requires confirmation before switching a Session with conversation state', async () => {
    const runtime = modelRuntime(true);
    const onSwitched = vi.fn();
    const { lastFrame } = await renderDialog(
      <ModelDialog runtime={runtime} onClose={vi.fn()} onSwitched={onSwitched} />,
    );

    await selectVisionModel();
    await selectReasoningEffort();
    await waitFor(() => {
      expect(lastFrame()).toContain('Start a new Session?');
    });
    expect(runtime.setModel).not.toHaveBeenCalled();

    const calls = mockedRadioButtonSelect.mock.calls;
    const confirm = calls[calls.length - 1]?.[0].onSelect;
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm?.(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(runtime.setModel).toHaveBeenCalledWith({
        provider: 'deepseek',
        model: 'deepseek-vision',
      });
      expect(onSwitched).toHaveBeenCalledWith(visionModel);
    });
  });

  it('opens provider setup before selecting a model with a missing credential', async () => {
    const runtime = modelRuntime();
    const providerSetupRuntime = providerRuntime();
    const { lastFrame } = await renderDialog(
      <ModelDialog
        runtime={runtime}
        providerSetupRuntime={providerSetupRuntime}
        onClose={vi.fn()}
        onSwitched={vi.fn()}
      />,
    );

    await selectVisionModel();
    await waitFor(() => {
      expect(providerSetupRuntime.describeProvider).toHaveBeenCalledWith(
        'deepseek',
        expect.any(AbortSignal),
      );
      expect(lastFrame()).toContain('Configure DeepSeek');
    });
    expect(runtime.setModel).not.toHaveBeenCalled();
  });

  it('switches when only the reasoning effort changes', async () => {
    const current = {
      ...visionModel,
      reasoning: { ...visionModel.reasoning, selectedEffort: 'high' },
    };
    const runtime = modelRuntime(false, current);
    const onSwitched = vi.fn();
    await renderDialog(
      <ModelDialog runtime={runtime} onClose={vi.fn()} onSwitched={onSwitched} />,
    );

    await selectVisionModel();
    await selectReasoningEffort('low');

    await waitFor(() => {
      expect(runtime.setModel).toHaveBeenCalledWith({
        provider: 'deepseek',
        model: 'deepseek-vision',
        reasoningEffort: 'low',
      });
      expect(onSwitched).toHaveBeenCalled();
    });
  });
});
