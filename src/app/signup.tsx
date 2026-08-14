import { useState, useMemo } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { isGoogleConfigured, useGoogleSignIn } from '@/lib/google-auth';
import { decodeInviteToken, validateInviteToken } from '@/utils/auth-links';

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(title, message);
  }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string }>();
  const { registerOwner, registerInvitedTechnician, signInWithGoogle, resendRegistration } = useAuth();
  const {
    prompt: promptGoogle,
    inProgress: googleInProgress,
    error: googleError,
  } = useGoogleSignIn();

  // ── Invitación de técnico (token en URL ?invite=...) ──
  const inviteData = useMemo(() => {
    const raw = params.invite;
    if (!raw || typeof raw !== 'string') return null;
    const decoded = decodeInviteToken(raw);
    if (!decoded) return null;
    const validation = validateInviteToken(decoded);
    if (!validation.valid) return { expired: true as const };
    return { expired: false as const, workshopName: validation.workshopName, workshopId: validation.workshopId };
  }, [params.invite]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Etapa de confirmación del correo (enlace enviado por Supabase).
  const [pendingVerification, setPendingVerification] = useState<string | null>(null); // email a confirmar
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      notify('Campos incompletos', 'Completa todos los campos obligatorios (*).');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      notify('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      notify('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      // Flujo de técnico invitado: crea la cuenta real (Supabase) con
      // role='technician' asociada al taller del admin que generó el enlace.
      // Sin Supabase configurado cae a la simulación local (demo).
      if (inviteData && !inviteData.expired) {
        const result = await registerInvitedTechnician(
          name.trim(),
          email.trim().toLowerCase(),
          password,
          inviteData.workshopId,
          inviteData.workshopName
        );
        if (result.pendingVerification) {
          setPendingVerification(email.trim().toLowerCase());
          notify(
            'Verifica tu correo',
            `Enviamos un enlace de confirmación a ${email.trim().toLowerCase()}. Revisa tu bandeja (y el spam).`
          );
          return;
        }
        if (result.ok) {
          notify(
            '¡Bienvenido al equipo!',
            `Tu cuenta de técnico fue creada y asociada al taller "${inviteData.workshopName}". Inicia sesión para empezar.`
          );
          router.replace('/login');
        } else {
          notify(
            'No se pudo crear la cuenta',
            result.message ??
              'El dispositivo o el correo ya están registrados, o el taller alcanzó el límite de 5 técnicos. Contacta al dueño del taller.'
          );
        }
        return;
      }
      // Flujo estándar: registro de dueño de taller.
      const { user, reason, pendingVerification: pending } = await registerOwner(
        name,
        email,
        password
      );
      if (user) {
        notify('¡Cuenta creada!', `Bienvenido, ${user.name}. Tu taller está listo.`);
        router.replace('/');
        return;
      }
      if (pending) {
        setPendingVerification(email.trim().toLowerCase());
        notify(
          'Verifica tu correo',
          `Enviamos un enlace de confirmación a ${email.trim().toLowerCase()}. Revisa tu bandeja (y el spam).`
        );
        return;
      }
      const msg =
        reason === 'email'
          ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
          : 'Dispositivo bloqueado por intentos repetidos.';
      notify('No se pudo crear la cuenta', msg);
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
    }
  };

  // Etapa de confirmación: el usuario debe abrir el enlace del correo.
  if (pendingVerification) {
    return (
      <Screen contentContainerStyle={styles.screen}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.brand}>
            Verifica tu correo
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Enviamos un enlace de confirmación a <ThemedText type="linkPrimary">{pendingVerification}</ThemedText>.
            Revisa tu bandeja de entrada (y el spam) y haz clic en el enlace para activar tu cuenta.
          </ThemedText>

          <Button
            label={submitting ? 'Reenviando…' : 'Reenviar correo de confirmación'}
            onPress={handleResend}
            style={styles.primary}
            disabled={submitting}
          />

          <View style={styles.loginLink}>
            <ThemedText type="small" themeColor="textSecondary">
              ¿Ya confirmaste tu correo?
            </ThemedText>
            <Link href="/login">
              <ThemedText type="linkPrimary">Iniciar sesión</ThemedText>
            </Link>
          </View>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <ThemedView style={styles.card}>
        {/* Encabezado contextual: taller propio o invitación de técnico */}
        {inviteData?.expired ? (
          <ThemedView style={styles.inviteBannerExpired}>
            <ThemedText type="smallBold" style={styles.inviteBannerText}>
              Esta invitación ha expirado.
            </ThemedText>
            <ThemedText type="small" style={styles.inviteBannerText}>
              Solicita un nuevo enlace al dueño del taller.
            </ThemedText>
          </ThemedView>
        ) : inviteData ? (
          <ThemedView style={styles.inviteBanner}>
            <ThemedText type="smallBold" style={styles.inviteBannerText}>
              Has sido invitado a unirte como técnico
            </ThemedText>
            <ThemedText type="small" style={styles.inviteBannerText}>
              Taller: {inviteData.workshopName}
            </ThemedText>
          </ThemedView>
        ) : null}
        <ThemedText type="subtitle" style={styles.brand}>
          {inviteData && !inviteData.expired ? 'Únete al equipo' : 'Crea tu taller'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {inviteData && !inviteData.expired
            ? `Regístrate para empezar a trabajar con el taller "${inviteData.workshopName}".`
            : 'Registra tu taller para administrar equipos y agregar técnicos. Te pediremos confirmar tu correo con el enlace que te enviamos.'}
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

        <Button
          label={submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          onPress={handleSubmit}
          style={styles.primary}
          disabled={submitting}
        />

        <View style={styles.divider}>
          <ThemedView style={styles.line} />
          <ThemedText type="small" themeColor="textSecondary">
            o
          </ThemedText>
          <ThemedView style={styles.line} />
        </View>

        <Button
          label={googleInProgress ? 'Conectando con Google…' : 'Registrarse con Google'}
          variant="secondary"
          onPress={handleGoogle}
          disabled={googleInProgress}
        />
        {googleError ? (
          <ThemedText type="small" style={styles.googleError}>
            {googleError}
          </ThemedText>
        ) : null}

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
  googleError: {
    color: Brand.danger,
    textAlign: 'center',
  },
  inviteBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.40)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  inviteBannerExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.40)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  inviteBannerText: {
    textAlign: 'center',
  },
});