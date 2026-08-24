/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ColorsTheme } from './types.js';
import { interpolateColor } from './utils.js';

export const lightTheme: ColorsTheme = {
  type: 'light',
  Background: '#FAFAFA',
  Foreground: '',
  LightBlue: '#89BDCD',
  AccentBlue: '#3B82F6',
  AccentPurple: '#8B5CF6',
  AccentCyan: '#06B6D4',
  AccentGreen: '#3CA84B',
  AccentYellow: '#D5A40A',
  AccentRed: '#DD4C4C',
  DiffAdded: '#C6EAD8',
  DiffRemoved: '#FFCCCC',
  Comment: '#008000',
  Gray: '#97a0b0',
  DarkGray: interpolateColor('#97a0b0', '#FAFAFA', 0.5),
  GradientColors: ['#4796E4', '#847ACE', '#C3677F'],
};

export const darkTheme: ColorsTheme = {
  type: 'dark',
  Background: '#1E1E2E',
  Foreground: '',
  LightBlue: '#ADD8E6',
  AccentBlue: '#89B4FA',
  AccentPurple: '#CBA6F7',
  AccentCyan: '#89DCEB',
  AccentGreen: '#A6E3A1',
  AccentYellow: '#F9E2AF',
  AccentRed: '#F38BA8',
  DiffAdded: '#28350B',
  DiffRemoved: '#430000',
  Comment: '#6C7086',
  Gray: '#6C7086',
  DarkGray: interpolateColor('#6C7086', '#1E1E2E', 0.5),
  GradientColors: ['#4796E4', '#847ACE', '#C3677F'],
};

export const ansiTheme: ColorsTheme = {
  type: 'ansi',
  Background: 'black',
  Foreground: '',
  LightBlue: 'blue',
  AccentBlue: 'blue',
  AccentPurple: 'magenta',
  AccentCyan: 'cyan',
  AccentGreen: 'green',
  AccentYellow: 'yellow',
  AccentRed: 'red',
  DiffAdded: 'green',
  DiffRemoved: 'red',
  Comment: 'gray',
  Gray: 'gray',
  DarkGray: 'gray',
};
