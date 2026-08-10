import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Navbar } from '@/components/navbar';
import { WebBadge } from '@/components/web-badge';
import {
  BottomTabInset,
  BREAKPOINTS,
  MaxContentWidth,
  Spacing,
  TabletContentWidth,
} from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Mobile content width. Not exported by the theme yet — keep the previous
 * mobile behavior (800) until the token lands there.
 */
const MobileContentWidth = 800;

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
  const { width } = useWindowDimensions();

  const maxWidth =
    width < BREAKPOINTS.mobile
      ? MobileContentWidth
      : width < BREAKPOINTS.tablet
        ? TabletContentWidth
        : MaxContentWidth;

  // RN insets are 0 on web; let CSS env(safe-area-inset-top) handle the
  // browser chrome (URL bar / PWA) instead. Only apply when there's no Navbar
  // (login / signup) — the Navbar handles its own top spacing in the auth area.
  // DimensionValue doesn't accept CSS custom properties, so widen once here.
  const webSafeAreaTop = Platform.select({
    web:
      !isAuthenticated
        ? ({ paddingTop: 'var(--sat)' } as unknown as ViewStyle)
        : undefined,
    default: undefined,
  });

  // Web bottom-bar clearance: on sub-desktop the fixed bottom tab bar overlays
  // the last ~50px of the viewport. Add the safe-area bottom (iPhone home
  // indicator) so the WebBadge & last content row are never obscured.
  const isBottomNavWeb = Platform.OS === 'web' && width < BREAKPOINTS.tablet;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.background },
        webSafeAreaTop,
      ]}>
      {isAuthenticated && <Navbar title={title} />}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: (isAuthenticated ? 0 : insets.top) + Spacing.four,
            paddingBottom: isBottomNavWeb
              ? (`calc(var(--sab) + ${BottomTabInset + Spacing.three}px)` as unknown as ViewStyle['paddingBottom'])
              : insets.bottom + BottomTabInset + Spacing.three,
          },
          contentContainerStyle,
        ]}>
        <View style={[styles.container, { maxWidth }]}>
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