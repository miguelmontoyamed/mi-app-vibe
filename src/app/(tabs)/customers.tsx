import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BREAKPOINTS, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair, type RepairItem } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';
import { visibleRepairs } from '@/utils/repair-logic';

type CustomerGroup = {
  key: string;
  name: string;
  phone: string;
  repairs: RepairItem[];
};

export default function CustomersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { repairs } = useRepair();
  const { currentUser } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.mobile;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Group repairs by (phone | name) so a returning client shows their full history.
  // Vive ANTES del guard de autenticación (regla de hooks); sin usuario devuelve
  // vacío porque el componente no renderiza nada igualmente.
  const customers = useMemo<CustomerGroup[]>(() => {
    if (!currentUser) {
      return [];
    }
    const map = new Map<string, CustomerGroup>();
    // RBAC: el técnico solo ve clientes de sus órdenes asignadas; el admin todos.
    for (const r of visibleRepairs(repairs, currentUser)) {
      const key = `${(r.phone ?? '').trim().toLowerCase()}|${r.clientName.trim().toLowerCase()}` || r.id;
      const existing = map.get(key);
      if (existing) {
        existing.repairs.push(r);
      } else {
        map.set(key, {
          key,
          name: r.clientName,
          phone: r.phone ?? '',
          repairs: [r],
        });
      }
    }
    // Most recently active first.
    return Array.from(map.values()).sort(
      (a, b) => b.repairs.length - a.repairs.length
    );
  }, [repairs, currentUser]);

  // Los tabs solo se renderizan autenticados; el guard mantiene el tipado seguro.
  if (!currentUser) {
    return null;
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRepair = (list: RepairItem[]) =>
    list.reduce((acc, r) => acc + (r.budget || 0), 0);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Clientes</ThemedText>
        <ThemedText themeColor="textSecondary">
          Historial completo de reparaciones por cliente
        </ThemedText>
      </View>

      <FormInput
        label="Buscar cliente"
        placeholder="Buscar por nombre o teléfono..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />

      <View style={[styles.listContainer, isTablet && styles.listContainerTablet]}>
        {filtered.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyContainer}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              No se encontraron clientes.
            </ThemedText>
          </ThemedView>
        ) : (
          filtered.map((customer) => {
            const isOpen = expandedKey === customer.key;
            const activeRepairs = customer.repairs.filter(
              (r) => r.status === 'Pendiente' || r.status === 'En Proceso' || r.status === 'Listo'
            ).length;
            return (
              <ThemedView
                key={customer.key}
                type="backgroundElement"
                style={[styles.card, isTablet && styles.cardTablet]}>
                <Pressable
                  onPress={() => setExpandedKey(isOpen ? null : customer.key)}
                  style={styles.cardHeader}>
                  <View style={styles.customerInfo}>
                    <ThemedText type="smallBold">{customer.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      📞 {customer.phone}
                    </ThemedText>
                  </View>
                  <View style={styles.customerMeta}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {customer.repairs.length} reparación{customer.repairs.length === 1 ? '' : 'es'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {activeRepairs > 0 ? `🟠 ${activeRepairs} activa(s)` : '✅ Sin activas'}
                    </ThemedText>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.textSecondary}
                    />
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={[styles.history, { borderTopColor: theme.border }]}>
                    {customer.repairs.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() =>
                          router.push({ pathname: '/receipt/[id]', params: { id: r.id } })
                        }
                        style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
                        <View style={styles.historyMain}>
                          <ThemedText type="smallBold" style={styles.deviceText}>
                            📱 {r.device}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {r.date} · {r.issue}
                          </ThemedText>
                          <ThemedText
                            type="smallBold"
                            style={[
                              styles.budgetText,
                              (r.advancePayment ?? 0) < r.budget && { color: Brand.danger },
                            ]}>
                            {formatCOP(r.budget)}
                            {(r.advancePayment ?? 0) < r.budget
                              ? ` · Falta ${formatCOP(Math.max(0, r.budget - (r.advancePayment ?? 0)))}`
                              : ' · Pagado'}
                          </ThemedText>
                        </View>
                        <StatusBadge status={r.status} />
                      </Pressable>
                    ))}
                    <ThemedText type="smallBold" style={styles.totalRow}>
                      Total histórico: {formatCOP(totalRepair(customer.repairs))}
                    </ThemedText>
                  </View>
                )}
              </ThemedView>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  searchInput: {
    paddingVertical: Spacing.two,
  },
  listContainer: {
    gap: Spacing.three,
  },
  listContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyContainer: {
    padding: Spacing.six,
    borderRadius: Shape.lg,
    alignItems: 'center',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Shape.lg,
    gap: Spacing.two,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    height: 'auto',
  },
  cardTablet: {
    flexBasis: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget.min,
  },
  customerInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  customerMeta: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  history: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget.min,
  },
  historyMain: {
    flex: 1,
    gap: Spacing.half,
  },
  deviceText: {
    fontSize: 14,
  },
  budgetText: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
});