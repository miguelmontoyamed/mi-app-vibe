import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { CommercialBanner, CONTACT_WHATSAPP } from '@/components/commercial-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Shape, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useDevices } from '@/context/device-context';
import { useWorkshop } from '@/context/workshop-context';
import { useTheme } from '@/hooks/use-theme';
import { shareDeviceReceiptPdf } from '@/utils/device-receipt-pdf';
import type { DeviceReceiptPdfData } from '@/utils/device-receipt-types';
import { formatCOP } from '@/utils/format';
import { formatNit } from '@/utils/nit';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function DeviceReceiptScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { devices } = useDevices();
  const { profile } = useWorkshop();
  const { id } = useLocalSearchParams<{ id: string }>();

  const device = devices.find((d) => d.id === id);

  if (!device || device.status !== 'Vendido') {
    return (
      <Screen title="Factura de Venta">
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="subtitle">Factura no encontrada</ThemedText>
          <ThemedText themeColor="textSecondary">
            El equipo no existe o aún no ha sido registrado como vendido.
          </ThemedText>
          <Button
            label="Volver a Equipos"
            onPress={() => router.back()}
          />
        </ThemedView>
      </Screen>
    );
  }

  const pdfData: DeviceReceiptPdfData = {
    brand: profile?.name || 'TechRepair Master',
    nit: profile?.nit,
    address: profile?.address,
    phone: profile?.phone,
    invoiceFolio: device.invoiceFolio || 'VNT-0000',
    saleDate: device.saleDate || device.createdAt.split('T')[0],
    paymentMethod: device.paymentMethod || 'Efectivo',
    clientName: device.clientName || 'Cliente General',
    clientDocument: device.clientDocument,
    clientPhone: device.clientPhone,
    brandDevice: device.brand,
    model: device.model,
    color: device.color,
    storageCapacity: device.storageCapacity,
    imei: device.imei,
    condition: device.condition,
    salePrice: device.salePrice || 0,
    warrantyMonths: device.clientWarrantyMonths || 0,
    warrantyExpiry: device.clientWarrantyExpiry || device.saleDate || '',
    saleNotes: device.saleNotes,
    attendedBy: currentUser?.name || 'Administrador',
    whatsappContact: CONTACT_WHATSAPP,
  };

  const buildHtml = (): string => {
    const brand = profile?.name || 'TechRepair Master';
    const nitLine = profile ? `NIT: ${formatNit(profile.nit)}<br/>` : '';
    const addressLine = profile?.address ? `${escapeHtml(profile.address)}<br/>` : '';
    const phoneLine = profile ? `Tel: ${escapeHtml(profile.phone)}` : '';
    const spec = [device.storageCapacity, device.color].filter(Boolean).join(' - ');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Factura ${escapeHtml(device.invoiceFolio || 'VNT')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #111827; background: #fff; }
  .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: bold; color: #2563eb; margin: 0 0 6px; }
  .meta { font-size: 13px; color: #4b5563; line-height: 1.4; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 12px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; }
  .row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
  .row strong { color: #374151; }
  .total-row { font-size: 18px; font-weight: bold; color: #111827; margin-top: 10px; border-top: 1px dashed #d1d5db; padding-top: 8px; }
  .terms-box { background: #f0f7fc; border: 1px solid #2563eb; border-radius: 8px; padding: 12px; font-size: 11px; color: #374151; margin-top: 18px; text-align: center; }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="brand">${escapeHtml(brand)}</div>
    <div class="meta">
      ${nitLine}
      ${addressLine}
      ${phoneLine}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Factura de Venta</div>
    <div class="row"><strong># Folio:</strong><span>${escapeHtml(device.invoiceFolio || 'VNT-0000')}</span></div>
    <div class="row"><strong>Fecha:</strong><span>${escapeHtml(device.saleDate || '')}</span></div>
    <div class="row"><strong>Método de Pago:</strong><span>${escapeHtml(device.paymentMethod || 'Efectivo')}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Comprador</div>
    <div class="row"><strong>Nombre:</strong><span>${escapeHtml(device.clientName || 'General')}</span></div>
    ${device.clientDocument ? `<div class="row"><strong>Cédula / Documento:</strong><span>${escapeHtml(device.clientDocument)}</span></div>` : ''}
    ${device.clientPhone ? `<div class="row"><strong>Teléfono:</strong><span>${escapeHtml(device.clientPhone)}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Detalles del Equipo</div>
    <div class="row"><strong>Dispositivo:</strong><span>${escapeHtml(device.brand)} ${escapeHtml(device.model)}</span></div>
    ${spec ? `<div class="row"><strong>Especificaciones:</strong><span>${escapeHtml(spec)}</span></div>` : ''}
    <div class="row"><strong>IMEI / Serial:</strong><span>${escapeHtml(device.imei)}</span></div>
    <div class="row"><strong>Condición:</strong><span>${escapeHtml(device.condition)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Garantía y Liquidación</div>
    <div class="row"><strong>Garantía:</strong><span style="color: #059669; font-weight: bold;">${device.clientWarrantyMonths || 0} meses</span></div>
    <div class="row"><strong>Válida hasta:</strong><span>${escapeHtml(device.clientWarrantyExpiry || '')}</span></div>
    <div class="row total-row"><strong>TOTAL PAGADO:</strong><span>${formatCOP(device.salePrice || 0)}</span></div>
  </div>

  <div class="terms-box">
    <strong>POLÍTICA DE GARANTÍA</strong><br/>
    La garantía cubre defectos de funcionamiento. No cubre golpes, humedad, pantalla rota o sellos alterados.
  </div>
</div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
      return;
    }
    const result = await shareDeviceReceiptPdf(pdfData, buildHtml());
    if (result === 'unavailable') {
      Alert.alert('Factura generada', 'No hay apps de compartir disponibles en este dispositivo.');
    } else if (result === 'error') {
      Alert.alert('Error', 'No se pudo generar el PDF de la factura.');
    }
  };

  const handleShareWhatsApp = async () => {
    const result = await shareDeviceReceiptPdf(pdfData, buildHtml());
    if (result === 'downloaded') {
      Alert.alert('PDF descargado', 'Adjunta el PDF en WhatsApp Web o correo para enviarlo al cliente.');
    } else if (result === 'unavailable') {
      Alert.alert('Factura generada', 'No hay apps de compartir disponibles en este dispositivo.');
    } else if (result === 'error') {
      Alert.alert('Error', 'No se pudo generar el PDF de la factura.');
    }
  };

  return (
    <Screen title="Factura de Venta">
      <View style={styles.actions}>
        <Button label="← Volver" variant="secondary" onPress={() => router.back()} style={styles.actionBtn} />
        <Button label="🖨️ Imprimir / Guardar PDF" variant="primary" onPress={handlePrint} style={styles.actionBtn} />
        <Button label="📲 Compartir por WhatsApp" variant="primary" onPress={handleShareWhatsApp} style={styles.actionBtn} />
      </View>

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
              Venta de Celulares & Tecnología
            </ThemedText>
          )}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold"># Factura / Folio:</ThemedText>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              {device.invoiceFolio}
            </ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Fecha de Venta:</ThemedText>
            <ThemedText type="small">{device.saleDate}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Método de Pago:</ThemedText>
            <ThemedText type="small">{device.paymentMethod || 'Efectivo'}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.section}>
          <ThemedText type="smallBold" style={[styles.sectionTitle, { color: Brand.primary }]}>
            COMPRADOR
          </ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Nombre:</ThemedText>
            <ThemedText type="small">{device.clientName}</ThemedText>
          </View>
          {device.clientDocument ? (
            <View style={styles.sectionRow}>
              <ThemedText type="smallBold">Cédula / Documento:</ThemedText>
              <ThemedText type="small">{device.clientDocument}</ThemedText>
            </View>
          ) : null}
          {device.clientPhone ? (
            <View style={styles.sectionRow}>
              <ThemedText type="smallBold">Teléfono:</ThemedText>
              <ThemedText type="small">{device.clientPhone}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.section}>
          <ThemedText type="smallBold" style={[styles.sectionTitle, { color: Brand.primary }]}>
            DISPOSITIVO
          </ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Equipo:</ThemedText>
            <ThemedText type="smallBold">
              {device.brand} {device.model}
            </ThemedText>
          </View>
          {device.storageCapacity || device.color ? (
            <View style={styles.sectionRow}>
              <ThemedText type="smallBold">Especificaciones:</ThemedText>
              <ThemedText type="small">
                {[device.storageCapacity, device.color].filter(Boolean).join(' - ')}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">IMEI / Serial:</ThemedText>
            <ThemedText type="smallBold">{device.imei}</ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Condición:</ThemedText>
            <ThemedText type="small">{device.condition}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.section}>
          <ThemedText type="smallBold" style={[styles.sectionTitle, { color: Brand.primary }]}>
            GARANTÍA Y PAGO
          </ThemedText>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Garantía Otorgada:</ThemedText>
            <ThemedText type="smallBold" style={{ color: '#059669' }}>
              {device.clientWarrantyMonths} meses
            </ThemedText>
          </View>
          <View style={styles.sectionRow}>
            <ThemedText type="smallBold">Vence el:</ThemedText>
            <ThemedText type="small">{device.clientWarrantyExpiry}</ThemedText>
          </View>
          <View style={[styles.sectionRow, styles.totalRow]}>
            <ThemedText type="subtitle">TOTAL PAGADO:</ThemedText>
            <ThemedText type="title" style={{ color: Brand.primary }}>
              {formatCOP(device.salePrice || 0)}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.termsBox, { borderColor: theme.border, backgroundColor: theme.surfaceContainer }]}>
          <ThemedText type="smallBold" style={{ color: Brand.primary, textAlign: 'center' }}>
            POLÍTICA DE GARANTÍA DE EQUIPOS
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
            Cubre fallas técnicas del fabricante o software. No cubre golpes, humedad, sobrevoltaje ni sellos violados.
          </ThemedText>
        </View>

        <CommercialBanner />
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Shape.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  actionBtn: {
    flex: 1,
    minWidth: 140,
  },
  receipt: {
    padding: Spacing.four,
    borderRadius: Shape.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  brand: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Brand.primary,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    marginBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  termsBox: {
    padding: Spacing.three,
    borderRadius: Shape.md,
    borderWidth: 1,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
});
