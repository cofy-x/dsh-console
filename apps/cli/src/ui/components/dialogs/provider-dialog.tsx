/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import type {
  ProviderSetupRuntime,
  ProviderSetupStatus,
  ProviderSetupView,
} from '../../provider-setup-runtime.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { theme } from '../../theme/colors.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import { ProviderSetupDialog } from './provider-setup-dialog.js';

export interface ProviderDialogProps {
  runtime: ProviderSetupRuntime;
  initialProvider?: string;
  onClose: () => void;
}

function statusLabel(status: ProviderSetupStatus): string {
  switch (status) {
    case 'configured':
      return 'Configured';
    case 'missing':
      return 'Setup required';
    case 'unsupported':
      return 'Unavailable';
    case 'error':
      return 'Error';
  }
}

function statusColor(status: ProviderSetupStatus): string {
  switch (status) {
    case 'configured':
      return theme.status.success;
    case 'missing':
    case 'unsupported':
      return theme.status.warning;
    case 'error':
      return theme.status.error;
  }
}

function matchesProvider(view: ProviderSetupView, query: string): boolean {
  const normalized = query.toLocaleLowerCase();
  return (
    view.provider.toLocaleLowerCase() === normalized ||
    view.displayName.toLocaleLowerCase() === normalized
  );
}

export function ProviderDialog({
  runtime,
  initialProvider,
  onClose,
}: ProviderDialogProps): React.JSX.Element {
  const [providers, setProviders] = useState<readonly ProviderSetupView[]>([]);
  const [highlighted, setHighlighted] = useState<ProviderSetupView>();
  const [editing, setEditing] = useState<ProviderSetupView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void runtime
      .listProviders(controller.signal)
      .then((available) => {
        if (controller.signal.aborted) return;
        setProviders(available);
        const requested = initialProvider
          ? available.find((provider) =>
              matchesProvider(provider, initialProvider),
            )
          : undefined;
        setHighlighted(requested ?? available[0]);
        if (initialProvider && !requested) {
          setError(`Unknown DSH provider: ${initialProvider}`);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load DSH providers.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialProvider, runtime]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') onClose();
    },
    { isActive: editing === undefined },
  );

  const items = useMemo(
    () =>
      providers.map((provider) => ({
        key: provider.provider,
        label: provider.displayName,
        value: provider,
      })),
    [providers],
  );
  const initialIndex = Math.max(
    0,
    providers.findIndex(
      (provider) => provider.provider === highlighted?.provider,
    ),
  );
  const currentProvider = runtime.getSnapshot().current.provider;

  if (editing) {
    return (
      <ProviderSetupDialog
        runtime={runtime}
        provider={editing.provider}
        onCancel={() => setEditing(undefined)}
        onConfigured={(configured) => {
          setProviders((current) =>
            current.map((provider) =>
              provider.provider === configured.provider ? configured : provider,
            ),
          );
          setHighlighted(configured);
          setEditing(undefined);
        }}
      />
    );
  }

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
        <Text bold color={theme.text.accent}>DSH Providers</Text>
        <Text color={theme.text.secondary}>
          <Text bold color={theme.text.primary}>Esc</Text> Close
        </Text>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
      {loading && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Loading providers...</Text>
        </Box>
      )}
      {!loading && providers.length === 0 && (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>
            No DSH-managed providers are available.
          </Text>
        </Box>
      )}
      {providers.length > 0 && highlighted && (
        <Box marginTop={1}>
          <Box width="55%" paddingRight={2}>
            <RadioButtonSelect
              items={items}
              initialIndex={initialIndex}
              onHighlight={setHighlighted}
              onSelect={(provider) => {
                if (provider.writable && provider.status !== 'unsupported') {
                  setEditing(provider);
                }
              }}
              showScrollArrows
              maxItemsToShow={12}
              renderItem={(item, { titleColor }) => (
                <Text color={titleColor} wrap="truncate">
                  {item.value.displayName}{' '}
                  <Text color={statusColor(item.value.status)}>
                    {statusLabel(item.value.status)}
                  </Text>
                  {item.value.provider === currentProvider && (
                    <Text color={theme.text.accent}> Current</Text>
                  )}
                </Text>
              )}
            />
          </Box>

          <Box width="45%" paddingLeft={2} flexDirection="column">
            <Text bold color={theme.text.primary}>
              {highlighted.displayName}
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text color={theme.text.secondary}>Provider</Text>
              <Text>{highlighted.provider}</Text>
              <Text color={theme.text.secondary}>Status</Text>
              <Text color={statusColor(highlighted.status)}>
                {statusLabel(highlighted.status)}
              </Text>
              {highlighted.credentialLabel && (
                <>
                  <Text color={theme.text.secondary}>Credential</Text>
                  <Text>{highlighted.credentialLabel}</Text>
                </>
              )}
              {highlighted.source && (
                <>
                  <Text color={theme.text.secondary}>Source</Text>
                  <Text>{highlighted.source}</Text>
                </>
              )}
              {highlighted.message && (
                <Box marginTop={1}>
                  <Text color={theme.status.warning}>
                    {highlighted.message}
                  </Text>
                </Box>
              )}
              {!highlighted.writable &&
                highlighted.status !== 'unsupported' &&
                highlighted.status !== 'error' && (
                  <Box marginTop={1}>
                    <Text color={theme.status.warning}>
                      This credential comes from a read-only source. Update it
                      outside DSH Console.
                    </Text>
                  </Box>
                )}
            </Box>
          </Box>
        </Box>
      )}

      {providers.length > 0 && highlighted && (
        <Box marginTop={1}>
          {highlighted.writable && highlighted.status !== 'unsupported' ? (
            <>
              <Text bold color={theme.text.accent}>Enter</Text>
              <Text color={theme.text.primary}>
                {' '}
                {highlighted.status === 'configured'
                  ? 'Replace credential'
                  : 'Configure provider'}
              </Text>
              <Text color={theme.text.secondary}>
                {'    '}Use ↑/↓ to navigate
              </Text>
            </>
          ) : (
            <Text color={theme.text.secondary}>
              Use ↑/↓ to inspect providers. This credential cannot be changed
              here.
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
