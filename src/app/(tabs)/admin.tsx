import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { CommercialBanner } from '@/components/commercial-banner';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth, MAX_TECHNICIANS, type User } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useWorkshop } from '@/context/workshop-context';
import { useTheme } from '@/hooks/use-theme';
import { SUPER_ADMIN_USER_ID } from '@/lib/super-admin';
import { formatCOP } from '@/utils/format';
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
    createTechnician,
    deleteTechnician,
    updateTechnicianCommission,
  } = useAuth();
  const { repairs, inventory } = useRepair();
  const { subscription } = useWorkshop();
  const router = useRouter();

  // Technician management form states
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techCommission, setTechCommission] = useState('');
  // Inline commission editing state (per technician row)
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState('');

  // Support ticket state
  const [supportType, setSupportType] = useState(SUPPORT_TYPES[0]);
  const [supportMessage, setSupportMessage] = useState('');

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

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  const handleDeleteTechnician = async (tech: (typeof users)[number]) => {
    const confirmDelete = async () => {
      const deleted = await deleteTechnician(tech.id);
      if (deleted) {
        notify('Técnico eliminado.');
      } else {
        notify('No se puede eliminar este técnico.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar a ${tech.name} del taller?`)) {
        await confirmDelete();
      }
    } else {
      Alert.alert('Eliminar técnico', `¿Eliminar a ${tech.name} del taller?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const handleAddTechnician = async () => {
    if (!techName.trim() || !techEmail.trim()) {
      notify('Complete todos los campos para agregar el técnico.');
      return;
    }
    if (!EMAIL_REGEX.test(techEmail.trim())) {
      notify('Ingrese un correo electrónico válido.');
      return;
    }
    const result = await createTechnician(
      techName.trim(),
      techEmail.trim(),
      Number(techCommission) / 100
    );
    if (result.ok) {
      setTechName('');
      setTechEmail('');
      setTechCommission('');
      notify(
        'Técnico agregado al taller. Recibirá un correo de confirmación para activar su cuenta.'
      );
    } else if (result.reason === 'limit') {
      notify(
        `Límite alcanzado: el taller tiene el máximo de ${MAX_TECHNICIANS} técnicos permitidos.`
      );
    } else if (result.reason === 'email') {
      notify('Ya existe un usuario con ese correo.');
    } else {
      notify(result.message ?? 'No se pudo agregar el técnico.');
    }
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
    const url = `https://wa.me/573000000000?text=${encodeURIComponent(
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
                <ThemedText type="smallBold" style={{ color: '#10b981' }}>
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
                  <View key={u.id} style={styles.techRow}>
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
                            placeholderTextColor="#9ca3af"
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

          <View style={styles.techForm}>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.backgroundElement },
              ]}
              placeholder="Nombre"
              placeholderTextColor="#9ca3af"
              value={techName}
              onChangeText={setTechName}
              maxLength={80}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.backgroundElement },
              ]}
              placeholder="Correo"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={techEmail}
              onChangeText={setTechEmail}
              maxLength={100}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.backgroundElement },
              ]}
              placeholder="Comisión % (Ej: 30)"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              value={techCommission}
              onChangeText={(t) => setTechCommission(t.replace(/[^0-9]/g, ''))}
              maxLength={3}
            />
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
              onPress={handleAddTechnician}>
              <ThemedText style={styles.buttonText}>Agregar Técnico</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      )}

      {/* Financial Revenue Control Card */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Control de Ingresos</ThemedText>
        <View style={styles.financesGrid}>
          <View style={styles.financeBox}>
            <ThemedText type="small" themeColor="textSecondary">
              Ingresos Cobrados (Listo/Entregado)
            </ThemedText>
            <ThemedText type="title" style={{ color: '#10b981' }}>
              {formatCOP(totalRevenue)}
            </ThemedText>
          </View>
          <View style={styles.financeBox}>
            <ThemedText type="small" themeColor="textSecondary">
              Utilidad Neta (menos repuestos)
            </ThemedText>
            <ThemedText type="title" style={{ color: '#10b981' }}>
              {formatCOP(netProfit)}
            </ThemedText>
          </View>
          <View style={styles.financeBox}>
            <ThemedText type="small" themeColor="textSecondary">
              En Trámite (Pendiente/Proceso)
            </ThemedText>
            <ThemedText type="title" style={{ color: '#f59e0b' }}>
              {formatCOP(pendingRevenue)}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.financeBox, { marginTop: Spacing.two }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Valor Total de Inventario en Piezas
          </ThemedText>
          <ThemedText type="subtitle">{formatCOP(inventoryValue)}</ThemedText>
        </View>
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
                ? { backgroundColor: '#10b981' }
                : subscription.status === 'trial'
                  ? { backgroundColor: '#f59e0b' }
                  : { backgroundColor: '#ef4444' },
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
                    ? { backgroundColor: '#0284c7' }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    isSelected && { color: '#ffffff' },
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
          placeholderTextColor="#9ca3af"
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
    borderRadius: Spacing.four,
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
    borderRadius: Spacing.three,
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
  financeBox: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.03)',
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
    borderRadius: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  activateButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  activateButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  renewButton: {
    backgroundColor: '#10b981',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  renewButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#25d366',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  linkDisplayBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.one,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copyButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
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
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
    width: 72,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  editButton: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  editButtonText: {
    color: '#0284c7',
    fontWeight: '600',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 12,
  },
  techForm: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
