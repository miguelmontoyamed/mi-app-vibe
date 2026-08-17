import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  /** MD3 surface tier (jerarquía surfaceContainer) — tiene prioridad sobre `type`. */
  surface?: 'low' | 'default' | 'high' | 'highest';
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  surface,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();

  const surfaceColor =
    surface === 'low'
      ? theme.surfaceContainerLow
      : surface === 'high'
        ? theme.surfaceContainerHigh
        : surface === 'highest'
          ? theme.surfaceContainerHighest
          : surface === 'default'
            ? theme.surfaceContainer
            : null;

  return (
    <View style={[{ backgroundColor: surfaceColor ?? theme[type ?? 'background'] }, style]} {...otherProps} />
  );
}
