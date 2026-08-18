import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  activateWorkshop,
  listAllProfiles,
  listAllWorkshops,
  SUPER_ADMIN_USER_ID,
  type SuperAdminProfile,
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
 * Capa 1 (ruta): `super-admin` vive dentro de `Stack.Protected` (requiere
 * sesión). Capa 2 (guard): cualquier cuenta que NO sea SUPER_ADMIN_USER_ID es
 * redirigida y no se renderiza nada. Capa 3 (backend): las RPC SECURITY
 * DEFINER validan `auth.uid()` contra el uid del dueño y lanzan excepción si
 * no coincide — verificado empíricamente con un usuario de prueba.
 *
 * Muestra los PERFILES con nombre + correo (JOIN a auth.users vía RPC) y
 * permite localizar por email a quien pagó para añadirle 30 días acumulables a
 * su taller con un clic. Debajo, la lista global de talleres.
 */
export default function SuperAdminScreen() {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [workshops, setWorkshops] = useState<SuperAdminWorkshop[]>([]);
  const [profiles, setProfiles] = useState<SuperAdminProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Guard (capa 2): solo el dueño de la plataforma entra aquí.
  useEffect(() => {
    if (currentUser && currentUser.id !== SUPER_ADMIN_USER_ID) {
      router.replace('/(tabs)');
    }
  }, [currentUser, router]);

  const refresh = async () => {
    setLoading(true);
    const [wsRes, profRes] = await Promise.all([listAllWorkshops(), listAllProfiles()]);
    setLoading(false);
    if (wsRes.error || profRes.error) {
      setLoadError(wsRes.error ?? profRes.error);
      return;
    }
    setLoadError(null);
    setWorkshops(wsRes.data ?? []);
    setProfiles(profRes.data ?? []);
  };

  useEffect(() => {
    if (currentUser?.id === SUPER_ADMIN_USER_ID) {
      refresh();
    }
  }, [currentUser?.id]);

  if (!currentUser || currentUser.id !== SUPER_ADMIN_USER_ID) {
    return null;
  }

  /** Añade 30 días acumulables al taller indicado (mismo botón en perfiles y talleres). */
  const handleAddDays = async (workshopId: string, workshopName: string) => {
    setActivatingId(workshopId);
    const { ok, error } = await activateWorkshop(workshopId);
    setActivatingId(null);
    if (ok) {
      notify(`Taller "${workshopName}": +30 días añadidos a su suscripción.`);
      refresh();
    } else {
      notify(`No se pudo activar: ${error ?? 'error desconocido'}`);
    }
  };

  const statusLabel = (status: string | null): { text: string; color: string } => {
    if (status === 'active') return { text: 'Activo', color: Brand.success };
    if (status === 'expired') return { text: 'Expirado', color: Brand.danger };
    return { text: 'Trial', color: Brand.warning };
  };

  // Búsqueda por correo (o nombre) — insensible a mayúsculas/acentos simples.
  const query = searchQuery.trim().toLowerCase();
  const filteredProfiles = query
    ? profiles.filter(
        (p) =>
          (p.email ?? '').toLowerCase().includes(query) ||
          (p.full_name ?? '').toLowerCase().includes(query)
      )
    : profiles;

  return (
    <Screen title="Super Admin">
      <ThemedView style={styles.header}>
        <ThemedText type="title">Panel Super Admin</ThemedText>
        <ThemedText themeColor="textSecondary">
          Localiza por correo a quien pagó y añádele 30 días acumulables a su taller
        </ThemedText>
      </ThemedView>

      {loadError && (
        <ThemedView type="backgroundElement" style={styles.errorBox}>
          <ThemedText type="small" style={{ color: Brand.danger }}>
            Error cargando datos: {loadError}
          </ThemedText>
          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Búsqueda por correo/nombre para localizar pagos rápidamente */}
      <TextInput
        style={[styles.searchInput, { color: theme.text, borderColor: theme.backgroundElement }]}
        placeholder="Buscar por correo o nombre…"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Perfiles: nombre + correo debajo + botón para añadir los días pagados */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Perfiles {query ? `(${filteredProfiles.length} resultados)` : ''}
      </ThemedText>

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>
          Cargando perfiles…
        </ThemedText>
      ) : filteredProfiles.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>
          {query ? `Sin resultados para "${searchQuery.trim()}"` : 'No hay perfiles registrados'}
        </ThemedText>
      ) : (
        filteredProfiles.map((p) => {
          const status = statusLabel(p.workshop_status);
          const busy = p.workshop_id !== null && activatingId === p.workshop_id;
          return (
            <ThemedView key={p.profile_id} type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <ThemedText type="subtitle" numberOfLines={1} ellipsizeMode="tail">
                    {p.full_name || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {p.email}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {p.role === 'admin' ? 'Dueño' : 'Técnico'} · Taller:{' '}
                    {p.workshop_name ?? '—'}
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
                  Trial termina: {shortDate(p.trial_ends_at)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Suscripción hasta: {shortDate(p.subscription_ends_at)}
                </ThemedText>
              </View>

              {p.workshop_id ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.activateButton,
                    pressed && styles.pressed,
                    busy && styles.disabledButton,
                  ]}
                  disabled={busy}
                  onPress={() => handleAddDays(p.workshop_id!, p.workshop_name ?? 'sin nombre')}>
                  <ThemedText style={styles.activateButtonText}>
                    {busy ? 'Añadiendo…' : 'Añadir 30 días'}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.noWorkshopNote}>
                  Sin taller asignado
                </ThemedText>
              )}
            </ThemedView>
          );
        })
      )}

      {/* Todos los talleres (vista global) */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>Todos los talleres</ThemedText>
      {loading && workshops.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>
          Cargando talleres…
        </ThemedText>
      ) : (
        workshops.map((ws) => {
          const status = statusLabel(ws.status);
          const busy = activatingId === ws.id;
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

              <Pressable
                style={({ pressed }) => [
                  styles.activateButton,
                  pressed && styles.pressed,
                  busy && styles.disabledButton,
                ]}
                disabled={busy}
                onPress={() => handleAddDays(ws.id, ws.name)}>
                <ThemedText style={styles.activateButtonText}>
                  {busy ? 'Añadiendo…' : 'Añadir 30 días'}
                </ThemedText>
              </Pressable>
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
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 14,
    backgroundColor: 'transparent',
    width: '100%',
  },
  sectionTitle: {
    marginTop: Spacing.three,
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
  noWorkshopNote: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.85,
  },
});
