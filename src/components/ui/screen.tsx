import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Navbar } from '@/components/navbar';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Optional screen title shown centered in the top navbar. */
  title?: string;
};

/**
 * Shared screen scaffold: themed ScrollView, safe-area insets, max-content
 * width, the top navbar and the web badge. Replaces the repeated per-screen
 * wrapper.
 */
export function Screen({ children, contentContainerStyle, title }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {isAuthenticated && <Navbar title={title} />}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: (isAuthenticated ? 0 : insets.top) + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
          },
          contentContainerStyle,
        ]}>
        <View style={styles.container}>
          {children}
          {Platform.OS === 'web' && <WebBadge />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    width: '100%',
    gap: Spacing.four,
  },
});