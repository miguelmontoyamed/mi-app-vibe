import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { RepairWorkflowStepper } from '@/components/ui/repair-workflow-stepper';
import { PatternPreview } from '@/components/ui/device-security-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { parseDeviceSecurity, parsePatternSequence } from '@/utils/device-security';
import { Brand, Shape, Spacing, statusStyle } from '@/constants/theme';
import { useAuth, type User } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';
import { canCancel, isAssignedToTechnician, profitForRepair } from '@/utils/repair-logic';

export default function JobDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser, users } = useAuth();
  const { repairs, cancelRepair, deleteRepair, updateRepair, updateRepairStatus } = useRepair();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [partsModalVisible, setPartsModalVisible] = useState(false);
  const [partsInput, setPartsInput] = useState('');
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  /** Miembro elegido en el modal de reasignación (null = aún sin elegir). */
  const [reassignTarget, setReassignTarget] = useState<User | null>(null);

  const repair = repairs.find((r) => r.id === id);

  // RBAC (defensa en profundidad): un técnico solo puede ver las órdenes
  // asignadas a su nombre/ID, incluso navegando por URL directa.
  const canViewRepair =
    currentUser?.role === 'admin' ||
    (currentUser != null && repair != null
      ? isAssignedToTechnician(repair, currentUser.id, currentUser.name)
      : false);

  if (!repair || !canViewRepair) {
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
  /** Seguridad del equipo: clave legible o secuencia del patrón 3x3. */
  const deviceSecurity = parseDeviceSecurity(repair.unlockCode);
  const patternSequence =
    deviceSecurity.kind === 'pattern' ? parsePatternSequence(deviceSecurity.payload) : [];
  const partsCost = repair.partsCost ?? 0;
  const profit = profitForRepair(repair);
  const canCancelRepair = canCancel(repair.status);
  const cancelStyle = statusStyle(repair.status, scheme === 'dark' ? 'dark' : 'light');

  const openPartsModal = () => {
    setPartsInput(partsCost > 0 ? String(partsCost) : '');
    setPartsModalVisible(true);
  };

  // Destinatarios para reasignar: el asignado actual primero ("actual") y
  // después el resto de miembros activos del taller (dueño + técnicos).
  // RLS (`repairs_workshop_update`) ya permite que CUALQUIER miembro del
  // taller actualice la orden, así que no hay gate de rol aquí.
  const currentAssignee = repair.technicianId
    ? users.find((u) => u.id === repair.technicianId)
    : undefined;
  const reassignOptions: { user: User; label: string }[] = (() => {
    const labelFor = (u: User): string => {
      const tags = [
        u.id === currentAssignee?.id ? 'actual' : null,
        currentUser && u.id === currentUser.id ? 'tú' : null,
      ].filter((t): t is string => t !== null);
      return tags.length > 0 ? `${u.name} (${tags.join(' · ')})` : u.name;
    };
    const list: { user: User; label: string }[] = [];
    if (currentAssignee) {
      list.push({ user: currentAssignee, label: labelFor(currentAssignee) });
    }
    for (const u of users) {
      if (u.id !== currentAssignee?.id) {
        list.push({ user: u, label: labelFor(u) });
      }
    }
    return list;
  })();

  const openReassignModal = () => {
    setReassignTarget(null);
    setReassignModalVisible(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassignTarget) {
      return;
    }
    await updateRepair(repair.id, {
      technicianId: reassignTarget.id,
      technicianName: reassignTarget.name,
    });
    setReassignModalVisible(false);
    setReassignTarget(null);
  };

  const handleSaveParts = async () => {
    const trimmed = partsInput.trim();
    const value = trimmed ? parseFloat(trimmed) : 0;
    if (!Number.isFinite(value) || value < 0) {
      if (Platform.OS === 'web') {
        window.alert('Valor inválido\n\nIngrese un valor numérico mayor o igual a 0.');
      } else {
        Alert.alert('Valor inválido', 'Ingrese un valor numérico mayor o igual a 0.');
      }
      return;
    }
    await updateRepair(repair.id, { partsCost: value });
    setPartsModalVisible(false);
    setPartsInput('');
  };

  const openCancelModal = () => {
    setCancelMotivo('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    const cleanMotivo = cancelMotivo.trim();
    if (!cleanMotivo) {
      if (Platform.OS === 'web') {
        window.alert('Motivo requerido\n\nEscribe el motivo por el cual no se realizó el trabajo.');
      } else {
        Alert.alert('Motivo requerido', 'Escribe el motivo por el cual no se realizó el trabajo.');
      }
      return;
    }
    if (await cancelRepair(repair.id, cleanMotivo)) {
      setCancelModalVisible(false);
      setCancelMotivo('');
    } else {
      if (Platform.OS === 'web') {
        window.alert('No se pudo cancelar\n\nLa orden no está en un estado que permita marcarla como no realizada.');
      } else {
        Alert.alert('No se pudo cancelar', 'La orden no está en un estado que permita marcarla como no realizada.');
      }
    }
  };

  /** Confirmación MD3 de eliminación (reemplaza window.confirm/Alert nativo). */
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const handleDeleteConfirm = async () => {
    setDeletingOrder(true);
    const deleted = await deleteRepair(repair.id);
    setDeletingOrder(false);
    if (deleted) {
      setDeleteDialogVisible(false);
      router.replace('/');
    }
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
          <ThemedText type="subtitle" numberOfLines={1} ellipsizeMode="tail" style={styles.folioTitle}>{repair.id}</ThemedText>
          <StatusBadge status={repair.status} />
        </View>
        <RepairWorkflowStepper
          status={repair.status}
          canEdit={
            !isCancelled &&
            currentUser != null &&
            (currentUser.role === 'admin' ||
              isAssignedToTechnician(repair, currentUser.id, currentUser.name))
          }
          onSelectStatus={(next) => {
            void updateRepairStatus(repair.id, next);
          }}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Cliente:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>{repair.clientName}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Teléfono:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>📞 {repair.phone}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Fecha:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>📅 {repair.date}</ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Dispositivo:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>📱 {repair.device}</ThemedText>
        </View>
        {repair.imei ? (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">IMEI / Serial:</ThemedText>
            <ThemedText type="small" style={styles.sectionValue}>🔢 {repair.imei}</ThemedText>
          </View>
        ) : null}
        {deviceSecurity.kind === 'pin' || deviceSecurity.kind === 'password' ? (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Clave:</ThemedText>
            <ThemedText type="small" style={styles.sectionValue}>🔑 {deviceSecurity.payload}</ThemedText>
          </View>
        ) : null}
        {deviceSecurity.kind === 'pattern' ? (
          <View style={[styles.sectionRow, styles.patternRow]}>
            <ThemedText type="smallBold">Patrón:</ThemedText>
            {patternSequence.length > 0 ? (
              <PatternPreview sequence={patternSequence} size={72} />
            ) : (
              <ThemedText type="small" style={styles.sectionValue}>{repair.unlockCode}</ThemedText>
            )}
          </View>
        ) : null}
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Falla:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>{repair.issue}</ThemedText>
        </View>
        {repair.technicianName ? (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Técnico:</ThemedText>
            <ThemedText type="small" style={styles.sectionValue}>{repair.technicianName}</ThemedText>
          </View>
        ) : null}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Presupuesto:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>{formatCOP(repair.budget)}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Abonado:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>{formatCOP(paid)}</ThemedText>
        </View>
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Saldo pendiente:</ThemedText>
          <ThemedText type="smallBold" style={styles.sectionValue}>
            {formatCOP(Math.max(0, repair.budget - paid))}
          </ThemedText>
        </View>
        {partsCost > 0 && (
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Repuesto:</ThemedText>
            <ThemedText type="small" style={styles.sectionValue}>
              − {formatCOP(partsCost)}
            </ThemedText>
          </View>
        )}
        <View style={styles.sectionRow}>
          <ThemedText type="smallBold">Utilidad:</ThemedText>
          <ThemedText type="small" style={styles.sectionValue}>
            {formatCOP(profit)}
          </ThemedText>
        </View>
        <Button
          label={partsCost > 0 ? '✏️ Editar valor de repuesto' : '➕ Agregar valor de repuesto'}
          variant="secondary"
          onPress={openPartsModal}
          style={styles.partsBtn}
        />
        {repair.status !== 'Cancelado / No Reparado' && (
          <Button
            label="👥 Reasignar técnico"
            variant="secondary"
            onPress={openReassignModal}
            style={styles.partsBtn}
          />
        )}
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
            onPress={() => setDeleteDialogVisible(true)}
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
              La orden pasará a estado “{'Cancelado / No Reparado'}” y no se cobrará comisión.
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

      {/* Parts cost edit modal (admin y técnico asignado) */}
      <Modal
        visible={partsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPartsModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText type="subtitle">Valor del repuesto</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Se resta del presupuesto para calcular la utilidad y la comisión
              del técnico. Déjalo en 0 si no se usó repuesto.
            </ThemedText>
            <FormInput
              label="Valor del repuesto (COP)"
              placeholder="Ej. 45000"
              keyboardType="numeric"
              value={partsInput}
              onChangeText={(t) => setPartsInput(t.replace(/[^0-9.]/g, ''))}
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="secondary" onPress={() => setPartsModalVisible(false)} style={styles.modalBtn} />
              <Button label="Guardar" variant="primary" onPress={handleSaveParts} style={styles.modalBtn} />
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Reassign technician modal (cualquier miembro del taller) */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText type="subtitle">Reasignar técnico</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              La orden pasará al miembro seleccionado. Útil cuando el técnico
              asignado no puede continuar con el trabajo.
            </ThemedText>
            {reassignOptions.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No hay miembros disponibles en el taller.
              </ThemedText>
            ) : (
              <View style={styles.chipsWrap}>
                {reassignOptions.map((option) => {
                  const selected = reassignTarget?.id === option.user.id;
                  return (
                    <Pressable
                      key={option.user.id}
                      onPress={() => setReassignTarget(option.user)}
                      style={[styles.reassignChip, selected && styles.reassignChipSelected]}>
                      <ThemedText
                        type="smallBold"
                        style={[styles.reassignChipText, selected && styles.reassignChipTextSelected]}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="secondary" onPress={() => setReassignModalVisible(false)} style={styles.modalBtn} />
              <Button label="Asignar" variant="primary" onPress={handleConfirmReassign} disabled={!reassignTarget} style={styles.modalBtn} />
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Confirmación MD3 de eliminación (sustituye window.confirm/Alert) */}
      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Eliminar Orden"
        message={`¿Eliminar DEFINITIVAMENTE la orden ${repair.id}? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Conservar"
        variant="danger"
        loading={deletingOrder}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        onCancel={() => setDeleteDialogVisible(false)}
      />
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
    borderRadius: Shape.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Shape.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    height: 'auto',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  folioTitle: {
    flexShrink: 1,
    minWidth: 0,
  },
  divider: {
    height: 1,
    opacity: 0.15,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  sectionValue: {
    flex: 1,
    textAlign: 'right',
  },
  patternRow: {
    alignItems: 'center',
  },
  partsBtn: {
    marginTop: Spacing.one,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reassignChip: {
    backgroundColor: Brand.secondary,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
    overflow: 'hidden',
  },
  reassignChipSelected: {
    backgroundColor: Brand.primary,
  },
  reassignChipText: {
    color: Brand.onBrand,
  },
  reassignChipTextSelected: {
    color: Brand.onBrand,
  },
  dangerZone: {
    gap: Spacing.two,
  },
  dangerBtn: {
    width: '100%',
  },
  empty: {
    borderRadius: Shape.lg,
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
    borderRadius: Shape.lg,
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
