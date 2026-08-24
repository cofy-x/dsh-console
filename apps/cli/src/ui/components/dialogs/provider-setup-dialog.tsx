/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import type {
  ProviderSetupRuntime,
  ProviderSetupView,
} from '../../provider-setup-runtime.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { theme } from '../../theme/colors.js';
import { useSensitiveInputProtection } from '../../hooks/input/use-sensitive-input-protection.js';

export interface ProviderSetupDialogProps {
  runtime: ProviderSetupRuntime;
  provider: string;
  reason?: 'first-run' | 'model';
  onCancel: () => void;
  onConfigured: (view: ProviderSetupView) => void;
}

export function ProviderSetupDialog({
  runtime,
  provider,
  reason = 'model',
  onCancel,
  onConfigured,
}: ProviderSetupDialogProps): React.JSX.Element {
  useSensitiveInputProtection();
  const [view, setView] = useState<ProviderSetupView>();
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const mountedRef = useRef(true);
  const saveControllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void runtime
      .describeProvider(provider, controller.signal)
      .then(setView)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      mountedRef.current = false;
      controller.abort();
      saveControllerRef.current?.abort();
    };
  }, [provider, runtime]);

  const submit = async (): Promise<void> => {
    if (saving || !view?.writable) return;
    const value = secret;
    const controller = new AbortController();
    saveControllerRef.current?.abort();
    saveControllerRef.current = controller;
    setSecret('');
    setSaving(true);
    setError(undefined);
    try {
      const configured = await runtime.configure(
        provider,
        value,
        controller.signal,
      );
      if (!mountedRef.current || controller.signal.aborted) return;
      onConfigured(configured);
    } catch (cause) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        (cause instanceof Error && cause.name === 'AbortError')
      ) {
        return;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to save this credential.',
      );
    } finally {
      if (saveControllerRef.current === controller) {
        saveControllerRef.current = undefined;
      }
      if (mountedRef.current) setSaving(false);
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        saveControllerRef.current?.abort();
        setSecret('');
        onCancel();
        return;
      }
      if (key.ctrl && key.name === 'c') {
        if (saving || secret.length === 0) {
          saveControllerRef.current?.abort();
          setSecret('');
          onCancel();
        } else {
          setSecret('');
        }
        return;
      }
      if (saving) return;
      if (key.ctrl && key.name === 'u') {
        setSecret('');
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        void submit();
        return;
      }
      if (
        key.name === 'backspace' ||
        key.name === 'delete' ||
        (key.ctrl && key.name === 'h')
      ) {
        setSecret((current) => current.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.cmd && key.sequence && key.sequence >= ' ') {
        setSecret((current) => current + key.sequence);
      }
    },
    { isActive: true },
  );

  const label = view?.displayName ?? provider;
  const credential = view?.credentialLabel ?? 'provider credential';
  const fieldLabel = credential.endsWith('_API_KEY') ? 'API key' : 'Credential';
  const canWrite = view?.writable === true;
  const isReadOnly =
    view !== undefined &&
    view.status !== 'unsupported' &&
    view.status !== 'error' &&
    !view.writable;

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      width="100%"
    >
      <Box justifyContent="space-between">
        <Text bold color={theme.text.accent}>
          Configure {label}
        </Text>
        <Text color={theme.text.secondary}>
          <Text bold color={theme.text.primary}>Esc</Text>{' '}
          {reason === 'first-run' ? 'Cancel' : 'Close'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.primary}>
          {reason === 'first-run'
            ? `Enter your ${label} API key to continue.`
            : `Enter a replacement credential for ${label}.`}
        </Text>
        <Text color={theme.text.secondary}>
          Alternatively, set {credential} before starting DSH Console.
        </Text>
      </Box>
      {!view && !error && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Checking provider setup...</Text>
        </Box>
      )}
      {view?.status === 'configured' && (
        <Box marginTop={1}>
          <Text color={theme.status.success}>
            Configured from {view.source ?? 'DSH credential storage'}.
          </Text>
        </Box>
      )}
      {(view?.status === 'unsupported' || view?.status === 'error') &&
        view.message && (
          <Box marginTop={1}>
            <Text color={theme.status.warning}>{view.message}</Text>
          </Box>
        )}
      {isReadOnly && (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>
            {credential} is supplied by a read-only source. Change that source
            and restart DSH Console.
          </Text>
        </Box>
      )}
      {canWrite && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color={theme.text.primary}>{fieldLabel}</Text>
          <Box
            borderStyle="single"
            borderColor={saving ? theme.border.default : theme.text.accent}
            paddingX={1}
          >
            <Text color={theme.text.primary}>
              {secret.length === 0 ? (
                <Text color={theme.text.secondary}>
                  Paste your {label} API key
                </Text>
              ) : (
                `${'*'.repeat(Math.min(secret.length, 64))}${
                  secret.length > 64 ? '...' : ''
                }`
              )}
            </Text>
          </Box>
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
      {canWrite ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            Stored through the configured DSH credential service. Never added
            to prompts, sessions, history, or logs.
          </Text>
          <Box marginTop={1}>
            <Text bold color={theme.text.accent}>Enter</Text>
            <Text color={theme.text.primary}> Save and continue</Text>
            <Text color={theme.text.secondary}>    </Text>
            <Text bold color={theme.text.primary}>Esc</Text>
            <Text color={theme.text.secondary}>
              {' '}{reason === 'first-run' ? 'Cancel' : 'Close'}
            </Text>
            <Text color={theme.text.secondary}>    </Text>
            <Text bold color={theme.text.primary}>Ctrl+C</Text>
            <Text color={theme.text.secondary}>
              {' '}{secret.length > 0 ? 'Clear' : 'Cancel'}
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text bold color={theme.text.primary}>Esc</Text>
          <Text color={theme.text.secondary}> Close</Text>
        </Box>
      )}
      {saving && (
        <Text bold color={theme.text.accent}>Saving credential...</Text>
      )}
    </Box>
  );
}
