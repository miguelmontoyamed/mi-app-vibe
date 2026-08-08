import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { formatCOP } from '@/utils/format';

export default function ReceiptScreen() {
  const router = useRouter();
  const { currentUser, license } = useAuth();
  const { repairs } = useRepair();
  const { id } = useLocalSearchParams<{ id: string }>();

  const repair = repairs.find((r) => r.id === id);

  if (!repair) {
    return (
      <Screen title="Recibo">
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="subtitle">Recibo no encontrado</ThemedText>
          <ThemedText themeColor="textSecondary">
            La orden de trabajo no existe o fue eliminada.
          </ThemedText>
          <Button label="Volver a Trabajos" onPress={() => router.replace('/jobs')} />
        </ThemedView>
      </Screen>
    );
  }

const paid = repair.advancePayment ?? 0;
  const balance = Math.max(0, repair.budget - paid);
  const paidInFull = paid >= repair.budget;

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    } else {
      // Native: native printing is out of scope for the current free build.
      alert('Usa Imprimir / Guardar como PDF desde el navegador web.');
    }
  };

  return (
    <Screen title="Recibo">
      {/* Non-printable actions */}
      <View style={styles.actions}>
        <Button label="← Volver" variant="secondary" onPress={() => router.back()} style={styles.actionBtn} />
        <Button label="🖨️ Imprimir / Guardar PDF" variant="primary" onPress={handlePrint} style={styles.actionBtn} />
      </View>

      {/* Printable area — global.css hides everything outside this during print */}
      <ThemedView nativeID="receiptArea" type="backgroundElement" style={styles.receipt}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.brand}>TechRepair Master</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Servicio Técnico de Celulares y Electrónica
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            NIT: 901.234.567-8 | Taller de reparación
          </ThemedText>
          <View style={styles.divider} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold"># Orden:</ThemedText>
            <ThemedText type="small">{repair.id}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Fecha:</ThemedText>
            <ThemedText type="small">{repair.date}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Estado:</ThemedText>
            <StatusBadge status={repair.status} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>CLIENTE</ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Nombre:</ThemedText>
            <ThemedText type="small">{repair.clientName}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Teléfono:</ThemedText>
            <ThemedText type="small">{repair.phone}</ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>EQUIPO / SERVICIO</ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Dispositivo:</ThemedText>
            <ThemedText type="small">{repair.device}</ThemedText>
          </View>
          {repair.imei ? (
            <View style={styles.sectionRow}>
              <ThemedText type="smallBold">IMEI / Serial:</ThemedText>
              <ThemedText type="small">{repair.imei}</ThemedText>
            </View>
          ) : null}
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Falla reportada:</ThemedText>
            <ThemedText type="small">{repair.issue}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Técnico:</ThemedText>
            <ThemedText type="small">{repair.technicianName || 'General'}</ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>VALOR A PAGAR</ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Total reparación:</ThemedText>
            <ThemedText type="smallBold">{formatCOP(repair.budget)}</ThemedText>
          </View>
          {paid > 0 && (
            <View style={styles.sectionRow}>
              <ThemedText type="small">Abonado:</ThemedText>
              <ThemedText type="small">− {formatCOP(paid)}</ThemedText>
            </View>
          )}
          <View style={[styles.sectionRow, styles.balanceRow]}>
            <ThemedText type="smallBold" style={{ color: paidInFull ? Brand.success : Brand.danger }}>
              {paidInFull ? 'ESTADO DE PAGO: CANCELADO' : 'SALDO PENDIENTE:'}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: paidInFull ? Brand.success : Brand.danger }}>
              {paidInFull ? '✓' : formatCOP(balance)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Atendido por:</ThemedText>
            <ThemedText type="small">{currentUser?.name || repair.technicianName || '-'}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Licencia:</ThemedText>
            <ThemedText type="small">{license.plan}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.thanks}>
            ¡Gracias por confiar en TechRepair! Conserva este recibo como soporte de tu garantía.
          </ThemedText>
        </View>
      </ThemedView>

      {/* Native reminder below printable area */}
      {Platform.OS === 'web' && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          💡 Usa &ldquo;Imprimir / Guardar PDF&rdquo; y elige &ldquo;Guardar como PDF&rdquo; para descargar el recibo.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  receipt: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    width: '100%',
  },
  header: {
    gap: 2,
    alignItems: 'center',
  },
  brand: {
    fontSize: 26,
    lineHeight: 30,
    color: Brand.primary,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    color: Brand.primary,
    textTransform: 'uppercase',
    fontSize: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  balanceRow: {
    marginTop: Spacing.one,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#9ca3af',
    marginVertical: Spacing.two,
  },
  footer: {
    gap: Spacing.one,
  },
  thanks: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  hint: {
    width: '100%',
    textAlign: 'center',
  },
  empty: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
  },
});