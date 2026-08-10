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

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/supabase';
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
    switchUser,
    logout,
    license,
    verifyLicense,
    renewSubscription,
    registerUser,
    generateInviteLink,
  } = useAuth();
  const { repairs, inventory } = useRepair();
  const router = useRouter();

  const [inputKey, setInputKey] = useState('');
  
  // Registration form states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'admin' | 'technician'>('technician');

  // Invitation state
  const [currentLink, setCurrentLink] = useState('');

  // Support ticket state
  const [supportType, setSupportType] = useState(SUPPORT_TYPES[0]);
  const [supportMessage, setSupportMessage] = useState('');

  // Tabs only render when authenticated. Guard keeps typing safe (User | null).
  if (!currentUser) {
    return null;
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  const handleRegister = async () => {
    if (!regName.trim() || !regEmail.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Complete todos los campos para crear la cuenta.');
      } else {
        Alert.alert('Campos incompletos', 'Complete todos los campos.');
      }
      return;
    }

    if (!EMAIL_REGEX.test(regEmail.trim())) {
      if (Platform.OS === 'web') {
        window.alert('Ingrese un correo electrónico válido.');
      } else {
        Alert.alert('Correo inválido', 'Ingrese un correo electrónico válido.');
      }
      return;
    }

    const success = await registerUser(
      regName.trim(),
      regEmail.trim(),
      regRole === 'admin'
    );

    if (success) {
      if (Platform.OS === 'web') {
        window.alert(`¡Usuario ${regName} registrado con éxito con huella de dispositivo única!`);
      } else {
        Alert.alert('Registro Exitoso', `¡Usuario ${regName} registrado con éxito con huella de dispositivo única!`);
      }
      setRegName('');
      setRegEmail('');
    } else {
      if (Platform.OS === 'web') {
        window.alert('Error: Dispositivo bloqueado. No se permiten más registros desde esta máquina.');
      } else {
        Alert.alert('Seguridad Anti-Abuso', 'Error: Dispositivo bloqueado. No se permiten más registros.');
      }
    }
  };

  const handleCreateInvite = () => {
    const link = generateInviteLink();
    setCurrentLink(link);
    if (Platform.OS === 'web') {
      window.alert(`Enlace temporal generado (Vence en 10 min):\n\n${link}`);
    } else {
      Alert.alert('Enlace Temporal Técnico', `Enlace temporal generado (Vence en 10 min):\n\n${link}`);
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

      {/* User Switcher (Simulation Roles) — SOLO demo local (sin Supabase) */}
      {!isSupabaseConfigured && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Cambiar de Técnico / Estación (Demo)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Simulador de sesión activa: {currentUser.name} ({currentUser.role.toUpperCase()})
          </ThemedText>
          <View style={styles.rolesRow}>
            {users.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => switchUser(u.id)}
                style={[
                  styles.roleButton,
                  currentUser.id === u.id
                    ? { backgroundColor: '#0284c7' }
                    : { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    currentUser.id === u.id && { color: '#ffffff' },
                  ]}>
                  {u.name.split(' ')[0]} ({u.role})
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      )}

      {/* Create/Register Owner Account with Anti-Abuse Hardware Fingerprint Check */}
      {currentUser.role === 'admin' && !isSupabaseConfigured && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">SaaS Onboarding (Crear Cuenta / Taller)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con validación de Email y Reconocimiento de Procesador/Dispositivo para evitar abusos de periodos gratis.
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
            placeholder="Nombre Completo"
            placeholderTextColor="#9ca3af"
            value={regName}
            onChangeText={setRegName}
            maxLength={80}
          />
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
            placeholder="Correo Electrónico"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={regEmail}
            onChangeText={setRegEmail}
            maxLength={100}
          />
          <View style={styles.rolesRow}>
            <Pressable
              onPress={() => setRegRole('technician')}
              style={[styles.roleButton, regRole === 'technician' ? { backgroundColor: '#334155' } : { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ color: '#fff' }}>Técnico</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setRegRole('admin')}
              style={[styles.roleButton, regRole === 'admin' ? { backgroundColor: '#334155' } : { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ color: '#fff' }}>Dueño (Admin)</ThemedText>
            </Pressable>
          </View>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleRegister}>
            <ThemedText style={styles.buttonText}>Registrar con Huella Digital de Dispositivo</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Expiring Link Generator for Technicians */}
      {currentUser.role === 'admin' && !isSupabaseConfigured && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Enlaces Temporales para Técnicos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            El dueño genera un enlace seguro de registro temporal. Vence automáticamente en 10 minutos para máxima protección.
          </ThemedText>
          <Pressable style={({ pressed }) => [styles.activateButton, pressed && styles.pressed, { paddingVertical: Spacing.three }]} onPress={handleCreateInvite}>
            <ThemedText style={styles.activateButtonText}>Generar Enlace de Invitación de Técnico</ThemedText>
          </Pressable>
          {currentLink ? (
            <View style={styles.linkDisplayBox}>
              <ThemedText type="smallBold" style={{ color: '#10b981' }}>Enlace Seguro Generado (Vence en 10 min):</ThemedText>
              <ThemedText type="code" style={{ fontSize: 11, marginTop: 4 }}>{currentLink}</ThemedText>
            </View>
          ) : null}
        </ThemedView>
      )}

      {/* Expiring Link Generator for Technicians */}
      {currentUser.role === 'admin' && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Enlaces Temporales para Técnicos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            El dueño genera un enlace seguro de registro temporal. Vence automáticamente en 10 minutos para máxima protección.
          </ThemedText>
          <Pressable style={({ pressed }) => [styles.activateButton, pressed && styles.pressed, { paddingVertical: Spacing.three }]} onPress={handleCreateInvite}>
            <ThemedText style={styles.activateButtonText}>Generar Enlace de Invitación de Técnico</ThemedText>
          </Pressable>
          {currentLink ? (
            <View style={styles.linkDisplayBox}>
              <ThemedText type="smallBold" style={{ color: '#10b981' }}>Enlace Seguro Generado (Vence en 10 min):</ThemedText>
              <ThemedText type="code" style={{ fontSize: 11, marginTop: 4 }}>{currentLink}</ThemedText>
            </View>
          ) : null}
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
});
