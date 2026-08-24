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
import { ExitWarning } from '../dialogs/exit-warning.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useFlickerDetector } from '../../hooks/visual/use-flicker-detector.js';
import { useAlternateBuffer } from '../../hooks/terminal/use-alternate-buffer.js';
import { CopyModeWarning } from '../dialogs/copy-mode-warning.js';
import { ToolConfirmationQueue } from '../dialogs/tool-confirmation-queue.js';
import { useApprovalRuntime } from '../../contexts/approval-context.js';
import { useUserQuestionRuntime } from '../../contexts/user-question-context.js';
import { UserQuestionQueue } from '../dialogs/user-question-queue.js';

export const DefaultAppLayout: React.FC = () => {
  const uiState = useUIState();
  const isAlternateBuffer = useAlternateBuffer();

  const { runtime: approvalRuntime, snapshot: approvalSnapshot } =
    useApprovalRuntime();
  const pendingApproval = approvalSnapshot.pending[0];
  const { snapshot: userQuestionSnapshot } = useUserQuestionRuntime();
  const pendingUserQuestion = userQuestionSnapshot.pending[0];

  const { rootUiRef, terminalHeight } = uiState;
  useFlickerDetector(rootUiRef, terminalHeight);
  // If in alternate buffer mode, need to leave room to draw the scrollbar on
  // the right side of the terminal.
  return (
    <Box
      flexDirection="column"
      width={uiState.terminalWidth}
      height={isAlternateBuffer ? terminalHeight : undefined}
      paddingBottom={isAlternateBuffer ? 1 : undefined}
      flexShrink={0}
      flexGrow={0}
      overflow="hidden"
      ref={uiState.rootUiRef}
    >
      <MainContent />

      <Box
        flexDirection="column"
        ref={uiState.mainControlsRef}
        flexShrink={0}
        flexGrow={0}
        width={uiState.terminalWidth}
      >
        <Notifications />
        <CopyModeWarning />

        {pendingApproval !== undefined ? (
          <>
            <ToolConfirmationQueue
              request={pendingApproval}
              index={1}
              total={approvalSnapshot.pending.length}
              terminalWidth={uiState.terminalWidth}
              respond={(response) =>
                approvalRuntime.respond(pendingApproval.id, response)
              }
            />
            <Composer isFocused={false} />
          </>
        ) : pendingUserQuestion !== undefined ? (
          <UserQuestionQueue />
        ) : uiState.customDialog ? (
          uiState.customDialog
        ) : uiState.dialogsVisible ? (
          <DialogManager
            terminalWidth={uiState.terminalWidth}
          />
        ) : (
          <Composer isFocused={true} />
        )}

        <ExitWarning />
      </Box>
    </Box>
  );
};
