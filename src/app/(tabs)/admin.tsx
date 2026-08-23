import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

import { CommercialBanner } from '@/components/commercial-banner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BREAKPOINTS, Brand, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth, MAX_TECHNICIANS, type User } from '@/context/auth-context';
import { useBilling } from '@/context/billing-context';
import { useRepair } from '@/context/repair-context';
import { useWorkshop } from '@/context/workshop-context';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { SUPER_ADMIN_USER_ID } from '@/lib/super-admin';
import type { TechnicianMonthlyPerformance } from '@/types/billing';
import { formatCOP } from '@/utils/format';
import {
  buildPeriodOptions,
  formatPeriodLabel,
  summarizePerformances,
} from '@/utils/billing-performance';
import { accumulatedCommission, accumulatedProfit } from '@/utils/repair-logic';

const SUPPORT_TYPES = [
  'Problema con inventario',
  'Error en recepción',
  'Duda de facturación',
  'Sugerencia de función',
  'Otro',
];

export default function AdminScreen() {
  const theme = useTheme();
  const {
    currentUser,
    users,
    logout,
    generateInviteLink,
    inviteLink,
    deleteTechnician,
    updateTechnicianCommission,
  } = useAuth();
  const { repairs, inventory } = useRepair();
  const { subscription } = useWorkshop();
  // Una sola suscripción a billing: periodo abierto, cierres históricos,
  // desglose mensual por técnico (RPC) y refresh del auto-cierre de mes.
  const {
    currentPeriod,
    closures,
    fetchMonthlyPerformance,
    refresh: refreshBilling,
  } = useBilling();
  const router = useRouter();
  // Safari/WebKit: en pantallas angostas las 3 cajas flex no encogen (min-width
  // auto) y los montos se parten carácter por carácter → apilamos en móvil.
  const { width: viewportWidth } = useWindowDimensions();
  const isWideViewport = viewportWidth >= BREAKPOINTS.mobile;

  // Inline commission editing state (per technician row)
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState('');

  // Support ticket state
  const [supportType, setSupportType] = useState(SUPPORT_TYPES[0]);
  const [supportMessage, setSupportMessage] = useState('');

  /** Confirmación MD3: marca el técnico a eliminar (reemplaza confirm nativo). */
  const [techPendingDelete, setTechPendingDelete] = useState<(typeof users)[number] | null>(null);
  const [techDeleting, setTechDeleting] = useState(false);

  // ── Panel de Liquidación y Rendimiento Mensual por Técnico ──
  /** Periodo elegido explícitamente por el usuario ('YYYY-MM'); null hasta que elige. */
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  /** Desglose por técnico del periodo seleccionado (fuente: RPC en la nube). */
  const [performances, setPerformances] = useState<TechnicianMonthlyPerformance[]>([]);
  /** Último periodo cuyos datos ya aterrizaron de la RPC (base del spinner derivado). */
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  /** Tick incrementado (con debounce) cuando Realtime reporta cambios en repairs. */
  const [realtimeTick, setRealtimeTick] = useState(0);
  /** Timer del debounce Realtime (se limpia al desmontar o tras disparar). */
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Mes actual + meses archivados (cierres) + meses con entregas, desc. */
  const periodOptions = useMemo(
    () => buildPeriodOptions(currentPeriod, closures.map((c) => c.period), repairs),
    [currentPeriod, closures, repairs]
  );
  /**
   * Periodo efectivo: la elección del usuario y, si aún no eligió, el mes en
   * curso o el más reciente disponible (evita panel vacío en talleres nuevos).
   * Derivado en render — sin efecto ni setState.
   */
  const effectivePeriod = selectedPeriod ?? currentPeriod ?? periodOptions[0]?.period ?? null;
  /** Los meses archivados son de solo lectura; el mes en curso sigue abierto. */
  const isArchivedPeriod = effectivePeriod !== null && effectivePeriod !== currentPeriod;

  // Spinner derivado: hay carga en vuelo mientras se muestra un periodo cuyos
  // datos todavía no aterrizan (primera carga o cambio de mes).
  const perfLoading = effectivePeriod !== null && loadedPeriod !== effectivePeriod;

  /** Carga el desglose mensual desde la RPC cuando cambia el periodo o llega
   *  un tick realtime. Todos los setState ocurren DESPUÉS del await: nunca
   *  síncronos en el efecto. */
  useEffect(() => {
    if (!effectivePeriod) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await fetchMonthlyPerformance(effectivePeriod);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setPerformances(result.data);
        setPerfError(null);
      } else {
        setPerformances([]);
        setPerfError(result.error ?? 'Error al cargar el rendimiento mensual.');
      }
      setLoadedPeriod(effectivePeriod);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMonthlyPerformance, effectivePeriod, realtimeTick]);

  // ── Tiempo real: refresca el desglose cuando cambian las órdenes ──
  // Suscripción postgres_changes sobre public.repairs (la visibilidad de los
  // eventos respeta RLS por taller). Cualquier entrega, edición de repuestos,
  // cobro o reasignación — propia o hecha desde otro dispositivo por otro
  // miembro — dispara una recarga DEBOUNCED del periodo visible. El setState
  // ocurre dentro del callback de la suscripción (sistema externo), nunca
  // síncrono en el cuerpo del efecto.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const channel = supabase
      .channel('admin-liquidacion-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs' },
        () => {
          if (realtimeTimerRef.current) {
            clearTimeout(realtimeTimerRef.current);
          }
          realtimeTimerRef.current = setTimeout(() => {
            setRealtimeTick((tick) => tick + 1);
          }, 800);
        },
      )
      .subscribe();
    return () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, []);

  /** Resumen global del periodo + técnicos ordenados por producción neta. */
  const monthlySummary = summarizePerformances(
    effectivePeriod ?? '',
    isArchivedPeriod,
    performances
  );

  // Guard de ruta (rol): el tab Admin es exclusivo del dueño. Un técnico que
  // entre por URL directa es redirigido a la zona protegida.
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [currentUser, router]);

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
    return null;
  }

  // RBAC: solo el dueño (admin) accede a la administración del taller.
  if (currentUser.role !== 'admin') {
    return null;
  }

  const notify = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('TechRepair', message);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // Financial calculations
  const totalRevenue = repairs
    .filter((r) => r.status === 'Entregado' || r.status === 'Listo')
    .reduce((acc, curr) => acc + curr.budget, 0);

  const pendingRevenue = repairs
    .filter((r) => r.status === 'Pendiente' || r.status === 'En Proceso')
    .reduce((acc, curr) => acc + curr.budget, 0);

  const inventoryValue = inventory.reduce(
    (acc, curr) => acc + curr.stock * curr.price,
    0
  );

  // Utilidad neta: ingresos cobrados menos el valor de repuestos usados en
  // esas órdenes. Refleja lo que realmente queda en caja.
  const partsCostCollected = repairs
    .filter((r) => r.status === 'Entregado' || r.status === 'Listo')
    .reduce((acc, curr) => acc + (curr.partsCost ?? 0), 0);
  const netProfit = totalRevenue - partsCostCollected;

  const startEditCommission = (u: User) => {
    setEditingCommissionId(u.id);
    setCommissionInput(String(Math.round((u.commissionRate ?? 0) * 100)));
  };

  const cancelEditCommission = () => {
    setEditingCommissionId(null);
    setCommissionInput('');
  };

  const handleSaveCommission = async (u: User) => {
    const rate = parseFloat(commissionInput);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      notify('Ingrese un porcentaje válido entre 0 y 100.');
      return;
    }
    const ok = await updateTechnicianCommission(u.id, rate / 100);
    if (!ok) {
      notify('No se pudo actualizar la comisión. Solo el dueño puede editarla.');
      return;
    }
    setEditingCommissionId(null);
    setCommissionInput('');
    notify(`Comisión de ${u.name} actualizada a ${rate}%.`);
  };

  const handleCreateInvite = () => {
    // Límite estricto: no se generan enlaces si el taller ya tiene 5 técnicos.
    const techCount = users.filter((u) => u.role === 'technician').length;
    if (techCount >= MAX_TECHNICIANS) {
      notify(`Límite alcanzado: el taller tiene el máximo de ${MAX_TECHNICIANS} técnicos permitidos.`);
      return;
    }
    const url = generateInviteLink();
    if (!url) {
      notify('Solo el dueño del taller puede generar enlaces de invitación.');
      return;
    }
    notify('¡Enlace de invitación generado! Vence en 10 minutos. Copia el enlace y compártelo con el técnico.');
  };

  /** Copia el enlace de invitación al portapapeles (web) o lo muestra (native). */
  const handleCopyInvite = () => {
    if (!inviteLink) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink.url).then(() => notify('Enlace copiado al portapapeles.'));
    } else {
      notify(`Enlace de invitación:\n\n${inviteLink.url}`);
    }
  };

  const handleDeleteTechnician = (tech: (typeof users)[number]) => {
    setTechPendingDelete(tech);
  };

  const confirmDeleteTechnician = async () => {
    if (!techPendingDelete) {
      return;
    }
    setTechDeleting(true);
    const deleted = await deleteTechnician(techPendingDelete.id);
    setTechDeleting(false);
    setTechPendingDelete(null);
    notify(deleted ? 'Técnico eliminado.' : 'No se puede eliminar este técnico.');
  };

  /** Abre WhatsApp para registrar el pago de la suscripción (renovación). */
  const handlePayWhatsApp = () => {
    const url =
      'https://wa.me/573002011801?text=Hola,%20quiero%20renovar%20mi%20suscripción.';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const buildSupportMessage = () => {
    return [
      '🚨 NUEVO TICKET DE SOPORTE - TechRepair Master 🚨',
      `Taller/Dueño: ${currentUser.name}`,
      `Necesidad: ${supportType} - ${supportMessage.trim()}`,
    ].join('\n');
  };

  const handleSupportValidation = () => {
    if (!supportMessage.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Escriba una descripción de su necesidad antes de enviar.');
      } else {
        Alert.alert('Soporte', 'Escriba una descripción de su necesidad antes de enviar.');
      }
      return false;
    }
    return true;
  };

  const handleSupportWhatsApp = () => {
    if (!handleSupportValidation()) return;
    const url = `https://wa.me/573002011801?text=${encodeURIComponent(
      buildSupportMessage()
    )}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Screen>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Administración & Seguridad</ThemedText>
        <ThemedText themeColor="textSecondary">
          Control de ingresos, registros de hardware y links temporales
        </ThemedText>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <ThemedText style={styles.logoutButtonText}>Cerrar sesión</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Panel Super Admin: exclusivo del dueño de la plataforma. */}
      {currentUser.id === SUPER_ADMIN_USER_ID && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">🛡️ Panel Super Admin</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Lista global de talleres y activación de 30 días con un clic.
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.activateButton,
              { paddingVertical: Spacing.three, alignSelf: 'flex-start' },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/super-admin')}>
            <ThemedText style={styles.activateButtonText}>
              Abrir Panel Super Admin
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Invitation Link for Technicians — consolidated for all environments */}
      {currentUser.role === 'admin' && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Invitación de Técnicos al Taller</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Genera un enlace seguro que permite a un técnico registrarse y quedar asociado
            automáticamente al taller{' '}
            <ThemedText type="linkPrimary">{currentUser.name}</ThemedText>.
            El enlace vence a los 10 minutos por seguridad.
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.activateButton,
              { paddingVertical: Spacing.three, alignSelf: 'flex-start' },
              pressed && styles.pressed,
            ]}
            onPress={handleCreateInvite}>
            <ThemedText style={styles.activateButtonText}>
              Generar Enlace de Invitación
            </ThemedText>
          </Pressable>

          {inviteLink ? (
            <View style={styles.linkDisplayBox}>
              <View style={styles.inviteHeader}>
                <ThemedText type="smallBold" style={{ color: Brand.success }}>
                  Enlace generado — vence en 10 min
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Creado: {new Date(inviteLink.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
              <ThemedText
                type="code"
                selectable
                style={{ fontSize: 11, lineHeight: 16, marginVertical: Spacing.one }}>
                {inviteLink.url}
              </ThemedText>
              <Pressable
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleCopyInvite}>
                <ThemedText style={styles.copyButtonText}>Copiar enlace</ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic' }}>
              Aún no hay un enlace activo. Genera uno para invitar a un técnico.
            </ThemedText>
          )}
        </ThemedView>
      )}

      {/* Technician Management Card */}
      {currentUser.role === 'admin' && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Gestión de Técnicos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {users.filter((u) => u.role === 'technician').length} de {MAX_TECHNICIANS}{' '}
            técnicos
          </ThemedText>

          {users.filter((u) => u.role === 'technician').length === 0 ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ fontStyle: 'italic' }}>
              Aún no hay técnicos. Genera un enlace de invitación o agrega uno
              manualmente.
            </ThemedText>
          ) : (
            users
              .filter((u) => u.role === 'technician')
              .map((u) => {
                const generated = accumulatedProfit(repairs, u.id, u.name);
                const earned = accumulatedCommission(
                  repairs,
                  u.id,
                  u.name,
                  u.commissionRate ?? 0
                );
                const isEditing = editingCommissionId === u.id;
                const ratePct = Math.round((u.commissionRate ?? 0) * 100);
                return (
                  <View key={u.id} style={[styles.techRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.techInfo}>
                      <ThemedText type="smallBold">{u.name}</ThemedText>
                      {isEditing ? (
                        <View style={styles.commissionEditRow}>
                          <TextInput
                            style={[
                              styles.commissionInput,
                              {
                                color: theme.text,
                                borderColor: theme.backgroundElement,
                              },
                            ]}
                            placeholder="%"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="number-pad"
                            value={commissionInput}
                            onChangeText={(t) =>
                              setCommissionInput(t.replace(/[^0-9]/g, ''))
                            }
                            maxLength={3}
                          />
                          <Pressable
                            style={({ pressed }) => [
                              styles.saveButton,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => handleSaveCommission(u)}>
                            <ThemedText style={styles.saveButtonText}>
                              Guardar
                            </ThemedText>
                          </Pressable>
                          <Pressable onPress={cancelEditCommission}>
                            <ThemedText
                              type="small"
                              themeColor="textSecondary">
                              Cancelar
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <ThemedText type="small" themeColor="textSecondary">
                            Comisión: {ratePct}% · Generado (entregado):{' '}
                            {formatCOP(generated)}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Ganancia ({ratePct}%): {formatCOP(earned)}
                          </ThemedText>
                        </>
                      )}
                    </View>
                    <View style={styles.techActions}>
                      {!isEditing && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.editButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => startEditCommission(u)}>
                          <ThemedText style={styles.editButtonText}>
                            Editar %
                          </ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => handleDeleteTechnician(u)}>
                        <ThemedText style={styles.deleteButtonText}>
                          Eliminar
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })
          )}
        </ThemedView>
      )}

      {/* Liquidación y Rendimiento Mensual por Técnico */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Liquidación y Rendimiento Mensual</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Desglose por técnico según la fecha real de entrega/cobro. Los meses
          archivados quedan congelados como solo lectura; el mes en curso
          sigue acumulando.
        </ThemedText>

        {/* Selector de periodo: mes en curso + meses archivados */}
        {periodOptions.length > 0 && (
          <View style={styles.periodRow}>
            {periodOptions.map((option) => {
              const isSelected = option.period === effectivePeriod;
              return (
                <Pressable
                  key={option.period}
                  onPress={() => setSelectedPeriod(option.period)}
                  style={({ pressed }) => [
                    styles.periodChip,
                    pressed && styles.pressed,
                    isSelected
                      ? { backgroundColor: Brand.primary }
                      : { backgroundColor: theme.surfaceContainerHigh },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={
                      isSelected
                        ? { color: Brand.onBrand }
                        : undefined
                    }>
                    {option.isCurrent ? `${option.label} (En Curso)` : option.label}
                  </ThemedText>
                  {!option.isCurrent && (
                    <ThemedText
                      type="small"
                      style={
                        isSelected
                          ? { color: Brand.onBrand, opacity: 0.75, fontSize: 10 }
                          : { color: theme.textSecondary, fontSize: 10 }
                      }>
                      Archivado
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {perfLoading ? (
          <ThemedText type="small" themeColor="textSecondary">
            Cargando rendimiento del periodo…
          </ThemedText>
        ) : perfError ? (
          <ThemedText type="small" style={{ color: Brand.danger }}>
            {perfError}
          </ThemedText>
        ) : (
          <>
            {/* Nota de archivo: los meses cerrados no se editan */}
            {isArchivedPeriod && (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontStyle: 'italic' }}>
                🗄️ Periodo archivado (solo lectura): snapshot histórico del mes
                cerrado.
              </ThemedText>
            )}

            {/* Resumen global del mes */}
            <View style={styles.settlementGrid}>
              <View
                style={[
                  styles.settlementBox,
                  { backgroundColor: theme.surfaceContainerHigh },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Total Facturado
                </ThemedText>
                <ThemedText type="subtitle">
                  {formatCOP(monthlySummary.totalRevenue)}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.settlementBox,
                  { backgroundColor: theme.surfaceContainerHigh },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Inversión en Repuestos
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: Brand.warning }}>
                  {formatCOP(monthlySummary.totalPartsCost)}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.settlementBox,
                  { backgroundColor: theme.surfaceContainerHigh },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Comisiones por Pagar
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: Brand.primary }}>
                  {formatCOP(monthlySummary.totalCommissions)}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.settlementBox,
                  { backgroundColor: theme.surfaceContainerHigh },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Utilidad Neta del Taller
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: Brand.success }}>
                  {formatCOP(monthlySummary.workshopNetProfit)}
                </ThemedText>
              </View>
            </View>

            {/* Tarjetas por técnico */}
            {monthlySummary.technicians.length === 0 ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontStyle: 'italic' }}>
                Sin órdenes entregadas en{' '}
                {effectivePeriod ? formatPeriodLabel(effectivePeriod) : 'este periodo'}.
              </ThemedText>
            ) : (
              monthlySummary.technicians.map((t) => {
                const ratePct = Math.round(t.commissionRate * 100);
                return (
                  <View
                    key={t.technicianId ?? t.technicianName}
                    style={[
                      styles.techPerfCard,
                      { backgroundColor: theme.surfaceContainerHigh },
                    ]}>
                    <View style={styles.techPerfHeader}>
                      <ThemedText type="smallBold">{t.technicianName}</ThemedText>
                      <View
                        style={[
                          styles.commissionBadge,
                          { backgroundColor: `${Brand.primary}1a` },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{ color: Brand.primary, fontWeight: '600' }}>
                          {ratePct}% comisión
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Órdenes entregadas: {t.deliveredCount}
                    </ThemedText>
                    <View style={styles.techPerfGrid}>
                      <View style={styles.techPerfMetric}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Generado
                        </ThemedText>
                        <ThemedText type="smallBold">
                          {formatCOP(t.totalRevenue)}
                        </ThemedText>
                      </View>
                      <View style={styles.techPerfMetric}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Repuestos
                        </ThemedText>
                        <ThemedText type="smallBold">
                          {formatCOP(t.totalPartsCost)}
                        </ThemedText>
                      </View>
                      <View style={styles.techPerfMetric}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Producción neta
                        </ThemedText>
                        <ThemedText type="smallBold">
                          {formatCOP(t.netProduction)}
                        </ThemedText>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.liquidationRow,
                        {
                          backgroundColor: `${Brand.success}14`,
                          borderColor: `${Brand.success}4d`,
                        },
                      ]}>
                      <ThemedText type="small">Por liquidar al técnico</ThemedText>
                      <ThemedText type="subtitle" style={{ color: Brand.success }}>
                        {formatCOP(t.commissionTotal)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Ganancia neta del taller sobre este técnico:{' '}
                      {formatCOP(t.workshopNetProfit)}
                    </ThemedText>
                  </View>
                );
              })
            )}
          </>
        )}
      </ThemedView>

      {/* Financial Revenue Control Card */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Control de Ingresos</ThemedText>
        <View style={[styles.financesGrid, !isWideViewport && styles.financesGridStack]}>
          <View style={[styles.financeBox, { backgroundColor: theme.surfaceContainerHigh }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Ingresos Cobrados (Listo/Entregado)
            </ThemedText>
            <ThemedText type="title" style={{ color: Brand.success }}>
              {formatCOP(totalRevenue)}
            </ThemedText>
          </View>
          <View style={[styles.financeBox, { backgroundColor: theme.surfaceContainerHigh }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Utilidad Neta (menos repuestos)
            </ThemedText>
            <ThemedText type="title" style={{ color: Brand.success }}>
              {formatCOP(netProfit)}
            </ThemedText>
          </View>
          <View style={[styles.financeBox, { backgroundColor: theme.surfaceContainerHigh }]}>
            <ThemedText type="small" themeColor="textSecondary">
              En Trámite (Pendiente/Proceso)
            </ThemedText>
            <ThemedText type="title" style={{ color: Brand.warning }}>
              {formatCOP(pendingRevenue)}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.financeBox, { marginTop: Spacing.two, backgroundColor: theme.surfaceContainerHigh }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Valor Total de Inventario en Piezas
          </ThemedText>
          <ThemedText type="subtitle">{formatCOP(inventoryValue)}</ThemedText>
        </View>
      </ThemedView>

      {/* Monthly Closures Card — cierres de meses anteriores */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Cierres de Mes Anteriores</ThemedText>
        {closures.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No hay meses cerrados aún. El cierre se genera automáticamente al
            cambiar de mes.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.periodHint}>
              Periodo abierto actual: {currentPeriod ?? '—'}
            </ThemedText>
            {closures.map((c) => (
              <View key={c.id} style={styles.closureRow}>
                <View style={styles.closureInfo}>
                  <ThemedText type="smallBold">{c.period}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cerrado: {new Date(c.closedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </ThemedText>
                </View>
                <View style={styles.closureMetrics}>
                  <View style={styles.metric}>
                    <ThemedText type="small" themeColor="textSecondary">Ingresos</ThemedText>
                    <ThemedText type="smallBold" style={{ color: Brand.success }}>
                      {formatCOP(c.revenue)}
                    </ThemedText>
                  </View>
                  <View style={styles.metric}>
                    <ThemedText type="small" themeColor="textSecondary">Repuestos</ThemedText>
                    <ThemedText type="smallBold" style={{ color: Brand.warning }}>
                      {formatCOP(c.partsCost)}
                    </ThemedText>
                  </View>
                  <View style={styles.metric}>
                    <ThemedText type="small" themeColor="textSecondary">Entregadas</ThemedText>
                    <ThemedText type="smallBold">{c.deliveredCount}</ThemedText>
                  </View>
                  <View style={styles.metric}>
                    <ThemedText type="small" themeColor="textSecondary">Canceladas</ThemedText>
                    <ThemedText type="smallBold" style={{ color: Brand.danger }}>
                      {c.cancelledCount}
                    </ThemedText>
                  </View>
                  <View style={styles.metric}>
                    <ThemedText type="small" themeColor="textSecondary">Total</ThemedText>
                    <ThemedText type="smallBold">{c.totalCount}</ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ThemedView>

      {/* Subscription Status Card — estado real de la suscripción del taller */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Suscripción del Taller</ThemedText>
        <View style={styles.licenseInfoRow}>
          <ThemedText type="smallBold">Estado:</ThemedText>
          <View
            style={[
              styles.statusDot,
              subscription.status === 'active'
                ? { backgroundColor: Brand.success }
                : subscription.status === 'trial'
                  ? { backgroundColor: Brand.warning }
                  : { backgroundColor: Brand.danger },
            ]}
          />
          <ThemedText type="small">
            {subscription.status === 'active'
              ? 'Suscripción Activa'
              : subscription.status === 'trial'
                ? `Periodo de Prueba (vence ${new Date(
                    subscription.trialEndsAt ?? ''
                  ).toLocaleDateString('es-CO')})`
                : 'Suscripción Expirada'}
          </ThemedText>
        </View>

        {subscription.status === 'active' && subscription.subscriptionEndsAt && (
          <ThemedText type="small" themeColor="textSecondary">
            Suscripción válida hasta:{' '}
            {new Date(subscription.subscriptionEndsAt).toLocaleDateString('es-CO')}
          </ThemedText>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.renewButton,
            pressed && styles.pressed,
          ]}
          onPress={handlePayWhatsApp}>
          <ThemedText style={styles.renewButtonText}>
            Registrar Pago ($20.000 COP / mes — Acceso Ilimitado)
          </ThemedText>
        </Pressable>

        {/* Commercial contact banner */}
        <View style={styles.bannerWrap}>
          <CommercialBanner />
        </View>
      </ThemedView>

      {/* Technical Support Card (visible to all roles) */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Soporte y Ayuda</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reporte las necesidades del taller; el equipo lo notificará por WhatsApp.
        </ThemedText>
        <View style={styles.rolesRow}>
          {SUPPORT_TYPES.map((type) => {
            const isSelected = supportType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setSupportType(type)}
                style={[
                  styles.roleButton,
                  isSelected
                    ? { backgroundColor: Brand.primary }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    isSelected && { color: Brand.onBrand },
                  ]}>
                  {type}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.backgroundElement },
          ]}
          placeholder="Describa su necesidad o sugerencia..."
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={4}
          value={supportMessage}
          onChangeText={setSupportMessage}
          maxLength={500}
        />
        <View style={styles.supportActions}>
          <Pressable
            style={({ pressed }) => [
              styles.whatsappButton,
              pressed && styles.pressed,
            ]}
            onPress={handleSupportWhatsApp}>
            <ThemedText style={styles.buttonText}>Enviar por WhatsApp</ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      {/* Confirmación MD3 de eliminación de técnico */}
      <ConfirmDialog
        visible={techPendingDelete !== null}
        title="Eliminar técnico"
        message={
          techPendingDelete
            ? `¿Eliminar a ${techPendingDelete.name} del taller? Su historial de órdenes se conserva.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={techDeleting}
        onConfirm={() => {
          void confirmDeleteTechnician();
        }}
        onCancel={() => setTechPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Shape.xl,
    gap: Spacing.three,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  roleButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Shape.lg,
    overflow: 'hidden',
  },
  roleButtonText: {
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 14,
  },
  financesGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  financesGridStack: {
    flexDirection: 'column',
    gap: Spacing.two,
  },
  financeBox: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.three,
    borderRadius: Shape.lg,
    gap: Spacing.one,
  },
  licenseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Shape.full,
  },
  input: {
    borderWidth: 1,
    borderRadius: Shape.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  activateButton: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Shape.sm,
  },
  activateButtonText: {
    color: Brand.onBrand,
    fontWeight: '600',
  },
  renewButton: {
    backgroundColor: Brand.success,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Shape.lg,
    marginTop: Spacing.two,
  },
  renewButtonText: {
    color: Brand.onBrand,
    fontWeight: 'bold',
  },
  bannerWrap: {
    marginTop: Spacing.two,
  },
  supportActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: Brand.whatsapp,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.min,
    borderRadius: Shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.three,
    minHeight: TouchTarget.min,
    borderRadius: Shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Brand.onBrand,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  linkDisplayBox: {
    backgroundColor: `${Brand.success}14`,
    borderWidth: 1,
    borderColor: `${Brand.success}4d`,
    padding: Spacing.three,
    borderRadius: Shape.sm,
    marginTop: Spacing.one,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copyButton: {
    backgroundColor: `${Brand.success}26`,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.sm,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    color: Brand.success,
    fontWeight: '600',
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: Brand.danger,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.lg,
    marginTop: Spacing.two,
  },
  logoutButtonText: {
    color: Brand.onBrand,
    fontWeight: '700',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
  },
  techInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  techActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  commissionEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  commissionInput: {
    borderWidth: 1,
    borderRadius: Shape.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
    width: 72,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  editButton: {
    backgroundColor: `${Brand.primary}1a`,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.sm,
  },
  editButtonText: {
    color: Brand.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: Brand.success,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.sm,
  },
  saveButtonText: {
    color: Brand.onBrand,
    fontWeight: '600',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: `${Brand.danger}1a`,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.sm,
  },
  deleteButtonText: {
    color: Brand.danger,
    fontWeight: '600',
    fontSize: 12,
  },
  periodHint: {
    marginBottom: Spacing.two,
    fontStyle: 'italic',
  },
  closureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  closureInfo: {
    flex: 1,
    gap: 2,
  },
  closureMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'center',
  },
  metric: {
    gap: 2,
    alignItems: 'flex-end',
    minWidth: 70,
  },
  // ── Panel de Liquidación y Rendimiento Mensual ──
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  periodChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Shape.lg,
    gap: 2,
  },
  settlementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  settlementBox: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: Spacing.three,
    borderRadius: Shape.lg,
    gap: Spacing.one,
  },
  techPerfCard: {
    padding: Spacing.three,
    borderRadius: Shape.lg,
    gap: Spacing.two,
  },
  techPerfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  commissionBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one / 2,
    borderRadius: Shape.full,
  },
  techPerfGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  techPerfMetric: {
    flex: 1,
    gap: 2,
  },
  liquidationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
    borderRadius: Shape.sm,
  },
});
