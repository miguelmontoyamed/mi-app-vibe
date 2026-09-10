import {
  Linking,
  Platform,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { ThemedText } from '@/components/themed-text';
import { Brand, Shape, Spacing } from '@/constants/theme';

/**
 * beta-bits — identidad visual "FASE BETA" y Programa Beta Tester.
 *
 * Componentes 100% presentacionales (sin lógica de negocio): chip BETA con
 * borde luminoso ámbar, tarjeta del programa con acceso a WhatsApp y pill
 * compacta para el dashboard. Estética MD3 + Liquid Glass sutil: en web se
 * aplica desenfoque de fondo; en nativo degrada a superficie sólida.
 */

/** WhatsApp de Beta Testers con mensaje predeterminado de feedback/extensión. */
export const BETA_WHATSAPP_URL =
  'https://wa.me/573002011801?text=Hola,%20soy%20Beta%20Tester%20de%20TechRepair%20Master.%20Quiero%20compartir%20mi%20feedback%20y%20activar%20mi%20extensión%20de%20prueba.';

export function openBetaWhatsApp(): void {
  if (Platform.OS === 'web') {
    window.open(BETA_WHATSAPP_URL, '_blank');
  } else {
    void Linking.openURL(BETA_WHATSAPP_URL).catch(() => {});
  }
}

/** Desenfoque solo-web (idioma del repo: cast estructural como en button.tsx). */
const webGlassStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as unknown as ViewStyle)
    : null;

/** Chip "BETA": borde luminoso ámbar sobre tinte translúcido. */
export function BetaBadge() {
  return (
    <View testID="beta-badge" accessibilityRole="text" accessibilityLabel="Fase beta">
      <View style={[styles.badge, webGlassStyle]}>
        <ThemedText type="smallBold" style={styles.badgeText}>
          BETA
        </ThemedText>
      </View>
    </View>
  );
}

/** Encabezado de marca con chip BETA al lado del título (login/signup). */
export function BetaBrandHeader({ title, titleStyle }: { title: string; titleStyle?: TextStyle }) {
  return (
    <View style={styles.brandRow}>
      <ThemedText type="subtitle" style={[styles.brandTitle, titleStyle]}>
        {title}
      </ThemedText>
      <BetaBadge />
    </View>
  );
}

/** Bloque informativo del Programa de Beta Testers Activos + WhatsApp. */
export function BetaTesterCard() {
  return (
    <GlassCard accent={Brand.warning} elevation={1} testID="beta-card">
      <View style={styles.cardCopy}>
        <ThemedText type="smallBold" style={styles.cardTitle}>
          🚀 Programa de Beta Testers Activos
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardText}>
          Disfruta de 90 días de prueba inicial. Si utilizas activamente la app en tu taller
          y nos compartes tu experiencia para seguir mejorando, ¡recibirás meses de prueba
          adicionales completamente gratis!
        </ThemedText>
        <Button
          label="Compartir feedback por WhatsApp"
          variant="whatsapp"
          onPress={openBetaWhatsApp}
          testID="beta-whatsapp-button"
        />
      </View>
    </GlassCard>
  );
}

/** Pill compacta no intrusiva para el dashboard (bajo el saludo). */
export function BetaPill() {
  return (
    <GlassCard accent={Brand.warning} elevation={1} testID="beta-pill">
      <View style={styles.pillRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.pillText}>
          💡 ¿Usando la Beta en tu mostrador? Cuéntanos tu experiencia por WhatsApp y
          amplía tu periodo de cortesía.
        </ThemedText>
        <Button
          label="WhatsApp"
          variant="whatsapp"
          onPress={openBetaWhatsApp}
          testID="beta-pill-whatsapp"
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderColor: Brand.warning,
    backgroundColor: `${Brand.warning}1a`,
    borderRadius: Shape.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Brand.warning,
    letterSpacing: 2,
    fontSize: 11,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  brandTitle: {
    textAlign: 'center',
    color: Brand.primary,
  },
  cardCopy: {
    gap: Spacing.two,
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardText: {
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pillText: {
    flex: 1,
    flexShrink: 1,
  },
});
