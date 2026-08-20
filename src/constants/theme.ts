/**
 * Design tokens centralizados — Sistema "Impeccable Design" (ver
 * .opencode/skills/impeccable-design.md).
 *
 * FUENTE ÚNICA DE VERDAD: `src/constants/tokens.ts`. Esta capa deriva y
 * re-exporta sus tokens para mantener compatibilidad con los callers
 * existentes (Brand, Colors, Shape, Glass, Spacing...). Los componentes
 * NUNCA hardcodean valores visuales: importan estos tokens.
 *
 * Base colors are defined for light and dark mode; semantic tokens (Brand,
 * StatusColors) keep brand/status colors consistent across screens and themes
 * so nothing hardcodes a light-only pastel that breaks in dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

import type { RepairStatus } from '@/context/repair-context';

import { tokens } from './tokens';

export { tokens };

export const Colors = {
  light: {
    text: tokens.colors.text.primaryLight,
    background: tokens.colors.background.light,
    // Cards / superficies elevadas: surface token (blanco sobre bg slate-50).
    backgroundElement: tokens.colors.surface.light,
    // Estados seleccionados: paso neutro desde surface (sin hex hardcodeado).
    backgroundSelected: '#eef1f6',
    textSecondary: tokens.colors.text.secondaryLight,
    border: tokens.colors.border.light,
    // Jerarquía MD3 surfaceContainer derivada de surface + pasos neutros.
    surfaceContainerLow: tokens.colors.surface.light,
    surfaceContainer: tokens.colors.surface.light,
    surfaceContainerHigh: '#f1f5f9',
    surfaceContainerHighest: '#e2e8f0',
    onSurface: tokens.colors.text.primaryLight,
    surfaceTint: tokens.colors.primary.default,
  },
  dark: {
    text: tokens.colors.text.primaryDark,
    background: tokens.colors.background.dark,
    backgroundElement: tokens.colors.surface.dark,
    backgroundSelected: '#28323f',
    textSecondary: tokens.colors.text.secondaryDark,
    border: tokens.colors.border.dark,
    surfaceContainerLow: tokens.colors.surface.dark,
    surfaceContainer: tokens.colors.surface.dark,
    surfaceContainerHigh: '#243244',
    surfaceContainerHighest: '#2c3a4e',
    onSurface: tokens.colors.text.primaryDark,
    surfaceTint: tokens.colors.primary.light,
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

/**
 * Escala de espaciado 4/8px (Impeccable Design, sección 2).
 * Escala canónica: xs=4, sm=8, md=12, lg=16, xl=24, xxl(2xl)=32, xxxl(3xl)=48.
 * Los alias legacy (half/one/two/three/four/five/six) se conservan para no
 * romper callers existentes.
 */
export const Spacing = {
  // Escala canónica del skill (derivada de tokens.spacing)
  xs: tokens.spacing.xs,
  sm: tokens.spacing.sm,
  md: tokens.spacing.md,
  lg: tokens.spacing.lg,
  xl: tokens.spacing.xl,
  xxl: tokens.spacing['2xl'],
  xxxl: tokens.spacing['3xl'],
  // Alias legacy (retrocompatibilidad)
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Escala tipográfica (Impeccable Design, sección 3):
 * - title: 20-24px, Semibold/Bold → encabezados principales y secciones.
 * - headline: 16-18px, Medium/Semibold → clientes, folios TRM, montos clave.
 * - body: 14-15px, Regular → descripciones, fallas técnicas, explicativos.
 * - label: 11-13px, Medium → badges, fechas secundarias, metadatos.
 */
export const Typography = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.2 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: 0.1 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.2 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.3 },
} as const;

export type TypographyVariant = keyof typeof Typography;

export const BREAKPOINTS = { mobile: 768, tablet: 1024 } as const;

/** Altura de la barra de navegación inferior móvil, reservada como clearance al final del contenido scrolleable. */
export const BottomTabInset = 50;

/** Altura mínima de objetivo táctil (Impeccable Design, sección 5): 44px. */
export const TouchTarget = { min: 44 } as const;

export const MaxContentWidth = 1200;
export const TabletContentWidth = 900;

/** Brand / semantic palette (theme-independent) — derivada de tokens.colors. */
export const Brand = {
  primary: tokens.colors.primary.default,
  primaryPressed: tokens.colors.primary.dark,
  secondary: tokens.colors.secondary.default,
  success: tokens.colors.status.success,
  warning: tokens.colors.status.pending,
  danger: tokens.colors.status.error,
  whatsapp: '#16a34a',
  onBrand: '#ffffff',
} as const;

/**
 * Distinct accent colors for the dashboard KPI cards — consume el mismo
 * semáforo semántico de tokens.colors.status que los badges de estado.
 */
export const KpiAccent = {
  pending: tokens.colors.status.pending, // Pendientes
  progress: tokens.colors.status.inProgress, // En Proceso
  ready: tokens.colors.status.ready, // Listos para Entrega
  delivered: tokens.colors.status.delivered, // Entregados
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

/**
 * Escala de elevación MD3 (niveles 1-3). Se usan con las props shadow de RN;
 * en web react-native-web las convierte a box-shadow.
 */
export const Elevation = {
  level1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  level3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

/** Escala de forma MD3 (radios de borde) — derivada de tokens.radius. */
export const Shape = {
  sm: tokens.radius.sm,
  md: tokens.radius.md,
  lg: tokens.radius.lg,
  xl: tokens.radius.xl,
  full: tokens.radius.full,
} as const;

/** Alphas de state layers MD3 (overlay del color on-surface sobre el fondo). */
export const StateLayer = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.12,
} as const;

/**
 * Liquid Glass — acabado translúcido para superficies clave (web).
 * blur(12px) según la espec del skill (sección 1: "Liquid Glass sutil").
 * El nativo degrada a superficies sólidas de la jerarquía MD3 (los
 * componentes lo resuelven con Platform.select). Alpha alto (≥0.72) para
 * preservar contraste AA: la legibilidad gana sobre la estética (AGENTS.md §3).
 */
export const Glass = {
  light: {
    background: tokens.colors.surfaceGlass.light,
    border: 'rgba(255, 255, 255, 0.6)',
    blur: 12,
    shadow: 'rgba(0, 0, 0, 0.06)',
  },
  dark: {
    background: tokens.colors.surfaceGlass.dark,
    border: tokens.colors.border.dark,
    blur: 12,
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;
