/**
 * SISTEMA DE TOKENS CENTRALIZADO — Impeccable Design (TechRepair Master).
 *
 * Fuente única de verdad de todos los valores visuales de la app.
 * `src/constants/theme.ts` re-exporta y deriva sus tokens de aquí para
 * mantener compatibilidad con los callers existentes.
 *
 * Escala de espaciado 4/8px, paleta light/dark, radios y elevaciones MD3 +
 * Liquid Glass (blur(12px)). Prohibido hardcodear valores visuales en
 * componentes: resolverlos desde `tokens`.
 */

export const tokens = {
  colors: {
    primary: {
      default: '#2563eb',
      light: '#60a5fa',
      dark: '#1d4ed8',
      surface: 'rgba(37, 99, 235, 0.08)',
    },
    secondary: {
      default: '#0d9488',
      light: '#2dd4bf',
      dark: '#0f766e',
      surface: 'rgba(13, 148, 136, 0.08)',
    },
    background: {
      light: '#f8fafc',
      dark: '#0f172a',
    },
    surface: {
      light: '#ffffff',
      dark: '#1e293b',
    },
    surfaceGlass: {
      light: 'rgba(255, 255, 255, 0.75)',
      dark: 'rgba(30, 41, 59, 0.75)',
    },
    border: {
      light: 'rgba(0, 0, 0, 0.08)',
      dark: 'rgba(255, 255, 255, 0.12)',
    },
    text: {
      primaryLight: '#0f172a',
      secondaryLight: '#64748b',
      primaryDark: '#f8fafc',
      secondaryDark: '#94a3b8',
    },
    status: {
      pending: '#f59e0b',
      inProgress: '#3b82f6',
      ready: '#10b981',
      delivered: '#6b7280',
      error: '#ef4444',
      success: '#10b981',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
  },
  radius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  elevation: {
    glass: {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    },
  },
} as const;

export type DesignTokens = typeof tokens;