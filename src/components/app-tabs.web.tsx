import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { BREAKPOINTS, Colors, Glass, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

/** Width of the desktop sidebar navigation. */
const SIDEBAR_WIDTH = 220;

/**
 * Bottom navigation bar (mobile web & tablet). Kept fixed on top of the
 * viewport; the screens reserve its height via `BottomTabInset` + the
 * `--sab` safe-area inset (see `src/components/ui/screen.tsx`).
 */
const bottomBarWebStyle = {
  position: 'fixed',
  left: 0,
  bottom: 0,
  width: '100%',
  zIndex: 9999,
} as unknown as ViewStyle;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const slotStyle: ViewStyle = isDesktop ? styles.slotDesktop : styles.slotMobile;

  return (
    <Tabs>
      <TabSlot style={slotStyle} />
      <TabList asChild>
        <CustomTabList sidebar={isDesktop}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton bottom={!isDesktop} icon={{ ios: 'house.fill', web: 'home' }}>
              Inicio
            </TabButton>
          </TabTrigger>
          <TabTrigger name="receive" href="/receive" asChild>
            <TabButton bottom={!isDesktop} icon={{ ios: 'plus.circle.fill', web: 'add_box' }}>
              Recepción
            </TabButton>
          </TabTrigger>
          <TabTrigger name="jobs" href="/jobs" asChild>
            <TabButton
              bottom={!isDesktop}
              icon={{ ios: 'wrench.and.screwdriver.fill', web: 'handyman' }}>
              Trabajos
            </TabButton>
          </TabTrigger>
          <TabTrigger name="customers" href="/customers" asChild>
            <TabButton bottom={!isDesktop} icon={{ ios: 'person.2.fill', web: 'group' }}>
              Clientes
            </TabButton>
          </TabTrigger>
          <TabTrigger name="inventory" href="/inventory" asChild>
            <TabButton bottom={!isDesktop} icon={{ ios: 'cube.box.fill', web: 'inventory_2' }}>
              Inventario
            </TabButton>
          </TabTrigger>
          {/* RBAC: el tab Admin solo se muestra al dueño (admin). */}
          {isAdmin && (
            <TabTrigger name="admin" href="/admin" asChild>
              <TabButton bottom={!isDesktop} icon={{ ios: 'gearshape.fill', web: 'settings' }}>
                Admin & Licencia
              </TabButton>
            </TabTrigger>
          )}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabIcon = NonNullable<SymbolViewProps['name']>;

export function TabButton({
  children,
  isFocused,
  icon,
  sidebar = false,
  bottom = false,
  ...props
}: TabTriggerSlotProps & { icon?: TabIcon; sidebar?: boolean; bottom?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={
          (
            sidebar
              ? [styles.sidebarButtonView, !isFocused && styles.sidebarButtonIdle]
              : bottom
                ? styles.bottomButtonView
                : styles.tabButtonView
          ) as StyleProp<ViewStyle>
        }>
        {icon && (
          <SymbolView
            tintColor={isFocused ? colors.text : colors.textSecondary}
            name={icon}
            size={sidebar ? 18 : bottom ? 20 : 14}
          />
        )}
        <ThemedText
          type="small"
          numberOfLines={1}
          ellipsizeMode="tail"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={(bottom ? styles.bottomLabel : undefined) as StyleProp<TextStyle>}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

type BottomTabListProps = TabListProps & { sidebar?: boolean };

export function CustomTabList({ sidebar = false, ...props }: BottomTabListProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const glass = Glass[scheme === 'dark' ? 'dark' : 'light'];
  // Glass sutil del scaffold web (AGENTS.md §3): translúcido + blur, bordes
  // luminosos. Los pills de los tabs conservan fondo sólido MD3 (legibilidad).
  const glassSurface: ViewStyle = {
    backgroundColor: glass.background,
    borderRightColor: glass.border,
    borderTopColor: glass.border,
    backdropFilter: `blur(${glass.blur}px) saturate(180%)`,
    WebkitBackdropFilter: `blur(${glass.blur}px) saturate(180%)`,
  } as unknown as ViewStyle;

  if (sidebar) {
    return (
      <ThemedView
        {...props}
        type="backgroundElement"
        style={[styles.sidebarContainer, glassSurface]}>
        <ThemedText type="smallBold" style={styles.sidebarBrand}>
          TechRepair
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.externalPressable, styles.sidebarExternal])}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    );
  }

  // Mobile & tablet (< 1024px): fixed bottom navigation bar. The top
  // bar stays owned by `Navbar` (screen.tsx); this one never overlaps it.
  return (
    <ThemedView
      {...props}
      type="backgroundElement"
      style={[styles.bottomBar, glassSurface]}>
      {props.children}
    </ThemedView>
  );
}

const bottomBarFixedStyle: ViewStyle = {
  ...bottomBarWebStyle,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-around',
  borderTopWidth: StyleSheet.hairlineWidth,
  paddingTop: Spacing.one,
  paddingBottom: 'var(--sab)' as unknown as ViewStyle['paddingBottom'],
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
  slotDesktop: {
    marginLeft: SIDEBAR_WIDTH,
    flex: 1,
  },
  slotMobile: {
    flex: 1,
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    flexDirection: 'column',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sidebarBrand: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  sidebarButtonView: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    width: '100%',
  },
  sidebarButtonIdle: {
    backgroundColor: 'transparent',
  },
  sidebarExternal: {
    marginLeft: 0,
    marginTop: 'auto',
    paddingVertical: Spacing.two,
  },
  bottomBar: bottomBarFixedStyle,
  bottomButtonView: {
    flex: 1,
    maxWidth: 96,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.three,
  },
  bottomLabel: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    maxWidth: 88,
  },
});