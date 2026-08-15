import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useWorkshop } from '@/context/workshop-context';
import { formatNit, NIT_BASE_LENGTH, nitCheckDigit, normalizeNit } from '@/utils/nit';

interface FieldErrors {
  name?: string;
  nit?: string;
  phone?: string;
}

/**
 * Onboarding / perfil del taller. Guarda el membrete (nombre, NIT, dirección,
 * teléfono) que se imprime en los recibos de reparación.
 *
 * El campo NIT solo acepta los 9 dígitos base; el dígito de verificación (DV)
 * se calcula automáticamente en segundo plano con el módulo 11 de la DIAN
 * (`nitCheckDigit`) y se adjunta al guardar, por lo que el usuario nunca
 * escribe guiones ni el DV.
 */
export default function TallerScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useWorkshop();

  const [name, setName] = useState(profile?.name ?? '');
  // Solo los 9 dígitos base: si el perfil previo guardó 10 (base + DV), se
  // recortan y el DV se recalcula con el mismo algoritmo.
  const [nit, setNit] = useState(() => normalizeNit(profile?.nit ?? '').slice(0, NIT_BASE_LENGTH));
  const [address, setAddress] = useState(profile?.address ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  // DV calculado en vivo (módulo 11 DIAN) apenas hay 9 dígitos base.
  const calculatedDv = nit.length === NIT_BASE_LENGTH ? nitCheckDigit(nit) : null;

  const handleSave = async () => {
    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Ingresa el nombre del taller.';
    }
    if (nit.length !== NIT_BASE_LENGTH) {
      nextErrors.nit = 'NIT inválido: ingresa los 9 dígitos (sin guiones ni dígito de verificación).';
    }
    if (!phone.trim()) {
      nextErrors.phone = 'Ingresa el teléfono del taller.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // El DV se adjunta automáticamente: se guardan los 10 dígitos (base + DV).
    // `saveProfile` espera la confirmación de Supabase y muestra su propio
    // alert de error en caso de fallo; solo resolvemos aquí si persistió.
    await saveProfile({
      name: name.trim(),
      nit: `${nit}${nitCheckDigit(nit)}`,
      address: address.trim(),
      phone: phone.trim(),
    });

    if (Platform.OS === 'web') {
      window.alert('Perfil del taller guardado. El membrete se usará en los recibos.');
    } else {
      Alert.alert('Taller guardado', 'El membrete se usará en los recibos.');
    }
    router.back();
  };

  return (
    <Screen title="Mi Taller">
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Perfil del Taller</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Estos datos se imprimen como membrete en los recibos de reparación (PDF).
        </ThemedText>

        <View style={styles.field}>
          <FormInput
            label="Nombre del taller"
            required
            placeholder="Ej: TechRepair Master"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          {errors.name ? <ThemedText style={styles.error}>{errors.name}</ThemedText> : null}
        </View>

        <View style={styles.field}>
          <FormInput
            label="NIT"
            required
            placeholder="Ej: 901234567"
            keyboardType="number-pad"
            value={nit}
            onChangeText={(text) => setNit(text.replace(/\D/g, '').slice(0, NIT_BASE_LENGTH))}
            maxLength={NIT_BASE_LENGTH}
          />
          {errors.nit ? <ThemedText style={styles.error}>{errors.nit}</ThemedText> : null}
          {calculatedDv !== null ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.nitHint}>
              Dígito de verificación (DV) calculado: {calculatedDv} → NIT:{' '}
              {formatNit(`${nit}${calculatedDv}`)}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.nitHint}>
              Ingresa los 9 dígitos del NIT: el dígito de verificación se calcula
              automáticamente.
            </ThemedText>
          )}
        </View>

        <View style={styles.field}>
          <FormInput
            label="Dirección"
            placeholder="Ej: Cra 15 # 88-10, Bogotá"
            value={address}
            onChangeText={setAddress}
            maxLength={120}
          />
        </View>

        <View style={styles.field}>
          <FormInput
            label="Teléfono"
            required
            placeholder="Ej: 300 123 4567"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={20}
          />
          {errors.phone ? <ThemedText style={styles.error}>{errors.phone}</ThemedText> : null}
        </View>

        <Button label="Guardar Perfil" onPress={handleSave} />
      </ThemedView>

      {/* Vista previa del membrete que se imprime en el recibo */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Vista previa del membrete</ThemedText>
        {profile ? (
          <View style={styles.preview}>
            <ThemedText type="smallBold" style={styles.previewName}>
              {profile.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              NIT: {formatNit(profile.nit)}
            </ThemedText>
            {profile.address ? (
              <ThemedText type="small" themeColor="textSecondary">
                {profile.address}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Tel: {profile.phone}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Aún no hay perfil guardado. Completa el formulario para personalizar el membrete de
            tus recibos.
          </ThemedText>
        )}
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
    width: '100%',
  },
  field: {
    gap: Spacing.one,
  },
  error: {
    color: Brand.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  preview: {
    gap: Spacing.one,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  previewName: {
    fontSize: 18,
    lineHeight: 24,
    color: Brand.primary,
  },
  nitHint: {
    lineHeight: 16,
  },
});