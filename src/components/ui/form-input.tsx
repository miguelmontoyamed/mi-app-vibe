import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormInputProps = TextInputProps & {
  label: string;
  required?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Labeled text input with theme-aware colors. Spreads TextInputProps. */
export function FormInput({ label, required = false, style, ...rest }: FormInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{required ? `${label} *` : label}</ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Shape.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
});
