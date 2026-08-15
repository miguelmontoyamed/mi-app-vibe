import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';

const COMMON_ISSUES = [
  'Cambio de pantalla',
  'Cambio de batería',
  'Pin de carga',
  'Mantenimiento software',
  'Cortocircuito / No enciende',
];

// Input constraints / validation
const MAX_LENGTHS = {
  clientName: 80,
  phone: 20,
  device: 80,
  issue: 240,
  unlockCode: 20,
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
  const { addRepair } = useRepair();
  const { currentUser } = useAuth();

  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [device, setDevice] = useState('');
  const [issue, setIssue] = useState('');
  const [unlockCode, setUnlockCode] = useState('');
  const [imei, setImei] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [budget, setBudget] = useState('');

  // Load saved receipt data when the form initializes.
  // NOTE: unlockCode (device PIN) is intentionally NOT persisted — see handleSave.
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
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };
    loadLastReceipt();
  }, []);

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
    return null;
  }

  const handleSave = async () => {
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

    await addRepair({
      clientName: clientName.trim(),
      phone: phone.trim(),
      device: device.trim(),
      issue: issue.trim(),
      budget: budgetNum,
      unlockCode: unlockCode.trim() || 'No especificado',
      imei: imei.trim() || undefined,
      advancePayment: advanceNum,
      technicianName: currentUser.name,
    });

    // Persist non-sensitive receipt fields only.
    // Security: device unlock codes/PINs must never be written to AsyncStorage
    // (it is unencrypted at rest and exposed as localStorage on web).
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
        })
      );
    } catch (error) {
      console.error('Error saving receipt data:', error);
    }

    notify(`¡Equipo recibido y asignado a ${currentUser.name}!`);

    // Reset form
    setClientName('');
    setPhone('');
    setDevice('');
    setIssue('');
    setUnlockCode('');
    setImei('');
    setAdvancePayment('');
    setBudget('');

    // Navigate to jobs list
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
          {/* Preloaded Common Failures Chips */}
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

        <View style={styles.rowInputs}>
          <View style={styles.rowInputItem}>
            <FormInput
              label="Código / Desbloqueo"
              placeholder="Ej. PIN 1234 o Patrón"
              value={unlockCode}
              onChangeText={setUnlockCode}
              maxLength={MAX_LENGTHS.unlockCode}
            />
          </View>

          <View style={styles.rowInputItem}>
            <FormInput
              label="Seña / Adelanto (COP)"
              placeholder="Ej. 80000"
              keyboardType="numeric"
              value={advancePayment}
              onChangeText={setAdvancePayment}
              maxLength={MAX_LENGTHS.money}
            />
          </View>
        </View>

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

        <Button label="Registrar Recepción y Asignar" onPress={handleSave} style={styles.submitButton} />
      </ThemedView>
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
  // Verified responsive: maxWidth 600 centers the form inside Screen's
  // MaxContentWidth (1200) container; header and chipsRow wrap correctly.
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
  },
  chipText: {
    color: Brand.onBrand,
    fontSize: 12,
    fontWeight: '600',
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
});
