import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

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

/** Themed action button. Works with expo-router <Link asChild> (spreads props). */
export function Button({ label, variant = 'primary', style, disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: variantColors[variant] },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  label: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
