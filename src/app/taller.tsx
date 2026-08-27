import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useWorkshop } from '@/context/workshop-context';
import { formatNit, NIT_MAX_BASE_LENGTH, nitCheckDigit, normalizeNit } from '@/utils/nit';

interface FieldErrors {
  name?: string;
  nit?: string;
  phone?: string;
}

/**
 * Onboarding / perfil del taller. Guarda el membrete (nombre, NIT, dirección,
 * teléfono) que se imprime en los recibos de reparación.
 *
 * El campo NIT acepta cualquier cantidad de dígitos base (1–15): personas
 * naturales suelen tener menos de 9 y jurídicas 9 o más. El dígito de
 * verificación (DV) se calcula automáticamente en segundo plano con el módulo
 * 11 de la DIAN (`nitCheckDigit`) y se adjunta al guardar, por lo que el
 * usuario nunca escribe guiones ni el DV.
 */
export default function TallerScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { profile, saveProfile } = useWorkshop();

  // Ya no redirigimos a los técnicos, ahora pueden ver el taller en modo solo lectura.

  const [name, setName] = useState(profile?.name ?? '');
  // Solo los 9 dígitos base: si el perfil previo guardó 10 (base + DV), se
  // recortan y el DV se recalcula con el mismo algoritmo.
  const [nit, setNit] = useState(() => normalizeNit(profile?.nit ?? '').slice(0, NIT_MAX_BASE_LENGTH));
  const [address, setAddress] = useState(profile?.address ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  // DV calculado en vivo (módulo 11 DIAN) apenas hay 9 dígitos base.
  const calculatedDv = nit.length > 0 ? nitCheckDigit(nit) : null;

  const handleSave = async () => {
    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Ingresa el nombre del taller.';
    }
    if (nit.length < 1) {
      nextErrors.nit = 'NIT inválido: ingresa los dígitos del NIT (sin guiones ni dígito de verificación).';
    }
    if (!phone.trim()) {
      nextErrors.phone = 'Ingresa el teléfono del taller.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // El DV se adjunta automáticamente: se guardan base + DV (longitud libre).
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

  const isTechnician = currentUser?.role === 'technician';

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
            required={!isTechnician}
            placeholder="Ej: TechRepair Master"
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!isTechnician}
          />
          {errors.name ? <ThemedText style={styles.error}>{errors.name}</ThemedText> : null}
        </View>

        <View style={styles.field}>
          <FormInput
            label="NIT"
            required={!isTechnician}
            placeholder="Ej: 901234567"
            keyboardType="number-pad"
            value={nit}
            onChangeText={(text) => setNit(text.replace(/\D/g, '').slice(0, NIT_MAX_BASE_LENGTH))}
            maxLength={NIT_MAX_BASE_LENGTH}
            editable={!isTechnician}
          />
          {errors.nit ? <ThemedText style={styles.error}>{errors.nit}</ThemedText> : null}
          {calculatedDv !== null ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.nitHint}>
              Dígito de verificación (DV) calculado: {calculatedDv} → NIT:{' '}
              {formatNit(`${nit}${calculatedDv}`)}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.nitHint}>
              Ingresa los dígitos del NIT (con la longitud que sea): el dígito de
              verificación se calcula automáticamente.
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
            editable={!isTechnician}
          />
        </View>

        <View style={styles.field}>
          <FormInput
            label="Teléfono"
            required={!isTechnician}
            placeholder="Ej: 300 123 4567"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={20}
            editable={!isTechnician}
          />
          {errors.phone ? <ThemedText style={styles.error}>{errors.phone}</ThemedText> : null}
        </View>

        {!isTechnician && (
          <Button label="Guardar Perfil" onPress={handleSave} />
        )}
      </ThemedView>

      {isTechnician && (
        <ThemedView style={styles.readonlyBanner}>
          <ThemedText type="smallBold" style={styles.readonlyBannerText}>
            Modo Solo Lectura
          </ThemedText>
          <ThemedText type="small" style={styles.readonlyBannerText}>
            El membrete de los recibos es administrado exclusivamente por el dueño del taller.
          </ThemedText>
        </ThemedView>
      )}

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
    borderRadius: Shape.lg,
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
  readonlyBanner: {
    padding: Spacing.three,
    borderRadius: Shape.lg,
    backgroundColor: `${Brand.primary}1a`, // Liquid Glass / subtil translúcido
    borderColor: `${Brand.primary}66`,
    borderWidth: 1,
    gap: Spacing.one,
  },
  readonlyBannerText: {
    color: Brand.primary,
  },
});