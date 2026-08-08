import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

type NavbarProps = {
  /** Optional screen title rendered in the center of the bar. */
  title?: string;
};

/**
 * Shared top navigation bar: brand on the left, optional screen title centered,
 * and the current user's name + role on the right. Handles the top safe-area
 * inset itself so it never overlaps the system status bar.
 */
export function Navbar({ title }: NavbarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  const role = currentUser.role === 'admin' ? 'Dueño / Admin' : 'Técnico';

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
          paddingTop: insets.top,
        },
      ]}>
      <View style={styles.inner}>
        <View style={styles.sectionLeft}>
          <View style={styles.logoBubble}>
            <Ionicons name="hardware-chip-outline" size={18} color={Brand.onBrand} />
          </View>
          <ThemedText type="smallBold" style={styles.brand}>
            TechRepair Master
          </ThemedText>
        </View>

        {title ? (
          <ThemedText type="smallBold" style={styles.centerTitle} numberOfLines={1}>
            {title}
          </ThemedText>
        ) : null}

        <View style={styles.sectionRight}>
          <View style={styles.avatarCircle}>
            <ThemedText style={styles.avatarInitial}>
              {currentUser.name.trim().charAt(0).toUpperCase() || '?'}
            </ThemedText>
          </View>
          <View style={styles.avatarText}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.avatarName}>
              {currentUser.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.avatarRole}>
              {role}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: 52,
  },
  sectionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexShrink: 1,
  },
  centerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 15,
  },
  sectionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 15,
  },
  avatarText: {
    alignItems: 'flex-end',
    maxWidth: 110,
  },
  avatarName: {
    fontSize: 13,
  },
  avatarRole: {
    fontSize: 11,
    lineHeight: 14,
  },
});