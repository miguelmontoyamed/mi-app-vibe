import { useState } from 'react';
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
import { useAuth, MAX_TECHNICIANS } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';

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
    license,
    verifyLicense,
    renewSubscription,
    generateInviteLink,
    inviteLink,
    createTechnician,
    deleteTechnician,
  } = useAuth();
  const { repairs, inventory } = useRepair();
  const router = useRouter();

  const [inputKey, setInputKey] = useState('');

  // Technician management form states
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techCommission, setTechCommission] = useState('');

  // Support ticket state
  const [supportType, setSupportType] = useState(SUPPORT_TYPES[0]);
  const [supportMessage, setSupportMessage] = useState('');

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
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

  const handleVerifyKey = () => {
    const success = verifyLicense(inputKey);
    if (success) {
      if (Platform.OS === 'web') {
        window.alert('¡Licencia activada con éxito! Suscripción mensual válida.');
      } else {
        Alert.alert('Éxito', '¡Licencia activada con éxito! Suscripción mensual válida.');
      }
      setInputKey('');
    } else {
      if (Platform.OS === 'web') {
        window.alert('Clave de licencia inválida o manipulada.');
      } else {
        Alert.alert('Error de Seguridad', 'Clave de licencia inválida o manipulada.');
      }
    }
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

  const buildSupportMessage = () => {
    return [
      '🚨 NUEVO TICKET DE SOPORTE - TechRepair Master 🚨',
      `Taller/Dueño: ${currentUser.name}`,
      `Licencia: ${license.licenseKey}`,
      `Plan: ${license.plan}`,
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

  const handleSupportEmail = () => {
    if (!handleSupportValidation()) return;
    const subject = `Soporte TechRepair - ${supportType}`;
    const mailto = `mailto:soporte@techrepair.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(buildSupportMessage())}`;
    if (Platform.OS === 'web') {
      if (typeof window.alert === 'function') {
        window.alert(
          `Correo de soporte preparado:\n\n${buildSupportMessage()}\n\nAbrir: ${mailto}`
        );
      }
      window.open(mailto, '_self');
    } else {
      Linking.openURL(mailto).catch(() => {});
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
              .map((u) => (
                <View key={u.id} style={styles.techRow}>
                  <View style={styles.techInfo}>
                    <ThemedText type="smallBold">{u.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Comisión:{' '}
                      {Math.round((u.commissionRate ?? 0) * 100) + '%'}
                    </ThemedText>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDeleteTechnician(u)}>
                    <ThemedText style={styles.deleteButtonText}>Eliminar</ThemedText>
                  </Pressable>
                </View>
              ))
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

      {/* Subscription & Anti-Piracy License Card */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Suscripción Mensual & Antiapiratería</ThemedText>
        <View style={styles.licenseInfoRow}>
          <ThemedText type="smallBold">Estado:</ThemedText>
          <View
            style={[
              styles.statusDot,
              license.isActive
                ? { backgroundColor: '#10b981' }
                : { backgroundColor: '#ef4444' },
            ]}
          />
          <ThemedText type="small">
            {license.isActive ? 'Licencia Activa' : 'Licencia Expirada'}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Plan: {license.plan} | Vence: {license.expiresAt} ({license.daysRemaining} días restantes)
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Clave actual: {license.licenseKey}
        </ThemedText>

        <View style={styles.licenseInputRow}>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, flex: 1 },
            ]}
            placeholder="Ingresar nueva clave de activación..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            value={inputKey}
            onChangeText={setInputKey}
            maxLength={40}
          />
          <Pressable
            style={({ pressed }) => [
              styles.activateButton,
              pressed && styles.pressed,
            ]}
            onPress={handleVerifyKey}>
            <ThemedText style={styles.activateButtonText}>Verificar</ThemedText>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.renewButton,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            renewSubscription();
            if (Platform.OS === 'web') {
              window.alert('¡Suscripción mensual renovada con éxito!');
            } else {
              Alert.alert('Renovación', '¡Suscripción mensual renovada con éxito!');
            }
          }}>
          <ThemedText style={styles.renewButtonText}>
            Simular Pago Mensual / Renovar ($50.000 COP / mes — Acceso Ilimitado)
          </ThemedText>
        </Pressable>

        {/* Commercial contact banner — replaces trial language */}
        <View style={styles.bannerWrap}>
          <CommercialBanner />
        </View>
      </ThemedView>

      {/* Technical Support Card (visible to all roles) */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Soporte y Ayuda</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reporte las necesidades del taller; el equipo lo notificará por WhatsApp y correo.
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
          <Pressable
            style={({ pressed }) => [
              styles.emailButton,
              pressed && styles.pressed,
            ]}
            onPress={handleSupportEmail}>
            <ThemedText style={styles.buttonText}>Enviar por Correo</ThemedText>
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
  },
  roleButtonText: {
    fontWeight: '600',
    fontSize: 12,
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
  licenseInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
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
  emailButton: {
    flex: 1,
    backgroundColor: '#0284c7',
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
