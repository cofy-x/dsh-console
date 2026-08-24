/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { spawnSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const RESTART_EXIT_CODE = 199;

// check build status, write warnings to file for app to display if needed
execSync('node ./scripts/check-build-status.js', {
  stdio: 'inherit',
  cwd: root,
});

const nodeArgs = [];
const isInDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

if (isInDebugMode) {
  nodeArgs.push('--inspect-brk');
}

nodeArgs.push(join(root, 'apps', 'cli'));
nodeArgs.push(...process.argv.slice(2));

const env = {
  ...process.env,
  DEV: 'true',
};

let result;
do {
  result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit', env });
  if (result.error) {
    console.error(`Failed to start DSH Console: ${result.error.message}`);
    process.exit(1);
  }
  if (result.signal) process.kill(process.pid, result.signal);
} while (result.status === RESTART_EXIT_CODE);

process.exit(result.status ?? 1);
