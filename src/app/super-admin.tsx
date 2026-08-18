import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  activateWorkshop,
  listAllWorkshops,
  SUPER_ADMIN_USER_ID,
  type SuperAdminWorkshop,
} from '@/lib/super-admin';

/** Formatea una fecha ISO a 'YYYY-MM-DD' local (legible en el panel). */
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Panel Super Admin — exclusivo del dueño de la plataforma.
 *
 * Lista todos los talleres (vía RPC SECURITY DEFINER) y permite activar 30
 * días a cualquiera con un clic. El guard filtra por SUPER_ADMIN_USER_ID:
 * cualquier otra cuenta autenticada es redirigida a la zona protegida.
 */
export default function SuperAdminScreen() {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [workshops, setWorkshops] = useState<SuperAdminWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const notify = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Super Admin', message);
    }
  };

  // Guard: solo el dueño de la plataforma entra aquí.
  useEffect(() => {
    if (currentUser && currentUser.id !== SUPER_ADMIN_USER_ID) {
      router.replace('/(tabs)');
    }
  }, [currentUser, router]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await listAllWorkshops();
    setLoading(false);
    if (error) {
      setLoadError(error);
      return;
    }
    setLoadError(null);
    setWorkshops(data ?? []);
  };

  useEffect(() => {
    if (currentUser?.id === SUPER_ADMIN_USER_ID) {
      refresh();
    }
  }, [currentUser?.id]);

  if (!currentUser || currentUser.id !== SUPER_ADMIN_USER_ID) {
    return null;
  }

  const handleActivate = async (ws: SuperAdminWorkshop) => {
    setActivatingId(ws.id);
    const { ok, error } = await activateWorkshop(ws.id);
    setActivatingId(null);
    if (ok) {
      notify(`Taller "${ws.name}" activado por 30 días.`);
      refresh();
    } else {
      notify(`No se pudo activar: ${error ?? 'error desconocido'}`);
    }
  };

  const isExpiredOrTrial = (ws: SuperAdminWorkshop): boolean => {
    if (ws.status === 'active') return false;
    if (ws.status === 'expired') return true;
    // trial: expirado si trial_ends_at ya pasó, o a punto de vencer (<=7 días)
    if (ws.trial_ends_at) {
      const end = new Date(ws.trial_ends_at).getTime();
      if (Number.isFinite(end)) {
        return Date.now() > end || end - Date.now() <= 7 * 24 * 60 * 60 * 1000;
      }
    }
    return false;
  };

  const statusLabel = (ws: SuperAdminWorkshop): { text: string; color: string } => {
    if (ws.status === 'active') return { text: 'Activo', color: Brand.success };
    if (ws.status === 'expired') return { text: 'Expirado', color: Brand.danger };
    return { text: 'Trial', color: Brand.warning };
  };

  return (
    <Screen title="Super Admin">
      <ThemedView style={styles.header}>
        <ThemedText type="title">Panel Super Admin</ThemedText>
        <ThemedText themeColor="textSecondary">
          Lista global de talleres — activación de 30 días con un clic
        </ThemedText>
      </ThemedView>

      {loadError && (
        <ThemedView type="backgroundElement" style={styles.errorBox}>
          <ThemedText type="small" style={{ color: Brand.danger }}>
            Error cargando talleres: {loadError}
          </ThemedText>
          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loading && workshops.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>
          Cargando talleres…
        </ThemedText>
      ) : (
        workshops.map((ws) => {
          const status = statusLabel(ws);
          const canActivate = isExpiredOrTrial(ws);
          return (
            <ThemedView key={ws.id} type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <ThemedText type="subtitle" numberOfLines={1} ellipsizeMode="tail">
                    {ws.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {ws.id.slice(0, 8)}… · Creado {shortDate(ws.created_at)}
                  </ThemedText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${status.color}1f` }]}>
                  <ThemedText type="smallBold" style={{ color: status.color }}>
                    {status.text}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.datesRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Trial termina: {shortDate(ws.trial_ends_at)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Suscripción hasta: {shortDate(ws.subscription_ends_at)}
                </ThemedText>
              </View>

              {canActivate ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.activateButton,
                    pressed && styles.pressed,
                    activatingId === ws.id && styles.disabledButton,
                  ]}
                  disabled={activatingId === ws.id}
                  onPress={() => handleActivate(ws)}>
                  <ThemedText style={styles.activateButtonText}>
                    {activatingId === ws.id ? 'Activando…' : 'Activar 30 días'}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.activeNote}>
                  Suscripción activa — sin acción requerida
                </ThemedText>
              )}
            </ThemedView>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
    width: '100%',
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  retryButtonText: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 13,
  },
  loadingText: {
    marginTop: Spacing.four,
    textAlign: 'center',
    width: '100%',
  },
  card: {
    gap: Spacing.two,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitleWrap: {
    flex: 1,
    gap: Spacing.half,
    minWidth: 0,
  },
  statusPill: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    flexShrink: 0,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  activateButton: {
    alignItems: 'center',
    backgroundColor: Brand.success,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  activateButtonText: {
    color: Brand.onBrand,
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  activeNote: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.85,
  },
});