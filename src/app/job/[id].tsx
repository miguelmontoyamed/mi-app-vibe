import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { filterInventoryParts } from '@/utils/inventory-parts';
import { Brand, Shape, Spacing, statusStyle } from '@/constants/theme';
import { useAuth, type User } from '@/context/auth-context';
import { useRepair, type InventoryPart } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';
import { canCancel, isAssignedToTechnician, profitForRepair } from '@/utils/repair-logic';

export default function JobDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser, users } = useAuth();
  const {
    repairs,
    inventory,
    cancelRepair,
    deleteRepair,
    updateRepair,
    updateRepairStatus,
    assignInventoryPartToRepair,
    removeInventoryPartFromRepair,
  } = useRepair();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(false);
  
  // Modal de repuestos (inventario / manual)
  const [partsModalVisible, setPartsModalVisible] = useState(false);
  const [partsTab, setPartsTab] = useState<'inventory' | 'manual'>('inventory');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [partQuantity, setPartQuantity] = useState(1);
  const [manualPartsInput, setManualPartsInput] = useState('');
  const [savingParts, setSavingParts] = useState(false);

  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  /** Miembro elegido en el modal de reasignación (null = aún sin elegir). */
  const [reassignTarget, setReassignTarget] = useState<User | null>(null);
  /** Confirmación MD3 de eliminación (reemplaza window.confirm/Alert nativo). */
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

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
    if (repair.inventoryPartId) {
      setPartsTab('inventory');
      setSelectedPartId(repair.inventoryPartId);
      setPartQuantity(repair.inventoryPartQty ?? 1);
      setManualPartsInput('');
    } else if (partsCost > 0) {
      setPartsTab('manual');
      setSelectedPartId(null);
      setPartQuantity(1);
      setManualPartsInput(String(partsCost));
    } else {
      setPartsTab(inventory.length > 0 ? 'inventory' : 'manual');
      setSelectedPartId(null);
      setPartQuantity(1);
      setManualPartsInput('');
    }
    setPartSearchQuery('');
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
    setSavingParts(true);
    try {
      if (partsTab === 'inventory') {
        if (!selectedPartId) {
          if (Platform.OS === 'web') {
            window.alert('Selecciona un repuesto del inventario o cambia a la pestaña Manual.');
          } else {
            Alert.alert('Aviso', 'Selecciona un repuesto del inventario o cambia a la pestaña Manual.');
          }
          return;
        }
        const ok = await assignInventoryPartToRepair(repair.id, selectedPartId, partQuantity);
        if (ok) {
          setPartsModalVisible(false);
        }
      } else {
        const trimmed = manualPartsInput.trim();
        const value = trimmed ? parseFloat(trimmed) : 0;
        if (!Number.isFinite(value) || value < 0) {
          if (Platform.OS === 'web') {
            window.alert('Valor inválido\n\nIngrese un valor numérico mayor o igual a 0.');
          } else {
            Alert.alert('Valor inválido', 'Ingrese un valor numérico mayor o igual a 0.');
          }
          return;
        }
        // Si tenía repuesto de inventario antes, primero lo desvinculamos para devolver su stock
        if (repair.inventoryPartId) {
          await removeInventoryPartFromRepair(repair.id);
        }
        await updateRepair(repair.id, {
          partsCost: value,
          inventoryPartId: undefined,
          inventoryPartName: undefined,
          inventoryPartQty: undefined,
        });
        setPartsModalVisible(false);
      }
    } finally {
      setSavingParts(false);
    }
  };

  const handleRemovePart = async () => {
    setSavingParts(true);
    try {
      await removeInventoryPartFromRepair(repair.id);
      setPartsModalVisible(false);
    } finally {
      setSavingParts(false);
    }
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
    setCancellingOrder(true);
    try {
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
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeletingOrder(true);
    const deleted = await deleteRepair(repair.id);
    setDeletingOrder(false);
    if (deleted) {
      setDeleteDialogVisible(false);
      router.replace('/');
    }
  };

  const filteredParts = filterInventoryParts(inventory, partSearchQuery);
  const selectedInventoryPart = inventory.find((p) => p.id === selectedPartId);
  const availableMaxStock = selectedInventoryPart
    ? selectedInventoryPart.stock + (repair.inventoryPartId === selectedInventoryPart.id ? (repair.inventoryPartQty ?? 1) : 0)
    : 0;

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
              {repair.inventoryPartName
                ? `📦 ${repair.inventoryPartName} (${repair.inventoryPartQty ?? 1} ud) − ${formatCOP(partsCost)}`
                : `− ${formatCOP(partsCost)}`}
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
          label={
            partsCost > 0
              ? repair.inventoryPartName
                ? '⚙️ Modificar repuesto de inventario'
                : '✏️ Editar valor de repuesto'
              : '➕ Usar repuesto de inventario'
          }
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
              <Button label="Cancelar" variant="secondary" onPress={() => setCancelModalVisible(false)} style={styles.modalBtn} disabled={cancellingOrder} />
              <Button label={cancellingOrder ? 'Cancelando...' : 'Confirmar'} variant="danger" onPress={handleConfirmCancel} style={styles.modalBtn} disabled={cancellingOrder} />
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal de Repuestos (Desde Inventario o Manual con descuento automático) */}
      <Modal
        visible={partsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPartsModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView type="backgroundElement" style={[styles.modalCard, styles.partsModalCard]}>
            <ThemedText type="subtitle">Asignar Repuesto</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              El costo del repuesto se resta del presupuesto para la utilidad y comisión del técnico.
            </ThemedText>

            {/* Selector de pestañas */}
            <View style={styles.tabHeader}>
              <Pressable
                onPress={() => setPartsTab('inventory')}
                style={[styles.tabButton, partsTab === 'inventory' && styles.tabButtonActive]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.tabButtonText, partsTab === 'inventory' && styles.tabButtonTextActive]}>
                  📦 Inventario ({inventory.length})
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setPartsTab('manual')}
                style={[styles.tabButton, partsTab === 'manual' && styles.tabButtonActive]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.tabButtonText, partsTab === 'manual' && styles.tabButtonTextActive]}>
                  💵 Valor Manual
                </ThemedText>
              </Pressable>
            </View>

            {partsTab === 'inventory' ? (
              <View style={styles.inventoryTabBody}>
                <FormInput
                  label="Buscar en inventario"
                  placeholder="Ej. Pantalla, Batería, etc..."
                  value={partSearchQuery}
                  onChangeText={setPartSearchQuery}
                />

                {inventory.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.emptyPartsNotice}>
                    <ThemedText type="small" themeColor="textSecondary">
                      No hay repuestos registrados en el inventario del taller. Regístralos en la pestaña Inventario o usa Valor Manual.
                    </ThemedText>
                  </ThemedView>
                ) : filteredParts.length === 0 ? (
                  <ThemedView type="backgroundElement" style={styles.emptyPartsNotice}>
                    <ThemedText type="small" themeColor="textSecondary">
                      No se encontraron piezas con “{partSearchQuery}”.
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ScrollView style={styles.partsListScroll} nestedScrollEnabled>
                    {filteredParts.map((item) => {
                      const isSelected = selectedPartId === item.id;
                      const hasStock = item.stock > 0 || (repair.inventoryPartId === item.id);
                      return (
                        <Pressable
                          key={item.id}
                          disabled={!hasStock}
                          onPress={() => {
                            setSelectedPartId(item.id);
                            if (partQuantity > item.stock && item.stock > 0) {
                              setPartQuantity(1);
                            }
                          }}
                          style={[
                            styles.partItemCard,
                            { borderColor: isSelected ? Brand.primary : theme.border },
                            isSelected && styles.partItemCardSelected,
                            !hasStock && styles.partItemCardDisabled,
                          ]}>
                          <View style={styles.partItemHeader}>
                            <ThemedText type="smallBold" style={styles.partItemName}>
                              {item.name}
                            </ThemedText>
                            <ThemedText type="smallBold" style={styles.partItemPrice}>
                              {formatCOP(item.price)}
                            </ThemedText>
                          </View>
                          <View style={styles.partItemFooter}>
                            <ThemedText type="small" themeColor="textSecondary">
                              {item.category || 'General'}
                            </ThemedText>
                            <View
                              style={[
                                styles.stockBadge,
                                { backgroundColor: hasStock ? Brand.primary : '#EF4444' },
                              ]}>
                              <ThemedText type="smallBold" style={styles.stockBadgeText}>
                                {hasStock ? `Stock: ${item.stock}` : 'Agotado (0)'}
                              </ThemedText>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Cantidad y resumen si hay pieza seleccionada */}
                {selectedInventoryPart && (
                  <View style={styles.quantitySection}>
                    <ThemedText type="smallBold">Cantidad a utilizar:</ThemedText>
                    <View style={styles.quantityControls}>
                      <Pressable
                        onPress={() => setPartQuantity((q) => Math.max(1, q - 1))}
                        disabled={partQuantity <= 1}
                        style={[styles.qtyBtn, partQuantity <= 1 && styles.qtyBtnDisabled]}>
                        <ThemedText type="subtitle">−</ThemedText>
                      </Pressable>
                      <ThemedText type="subtitle" style={styles.qtyDisplay}>
                        {partQuantity}
                      </ThemedText>
                      <Pressable
                        onPress={() => setPartQuantity((q) => Math.min(availableMaxStock, q + 1))}
                        disabled={partQuantity >= availableMaxStock}
                        style={[styles.qtyBtn, partQuantity >= availableMaxStock && styles.qtyBtnDisabled]}>
                        <ThemedText type="subtitle">+</ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText type="small" style={styles.deductPreview}>
                      Total: {formatCOP(selectedInventoryPart.price * partQuantity)} (se descontarán {partQuantity} uds automáticamente)
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.manualTabBody}>
                <ThemedText type="small" themeColor="textSecondary">
                  Ingresa el valor del repuesto si fue comprado fuera del taller o es un servicio tercerizado.
                </ThemedText>
                <FormInput
                  label="Valor del repuesto (COP)"
                  placeholder="Ej. 45000"
                  keyboardType="numeric"
                  value={manualPartsInput}
                  onChangeText={(t) => setManualPartsInput(t.replace(/[^0-9.]/g, ''))}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              {partsCost > 0 && (
                <Button
                  label="Quitar"
                  variant="danger"
                  disabled={savingParts}
                  onPress={handleRemovePart}
                  style={styles.modalBtn}
                />
              )}
              <Button
                label="Cancelar"
                variant="secondary"
                disabled={savingParts}
                onPress={() => setPartsModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                label={savingParts ? 'Guardando...' : 'Aplicar'}
                variant="primary"
                disabled={savingParts || (partsTab === 'inventory' && !selectedPartId)}
                onPress={handleSaveParts}
                style={styles.modalBtn}
              />
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
    marginTop: Spacing.two,
  },
  modalBtn: {
    flex: 1,
  },
  partsModalCard: {
    maxHeight: '90%',
  },
  tabHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Spacing.two,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Shape.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabButtonActive: {
    backgroundColor: Brand.primary,
  },
  tabButtonText: {
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: Brand.onBrand,
  },
  inventoryTabBody: {
    gap: Spacing.two,
  },
  emptyPartsNotice: {
    padding: Spacing.three,
    borderRadius: Shape.md,
    alignItems: 'center',
  },
  partsListScroll: {
    maxHeight: 220,
  },
  partItemCard: {
    borderWidth: 1.5,
    borderRadius: Shape.md,
    padding: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  partItemCardSelected: {
    backgroundColor: 'rgba(0, 168, 232, 0.12)',
  },
  partItemCardDisabled: {
    opacity: 0.5,
  },
  partItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  partItemName: {
    flex: 1,
  },
  partItemPrice: {
    color: Brand.primary,
  },
  partItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Shape.sm,
  },
  stockBadgeText: {
    color: Brand.onBrand,
    fontSize: 11,
  },
  quantitySection: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Shape.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: Shape.md,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyDisplay: {
    minWidth: 40,
    textAlign: 'center',
  },
  deductPreview: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  manualTabBody: {
    gap: Spacing.two,
  },
});
