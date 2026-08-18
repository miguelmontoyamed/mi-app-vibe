import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

/**
 * URL del payment link de Wompi (pasarela elegida para el cobro mensual).
 *
 * ESPACIO RESERVADO: aún no existe cuenta/checkout de Wompi. Cuando el link
 * esté disponible, pegar aquí la URL tipo https://checkout.wompi.co/p/<id>
 * y activar handlePay (Linking.openURL + validación del evento de pago).
 */
export const WOMPI_CHECKOUT_URL: string | null = null;

/**
 * Paywall de monetización (Liquid Glass + MD3).
 *
 * Bloqueo total: sin navbar ni tab bar. Se muestra cuando el taller expira
 * (trial de 90 días o suscripción vencidos) y el router impide navegar a la
 * zona protegida. Por ahora el pago es un stub: el botón solo registra en
 * consola hasta que se integre la pasarela Wompi (WOMPI_CHECKOUT_URL).
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
    // TODO(Wompi): cuando WOMPI_CHECKOUT_URL esté disponible, abrirlo con
    // Linking.openURL(WOMPI_CHECKOUT_URL) y tras el pago confirmado marcar
    // status='active' + subscription_ends_at en la tabla workshops.
    console.log(
      `[paywall] Pago mensual solicitado: ${formatCOP(MONTHLY_PRICE_COP)} COP — integrar pasarela Wompi`
    );
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

          <Button
            label={`Pagar Mes (${formatCOP(MONTHLY_PRICE_COP)})`}
            variant="primary"
            onPress={handlePay}
            style={styles.payButton}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            Pago procesado de forma segura. Si necesitas ayuda, escríbenos por
            WhatsApp.
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
  payButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  footnote: {
    textAlign: 'center',
    marginTop: Spacing.half,
  },
});