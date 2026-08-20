import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Shape, Spacing, statusStyle } from '@/constants/theme';
import type { RepairStatus } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type StatusBadgeProps = {
  status: RepairStatus;
  showIcon?: boolean;
};

/** Theme-aware status pill (Pendiente / En Proceso / Listo / Entregado). */
export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const scheme = useColorScheme();
  const style = statusStyle(status, scheme === 'dark' ? 'dark' : 'light');

  return (
    <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
      {showIcon && <ThemedText style={styles.icon}>{style.icon}</ThemedText>}
      <ThemedText style={[styles.label, { color: style.text }]}>{status}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Shape.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  icon: {
    fontSize: 14,
    lineHeight: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
