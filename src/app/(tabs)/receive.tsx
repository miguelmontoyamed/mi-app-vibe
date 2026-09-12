import { useRouter } from 'expo-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DeviceSecurityInput } from '@/components/ui/device-security-input';
import { FormInput } from '@/components/ui/form-input';
import { PartAutocompleteInput } from '@/components/ui/part-autocomplete-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing } from '@/constants/theme';
import { useAuth, type User } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useWorkshop } from '@/context/workshop-context';
import { useTheme } from '@/hooks/use-theme';
import { printComanda } from '@/utils/comanda-printer';
import type { ComandaData } from '@/utils/comanda-printer-types';
import { formatCOP } from '@/utils/format';
import { matchInventoryPart, searchInventoryParts } from '@/utils/part-search';

const COMMON_ISSUES = [
  'Cambio de pantalla',
  'Cambio de batería',
  'Pin de carga',
  'Mantenimiento software',
  'Cortocircuito / No enciende',
];

const MAX_LENGTHS = {
  clientName: 80,
  phone: 20,
  device: 80,
  issue: 240,
  imei: 17,
  money: 10,
} as const;

const PHONE_REGEX = /^[+()\d\s-]{7,20}$/;
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!MONEY_REGEX.test(trimmed)) return null;
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? num : null;
}

function notify(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('Aviso', message);
  }
}

