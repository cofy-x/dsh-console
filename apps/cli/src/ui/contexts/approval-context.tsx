/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ApprovalRuntime, ApprovalSnapshot } from '../approval-runtime.js';

interface ApprovalContextValue {
  runtime: ApprovalRuntime;
  snapshot: ApprovalSnapshot;
}

const ApprovalContext = createContext<ApprovalContextValue | undefined>(
  undefined,
);

export const ApprovalRuntimeProvider: React.FC<{
  runtime: ApprovalRuntime;
  children: React.ReactNode;
}> = ({ runtime, children }) => {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const value = useMemo(() => ({ runtime, snapshot }), [runtime, snapshot]);
  return (
    <ApprovalContext.Provider value={value}>
      {children}
    </ApprovalContext.Provider>
  );
};

export function useApprovalRuntime(): ApprovalContextValue {
  const value = useContext(ApprovalContext);
  if (value === undefined) {
    throw new Error(
      'useApprovalRuntime must be used within ApprovalRuntimeProvider',
    );
  }
  return value;
}
