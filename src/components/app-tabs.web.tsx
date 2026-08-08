import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon={{ ios: 'house.fill', web: 'home' }}>Inicio</TabButton>
          </TabTrigger>
          <TabTrigger name="receive" href="/receive" asChild>
            <TabButton icon={{ ios: 'plus.circle.fill', web: 'add_box' }}>Recepción</TabButton>
          </TabTrigger>
          <TabTrigger name="jobs" href="/jobs" asChild>
            <TabButton icon={{ ios: 'wrench.and.screwdriver.fill', web: 'handyman' }}>Trabajos</TabButton>
          </TabTrigger>
          <TabTrigger name="customers" href="/customers" asChild>
            <TabButton icon={{ ios: 'person.2.fill', web: 'group' }}>Clientes</TabButton>
          </TabTrigger>
          <TabTrigger name="inventory" href="/inventory" asChild>
            <TabButton icon={{ ios: 'cube.box.fill', web: 'inventory_2' }}>Inventario</TabButton>
          </TabTrigger>
          <TabTrigger name="admin" href="/admin" asChild>
            <TabButton icon={{ ios: 'gearshape.fill', web: 'settings' }}>Admin & Licencia</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabIcon = NonNullable<SymbolViewProps['name']>;

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon?: TabIcon }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        {icon && (
          <SymbolView
            tintColor={isFocused ? colors.text : colors.textSecondary}
            name={icon}
            size={14}
          />
        )}
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View {...props} style={styles.tabListContainer}>
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
});
