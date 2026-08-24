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
import type {
  UserQuestionRuntime,
  UserQuestionSnapshot,
} from '../user-question-runtime.js';

interface UserQuestionContextValue {
  runtime: UserQuestionRuntime;
  snapshot: UserQuestionSnapshot;
}

const UserQuestionContext = createContext<
  UserQuestionContextValue | undefined
>(undefined);

export const UserQuestionRuntimeProvider: React.FC<{
  runtime: UserQuestionRuntime;
  children: React.ReactNode;
}> = ({ runtime, children }) => {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const value = useMemo(() => ({ runtime, snapshot }), [runtime, snapshot]);
  return (
    <UserQuestionContext.Provider value={value}>
      {children}
    </UserQuestionContext.Provider>
  );
};

export function useUserQuestionRuntime(): UserQuestionContextValue {
  const value = useContext(UserQuestionContext);
  if (value === undefined) {
    throw new Error(
      'useUserQuestionRuntime must be used within UserQuestionRuntimeProvider',
    );
  }
  return value;
}

