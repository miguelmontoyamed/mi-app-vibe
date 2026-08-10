import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BREAKPOINTS, KpiAccent, Spacing, statusStyle } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair, type RepairStatus } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';

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
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.mobile;
  const cardBasis =
    width >= BREAKPOINTS.tablet ? '31%' : width >= BREAKPOINTS.mobile ? '48%' : '100%';
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

  const recentRepairs = relevantRepairs.slice(0, 4);

  const showTrialWarning = license.plan === 'Prueba - 3 Meses' && license.daysRemaining <= 10;

  const kpiCards: KpiCard[] = [
    { label: 'Pendientes', count: pendingCount, status: 'Pendiente', icon: 'hourglass-outline', accent: KpiAccent.pending },
    { label: 'En Proceso', count: inProgressCount, status: 'En Proceso', icon: 'construct-outline', accent: KpiAccent.progress },
    { label: 'Listos para Entrega', count: readyCount, status: 'Listo', icon: 'checkmark-circle-outline', accent: KpiAccent.ready },
  ];

  return (
    <Screen title="Panel de Control">
      {/* Trial Expiring Countdown Banner */}
      {showTrialWarning && (
        <ThemedView style={styles.warningBanner}>
          <View style={styles.warningRow}>
            <Ionicons name="alert-circle" size={18} color="#ffffff" />
            <ThemedText style={styles.warningText}>
              ¡Atención! Tu periodo de prueba gratuita expira en {license.daysRemaining} días ({license.expiresAt}). Renueva para evitar bloqueos.
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

      {/* Recent Repairs Section */}
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">
          {currentUser.role === 'admin' ? 'Últimos Trabajos en el Taller' : 'Mis Equipos Asignados'}
        </ThemedText>
        <Link href="/jobs">
          <ThemedText type="linkPrimary">Ver todos</ThemedText>
        </Link>
      </View>

      <View style={[styles.listContainer, isTablet && styles.listContainerTablet]}>
        {recentRepairs.map((item) => (
          <ThemedView
            key={item.id}
            type="backgroundElement"
            style={[styles.repairCard, { flexBasis: isTablet ? '48%' : '100%' }]}>
            <View style={styles.repairCardTop}>
              <ThemedText type="smallBold">{item.clientName}</ThemedText>
              <StatusBadge status={item.status} />
            </View>
            <View style={styles.repairDeviceRow}>
              <Ionicons name="phone-portrait-outline" size={15} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.repairDeviceText}>
                {item.device} — {item.issue}
              </ThemedText>
            </View>
            <View style={styles.repairCardBottom}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.repairMeta}>
                Técnico: {item.technicianName || 'General'} | Seña: {formatCOP(item.advancePayment ?? 0)}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.budgetText}>
                {formatCOP(item.budget)}
              </ThemedText>
            </View>
          </ThemedView>
        ))}
      </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
    width: '100%',
  },
  listContainer: {
    gap: Spacing.three,
    width: '100%',
  },
  listContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  repairCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  repairCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repairDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  repairDeviceText: {
    flex: 1,
  },
  repairCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  repairMeta: {
    flexShrink: 1,
    marginRight: Spacing.two,
  },
  budgetText: {
    color: KpiAccent.ready,
  },
});