import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import {
  CommercialBanner,
  CONTACT_WHATSAPP,
} from '@/components/commercial-banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing, statusStyle } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import { useWorkshop } from '@/context/workshop-context';
import { formatCOP } from '@/utils/format';
import { formatNit } from '@/utils/nit';
import { shareReceiptPdf } from '@/utils/receipt-pdf';
import type { ReceiptPdfData } from '@/utils/receipt-pdf-types';

/** Escape básico para insertar valores del dominio dentro del HTML del PDF. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function ReceiptScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { repairs } = useRepair();
  const { profile } = useWorkshop();
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

  /** Datos estructurados del recibo, compartidos por ambas plataformas. */
  const pdfData: ReceiptPdfData = {
    brand: profile?.name || 'TechRepair Master',
    nit: profile?.nit,
    address: profile?.address,
    phone: profile?.phone,
    orderId: repair.id,
    date: repair.date,
    status: repair.status,
    clientName: repair.clientName,
    clientPhone: repair.phone,
    device: repair.device,
    imei: repair.imei,
    issue: repair.issue,
    technicianName: repair.technicianName || 'General',
    budget: repair.budget,
    partsCost: 0,
    paid: 0,
    attendedBy: currentUser?.name || repair.technicianName || '-',
    whatsappContact: CONTACT_WHATSAPP,
  };

  /**
   * HTML autocontenido del recibo para el PDF nativo (expo-print). Mantiene el
   * mismo contenido que el área imprimible de la pantalla: membrete, datos de
   * la orden, cliente, equipo/servicio, total limpio y banner comercial.
   */
  const buildReceiptHtml = (): string => {
    const brand = profile?.name || 'TechRepair Master';
    const nitLine = profile ? `NIT: ${formatNit(profile.nit)}<br/>` : '';
    const addressLine = profile?.address ? `${escapeHtml(profile.address)}<br/>` : '';
    const phoneLine = profile ? `Tel: ${escapeHtml(profile.phone)}` : '';
    const imeiRow = repair.imei
      ? `<div class="row"><strong>IMEI / Serial:</strong><span>${escapeHtml(repair.imei)}</span></div>`
      : '';
    const estado = statusStyle(repair.status, 'light');
    const attendedBy = currentUser?.name || repair.technicianName || '-';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Recibo ${escapeHtml(repair.id)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; padding-left: 32px; padding-right: 32px; padding-top: 24px; }
  h1 { font-size: 24px; color: ${Brand.primary}; text-align: center; margin-bottom: 4px; }
  .membrete { text-align: center; color: #374151; font-size: 12px; line-height: 1.5; margin-bottom: 8px; }
  .divider { border-top: 1px solid #d1d5db; margin: 14px 0; }
  h2 { font-size: 13px; color: ${Brand.primary}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; line-height: 1.7; }
  .estado { display: inline-block; padding: 2px 8px; border: 1px solid ${estado.border}; border-radius: 4px; background: ${estado.bg}; color: ${estado.text}; font-weight: 600; }
  .banner { margin-top: 14px; padding: 12px 14px; border: 1px solid ${Brand.primary}80; border-radius: 8px; background: #f0f7fc; font-size: 11px; color: #334155; line-height: 1.6; }
  .banner strong { color: ${Brand.primary}; display: block; margin-bottom: 2px; }
  .footer { margin-top: 14px; font-size: 12px; color: #374151; line-height: 1.7; }
</style>
</head>
<body>
  <h1>${escapeHtml(brand)}</h1>
  <div class="membrete">${nitLine}${addressLine}${phoneLine}</div>
  <div class="divider"></div>
  <h2>Orden de trabajo</h2>
  <div class="row"><strong># Orden:</strong><span>${escapeHtml(repair.id)}</span></div>
  <div class="row"><strong>Fecha:</strong><span>${escapeHtml(repair.date)}</span></div>
  <div class="row"><strong>Estado:</strong><span class="estado">${escapeHtml(repair.status)}</span></div>
  <div class="divider"></div>
  <h2>Cliente</h2>
  <div class="row"><strong>Nombre:</strong><span>${escapeHtml(repair.clientName)}</span></div>
  <div class="row"><strong>Teléfono:</strong><span>${escapeHtml(repair.phone)}</span></div>
  <div class="divider"></div>
  <h2>Equipo / Servicio</h2>
  <div class="row"><strong>Dispositivo:</strong><span>${escapeHtml(repair.device)}</span></div>
  ${imeiRow}
  <div class="row"><strong>Falla reportada:</strong><span>${escapeHtml(repair.issue)}</span></div>
  <div class="row"><strong>Técnico:</strong><span>${escapeHtml(repair.technicianName || 'General')}</span></div>
  <div class="divider"></div>
  <h2>Valor a pagar</h2>
  <div class="row"><strong>Total reparación:</strong><span>${formatCOP(repair.budget)}</span></div>
  <div class="divider"></div>
  <div class="footer">
    <div class="row"><strong>Atendido por:</strong><span>${escapeHtml(attendedBy)}</span></div>
  </div>
  <div class="banner">
    <strong>Adquiere la Licencia de Facturación</strong>
    Contacta a nuestro equipo comercial para adquirir el producto o tu licencia de facturación: WhatsApp ${escapeHtml(CONTACT_WHATSAPP)}
  </div>
</body>
</html>`;
  };

  /**
   * Impresión / PDF universal:
   * - Web: impresión estándar del navegador (aprovecha el CSS print de
   *   `#receiptArea` en global.css).
   * - iOS/Android: genera el PDF con `shareReceiptPdf` (expo-print +
   *   expo-sharing) y abre el menú nativo del sistema (guardar en archivos,
   *   WhatsApp, correo, etc.).
   */
  const handlePrint = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
      return;
    }
    const result = await shareReceiptPdf(pdfData, buildReceiptHtml());
    if (result === 'unavailable') {
      Alert.alert('Recibo generado', 'No hay apps de compartir disponibles en este dispositivo.');
    } else if (result === 'error') {
      Alert.alert('Error', 'No se pudo generar el PDF del recibo. Intenta de nuevo.');
    }
    // 'shared' / 'downloaded' / 'cancelled' no requieren alerta.
  };

  /**
   * Compartir el PDF por WhatsApp:
   * - Nativo: `shareReceiptPdf` (expo-print + expo-sharing) abre el share
   *   sheet nativo donde WhatsApp aparece como opción.
   * - Web: jspdf genera el PDF y la Web Share API lo comparte (móvil) o se
   *   descarga (escritorio) para adjuntarlo en WhatsApp Web.
   */
  const handleShareWhatsApp = async () => {
    const result = await shareReceiptPdf(pdfData, buildReceiptHtml());
    if (result === 'downloaded') {
      Alert.alert('PDF descargado', 'Adjunta el PDF en WhatsApp Web o correo para enviarlo.');
    } else if (result === 'unavailable') {
      Alert.alert('Recibo generado', 'No hay apps de compartir disponibles en este dispositivo.');
    } else if (result === 'error') {
      Alert.alert('Error', 'No se pudo generar el PDF del recibo. Intenta de nuevo.');
    }
    // 'shared' / 'cancelled' no requieren alerta.
  };

  return (
    <Screen title="Recibo">
      {/* Non-printable actions */}
      <View style={styles.actions}>
        <Button label="← Volver" variant="secondary" onPress={() => router.back()} style={styles.actionBtn} />
        <Button label="🖨️ Imprimir / Guardar PDF" variant="primary" onPress={handlePrint} style={styles.actionBtn} />
        <Button label="📲 Compartir por WhatsApp" variant="primary" onPress={handleShareWhatsApp} style={styles.actionBtn} />
      </View>

      {/* Printable area — global.css hides everything outside this during print */}
      <ThemedView nativeID="receiptArea" type="backgroundElement" style={styles.receipt}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.brand}>
            {profile?.name ?? 'TechRepair Master'}
          </ThemedText>
          {profile ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                NIT: {formatNit(profile.nit)}
              </ThemedText>
              {profile.address ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {profile.address}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                Tel: {profile.phone}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Servicio Técnico de Celulares y Electrónica
            </ThemedText>
          )}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
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

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

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

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

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

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>VALOR A PAGAR</ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Total reparación:</ThemedText>
            <ThemedText type="smallBold">{formatCOP(repair.budget)}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.footer}>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Atendido por:</ThemedText>
            <ThemedText type="small">{currentUser?.name || repair.technicianName || '-'}</ThemedText>
          </View>
          <View style={styles.bannerWrap}>
            <CommercialBanner />
          </View>
        </View>
      </ThemedView>

      {/* Platform hint below printable area */}
      {Platform.OS === 'web' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          💡 &ldquo;Compartir por WhatsApp&rdquo; genera el PDF del recibo: en el celular abre el menú de compartir del sistema (WhatsApp, correo, archivos). En el PC se descarga el PDF para adjuntarlo donde quieras. También puedes usar &ldquo;Imprimir / Guardar PDF&rdquo; y elegir &ldquo;Guardar como PDF&rdquo;.
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          💡 Al compartir el PDF se abrirá el menú nativo para enviarlo por
          WhatsApp, correo o guardarlo en archivos.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  receipt: {
    padding: Spacing.four,
    borderRadius: Shape.lg,
    gap: Spacing.two,
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    height: 'auto',
  },
  header: {
    gap: Spacing.half,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  footer: {
    gap: Spacing.one,
  },
  bannerWrap: {
    marginTop: Spacing.two,
  },
  hint: {
    width: '100%',
    textAlign: 'center',
  },
  empty: {
    padding: Spacing.four,
    borderRadius: Shape.lg,
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
  },
});