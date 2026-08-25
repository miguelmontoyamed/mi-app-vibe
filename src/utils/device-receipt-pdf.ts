/**
 * TechRepair Master — Generación de Factura / Comprobante de Venta de Equipos (Nativo iOS / Android)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { DeviceReceiptPdfData, DeviceReceiptShareResult } from './device-receipt-types';

export async function shareDeviceReceiptPdf(
  data: DeviceReceiptPdfData,
  html?: string
): Promise<DeviceReceiptShareResult> {
  try {
    if (!html) {
      return 'error';
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) {
      return 'unavailable';
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Compartir Factura ${data.invoiceFolio}`,
      UTI: 'com.adobe.pdf',
    });
    return 'shared';
  } catch (error) {
    console.error('Error generando el PDF de la factura:', error);
    return 'error';
  }
}
