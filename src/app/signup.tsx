import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth-context';
import {
  decodeInviteToken,
  savePendingInvite,
  savePendingInviteToken,
  validateInviteToken,
} from '@/utils/auth-links';
import { isGoogleConfigured, useGoogleSignIn } from '@/lib/google-auth';
import { supabaseSignInWithGoogleRedirect } from '@/lib/supabase-auth';

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ invite?: string }>();
  const {
    registerOwner,
    registerInvitedTechnician,
    signInWithGoogle,
    resendRegistration,
    getInvitationDetails,
  } = useAuth();
  const {
    prompt: promptGoogle,
    inProgress: googleInProgress,
    error: googleError,
  } = useGoogleSignIn();

  // ── Estado de verificación segura de invitación ──
  const [inviteStatus, setInviteStatus] = useState<{
    loading: boolean;
    valid: boolean;
    workshopName: string;
    workshopId: string;
    requiredEmail: string | null;
    expired: boolean;
    errorMessage: string | null;
    token: string;
  } | null>(null);

  const isInviteFlow = params.invite != null && typeof params.invite === 'string';

  useEffect(() => {
    const raw = params.invite;
    if (!raw || typeof raw !== 'string') {
      setInviteStatus(null);
      return;
    }

    let cancelled = false;
    setInviteStatus({
      loading: true,
      valid: false,
      workshopName: '',
      workshopId: '',
      requiredEmail: null,
      expired: false,
      errorMessage: null,
      token: raw,
    });

    (async () => {
      const details = await getInvitationDetails(raw);
      if (cancelled) return;

      if (details.ok) {
        setInviteStatus({
          loading: false,
          valid: true,
          workshopName: details.workshopName || 'Taller',
          workshopId: details.workshopId || '',
          requiredEmail: details.email || null,
          expired: false,
          errorMessage: null,
          token: raw,
        });
        if (details.email) {
          setEmail(details.email);
        }
      } else {
        setInviteStatus({
          loading: false,
          valid: false,
          workshopName: '',
          workshopId: '',
          requiredEmail: null,
          expired: !!details.expired,
          errorMessage: details.message || 'Invitación no válida',
          token: raw,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.invite, getInvitationDetails]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Etapa de confirmación del correo (enlace enviado por Supabase).
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (inviteStatus?.expired) {
      notify(
        'Invitación expirada',
        'El enlace de invitación ha vencido (vigencia de 24 horas). Solicita un nuevo enlace al dueño del taller.'
      );
      return;
    }

    if (inviteStatus && !inviteStatus.valid && !inviteStatus.loading) {
      notify(
        'Invitación inválida',
        inviteStatus.errorMessage || 'El enlace de invitación no es válido o ya fue utilizado.'
      );
      return;
    }

    if (
      inviteStatus?.requiredEmail &&
      email.trim().toLowerCase() !== inviteStatus.requiredEmail.toLowerCase()
    ) {
      notify(
        'Correo no coincide',
        `Esta invitación fue emitida exclusivamente para ${inviteStatus.requiredEmail}. Debes registrarte con esa cuenta.`
      );
      return;
    }

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
      if (inviteStatus && inviteStatus.valid) {
        savePendingInviteToken(inviteStatus.token);
        const result = await registerInvitedTechnician(
          name.trim(),
          email.trim().toLowerCase(),
          password,
          inviteStatus.workshopId,
          inviteStatus.workshopName,
          inviteStatus.token
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
            `Tu cuenta de técnico fue creada y asociada al taller "${inviteStatus.workshopName}". Inicia sesión para empezar.`
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

      // Si el enlace de invitación era inválido o malformado, evitar registrar como dueño por error
      if (isInviteFlow) {
        notify(
          'Enlace de invitación inválido',
          'El enlace de invitación no es válido o expiró. Pide al dueño del taller que te comparta un nuevo enlace.'
        );
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
    if (inviteStatus?.expired) {
      notify(
        'Invitación expirada',
        'El enlace de invitación ha vencido (vigencia de 24 horas). Solicita un nuevo enlace al dueño del taller.'
      );
      return;
    }

    if (inviteStatus && inviteStatus.valid) {
      savePendingInviteToken(inviteStatus.token);
    }

    if (Platform.OS === 'web') {
      const result = await supabaseSignInWithGoogleRedirect();
      if (!result.ok) {
        notify('Error de acceso', result.message);
      }
      return;
    }

    if (!isGoogleConfigured) {
      notify(
        'Google no configurado',
        'Falta el Client ID de Google. Agrégalo como EXPO_PUBLIC_GOOGLE_CLIENT_ID y vuelve a desplegar.'
      );
      return;
    }
    const auth = await promptGoogle();
    if (!auth) {
      return;
    }
    const user = await signInWithGoogle(auth);
    if (user) {
      router.replace('/');
    }
  };

  if (pendingVerification) {
    return (
      <Screen contentContainerStyle={styles.screen}>
        <ThemedView style={[styles.card, { borderColor: theme.border }]}>
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

  const isFormDisabled =
    submitting ||
    inviteStatus?.loading ||
    (inviteStatus != null && !inviteStatus.valid);

  return (
    <Screen contentContainerStyle={styles.screen}>
      <ThemedView style={[styles.card, { borderColor: theme.border }]}>
        {/* Encabezado contextual: invitación o taller propio */}
        {inviteStatus?.loading ? (
          <ThemedView style={styles.inviteBanner}>
            <ThemedText type="small" style={styles.inviteBannerText}>
              Verificando validez de la invitación...
            </ThemedText>
          </ThemedView>
        ) : inviteStatus?.expired ? (
          <ThemedView style={styles.inviteBannerExpired}>
            <ThemedText type="smallBold" style={styles.inviteBannerText}>
              Esta invitación ha expirado.
            </ThemedText>
            <ThemedText type="small" style={styles.inviteBannerText}>
              El enlace tenía una vigencia de 24 horas. Solicita un nuevo enlace al administrador.
            </ThemedText>
          </ThemedView>
        ) : inviteStatus && !inviteStatus.valid ? (
          <ThemedView style={styles.inviteBannerExpired}>
            <ThemedText type="smallBold" style={styles.inviteBannerText}>
              Invitación no válida
            </ThemedText>
            <ThemedText type="small" style={styles.inviteBannerText}>
              {inviteStatus.errorMessage || 'El enlace de invitación no es válido o ya fue utilizado.'}
            </ThemedText>
          </ThemedView>
        ) : inviteStatus?.valid ? (
          <ThemedView style={styles.inviteBanner}>
            <ThemedText type="smallBold" style={styles.inviteBannerText}>
              Has sido invitado a unirte como técnico
            </ThemedText>
            <ThemedText type="small" style={styles.inviteBannerText}>
              Taller: {inviteStatus.workshopName}
              {inviteStatus.requiredEmail ? ` • Correo: ${inviteStatus.requiredEmail}` : ''}
            </ThemedText>
          </ThemedView>
        ) : null}

        <ThemedText type="subtitle" style={styles.brand}>
          {inviteStatus?.valid ? 'Únete al equipo' : 'Crea tu taller'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {inviteStatus?.valid
            ? `Regístrate para empezar a trabajar con el taller "${inviteStatus.workshopName}".`
            : inviteStatus?.expired
              ? 'Pide al administrador que te genere una nueva invitación para unirte a su taller.'
              : 'Registra tu taller para administrar equipos y agregar técnicos. Te pediremos confirmar tu correo.'}
        </ThemedText>

        <FormInput
          label={inviteStatus?.valid ? 'Nombre completo' : 'Nombre del taller'}
          required
          placeholder={inviteStatus?.valid ? 'Ej: Juan Pérez' : 'Ej: TechRepair Master'}
          value={name}
          onChangeText={setName}
          maxLength={80}
          editable={!isFormDisabled}
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
          editable={!isFormDisabled && !inviteStatus?.requiredEmail}
        />
        <FormInput
          label="Contraseña"
          required
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isFormDisabled}
        />

        <Button
          label={
            inviteStatus?.loading
              ? 'Verificando invitación…'
              : inviteStatus?.expired
                ? 'Invitación expirada'
                : submitting
                  ? 'Creando cuenta…'
                  : inviteStatus?.valid
                    ? 'Unirme como técnico'
                    : 'Crear cuenta'
          }
          onPress={handleSubmit}
          style={styles.primary}
          disabled={isFormDisabled}
        />

        <View style={styles.divider}>
          <ThemedView style={[styles.line, { backgroundColor: theme.border }]} />
          <ThemedText type="small" themeColor="textSecondary">
            o
          </ThemedText>
          <ThemedView style={[styles.line, { backgroundColor: theme.border }]} />
        </View>

        <Button
          label={googleInProgress ? 'Conectando con Google…' : 'Registrarse con Google'}
          variant="secondary"
          onPress={handleGoogle}
          disabled={googleInProgress || isFormDisabled}
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
    borderRadius: Shape.lg,
    gap: Spacing.three,
    borderWidth: 1,
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
    backgroundColor: `${Brand.success}1a`,
    borderWidth: 1,
    borderColor: `${Brand.success}66`,
    borderRadius: Shape.lg,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  inviteBannerExpired: {
    backgroundColor: `${Brand.danger}1a`,
    borderWidth: 1,
    borderColor: `${Brand.danger}66`,
    borderRadius: Shape.lg,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  inviteBannerText: {
    textAlign: 'center',
  },
});
