/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // Brand tokens from docs/brand-guidelines.md
  brand: {
    primary: '#0B284C', // Deep Academic Navy
    primaryDark: '#06172D',
    primaryLight: '#E6ECF2',
    secondary: '#009D96', // Signal Teal
    secondaryDark: '#007671',
    secondaryLight: '#E0F4F4',
    accentBlue: '#007AFF', // System Accent
    warningAmber: '#FF9500',
    criticalRed: '#FF3B30',
  },
  light: {
    text: '#0B192C',
    textSecondary: '#5A697E',
    textMuted: '#8E9BAE',
    background: '#F2F4F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E0F4F4',
    border: '#E2E6ED',
    primary: '#0B284C',
    accent: '#009D96',
  },
  dark: {
    text: '#F0F4F8',
    textSecondary: '#8B9BB0',
    textMuted: '#55667A',
    background: '#0B111A',
    backgroundElement: '#121A24',
    backgroundSelected: '#1A2433',
    border: '#223042',
    primary: '#FFFFFF',
    accent: '#009D96',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
