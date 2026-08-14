/**
 * Design tokens shared by the whole app.
 * Base colors are defined for light and dark mode; semantic tokens (Brand,
 * StatusColors) keep brand/status colors consistent across screens and themes
 * so nothing hardcodes a light-only pastel that breaks in dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

import type { RepairStatus } from '@/context/repair-context';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#D8D8DF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#3A3A42',
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
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

export const BREAKPOINTS = { mobile: 768, tablet: 1024 } as const;

/** Altura de la barra de navegación inferior móvil, reservada como clearance al final del contenido scrolleable. */
export const BottomTabInset = 50;
export const MaxContentWidth = 1200;
export const TabletContentWidth = 900;

/** Brand / semantic palette (theme-independent). */
export const Brand = {
  primary: '#0284c7',
  primaryPressed: '#0369a1',
  secondary: '#334155',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  whatsapp: '#16a34a',
  onBrand: '#ffffff',
} as const;

/** Distinct accent colors for the dashboard KPI cards. */
export const KpiAccent = {
  pending: '#f97316', // Orange — Pendientes
  progress: '#3b82f6', // Blue — En Proceso
  ready: '#10b981', // Green — Listos para Entrega
  delivered: '#64748b', // Slate — Entregados
} as const;

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  icon: string;
}

/**
 * Per-status colors for light and dark mode. Used by <StatusBadge/> and the
 * dashboard KPI cards so status colors stay legible in both themes.
 */
export const StatusColors: Record<RepairStatus, { light: StatusStyle; dark: StatusStyle }> = {
  Pendiente: {
    light: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b', icon: '⏳' },
    dark: { bg: '#452a03', text: '#fcd34d', border: '#b45309', icon: '⏳' },
  },
  'En Proceso': {
    light: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6', icon: '🔄' },
    dark: { bg: '#172554', text: '#93c5fd', border: '#2563eb', icon: '🔄' },
  },
  Listo: {
    light: { bg: '#d1fae5', text: '#065f46', border: '#10b981', icon: '✅' },
    dark: { bg: '#064e3b', text: '#6ee7b7', border: '#059669', icon: '✅' },
  },
  Entregado: {
    light: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af', icon: '📦' },
    dark: { bg: '#1f2937', text: '#d1d5db', border: '#6b7280', icon: '📦' },
  },
  'Cancelado / No Reparado': {
    light: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444', icon: '🚫' },
    dark: { bg: '#450a0a', text: '#fca5a5', border: '#dc2626', icon: '🚫' },
  },
};

export function statusStyle(status: RepairStatus, scheme: 'light' | 'dark'): StatusStyle {
  return StatusColors[status][scheme];
}