export default function ReceiveScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { addRepair, inventory } = useRepair();
  const { currentUser, users } = useAuth();
  const { profile } = useWorkshop();

  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [device, setDevice] = useState('');
  const [issue, setIssue] = useState('');
  const [unlockCode, setUnlockCode] = useState('');
  const [securityKey, setSecurityKey] = useState(0);
  const [imei, setImei] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [budget, setBudget] = useState('');
  /** Nombre/descripción del repuesto (autocomplete input) */
  const [partName, setPartName] = useState('');
  /** Costo manual del repuesto (solo cuando NO está en inventario) */
  const [manualPartsCost, setManualPartsCost] = useState('');
  /** Repuesto seleccionado del inventario (id) - null si es manual */
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  /** Cantidad del repuesto seleccionado del inventario */
  const [partQty, setPartQty] = useState(1);
  const [assignedMember, setAssignedMember] = useState<User | null>(null);
  /** Comanda lista para imprimir tras guardar (abre el modal post-guardado). */
  const [savedComanda, setSavedComanda] = useState<ComandaData | null>(null);
  const [printing, setPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Repuestos con stock > 0 para sugerencias
  const availableParts = useMemo(
    () => inventory.filter((p) => p.stock > 0),
    [inventory]
  );

  // El partsCost se calcula automáticamente si hay parte seleccionada del inventario
  const computedPartsCost = selectedPartId
    ? Number(availableParts.find((p) => p.id === selectedPartId)?.price ?? 0) * partQty
    : 0;
  const isPartsCostAuto = selectedPartId !== null;

  // Load saved receipt data when the form initializes.
  useEffect(() => {
    const loadLastReceipt = async () => {
      try {
        const savedData = await AsyncStorage.getItem('receiptData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setClientName(data.clientName);
          setPhone(data.phone);
          setDevice(data.device);
          setIssue(data.issue);
          setUnlockCode(data.unlockCode || '');
          setImei(data.imei || '');
          setAdvancePayment(data.advancePayment != null ? String(data.advancePayment) : '');
          setBudget(data.budget != null ? String(data.budget) : '');
          setPartName(data.partName || '');
          setManualPartsCost(data.manualPartsCost || '');
          setSelectedPartId(data.selectedPartId || null);
          setPartQty(data.partQty || 1);
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };
    loadLastReceipt();
  }, []);

  if (!currentUser) {
    return null;
  }

  const memberOptions: { user: User; label: string }[] = [
    { user: currentUser, label: `${currentUser.name} (tú)` },
    ...users
      .filter((u) => u.id !== currentUser.id)
      .map((u) => ({ user: u, label: u.name })),
  ];
  const resolvedAssignee = assignedMember ?? currentUser;

  // Callback cuando el usuario selecciona un repuesto del autocomplete
  const onSelectPart = useCallback((part: { id: string; name: string; price: number; stock: number }) => {
    setSelectedPartId(part.id);
    setPartName(part.name); // Mostramos el nombre en el input
    setManualPartsCost(''); // Limpiamos costo manual
    setPartQty(1);
  }, []);

  // Callback cuando el usuario escribe en el autocomplete
  const onPartTextChange = useCallback((text: string) => {
    setPartName(text);
    // Si el texto coincide exactamente con un repuesto del inventario, preseleccionar
    const match = matchInventoryPart(availableParts, text);
    if (match && text.trim().toLowerCase() === match.name.toLowerCase()) {
      setSelectedPartId(match.id);
      setManualPartsCost(''); // Limpiamos costo manual
      setPartQty(1);
    } else {
      setSelectedPartId(null); // Entrada manual
    }
  }, [availableParts]);

  // Costo final del repuesto para enviar a addRepair
  const finalPartsCost = isPartsCostAuto
    ? computedPartsCost
    : (manualPartsCost.trim() ? (parseMoney(manualPartsCost) ?? 0) : 0);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (
      !clientName.trim() ||
      !phone.trim() ||
      !device.trim() ||
      !issue.trim() ||
      !budget.trim()
    ) {
      notify('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    if (!PHONE_REGEX.test(phone.trim())) {
      notify('Ingrese un número de teléfono válido (7 a 20 dígitos, con +57 opcional).');
      return;
    }

    const budgetNum = parseMoney(budget);
    if (budgetNum === null || budgetNum < 0) {
      notify('Ingrese un presupuesto estimado válido (ej. 480000).');
      return;
    }

    const advanceNum = advancePayment.trim() ? (parseMoney(advancePayment) ?? 0) : 0;

    setIsSaving(true);
    try {
    const result = await addRepair({
      clientName: clientName.trim(),
      phone: phone.trim(),
      device: device.trim(),
      issue: issue.trim(),
      budget: budgetNum,
      partsCost: finalPartsCost,
      unlockCode: unlockCode.trim() || 'No especificado',
      imei: imei.trim() || undefined,
      advancePayment: advanceNum,
      technicianName: resolvedAssignee.name,
      technicianId: resolvedAssignee.id,
      inventoryPartId: selectedPartId || undefined,
      inventoryPartName: selectedPartId ? availableParts.find((p) => p.id === selectedPartId)?.name : undefined,
      inventoryPartQty: isPartsCostAuto ? partQty : 0,
    });

    if (!result.ok) {
      console.error('[receive] addRepair falló: la orden NO se guardó en la nube.', result.error);
      notify(`No se pudo guardar la reparación en la nube: ${result.error ?? 'error desconocido'}`);
      return;
    }

    try {
      await AsyncStorage.setItem(
        'receiptData',
        JSON.stringify({
          clientName: clientName.trim(),
          phone: phone.trim(),
          device: device.trim(),
          issue: issue.trim(),
          imei: imei.trim(),
          advancePayment: advanceNum,
          budget: budgetNum,
          partName: partName.trim(),
          manualPartsCost: manualPartsCost.trim(),
          selectedPartId: selectedPartId || undefined,
          partQty: isPartsCostAuto ? partQty : undefined,
        })
      );
    } catch (error) {
      console.error('Error saving receipt data:', error);
    }

    if (result.repair) {
      const saved = result.repair;
      setSavedComanda({
        brand: profile?.name || 'TechRepair Master',
        orderId: saved.id,
        date: saved.date,
        clientName: saved.clientName,
        clientPhone: saved.phone,
        device: saved.device,
        imei: saved.imei,
        unlockCode: saved.unlockCode,
        issue: saved.issue,
        technicianName: saved.technicianName || 'General',
        receivedBy: currentUser?.name ?? resolvedAssignee.name,
      });
    } else {
      notify(`¡Equipo recibido y asignado a ${resolvedAssignee.name}!`);
    }

    setClientName('');
    setPhone('');
    setDevice('');
    setIssue('');
    setUnlockCode('');
    setSecurityKey((k) => k + 1);
    setImei('');
    setAdvancePayment('');
    setBudget('');
    setPartName('');
    setManualPartsCost('');
    setSelectedPartId(null);
    setPartQty(1);
    setAssignedMember(null);

    if (!result.repair) {
      // Fallback: sin datos de orden no hay modal; volver a trabajos como antes.
      router.push('/jobs');
    }
    // Con modal: sin push automático (ofrece imprimir, ver recibo o seguir).
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintComanda = async () => {
    if (!savedComanda || printing) {
      return;
    }
    setPrinting(true);
    try {
      const result = await printComanda(savedComanda, '80mm');
      if (result === 'blocked') {
        notify('Permite las ventanas emergentes para imprimir la comanda.');
      } else if (result === 'unavailable') {
        notify('Impresión no disponible en este dispositivo.');
      } else if (result === 'error') {
        notify('No se pudo abrir la impresión. Intenta de nuevo.');
      }
    } finally {
      setPrinting(false);
    }
  };

  const goReceipt = () => {
    const orderId = savedComanda?.orderId;
    setSavedComanda(null);
    if (orderId) {
      router.push({ pathname: '/receipt/[id]', params: { id: orderId } });
    }
  };

  const goJobs = () => {
    setSavedComanda(null);
    router.push('/jobs');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Recepción de Equipo
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Estación de: {currentUser.name} ({currentUser.role.toUpperCase()})
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.formContainer}>
        <FormInput
          label="Nombre del Cliente"
          required
          placeholder="Ej. Juan Pérez"
          value={clientName}
          onChangeText={setClientName}
          maxLength={MAX_LENGTHS.clientName}
        />

        <FormInput
          label="Teléfono de Contacto"
          required
          placeholder="Ej. +57 300 1234567"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={MAX_LENGTHS.phone}
        />

        <FormInput
          label="Dispositivo / Marca y Modelo"
          required
          placeholder="Ej. iPhone 13, Samsung S23"
          value={device}
          onChangeText={setDevice}
          maxLength={MAX_LENGTHS.device}
        />

        <View style={styles.inputGroup}>
          <FormInput
            label="Falla Reportada"
            required
            placeholder="Describe la falla o selecciona abajo..."
            multiline
            numberOfLines={3}
            value={issue}
            onChangeText={setIssue}
            maxLength={MAX_LENGTHS.issue}
            style={styles.textArea}
          />
          <View style={styles.chipsRow}>
            {COMMON_ISSUES.map((commonIssue) => (
              <Pressable
                key={commonIssue}
                onPress={() => setIssue(commonIssue)}
                style={styles.chip}>
                <ThemedText style={styles.chipText}>{commonIssue}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <DeviceSecurityInput
          key={securityKey}
          defaultValue={unlockCode}
          onChange={setUnlockCode}
        />

        <FormInput
          label="Seña / Adelanto (COP)"
          placeholder="Ej. 80000"
          keyboardType="numeric"
          value={advancePayment}
          onChangeText={setAdvancePayment}
          maxLength={MAX_LENGTHS.money}
        />

        <FormInput
          label="IMEI / Número de Serie"
          placeholder="Ej. 353311008766521"
          keyboardType="numeric"
          value={imei}
          onChangeText={setImei}
          maxLength={MAX_LENGTHS.imei}
        />

        <FormInput
          label="Presupuesto Estimado"
          required
          placeholder="Ej. 480000"
          keyboardType="numeric"
          value={budget}
          onChangeText={setBudget}
          maxLength={MAX_LENGTHS.money}
        />

        {/* Repuesto: Autocomplete con sugerencias de inventario + entrada manual */}
        <PartAutocompleteInput
          label="Repuesto / Pieza Requerida (opcional)"
          value={partName}
          onChangeText={onPartTextChange}
          inventory={availableParts}
          onSelectPart={onSelectPart}
          placeholder="Escribe para buscar en inventario o escribe manual..."
          maxLength={100}
        />

        {selectedPartId && (
          <View style={styles.partQtyRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Cantidad:
            </ThemedText>
            <View style={styles.qtyControls}>
              <Pressable
                onPress={() => setPartQty(Math.max(1, partQty - 1))}
                style={styles.qtyBtn}
                disabled={partQty <= 1}
                accessibilityLabel="Disminuir cantidad">
                <ThemedText type="smallBold" style={styles.qtyBtnText}>
                  −
                </ThemedText>
              </Pressable>
              <ThemedText type="smallBold" style={styles.qtyValue}>
                {partQty}
              </ThemedText>
              <Pressable
                onPress={() => {
                  const part = availableParts.find((p) => p.id === selectedPartId);
                  setPartQty(Math.min(partQty + 1, part?.stock ?? 99));
                }}
                style={styles.qtyBtn}
                disabled={partQty >= (availableParts.find((p) => p.id === selectedPartId)?.stock ?? 99)}
                accessibilityLabel="Aumentar cantidad">
                <ThemedText type="smallBold" style={styles.qtyBtnText}>
                  +
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.partSubtotal}>
              Subtotal: {formatCOP(computedPartsCost)}
            </ThemedText>
          </View>
        )}

        {isPartsCostAuto ? (
          <ThemedView type="backgroundElement" style={styles.autoPartsCostInfo}>
            <ThemedText type="small" style={styles.autoPartsCostText}>
              ✓ Repuesto de inventario: {availableParts.find((p) => p.id === selectedPartId)?.name}
              × {partQty} = {formatCOP(computedPartsCost)} — Se descontará stock automáticamente
            </ThemedText>
          </ThemedView>
        ) : partName.trim().length > 0 ? (
          <>
            <ThemedView type="backgroundElement" style={[styles.autoPartsCostInfo, styles.manualPartsCostInfo]}>
              <ThemedText type="small" style={styles.autoPartsCostText}>
                ✍️ Repuesto manual: "{partName}" — No afecta inventario
              </ThemedText>
            </ThemedView>
            <FormInput
              label="Valor del Repuesto Manual (COP)"
              placeholder="Ej. 150000"
              keyboardType="numeric"
              value={manualPartsCost}
              onChangeText={setManualPartsCost}
              maxLength={MAX_LENGTHS.money}
            />
          </>
        ) : null}

        {currentUser.role === 'admin' && (
          <View style={styles.assignGroup}>
            <ThemedText type="smallBold">Asignar a</ThemedText>
            <View style={styles.chipsRow}>
              {memberOptions.map((option) => {
                const selected = (assignedMember?.id ?? currentUser.id) === option.user.id;
                return (
                  <Pressable
                    key={option.user.id}
                    onPress={() => setAssignedMember(option.user)}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Button
          label={isSaving ? 'Guardando…' : 'Registrar Recepción y Asignar'}
          onPress={handleSave}
          style={styles.submitButton}
          disabled={isSaving}
        />
      </ThemedView>

      {/* Modal post-guardado: imprimir comanda, ver recibo o seguir (admin y técnico). */}
      <Modal
        visible={savedComanda !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={goJobs}>
        <View style={styles.modalWrap}>
          <Pressable
            testID="comanda-modal-scrim"
            accessibilityRole="button"
            accessibilityLabel="Cerrar diálogo"
            onPress={goJobs}
            style={styles.modalScrimAbsolute}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.border },
            ]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              ¡Equipo recibido!
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.modalMessage}>
              Orden {savedComanda?.orderId} guardada y asignada a {savedComanda?.technicianName}.
            </ThemedText>
            <Button
              label={printing ? 'Abriendo impresión…' : '🏷️ Imprimir Comanda (Pegar al equipo)'}
              variant="primary"
              onPress={() => void handlePrintComanda()}
              disabled={printing}
              testID="print-comanda-button"
            />
            <Button
              label="🧾 Ver Recibo del Cliente"
              variant="secondary"
              onPress={goReceipt}
              testID="goto-receipt-button"
            />
            <Button
              label="➕ Nueva Recepción"
              variant="success"
              onPress={() => setSavedComanda(null)}
              testID="new-reception-button"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ir a Trabajos"
              onPress={goJobs}
              style={styles.modalLink}>
              <ThemedText type="linkPrimary">Ir a Trabajos →</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  formContainer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  inputGroup: {
    gap: Spacing.two,
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: Brand.secondary,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
    overflow: 'hidden',
  },
  chipText: {
    color: Brand.onBrand,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  partQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  qtyBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    backgroundColor: Brand.secondary,
    minWidth: 36,
    alignItems: 'center',
  },
  qtyBtnText: {
    color: Brand.onBrand,
    fontSize: 18,
    lineHeight: 20,
  },
  qtyValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 16,
  },
  partSubtotal: {
    marginLeft: Spacing.two,
    fontWeight: '600',
    color: Brand.primary,
  },
  autoPartsCostInfo: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: Brand.secondary + '20',
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  manualPartsCostInfo: {
    borderColor: Brand.warning,
    backgroundColor: Brand.warning + '20',
  },
  autoPartsCostText: {
    color: Brand.primary,
    fontWeight: '600',
  },
  assignGroup: {
    gap: Spacing.one,
  },
  chipSelected: {
    backgroundColor: Brand.primary,
  },
  chipTextSelected: {
    color: Brand.onBrand,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  rowInputItem: {
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.two,
  },
  modalScrimAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Shape.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  modalTitle: {
    textAlign: 'center',
  },
  modalMessage: {
    textAlign: 'center',
  },
  modalLink: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
});