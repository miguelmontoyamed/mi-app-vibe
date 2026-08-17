/**
 * Barra de navegación inferior móvil (plataforma nativa).
 *
 * Sustituye a `NativeTabs` (API inestable) por los tabs JS estables de
 * expo-router (`expo-router/js-tabs`) con una barra 100% custom: píldora
 * indicadora animada con spring, feedback de presión por escala y etiquetas
 * de una línea. La altura de contenido es exactamente 50px + insets.bottom
 * (contrato con `BottomTabInset` en `constants/theme`). En web se resuelve
 * `app-tabs.web.tsx` (top nav), que tiene prioridad por plataforma.
 */

'use no memo';

import { Ionicons } from '@expo/vector-icons';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Geometría de la barra: 6 (top) + 24 (icono) + 2 (gap) + 12 (label) + 6 (bottom) = 50px. */
const BAR_HEIGHT = 50;
const BAR_PADDING = 6;
const ICON_SIZE = 24;
const LABEL_FONT_SIZE = 10;
const LABEL_LINE_HEIGHT = 12;
const INDICATOR_HEIGHT = 36;
const INDICATOR_RADIUS = 12;
const INDICATOR_SIDE_MARGIN = 6;
const INDICATOR_OPACITY = 0.14;
const INDICATOR_SPRING = { damping: 18, stiffness: 200 };
const PRESS_SPRING = { damping: 15, stiffness: 300 };
const PRESS_SCALE = 0.9;

type TabItemProps = {
  focused: boolean;
  label: string;
  accessibilityLabel: string;
  icon: ReactNode;
  color: string;
  onPress: () => void;
};

/**
 * Tab individual: icono + etiqueta con feedback de presión por spring.
 * Cada instancia posee su propia shared value de escala (sin hooks en
 * bucles desde el padre).
 */
function TabItem({ focused, label, accessibilityLabel, icon, color, onPress }: TabItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scale: scale.value }] };
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => {
        // falsa alarma del React Compiler: reanimated exige mutar shared values
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={styles.tab}>
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <View style={styles.tabInner}>
          {icon}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.tabLabel, { color, fontWeight: focused ? '700' : '400' }]}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Barra inferior custom: tabs de ancho igual, píldora indicadora con spring
 * y feedback de presión. Altura total = 50px + insets.bottom; el contenido
 * visual queda centrado (6..44) y el Pressable de cada tab conserva una zona
 * táctil de 48px (minHeight) sin romper el contrato de 50px.
 */
function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const barWidth = useSharedValue(0);
  const activeIndex = useSharedValue(state.index);
  const translateX = useSharedValue(0);

  const tabCount = state.routes.length;

  // Desliza la píldora al tab activo con spring cuando cambia el índice.
  useAnimatedReaction(
    () => state.index,
    (index) => {
      'worklet';
      activeIndex.value = index;
      translateX.value = withSpring((barWidth.value / tabCount) * index, INDICATOR_SPRING);
    },
  );

  // Recalcula la posición apenas se mide el ancho de la barra (primer layout).
  useAnimatedReaction(
    () => barWidth.value,
    (width) => {
      'worklet';
      if (width > 0) {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withSpring((width / tabCount) * activeIndex.value, INDICATOR_SPRING);
      }
    },
  );

  const indicatorStyle = useAnimatedStyle(() => {
    'worklet';
    const width = Math.max(0, barWidth.value / tabCount - INDICATOR_SIDE_MARGIN * 2);
    const opacity = interpolate(barWidth.value, [0, 1], [0, INDICATOR_OPACITY], Extrapolation.CLAMP);
    return { width, opacity, transform: [{ translateX: translateX.value }] };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        // eslint-disable-next-line react-hooks/immutability
        barWidth.value = event.nativeEvent.layout.width;
      }}
      style={[
        styles.bar,
        {
          height: BAR_HEIGHT + insets.bottom,
          backgroundColor: theme.surfaceContainer,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + BAR_PADDING,
        },
      ]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = options.title ?? route.name;
        const accessibilityLabel = options.tabBarAccessibilityLabel ?? label;
        const color = isFocused ? Brand.primary : theme.textSecondary;
        const icon = options.tabBarIcon
          ? options.tabBarIcon({ focused: isFocused, color, size: ICON_SIZE })
          : null;

        const handlePress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TabItem
            key={route.key}
            focused={isFocused}
            label={label}
            accessibilityLabel={accessibilityLabel}
            icon={icon}
            color={color}
            onPress={handlePress}
          />
        );
      })}
    </Animated.View>
  );
}

/** Navegador de tabs estable (JS) con barra inferior custom para móvil. */
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <MobileTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          title: 'Recepción',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Trabajos',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'construct' : 'construct-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventario',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarAccessibilityLabel: 'Admin & Licencia',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: BAR_PADDING,
  },
  indicator: {
    position: 'absolute',
    left: INDICATOR_SIDE_MARGIN,
    top: (BAR_HEIGHT - INDICATOR_HEIGHT) / 2,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_RADIUS,
    backgroundColor: Brand.primary,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    gap: Spacing.half,
  },
  tabContent: {
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  tabLabel: {
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign: 'center',
  },
});