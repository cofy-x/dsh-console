/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type {
  AgentPresetOptionView,
  AgentPresetRuntime,
  AgentPresetSnapshot,
} from '../../agent-preset-runtime.js';
import { AgentPresetDialog } from './agent-preset-dialog.js';

function fixture(enabled = true) {
  const option = { id: 'minimal', name: 'Minimal Mode', isDefault: false };
  let resolve!: (option: AgentPresetOptionView) => void;
  const promise = new Promise<AgentPresetOptionView>((done) => {
    resolve = done;
  });
  const pending = { promise, resolve };
  const select = vi.fn((_id: string, _signal?: AbortSignal) => pending.promise);
  const snapshot: AgentPresetSnapshot = {
    status: 'ready',
    modeSelectionEnabled: enabled,
    currentId: 'standard',
    options: [option],
    busy: false,
  };
  const runtime: AgentPresetRuntime = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    prepare: async () => {},
    select,
  };
  return { option, pending, select, runtime };
}

describe('AgentPresetDialog', () => {
  it.each(['Escape', 'Ctrl+C', 'unmount'])(
    'cancels a pending selection on %s and ignores a late result',
    async (action) => {
      const h = fixture();
      const onClose = vi.fn();
      const onSwitched = vi.fn();
      const { stdin, unmount } = renderWithProviders(
        <StrictMode>
          <AgentPresetDialog
            runtime={h.runtime}
            onClose={onClose}
            onSwitched={onSwitched}
          />
        </StrictMode>,
      );
      await act(async () => {
        stdin.write('\r');
      });
      await vi.waitFor(() => expect(h.select).toHaveBeenCalledOnce());
      const signal = h.select.mock.calls[0]?.[1];
      expect(signal).toBeInstanceOf(AbortSignal);
      await act(async () => {
        if (action === 'unmount') unmount();
        else stdin.write(action === 'Escape' ? '\u001b' : '\u0003');
      });
      await vi.waitFor(() => expect(signal?.aborted).toBe(true));
      expect(onClose).toHaveBeenCalledTimes(action === 'unmount' ? 0 : 1);
      await act(async () => {
        h.pending.resolve(h.option);
        await h.pending.promise;
      });
      expect(onSwitched).not.toHaveBeenCalled();
    },
  );

  it('does not display selectable presets when the Host disables selection', () => {
    const h = fixture(false);
    const { lastFrame } = renderWithProviders(
      <AgentPresetDialog
        runtime={h.runtime}
        onClose={vi.fn()}
        onSwitched={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('disabled by the DSH host');
    expect(lastFrame()).not.toContain('Minimal Mode');
    expect(h.select).not.toHaveBeenCalled();
  });
});
