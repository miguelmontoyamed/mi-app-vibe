import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BREAKPOINTS, KpiAccent, Spacing, statusStyle } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair, type RepairStatus } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
    return null;
  }

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
      {/* License Expiring Countdown Banner */}
      {showLicenseWarning && (
        <ThemedView style={styles.warningBanner}>
          <View style={styles.warningRow}>
            <Ionicons name="alert-circle" size={18} color="#ffffff" />
            <ThemedText style={styles.warningText}>
              ¡Atención! Tu licencia de evaluación expira en {license.daysRemaining} días ({license.expiresAt}). Renueva para evitar bloqueos.
            </ThemedText>
          </View>
        </ThemedView>
      )}

      {/* Dashboard Summary Cards */}
      <View style={styles.cardsGrid}>
        {kpiCards.map((card) => {
          const s = statusStyle(card.status, dark ? 'dark' : 'light');
          return (
            <ThemedView
              key={card.status}
              style={[
                styles.card,
                { backgroundColor: s.bg, borderColor: card.accent, flexBasis: cardBasis },
              ]}>
              <View style={[styles.cardIcon, { backgroundColor: `${card.accent}1f` }]}>
                <Ionicons name={card.icon} size={22} color={card.accent} />
              </View>
              <ThemedText type="small" style={[styles.cardLabel, { color: s.text }]}>
                {card.label}
              </ThemedText>
              <ThemedText type="title" style={[styles.cardNumber, { color: s.text }]}>
                {card.count}
              </ThemedText>
            </ThemedView>
          );
        })}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <Link href="/receive" asChild>
          <Button label="+ Recibir Equipo" style={styles.primaryButton} />
        </Link>
        <Link href="/jobs" asChild>
          <Button label="Ver Trabajos" variant="secondary" style={styles.actionButton} />
        </Link>
      </View>
      <Link href="/taller" asChild>
        <Button label="🏪 Configurar Mi Taller" variant="secondary" style={styles.tallerButton} />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
    width: '100%',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    gap: Spacing.two,
    minHeight: 132,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: Spacing.three,
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
    shadowColor: KpiAccent.progress,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  warningBanner: {
    backgroundColor: '#b91c1c',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    width: '100%',
    marginBottom: Spacing.two,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  warningText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 13,
    flex: 1,
  },
});