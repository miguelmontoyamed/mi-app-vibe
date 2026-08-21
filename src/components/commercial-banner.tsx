import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

/** Canal de contacto comercial de TechRepair Master (banner, PDF e impresión). */
export const CONTACT_WHATSAPP = '+57 300 201 1801';

/**
 * Banner de contacto comercial y profesional. Reemplaza los textos de prueba
 * ("prueba de 3 meses", "gracias por confiar") e indica cómo contactar a la
 * empresa para adquirir el producto / licencia de facturación. Es responsive
 * (columna en pantallas estrechas, fila en escritorio) y respeta los temas.
 */
export function CommercialBanner() {
  return (
    <ThemedView type="backgroundElement" style={styles.banner}>
      <View style={styles.iconWrap}>
        <Ionicons name="briefcase-outline" size={22} color={Brand.primary} />
      </View>
      <View style={styles.copy}>
        <ThemedText type="smallBold" style={styles.title}>
          Adquiere la Licencia de Facturación
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Trabaja sin límites con TechRepair Master. Contacta a nuestro equipo
          comercial para adquirir el producto o tu licencia de facturación.
        </ThemedText>
        <View style={styles.contacts}>
          <View style={styles.contactItem}>
            <Ionicons name="logo-whatsapp" size={14} color={Brand.whatsapp} />
            <ThemedText type="small" themeColor="textSecondary">
              {CONTACT_WHATSAPP}
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.35)',
    backgroundColor: 'rgba(2, 132, 199, 0.06)',
    width: '100%',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    color: Brand.primary,
    fontSize: 14,
  },
  contacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});