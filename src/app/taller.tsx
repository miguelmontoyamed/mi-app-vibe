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
import { formatNit, isValidNit, normalizeNit } from '@/utils/nit';

interface FieldErrors {
  name?: string;
  nit?: string;
  phone?: string;
}

/**
 * Onboarding / perfil del taller. Guarda el membrete (nombre, NIT, dirección,
 * teléfono) que se imprime en los recibos de reparación. El NIT se valida con
 * el dígito de verificación (módulo 11 DIAN) y los errores se muestran en
 * línea, junto a cada campo.
 */
export default function TallerScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useWorkshop();

  const [name, setName] = useState(profile?.name ?? '');
  const [nit, setNit] = useState(profile?.nit ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSave = () => {
    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Ingresa el nombre del taller.';
    }
    if (!isValidNit(nit)) {
      nextErrors.nit =
        'NIT inválido: deben ser 9 dígitos + dígito de verificación correcto (módulo 11 DIAN).';
    }
    if (!phone.trim()) {
      nextErrors.phone = 'Ingresa el teléfono del taller.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    saveProfile({
      name: name.trim(),
      nit: normalizeNit(nit),
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
            placeholder="Ej: 901.234.567-8"
            keyboardType="number-pad"
            value={nit}
            onChangeText={setNit}
            maxLength={15}
          />
          {errors.nit ? <ThemedText style={styles.error}>{errors.nit}</ThemedText> : null}
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
});