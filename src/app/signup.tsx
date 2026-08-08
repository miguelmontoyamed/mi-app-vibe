import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(title, message);
  }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?\d{7,15}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const { registerOwner, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      notify('Campos incompletos', 'Completa todos los campos obligatorios (*).');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      notify('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      notify('Teléfono inválido', 'Ingresa un número de teléfono válido (7 a 15 dígitos, con + opcional).');
      return;
    }
    if (password.length < 6) {
      notify('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const { user, reason } = registerOwner(name, email, password, phone);
    if (user) {
      notify('¡Cuenta creada!', `Bienvenido, ${user.name}. Tu taller está listo.`);
      router.replace('/');
    } else {
      const msg =
        reason === 'email'
          ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
          : reason === 'phone'
            ? 'Ya existe una cuenta con ese teléfono. Inicia sesión.'
            : 'Dispositivo bloqueado por intentos repetidos.';
      notify('No se pudo crear la cuenta', msg);
    }
  };

  const handleGoogle = () => {
    notify('Google (demo)', 'Se creará una cuenta demo de taller con Google.');
    const user = signInWithGoogle('dueño.taller@gmail.com');
    if (user) {
      router.replace('/');
    }
  };

  return (
    <Screen contentContainerStyle={styles.screen}>
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle" style={styles.brand}>
          Crea tu taller
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Registra tu taller para administrar equipos y agregar técnicos.
        </ThemedText>

        <FormInput
          label="Nombre del taller"
          required
          placeholder="Ej: TechRepair Master"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <FormInput
          label="Correo"
          required
          placeholder="correo@taller.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          maxLength={100}
        />
        <FormInput
          label="Contraseña"
          required
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <FormInput
          label="Teléfono"
          required
          placeholder="+57 300 123 4567"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={20}
        />

        <Button label="Crear cuenta" onPress={handleSubmit} style={styles.primary} />

        <View style={styles.divider}>
          <ThemedView style={styles.line} />
          <ThemedText type="small" themeColor="textSecondary">
            o
          </ThemedText>
          <ThemedView style={styles.line} />
        </View>

        <Button label="Registrarse con Google" variant="secondary" onPress={handleGoogle} />

        <View style={styles.loginLink}>
          <ThemedText type="small" themeColor="textSecondary">
            ¿Ya tienes cuenta?
          </ThemedText>
          <Link href="/login">
            <ThemedText type="linkPrimary">Inicia sesión</ThemedText>
          </Link>
        </View>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: Spacing.five,
    borderRadius: Spacing.five,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.primary,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  brand: {
    fontSize: 30,
    textAlign: 'center',
    color: Brand.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  primary: {
    marginTop: Spacing.two,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});