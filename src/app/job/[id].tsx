import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Brand, Spacing, statusStyle } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCOP } from '@/utils/format';
import { canCancel } from '@/utils/repair-logic';

export default function JobDetailScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { repairs, cancelRepair, deleteRepair } = useRepair();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');

  const repair = repairs.find((r) => r.id === id);

  if (!repair) {
    return (
      <Screen title="Detalle de Orden">
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="subtitle">Orden no encontrada</ThemedText>
          <ThemedText themeColor="textSecondary">
            La orden de trabajo no existe o fue eliminada.
          </ThemedText>
          <Button label="← Volver a Trabajos" onPress={() => router.replace('/jobs')} />
        </ThemedView>
      </Screen>
    );
  }

  const isOwner = currentUser?.role === 'admin';
  const isCancelled = repair.status === 'Cancelado / No Reparado';
  const paid = repair.advancePayment ?? 0;
  const canCancelRepair = canCancel(repair.status);
  const cancelStyle = statusStyle(repair.status, scheme === 'dark' ? 'dark' : 'light');

  const openCancelModal = () => {
    setCancelMotivo('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    const cleanMotivo = cancelMotivo.trim();
    if (!cleanMotivo) {
      Alert.alert('Motivo requerido', 'Escribe el motivo por el cual no se realizó el trabajo.');
      return;
    }
    if (await cancelRepair(repair.id, cleanMotivo)) {
      setCancelModalVisible(false);
      setCancelMotivo('');
    } else {
      Alert.alert('No se pudo cancelar', 'La orden no está en un estado que permita marcarla como no realizada.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Orden',
      `¿Eliminar DEFINITIVAMENTE la orden ${repair.id}?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            if (await deleteRepair(repair.id)) {
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen title="Detalle de Orden">
      {/* Actions */}
      <View style={styles.actions}>
        <Button label="← Volver" variant="secondary" onPress={() => router.back()} style={styles.actionBtn} />
        <Button
          label="🧾 Ver Recibo"
          variant="primary"
          onPress={() =>
            router.push({ pathname: '/receipt/[id]', params: { id: repair.id } })
          }
          style={styles.actionBtn}
        />
      </View>

      {/* Cancellation box (visible when the order was marked as not performed) */}
      {isCancelled && (
        <ThemedView
          type="backgroundElement"
          style={[
            styles.cancelBox,
            { backgroundColor: cancelStyle.bg, borderColor: cancelStyle.border },
          ]}>
          <ThemedText type="smallBold" style={{ color: cancelStyle.text }}>
            {cancelStyle.icon} Orden No Realizada
          </ThemedText>
          <ThemedText type="small" style={{ color: cancelStyle.text }}>
            Motivo: {repair.motivoCancelacion?.trim() || 'Sin motivo registrado'}
          </ThemedText>
        </ThemedView>
      )}

      {/* Order summary */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.rowBetween}>
          <ThemedText type="subtitle">{repair.id}</ThemedText>
          <StatusBadge status={repair.status} />
        </View>
        <View style={styles.divider} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Cliente:</ThemedText>
          <ThemedText type="small">{repair.clientName}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Teléfono:</ThemedText>
          <ThemedText type="small">📞 {repair.phone}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Fecha:</ThemedText>
          <ThemedText type="small">📅 {repair.date}</ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Dispositivo:</ThemedText>
          <ThemedText type="small">📱 {repair.device}</ThemedText>
        </View>
        {repair.imei ? (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">IMEI / Serial:</ThemedText>
            <ThemedText type="small">🔢 {repair.imei}</ThemedText>
          </View>
        ) : null}
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Falla:</ThemedText>
          <ThemedText type="small">{repair.issue}</ThemedText>
        </View>
        {repair.technicianName ? (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Técnico:</ThemedText>
            <ThemedText type="small">{repair.technicianName}</ThemedText>
          </View>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Presupuesto:</ThemedText>
          <ThemedText type="small">{formatCOP(repair.budget)}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Abonado:</ThemedText>
          <ThemedText type="small">{formatCOP(paid)}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Saldo pendiente:</ThemedText>
          <ThemedText type="smallBold">
            {formatCOP(Math.max(0, repair.budget - paid))}
          </ThemedText>
        </View>
      </ThemedView>

      {/* Dangerous actions */}
      <View style={styles.dangerZone}>
        {canCancelRepair && (
          <Button
            label="🚫 Marcar como No Realizado"
            variant="danger"
            onPress={openCancelModal}
            style={styles.dangerBtn}
          />
        )}
        {isOwner && (
          <Button
            label="🗑️ Eliminar Orden"
            variant="danger"
            onPress={handleDelete}
            style={styles.dangerBtn}
          />
        )}
      </View>

      {/* Cancel reason modal (free-text, required) */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText type="subtitle">Marcar como No Realizado</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              La orden pasará a estado "{'Cancelado / No Reparado'}" y no se cobrará comisión.
            </ThemedText>
            <FormInput
              label="Motivo por el cual no se realizó el trabajo"
              required
              placeholder="Ej: el cliente no trajo el equipo"
              multiline
              value={cancelMotivo}
              onChangeText={setCancelMotivo}
              style={styles.motivoInput}
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="secondary" onPress={() => setCancelModalVisible(false)} style={styles.modalBtn} />
              <Button label="Confirmar" variant="danger" onPress={handleConfirmCancel} style={styles.modalBtn} />
            </View>
          </ThemedView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    minWidth: 140,
  },
  cancelBox: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: Brand.secondary,
    opacity: 0.15,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  dangerZone: {
    gap: Spacing.two,
  },
  dangerBtn: {
    width: '100%',
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  motivoInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalBtn: {
    flex: 1,
  },
});
