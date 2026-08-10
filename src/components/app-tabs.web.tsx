import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { BREAKPOINTS, Colors, MaxContentWidth, Spacing } from '@/constants/theme';

/** Width of the desktop sidebar navigation. */
const SIDEBAR_WIDTH = 220;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;

  return (
    <Tabs>
      <TabSlot style={isDesktop ? styles.slotDesktop : { height: '100%' }} />
      <TabList asChild>
        <CustomTabList sidebar={isDesktop} tablet={isTablet}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'house.fill', web: 'home' }}>
              Inicio
            </TabButton>
          </TabTrigger>
          <TabTrigger name="receive" href="/receive" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'plus.circle.fill', web: 'add_box' }}>
              Recepción
            </TabButton>
          </TabTrigger>
          <TabTrigger name="jobs" href="/jobs" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'wrench.and.screwdriver.fill', web: 'handyman' }}>
              Trabajos
            </TabButton>
          </TabTrigger>
          <TabTrigger name="customers" href="/customers" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'person.2.fill', web: 'group' }}>
              Clientes
            </TabButton>
          </TabTrigger>
          <TabTrigger name="inventory" href="/inventory" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'cube.box.fill', web: 'inventory_2' }}>
              Inventario
            </TabButton>
          </TabTrigger>
          <TabTrigger name="admin" href="/admin" asChild>
            <TabButton sidebar={isDesktop} icon={{ ios: 'gearshape.fill', web: 'settings' }}>
              Admin & Licencia
            </TabButton>
          </TabTrigger>
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
  ...props
}: TabTriggerSlotProps & { icon?: TabIcon; sidebar?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={
          sidebar
            ? [styles.sidebarButtonView, !isFocused && styles.sidebarButtonIdle]
            : styles.tabButtonView
        }>
        {icon && (
          <SymbolView
            tintColor={isFocused ? colors.text : colors.textSecondary}
            name={icon}
            size={sidebar ? 18 : 14}
          />
        )}
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList({
  sidebar = false,
  tablet = false,
  ...props
}: TabListProps & { sidebar?: boolean; tablet?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  if (sidebar) {
    return (
      <ThemedView
        {...props}
        type="backgroundElement"
        style={[styles.sidebarContainer, { borderRightColor: colors.border }]}>
        <ThemedText type="smallBold" style={styles.sidebarBrand}>
          TechRepair
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={[styles.externalPressable, styles.sidebarExternal]}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    );
  }

  return (
    <View {...props} style={[styles.tabListContainer, tablet && styles.tabListTablet]}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          TechRepair
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  tabListTablet: {
    top: 0,
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
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
    height: '100%',
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
});