import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Screen } from '@/components/ui/screen';
import { Brand, BREAKPOINTS, Elevation, KpiAccent, Shape, Spacing, statusStyle } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair, type RepairStatus } from '@/context/repair-context';
import { useWorkshop } from '@/context/workshop-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** WhatsApp de renovación cuando el trial está por vencer (<=10 días). */
const RENEW_WHATSAPP_URL =
  'https://wa.me/573002011801?text=Hola,%20quiero%20renovar%20mi%20suscripción.';

type IconName = keyof typeof Ionicons.glyphMap;

type KpiCard = {
  label: string;
  count: number;
  status: RepairStatus;
  icon: IconName;
  accent: string;
};

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const { width } = useWindowDimensions();
  const cardBasis = width >= BREAKPOINTS.tablet ? '23%' : width >= BREAKPOINTS.mobile ? '48%' : '100%';
  const { repairs } = useRepair();
  const { currentUser, license } = useAuth();
  const { subscription } = useWorkshop();

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
    return null;
  }

  // Trial por vencer: status 'trial' y faltan <=10 días para trial_ends_at.
  const trialDaysLeft =
    subscription.status === 'trial' && subscription.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;
  const showTrialWarning = trialDaysLeft !== null && trialDaysLeft <= 10;

  const handleRenew = () => {
    if (Platform.OS === 'web') {
      window.open(RENEW_WHATSAPP_URL, '_blank');
    } else {
      Linking.openURL(RENEW_WHATSAPP_URL).catch(() => {});
    }
  };

  // Filter repairs depending on role
  const relevantRepairs =
    currentUser.role === 'admin'
      ? repairs
      : repairs.filter(
          (r) =>
            !r.technicianName ||
            r.technicianName.toLowerCase().includes(currentUser.name.split(' ')[0].toLowerCase())
        );

  const pendingCount = relevantRepairs.filter((r) => r.status === 'Pendiente').length;
  const inProgressCount = relevantRepairs.filter((r) => r.status === 'En Proceso').length;
  const readyCount = relevantRepairs.filter((r) => r.status === 'Listo').length;
  const deliveredCount = relevantRepairs.filter((r) => r.status === 'Entregado').length;

  const showLicenseWarning = license.plan === 'Licencia Inicial' && license.daysRemaining <= 10;

  const kpiCards: KpiCard[] = [
    { label: 'Pendientes', count: pendingCount, status: 'Pendiente', icon: 'hourglass-outline', accent: KpiAccent.pending },
    { label: 'En Proceso', count: inProgressCount, status: 'En Proceso', icon: 'construct-outline', accent: KpiAccent.progress },
    { label: 'Listos para Entrega', count: readyCount, status: 'Listo', icon: 'checkmark-circle-outline', accent: KpiAccent.ready },
    { label: 'Equipos Entregados', count: deliveredCount, status: 'Entregado', icon: 'checkmark-done-outline', accent: KpiAccent.delivered },
  ];

  return (
    <Screen title="Panel de Control">
      {/* Encabezado de bienvenida (presentacional: lee el nombre del auth actual). */}
      <View style={styles.welcomeHeader}>
        <View style={styles.welcomeCopy}>
          <ThemedText type="subtitle" numberOfLines={1} ellipsizeMode="tail">
            Hola, {currentUser.name.trim().split(' ')[0]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {currentUser.role === 'admin' ? 'Resumen de tu taller' : 'Tus trabajos asignados'}
          </ThemedText>
        </View>
        <View style={styles.welcomeChip}>
          <Ionicons name="sparkles" size={22} color={Brand.primary} />
        </View>
      </View>

      {/* Trial Expiring Banner — aviso de expiración de prueba (10 días). */}
      {showTrialWarning && (
        <GlassCard accent={Brand.danger} elevation={1} style={styles.warningBanner}>
          <View style={styles.warningIconChip}>
            <Ionicons name="hourglass-outline" size={20} color={Brand.danger} />
          </View>
          <View style={styles.warningCopy}>
            <ThemedText type="smallBold" style={{ color: Brand.danger }}>
              ⚠️ Faltan {trialDaysLeft} días para que termine tu periodo de prueba.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Renueva ahora para no perder acceso.
            </ThemedText>
            <Button
              label="Renovar ahora"
              variant="whatsapp"
              onPress={handleRenew}
              style={styles.renewButton}
            />
          </View>
        </GlassCard>
      )}

      {/* License Expiring Countdown Banner — contenedor de error MD3 + glass sutil. */}
      {showLicenseWarning && (
        <GlassCard accent={Brand.danger} elevation={1} style={styles.warningBanner}>
          <View style={styles.warningIconChip}>
            <Ionicons name="alert-circle" size={20} color={Brand.danger} />
          </View>
          <View style={styles.warningCopy}>
            <ThemedText type="smallBold" style={{ color: Brand.danger }}>
              Licencia de evaluación por expirar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ¡Atención! Quedan {license.daysRemaining} días ({license.expiresAt}). Renueva para evitar bloqueos.
            </ThemedText>
          </View>
        </GlassCard>
      )}

      {/* Dashboard Summary Cards — GlassCard con chip de acento por estado. */}
      <View style={styles.cardsGrid}>
        {kpiCards.map((card) => {
          const s = statusStyle(card.status, dark ? 'dark' : 'light');
          return (
            <GlassCard
              key={card.status}
              accent={card.accent}
              elevation={1}
              style={[styles.card, { flexBasis: cardBasis }]}>
              <View style={[styles.cardIcon, { backgroundColor: `${card.accent}1f` }]}>
                <Ionicons name={card.icon} size={22} color={card.accent} />
              </View>
              <ThemedText type="small" style={[styles.cardLabel, { color: s.text }]}>
                {card.label}
              </ThemedText>
              <ThemedText type="title" style={[styles.cardNumber, { color: s.text }]}>
                {card.count}
              </ThemedText>
            </GlassCard>
          );
        })}
      </View>

      {/* Quick Actions — elevación MD3 sobre los state layers de Fase B. */}
      <View style={styles.actionsRow}>
        <Link href="/receive" asChild>
          <Button label="+ Recibir Equipo" style={StyleSheet.flatten([styles.primaryButton, Elevation.level3])} />
        </Link>
        <Link href="/jobs" asChild>
          <Button label="Ver Trabajos" variant="secondary" style={StyleSheet.flatten([styles.actionButton, Elevation.level1])} />
        </Link>
      </View>
      {/* Configurar taller: permiso exclusivo del dueño (admin). */}
      {currentUser.role === 'admin' && (
        <Link href="/taller" asChild>
          <Button
            label="🏪 Configurar Mi Taller"
            variant="secondary"
            style={StyleSheet.flatten([styles.tallerButton, Elevation.level1])}
          />
        </Link>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    width: '100%',
  },
  welcomeCopy: {
    flex: 1,
    gap: Spacing.half,
    minWidth: 0,
  },
  welcomeChip: {
    width: 48,
    height: 48,
    borderRadius: Shape.xl,
    backgroundColor: `${Brand.primary}1f`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
    width: '100%',
  },
  card: {
    gap: Spacing.two,
    minHeight: 132,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: Shape.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 16,
  },
  cardNumber: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 34,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  tallerButton: {
    width: '100%',
  },
  actionButton: {
    flex: 1,
  },
  primaryButton: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    width: '100%',
    marginBottom: Spacing.two,
  },
  warningIconChip: {
    width: 36,
    height: 36,
    borderRadius: Shape.lg,
    backgroundColor: `${Brand.danger}1f`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  warningCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  renewButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});