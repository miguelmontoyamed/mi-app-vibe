import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useWorkshop } from '@/context/workshop-context';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';

/** Precio mensual de la suscripción (Fase 1: paywall sin pasarela real). */
export const MONTHLY_PRICE_COP = 20000;

/** Llave Bre-B del negocio: único método de pago aceptado (no se tiene Nequi). */
export const BREB_KEY = '3002011801';

/** Enlace de WhatsApp con mensaje pre-cargado para notificar el pago por Bre-B. */
export const BREB_WHATSAPP_URL =
  'https://wa.me/573002011801?text=Hola,%20mi%20taller%20está%20bloqueado.%20Ya%20tengo%20el%20comprobante%20de%20Bre-B%20para%20pagar%20el%20mes.';

/**
 * URL del payment link de Wompi (pasarela elegida como opción futura).
 *
 * ESPACIO RESERVADO: aún no existe cuenta/checkout de Wompi. Mientras tanto el
 * cobro es MANUAL por Bre-B (ver BREB_KEY). Cuando el link esté disponible,
 * pegar aquí la URL tipo https://checkout.wompi.co/p/<id> y decidir si reemplaza
 * al flujo manual de WhatsApp.
 */
export const WOMPI_CHECKOUT_URL: string | null = null;

/**
 * Paywall de monetización (Liquid Glass + MD3).
 *
 * Bloqueo total: sin navbar ni tab bar. Se muestra cuando el taller expira
 * (trial de 90 días o suscripción vencidos) y el router impide navegar a la
 * zona protegida. Pago manual: el usuario transfiere por Bre-B y notifica el
 * comprobante por WhatsApp (Linking.openURL a BREB_WHATSAPP_URL).
 */
export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { subscription } = useWorkshop();

  // Caso borde: si alguien abre /paywall sin estar expirado (o tras renovar),
  // volver a la zona protegida. El demo local (sin Supabase) nunca expira.
  useEffect(() => {
    if (isAuthenticated && !subscription.isExpired) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, subscription.isExpired, router]);

  const handlePay = () => {
    // Pago manual Bre-B: abre WhatsApp con el comprobante pre-cargado.
    Linking.openURL(BREB_WHATSAPP_URL).catch((err) => {
      console.warn('[paywall] No se pudo abrir WhatsApp:', err);
    });
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.container}>
        {/* Tarjeta glass: translucidez + borde luminoso (Liquid Glass). */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="hourglass-outline" size={40} color={Brand.primary} />
          </View>

          <ThemedText type="title" style={styles.title}>
            Tu periodo de prueba ha terminado
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Para seguir usando TechRepair Master con tus reparaciones, inventario
            y facturación, renueva tu plan mensual.
          </ThemedText>

          <ThemedView surface="highest" style={styles.pricePill}>
            <ThemedText type="smallBold" style={styles.priceText}>
              {formatCOP(MONTHLY_PRICE_COP)} COP / mes
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Renovación mensual. Cancela cuando quieras.
            </ThemedText>
          </ThemedView>

          {/* Banner crítico (Liquid Glass rojo): único método de pago aceptado. */}
          <View style={styles.brebWarning}>
            <Ionicons name="warning" size={20} color={Brand.danger} />
            <ThemedText type="smallBold" style={styles.brebWarningText}>
              ⚠️ NO TENGO NEQUI. PAGO ÚNICAMENTE POR BRE-B. MI LLAVE ES:{' '}
              {BREB_KEY}
            </ThemedText>
          </View>

          <Button
            label="Notificar Pago por WhatsApp"
            variant="whatsapp"
            onPress={handlePay}
            style={styles.payButton}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            Haz la transferencia por Bre-B a la llave indicada y notifica el
            comprobante por WhatsApp. Si necesitas ayuda, escríbenos.
          </ThemedText>
        </ThemedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Shape.lg,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.35)',
    backgroundColor: Platform.select({
      web: 'rgba(2, 132, 199, 0.06)',
      default: undefined,
    }),
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  pricePill: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Shape.lg,
    marginTop: Spacing.one,
  },
  priceText: {
    color: Brand.primary,
    fontSize: 20,
  },
  brebWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Shape.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    backgroundColor: Platform.select({
      web: 'rgba(239, 68, 68, 0.10)',
      default: undefined,
    }),
  },
  brebWarningText: {
    flex: 1,
    color: Brand.danger,
    textTransform: 'uppercase',
    fontSize: 13,
    lineHeight: 18,
  },
  payButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  footnote: {
    textAlign: 'center',
    marginTop: Spacing.half,
  },
});