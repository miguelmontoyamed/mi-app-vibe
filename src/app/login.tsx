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

export default function LoginScreen() {
  const router = useRouter();
  const { login, signInWithGoogle } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!identifier.trim() || !password.trim()) {
      notify('Campos incompletos', 'Ingresa tu correo o teléfono y tu contraseña.');
      return;
    }
    const user = login(identifier, password);
    if (user) {
      router.replace('/');
    } else {
      notify('Error de acceso', 'Correo/Teléfono o contraseña incorrectos.');
    }
  };

  const handleGoogle = () => {
    // Simulated Google account creation. Swap for expo-auth-session/Google OAuth
    // once a backend + credentials are configured.
    notify('Google (demo)', 'Inicia sesión con tu cuenta de Google.');
    const user = signInWithGoogle('dueño.demo@gmail.com');
    if (user) {
      router.replace('/');
    }
  };

  return (
    <Screen contentContainerStyle={styles.screen}>
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle" style={styles.brand}>
          TechRepair Master
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Inicia sesión para administrar tu taller
        </ThemedText>

        <FormInput
          label="Correo o Teléfono"
          placeholder="correo@taller.com o +57 300 123 4567"
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <FormInput
          label="Contraseña"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button label="Iniciar sesión" onPress={handleLogin} style={styles.primary} />
        <Button label="Continuar con Google" variant="secondary" onPress={handleGoogle} />

        <View style={styles.divider}>
          <ThemedView style={styles.line} />
          <ThemedText type="small" themeColor="textSecondary">
            ¿No tienes cuenta?
          </ThemedText>
          <ThemedView style={styles.line} />
        </View>

        <Link href="/signup" asChild>
          <Button label="Crear cuenta" variant="success" />
        </Link>

        <ThemedText type="small" themeColor="textSecondary" style={styles.helper}>
          Demo: carlos@techrepair.com / admin123
        </ThemedText>
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
    fontSize: 32,
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
  helper: {
    fontSize: 12,
    textAlign: 'center',
  },
});