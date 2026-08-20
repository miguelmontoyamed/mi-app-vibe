import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { Colors, Elevation, Glass, Shape, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type GlassCardProps = ViewProps & {
  /** Borde de acento (p. ej. el color del estado en las KPI cards). */
  accent?: string;
  /** Nivel de elevación MD3 (1-3). */
  elevation?: 1 | 2 | 3;
};

/**
 * Superficie híbrida MD3 + Liquid Glass (AGENTS.md §3):
 * - Web: translúcida con backdrop-filter (blur ≤16px) y borde luminoso.
 * - Nativo: superficie sólida de la jerarquía MD3 (degradación sin blur).
 * Regla de conflicto: la legibilidad gana sobre la estética → alpha alto en
 * web (≥0.72) y fondo sólido en nativo. El acento colorea solo el borde,
 * nunca el contenido.
 */
export function GlassCard({ style, accent, elevation = 1, ...rest }: GlassCardProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const glass = Glass[dark ? 'dark' : 'light'];
  const elevationStyle =
    elevation === 3 ? Elevation.level3 : elevation === 2 ? Elevation.level2 : Elevation.level1;

  const surfaceStyle: ViewStyle | undefined = Platform.select({
    web: {
      backgroundColor: glass.background,
      borderColor: accent ?? glass.border,
      backdropFilter: `blur(${glass.blur}px) saturate(180%)`,
      WebkitBackdropFilter: `blur(${glass.blur}px) saturate(180%)`,
    } as unknown as ViewStyle,
    default: {
      backgroundColor: Colors[dark ? 'dark' : 'light'].surfaceContainerHigh,
      borderColor: accent ?? 'transparent',
    },
  });

  return (
    <View
      style={[
        styles.base,
        { borderRadius: Shape.lg, padding: Spacing.three },
        surfaceStyle,
        elevationStyle,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
  },
});