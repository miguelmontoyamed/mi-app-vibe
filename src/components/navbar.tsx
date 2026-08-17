import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, BREAKPOINTS, Colors, Glass, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type NavbarProps = {
  /** Optional screen title rendered in the center of the bar. */
  title?: string;
};

/**
 * Shared top navigation bar: brand on the left, optional screen title centered,
 * and the current user's name + role on the right. Handles the top safe-area
 * inset itself so it never overlaps the system status bar / notch (native) or
 * the Safari/PWA browser chrome (web, via the `--sat` CSS variable).
 *
 * Responsive contract (evita superposiciones en pantallas pequeñas):
 * - En móvil (`< BREAKPOINTS.mobile`) se oculta el texto de la marca y queda
 *   solo el ícono del logo; el título central reaparece con la marca en md+.
 * - Las tres columnas viven en el flujo flex (sin `position: absolute`), cada
 *   lateral con `flex: 1` + `minWidth: 0` y el centro con `flexShrink: 1`, de
 *   modo que nada puede encimarse y los textos largos se truncan con `…`.
 */
export function Navbar({ title }: NavbarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const glass = Glass[dark ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  const isMobile = width < BREAKPOINTS.mobile;
  const role = currentUser.role === 'admin' ? 'Dueño / Admin' : 'Técnico';

  // On native, `insets.top` is the notch / Dynamic Island / status bar height.
  // On web it is 0, so fall back to `env(safe-area-inset-top)` via `--sat` for
  // mobile Safari in standalone/installed mode. DimensionValue rejects CSS
  // custom properties, so widen the type once (same pattern as Screen).
  const topInsetStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({ paddingTop: 'var(--sat)' } as unknown as ViewStyle)
      : { paddingTop: insets.top };

  // Superficie híbrida MD3 + Liquid Glass (AGENTS.md §3): translúcida con blur
  // en web; sólida `surfaceContainer` en nativo (máximo rendimiento).
  const barSurface: ViewStyle = Platform.select({
    web: {
      backgroundColor: glass.background,
      borderBottomColor: glass.border,
      backdropFilter: `blur(${glass.blur}px) saturate(180%)`,
      WebkitBackdropFilter: `blur(${glass.blur}px) saturate(180%)`,
    } as unknown as ViewStyle,
    default: {
      backgroundColor: Colors[dark ? 'dark' : 'light'].surfaceContainer,
      borderBottomColor: Colors[dark ? 'dark' : 'light'].border,
    },
  });

  return (
    <View style={[styles.bar, barSurface, topInsetStyle]}>
      <View style={styles.inner}>
        {/* Marca: en móvil queda solo el ícono (sm:hidden del texto, md:flex) */}
        <View style={styles.sectionLeft}>
          <View style={styles.logoBubble}>
            <Ionicons name="hardware-chip-outline" size={18} color={Brand.onBrand} />
          </View>
          {!isMobile && (
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.brand}>
              TechRepair Master
            </ThemedText>
          )}
        </View>

        {/* Título central: en flujo (no absolute), encoge antes de solaparse */}
        {title ? (
          <View style={styles.centerWrap}>
            <ThemedText
              type="smallBold"
              style={styles.centerTitle}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </ThemedText>
          </View>
        ) : null}

        {/* Usuario: min-w-0 + flex-shrink, nombre/rol truncan con … */}
        <View style={styles.sectionRight}>
          <View style={styles.avatarCircle}>
            <ThemedText style={styles.avatarInitial}>
              {currentUser.name.trim().charAt(0).toUpperCase() || '?'}
            </ThemedText>
          </View>
          <View style={[styles.avatarText, isMobile ? styles.avatarTextMobile : styles.avatarTextDesktop]}>
            <ThemedText type="smallBold" numberOfLines={1} ellipsizeMode="tail" style={styles.avatarName}>
              {currentUser.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} ellipsizeMode="tail" style={styles.avatarRole}>
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
    gap: Spacing.two,
  },
  sectionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // min-w-0: permite que el contenido lateral se encoja/trunque.
    minWidth: 0,
  },
  logoBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brand: {
    flexShrink: 1,
  },
  centerWrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '42%',
    paddingHorizontal: Spacing.one,
  },
  centerTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  sectionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    // min-w-0 + flex-shrink del bloque de texto: el nombre largo trunca en vez
    // de empujar/encimarse con el título central.
    minWidth: 0,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 15,
  },
  avatarText: {
    alignItems: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
  },
  avatarTextMobile: {
    maxWidth: 96,
  },
  avatarTextDesktop: {
    maxWidth: 160,
  },
  avatarName: {
    fontSize: 13,
  },
  avatarRole: {
    fontSize: 11,
    lineHeight: 14,
  },
});