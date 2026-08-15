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
import { isGoogleConfigured, useGoogleSignIn } from '@/lib/google-auth';
import { supabaseSignInWithGoogleRedirect } from '@/lib/supabase-auth';

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(title, message);
  }
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, signInWithGoogle, resendRegistration } = useAuth();
  const {
    prompt: promptGoogle,
    inProgress: googleInProgress,
    error: googleError,
  } = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Correo pendiente de confirmación: bloquea el login y pide verificar.
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      notify('Campos incompletos', 'Ingresa tu correo y tu contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.ok) {
        router.replace('/');
      } else if (result.reason === 'unconfirmed') {
        setPendingVerification(email.trim().toLowerCase());
      } else {
        notify('Error de acceso', 'Correo o contraseña incorrectos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingVerification) return;
    setSubmitting(true);
    try {
      const ok = await resendRegistration(pendingVerification);
      notify(
        ok ? 'Correo reenviado' : 'No se pudo reenviar',
        ok
          ? 'Revisa tu correo (y el spam) con el nuevo enlace de confirmación.'
          : 'Hubo un problema al reenviar el correo. Intenta en un momento.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    // Web: flujo de redirección de ventana completa (sin popups). Supabase
    // devuelve la URL de Google y navegamos la pestaña principal; al volver,
    // el listener onAuthStateChange captura la sesión y el guard redirige.
    if (Platform.OS === 'web') {
      const result = await supabaseSignInWithGoogleRedirect();
      if (!result.ok) {
        notify('Error de acceso', result.message);
      }
      return;
    }
    // Nativo: puente expo-auth-session (in-app browser) + id_token.
    if (!isGoogleConfigured) {
      notify(
        'Google no configurado',
        'Falta el Client ID de Google. Agrégalo como EXPO_PUBLIC_GOOGLE_CLIENT_ID y vuelve a desplegar.'
      );
      return;
    }
    const auth = await promptGoogle();
    if (!auth) {
      return; // cancelado o error: el usuario no cambió de pantalla
    }
    const user = await signInWithGoogle(auth);
    if (user) {
      router.replace('/');
    } else {
      notify(
        'Error de acceso',
        'No se pudo iniciar sesión con Google. Intenta de nuevo o usa correo y contraseña.'
      );
    }
  };

  // Correo sin confirmar: bloquea el acceso y pide verificar antes de entrar.
  if (pendingVerification) {
    return (
      <Screen contentContainerStyle={styles.screen}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.brand}>
            Verifica tu correo
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Tu correo <ThemedText type="linkPrimary">{pendingVerification}</ThemedText> aún no está
            verificado. Revisa tu bandeja de entrada (y el spam) y haz clic en el enlace de
            confirmación antes de iniciar sesión.
          </ThemedText>

          <Button
            label={submitting ? 'Reenviando…' : 'Reenviar correo de confirmación'}
            onPress={handleResend}
            style={styles.primary}
            disabled={submitting}
          />

          <View style={styles.divider}>
            <ThemedView style={styles.line} />
            <ThemedText type="small" themeColor="textSecondary">
              ¿Ya verificaste tu correo?
            </ThemedText>
            <ThemedView style={styles.line} />
          </View>

          <Button
            label="Volver a intentar"
            variant="secondary"
            onPress={() => setPendingVerification(null)}
            disabled={submitting}
          />
        </ThemedView>
      </Screen>
    );
  }

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
          label="Correo"
          placeholder="correo@taller.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <FormInput
          label="Contraseña"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          label={submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          onPress={handleLogin}
          style={styles.primary}
          disabled={submitting}
        />
        <Button
          label={googleInProgress ? 'Conectando con Google…' : 'Continuar con Google'}
          variant="secondary"
          onPress={handleGoogle}
          disabled={googleInProgress}
        />
        {googleError ? (
          <ThemedText type="small" style={styles.googleError}>
            {googleError}
          </ThemedText>
        ) : null}

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
  googleError: {
    color: Brand.danger,
    textAlign: 'center',
  },
});