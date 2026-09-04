/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';

const GENERAL_TIPS = [
  {
    before: 'Use ',
    highlight: '/btw',
    after: ' to explore a side question in parallel.',
  },
  {
    before: 'Type ',
    highlight: '@path/to/file',
    after: ' to add focused context.',
  },
  {
    before: 'Use ',
    highlight: '/agents',
    after: ' to inspect subagent activity and history.',
  },
  {
    before: 'Use ',
    highlight: '/sessions',
    after: ' to resume an earlier conversation.',
  },
  {
    before: 'Press ',
    highlight: 'Ctrl+/',
    after: ' to switch between main and side conversations.',
  },
  {
    before: 'Use ',
    highlight: '/help',
    after: ' to discover commands and shortcuts.',
  },
] as const;

const POKEMON_SHUFFLE_TIP = {
  before: 'Click the ',
  highlight: 'Pokémon',
  after: ' artwork to shuffle the header.',
} as const;

interface TipsProps {
  rotationSeed: number;
  showPokemonShuffle?: boolean;
}

export const createTipsRotationSeed = (): number => Math.random();

export const Tips: React.FC<TipsProps> = ({
  rotationSeed,
  showPokemonShuffle = false,
}) => {
  const availableTips = showPokemonShuffle
    ? [...GENERAL_TIPS, POKEMON_SHUFFLE_TIP]
    : GENERAL_TIPS;
  const startIndex = Math.floor(rotationSeed * availableTips.length);
  const selectedTips = [
    availableTips[startIndex],
    availableTips[(startIndex + 1) % availableTips.length],
  ];

  return (
    <Box flexDirection="column" marginTop={0}>
      <Text bold color={theme.text.primary}>
        TIPS
      </Text>
      {selectedTips.map((tip) => (
        <Text key={tip.highlight}>
          <Text color={theme.text.link}>{'  › '}</Text>
          <Text color={theme.text.secondary}>{tip.before}</Text>
          <Text bold color={theme.text.accent}>
            {tip.highlight}
          </Text>{' '}
          <Text color={theme.text.secondary}>{tip.after.trimStart()}</Text>
        </Text>
      ))}
    </Box>
  );
};
