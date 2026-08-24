/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box } from 'ink';
import { Notifications } from '../indicators/notifications.js';
import { MainContent } from './main-content.js';
import { DialogManager } from '../dialogs/dialog-manager.js';
import { Composer } from '../input/composer.js';
import { Footer } from './footer.js';
import { ExitWarning } from '../dialogs/exit-warning.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useFlickerDetector } from '../../hooks/visual/use-flicker-detector.js';
import { useApprovalRuntime } from '../../contexts/approval-context.js';
import { useUserQuestionRuntime } from '../../contexts/user-question-context.js';
import { ToolConfirmationQueue } from '../dialogs/tool-confirmation-queue.js';
import { UserQuestionQueue } from '../dialogs/user-question-queue.js';

export const ScreenReaderAppLayout: React.FC = () => {
  const uiState = useUIState();
  const { rootUiRef, terminalHeight } = uiState;
  const { runtime: approvalRuntime, snapshot: approvalSnapshot } =
    useApprovalRuntime();
  const pendingApproval = approvalSnapshot.pending[0];
  const { snapshot: userQuestionSnapshot } = useUserQuestionRuntime();
  const pendingUserQuestion = userQuestionSnapshot.pending[0];
  useFlickerDetector(rootUiRef, terminalHeight);

  return (
    <Box
      flexDirection="column"
      width="90%"
      height="100%"
      ref={uiState.rootUiRef}
    >
      <Notifications />
      <Footer />
      <Box flexGrow={1} overflow="hidden">
        <MainContent />
      </Box>
      {pendingApproval !== undefined ? (
        <ToolConfirmationQueue
          request={pendingApproval}
          index={1}
          total={approvalSnapshot.pending.length}
          terminalWidth={uiState.terminalWidth}
          respond={(response) =>
            approvalRuntime.respond(pendingApproval.id, response)
          }
        />
      ) : pendingUserQuestion !== undefined ? (
        <UserQuestionQueue />
      ) : uiState.dialogsVisible ? (
        <DialogManager
          terminalWidth={uiState.terminalWidth}
        />
      ) : (
        <Composer />
      )}

      <ExitWarning />
    </Box>
  );
};
