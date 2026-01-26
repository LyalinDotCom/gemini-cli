/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { lightTheme, darkTheme, ansiTheme } from './theme.js';

export interface SemanticColors {
  text: {
    primary: string;
    secondary: string;
    link: string;
    accent: string;
    response: string;
  };
  background: {
    primary: string;
    inputBar: string;
    hintMode: string;
    diff: {
      added: string;
      removed: string;
    };
  };
  border: {
    default: string;
    focused: string;
  };
  ui: {
    comment: string;
    symbol: string;
    dark: string;
    gradient: string[] | undefined;
  };
  status: {
    error: string;
    success: string;
    warning: string;
  };
}

export const lightSemanticColors: SemanticColors = {
  text: {
    primary: lightTheme.Foreground,
    secondary: lightTheme.Gray,
    link: lightTheme.AccentBlue,
    accent: lightTheme.AccentPurple,
    response: lightTheme.Foreground,
  },
  background: {
    primary: lightTheme.Background,
    inputBar: '#EEEEEE',
    hintMode: '#E8E0F0',
    diff: {
      added: lightTheme.DiffAdded,
      removed: lightTheme.DiffRemoved,
    },
  },
  border: {
    default: lightTheme.Gray,
    focused: lightTheme.AccentBlue,
  },
  ui: {
    comment: lightTheme.Comment,
    symbol: lightTheme.Gray,
    dark: lightTheme.DarkGray,
    gradient: lightTheme.GradientColors,
  },
  status: {
    error: lightTheme.AccentRed,
    success: lightTheme.AccentGreen,
    warning: lightTheme.AccentYellow,
  },
};

export const darkSemanticColors: SemanticColors = {
  text: {
    primary: darkTheme.Foreground,
    secondary: darkTheme.Gray,
    link: darkTheme.AccentBlue,
    accent: darkTheme.AccentPurple,
    response: darkTheme.Foreground,
  },
  background: {
    primary: darkTheme.Background,
    inputBar: '#2A2A3E',
    hintMode: '#352A45',
    diff: {
      added: darkTheme.DiffAdded,
      removed: darkTheme.DiffRemoved,
    },
  },
  border: {
    default: darkTheme.Gray,
    focused: darkTheme.AccentBlue,
  },
  ui: {
    comment: darkTheme.Comment,
    symbol: darkTheme.Gray,
    dark: darkTheme.DarkGray,
    gradient: darkTheme.GradientColors,
  },
  status: {
    error: darkTheme.AccentRed,
    success: darkTheme.AccentGreen,
    warning: darkTheme.AccentYellow,
  },
};

export const ansiSemanticColors: SemanticColors = {
  text: {
    primary: ansiTheme.Foreground,
    secondary: ansiTheme.Gray,
    link: ansiTheme.AccentBlue,
    accent: ansiTheme.AccentPurple,
    response: ansiTheme.Foreground,
  },
  background: {
    primary: ansiTheme.Background,
    inputBar: 'gray',
    hintMode: 'magenta',
    diff: {
      added: ansiTheme.DiffAdded,
      removed: ansiTheme.DiffRemoved,
    },
  },
  border: {
    default: ansiTheme.Gray,
    focused: ansiTheme.AccentBlue,
  },
  ui: {
    comment: ansiTheme.Comment,
    symbol: ansiTheme.Gray,
    dark: ansiTheme.DarkGray,
    gradient: ansiTheme.GradientColors,
  },
  status: {
    error: ansiTheme.AccentRed,
    success: ansiTheme.AccentGreen,
    warning: ansiTheme.AccentYellow,
  },
};
