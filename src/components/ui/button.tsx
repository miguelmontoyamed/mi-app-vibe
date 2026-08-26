import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Shape, Spacing, StateLayer, TouchTarget } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'whatsapp';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

const variantColors: Record<ButtonVariant, string> = {
  primary: Brand.primary,
  secondary: Brand.secondary,
  success: Brand.success,
  danger: Brand.danger,
  whatsapp: Brand.whatsapp,
};

/** Overlay de state layer MD3: color on-surface (blanco) al alpha indicado. */
const stateOverlay = (alpha: number): ViewStyle => ({
  backgroundColor: `rgba(255, 255, 255, ${alpha})`,
});

/**
 * Themed action button with MD3 state layers (hover 8% / focus 10% / pressed
 * 12% overlay) instead of plain opacity. Works with expo-router <Link asChild>
 * (spreads props). API unchanged: `variant`, `label`, `style`, `disabled`.
 */
export function Button({
  label,
  variant = 'primary',
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Web: anillo de foco visible para teclado (a11y). Mismo patrón de widening
  // que screen.tsx / navbar.tsx (props CSS exclusivas de web).
  const focusRing: ViewStyle | undefined =
    focused && Platform.OS === 'web'
      ? ({
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: variantColors[variant],
          outlineOffset: 2,
        } as unknown as ViewStyle)
      : undefined;

  const handlePressIn = (e: GestureResponderEvent) => {
    setPressed(true);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(e);
  };

  return (
    <Pressable
      accessibilityRole="button"
      role="button"
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.base,
        { backgroundColor: variantColors[variant] },
        focusRing,
        disabled && styles.disabled,
        style,
      ]}>
      {/* State layer MD3: overlay absoluto que cubre la superficie del botón. */}
      <View
        pointerEvents="none"
        style={[
          styles.stateLayer,
          hovered && !disabled && stateOverlay(StateLayer.hover),
          pressed && !disabled && stateOverlay(StateLayer.pressed),
          focused && !disabled && stateOverlay(StateLayer.focus),
        ]}>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget.min,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Shape.lg,
    overflow: 'hidden',
  },
  stateLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
