import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BREAKPOINTS, KpiAccent, Spacing } from '@/constants/theme';
import { RepairStatus, useRepair } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP, parseCOPInput } from '@/utils/format';
import { PAYMENT_METHODS, type PaymentMethod } from '@/utils/repair-logic';

const STATUS_FILTERS: (RepairStatus | 'Todos')[] = [
  'Todos',
  'Pendiente',
  'En Proceso',
  'Listo',
  'Entregado',
];

/**
 * Normaliza una cadena para búsqueda multicriterio: minúsculas, sin espacios
 * extras al inicio/fin y con espacios internos múltiples colapsados a uno.
 * Permite que "  mARIA   Pérez " coincida con "maria perez".
 */
function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function JobsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.mobile;
  const router = useRouter();
  const { repairs, updateRepairStatus, recordRepairPayment } = useRepair();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<RepairStatus | 'Todos'>('Todos');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentInput, setPaymentInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');

  /**
   * Filtrado multicriterio en memoria, memoizado para que sea fluido al
   * escribir. La cadena normalizada busca coincidencia (case-insensitive,
   * sin espacios extras) en: número de orden (id), cliente, celular e IMEI.
   */
  const filteredRepairs = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    const hasQuery = query.length > 0;
    return repairs.filter((item) => {
      const matchesStatus =
        selectedFilter === 'Todos' || item.status === selectedFilter;
      if (!matchesStatus) {
        return false;
      }
      if (!hasQuery) {
        return true;
      }
      return (
        normalizeSearch(item.id).includes(query) ||
        normalizeSearch(item.clientName).includes(query) ||
        normalizeSearch(item.phone).includes(query) ||
        normalizeSearch(item.imei ?? '').includes(query)
      );
    });
  }, [repairs, searchQuery, selectedFilter]);

  const handleSendWhatsApp = (item: {
    clientName: string;
    device: string;
    status: string;
    phone: string;
  }) => {
    const message = `Hola ${item.clientName}, le saludamos de TechRepair. Su equipo ${item.device} se encuentra actualmente en estado: *${item.status}*. Saludos cordiales, le estaremos informando.`;
    const url = `https://api.whatsapp.com/send?phone=${item.phone.replace(
      /\D/g,
      ''
    )}&text=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Alert.alert(
        'Notificación WhatsApp',
        `Mensaje preparado para ${item.clientName} (${item.phone}):\n\n"${message}"`
      );
    }
  };

  const handleSubmitPayment = (id: string, budget: number, advance: number) => {
    const remaining = Math.max(0, budget - advance);
    const value = paymentInput.trim() ? (parseCOPInput(paymentInput) ?? 0) : remaining;
    if (value <= 0) {
      Alert.alert('Pago', 'El saldo pendiente es $ 0. No hay nada que cobrar.');
      return;
    }
    const applied = Math.min(value, remaining);
    recordRepairPayment(id, applied, paymentMethod);
    if (Platform.OS === 'web') {
      window.alert(
        `Pago registrado: ${formatCOP(applied)}${applied < value ? ' (supera el saldo, se tomó el saldo)' : ''}`
      );
    } else {
      Alert.alert(
        'Pago registrado',
        `Se cobró ${formatCOP(applied)} al cliente. Saldo restante: ${formatCOP(remaining - applied)}.`
      );
    }
    setPayingId(null);
    setPaymentInput('');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Lista de Trabajos
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Gestión de reparaciones y notificaciones a clientes
        </ThemedText>
      </View>

      {/* Search Bar */}
      <FormInput
        label="Buscar trabajo"
        placeholder="Buscar por orden, cliente, celular o IMEI..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}>
        {STATUS_FILTERS.map((status) => {
          const isSelected = selectedFilter === status;
          return (
            <Pressable
              key={status}
              onPress={() => setSelectedFilter(status)}
              style={[
                styles.filterChip,
                isSelected
                  ? { backgroundColor: Brand.primary }
                  : { backgroundColor: theme.backgroundElement },
              ]}>
              <ThemedText
                style={[
                  styles.filterChipText,
                  isSelected && { color: Brand.onBrand },
                ]}>
                {status}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Repairs List */}
      <View style={[styles.listContainer, isTablet && styles.listContainerTablet]}>
        {filteredRepairs.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyContainer}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              No se encontraron reparaciones.
            </ThemedText>
          </ThemedView>
        ) : (
          filteredRepairs.map((item) => (
            <ThemedView
              key={item.id}
              type="backgroundElement"
              style={[styles.repairCard, { flexBasis: isTablet ? '48%' : '100%' }]}>
              <View style={styles.repairCardTop}>
                <View style={styles.clientInfo}>
                  <ThemedText type="smallBold">{item.clientName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    📞 {item.phone}
                  </ThemedText>
                </View>
                <StatusBadge status={item.status} />
              </View>

              <ThemedText type="smallBold" style={styles.deviceText}>
                📱 {item.device}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Falla: {item.issue}
              </ThemedText>
              {item.imei ? (
                <ThemedText type="small" themeColor="textSecondary">
                  🔢 IMEI / Serial: {item.imei}
                </ThemedText>
              ) : null}

              <View style={styles.repairCardFooter}>
                <ThemedText type="small" themeColor="textSecondary">
                  📅 {item.date} | Presupuesto: {formatCOP(item.budget)}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.balanceText,
                    (item.advancePayment ?? 0) >= item.budget && { color: Brand.success },
                  ]}>
                  {item.status === 'Entregado'
                    ? 'Pago completo'
                    : `Saldo pendiente: ${formatCOP(Math.max(0, item.budget - (item.advancePayment ?? 0)))}`}
                </ThemedText>
              </View>

              {/* WhatsApp Notification Button */}
              <Button
                label="📱 Enviar Actualización por WhatsApp"
                variant="whatsapp"
                onPress={() => handleSendWhatsApp(item)}
                style={styles.whatsappBtn}
              />

              {/* Payment + Receipt actions */}
              <View style={styles.rowButtons}>
                <Button
                  label="🔍 Ver Detalles"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/job/[id]', params: { id: item.id } })
                  }
                  style={styles.rowButton}
                />
                <Button
                  label="🧾 Ver Recibo"
                  variant="primary"
                  onPress={() =>
                    router.push({ pathname: '/receipt/[id]', params: { id: item.id } })
                  }
                  style={styles.rowButton}
                />
                {(item.advancePayment ?? 0) < item.budget && (
                  <Button
                    label="💵 Registrar Pago"
                    variant="success"
                    onPress={() => {
                      setPayingId(item.id);
                      setPaymentInput('');
                      setPaymentMethod('Efectivo');
                    }}
                    style={styles.rowButton}
                  />
                )}
              </View>

              {payingId === item.id && (
                <View style={styles.paymentBox}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Saldo a cobrar: {formatCOP(Math.max(0, item.budget - (item.advancePayment ?? 0)))}
                  </ThemedText>

                  {/* Payment Method Selector */}
                  <ThemedText type="small" themeColor="textSecondary">
                    Método de pago:
                  </ThemedText>
                  <View style={styles.methodRow}>
                    {PAYMENT_METHODS.map((method) => {
                      const isSelected = paymentMethod === method;
                      return (
                        <Pressable
                          key={method}
                          onPress={() => setPaymentMethod(method)}
                          style={[
                            styles.methodChip,
                            isSelected
                              ? { backgroundColor: Brand.primary }
                              : { backgroundColor: theme.backgroundElement },
                          ]}>
                          <ThemedText
                            type="smallBold"
                            style={[
                              styles.methodChipText,
                              isSelected && { color: Brand.onBrand },
                            ]}>
                            {method}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.paymentRow}>
                    <FormInput
                      label="Monto a pagar (COP)"
                      placeholder={String(Math.max(0, item.budget - (item.advancePayment ?? 0)))}
                      keyboardType="numeric"
                      value={paymentInput}
                      onChangeText={setPaymentInput}
                      style={styles.paymentInput}
                    />
                    <Button
                      label="Cobrar"
                      variant="success"
                      onPress={() => handleSubmitPayment(item.id, item.budget, item.advancePayment ?? 0)}
                      style={styles.paymentBtn}
                    />
                  </View>
                </View>
              )}

              {/* Status Update Actions */}
              <View style={styles.statusActions}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cambiar estado:
                </ThemedText>
                <View style={styles.actionButtonsRow}>
                  {(['Pendiente', 'En Proceso', 'Listo', 'Entregado'] as RepairStatus[]).map(
                    (st) => (
                      <Pressable
                        key={st}
                        disabled={item.status === st}
                        onPress={() => updateRepairStatus(item.id, st)}
                        style={[
                          styles.actionBtn,
                          item.status === st
                            ? styles.actionBtnDisabled
                            : styles.actionBtnActive,
                        ]}>
                        <ThemedText
                          style={[
                            styles.actionBtnText,
                            item.status === st && { opacity: 0.5 },
                          ]}>
                          {st}
                        </ThemedText>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            </ThemedView>
          ))
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
  filtersRow: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  filterChip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  filterChipText: {
    fontWeight: '600',
  },
  listContainer: {
    gap: Spacing.three,
  },
  listContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyContainer: {
    padding: Spacing.six,
    borderRadius: Spacing.three,
    alignItems: 'center',
    flexBasis: '100%',
  },
  centerText: {
    textAlign: 'center',
  },
  repairCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  repairCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  deviceText: {
    marginTop: Spacing.one,
  },
  repairCardFooter: {
    marginTop: Spacing.one,
    gap: 2,
  },
  balanceText: {
    color: KpiAccent.pending,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  rowButton: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  paymentBox: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  paymentInput: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  paymentBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  methodChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  methodChipText: {
    fontSize: 12,
  },
  whatsappBtn: {
    marginTop: Spacing.one,
  },
  statusActions: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#4b5563',
    gap: Spacing.one,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  actionBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.two,
  },
  actionBtnActive: {
    backgroundColor: Brand.primary,
  },
  actionBtnDisabled: {
    backgroundColor: Brand.secondary,
  },
  actionBtnText: {
    fontSize: 11,
    color: Brand.onBrand,
    fontWeight: '600',
  },
});
