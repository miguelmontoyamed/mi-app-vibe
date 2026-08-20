/**
 * Generación y compartición del PDF del recibo en iOS/Android.
 *
 * Usa `expo-print` para rasterizar el HTML del recibo a un PDF y
 * `expo-sharing` para abrir el menú nativo de compartir (WhatsApp, correo,
 * archivos, etc.).
 *
 * En web este módulo NO se usa: Metro resuelve `receipt-pdf.web.ts`
 * (jspdf + Web Share API). Ambos exportan `shareReceiptPdf` con el mismo
 * contrato, así la pantalla importa `@/utils/receipt-pdf` sin conocer la
 * plataforma.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ReceiptPdfData, ReceiptShareResult } from './receipt-pdf-types';

/**
 * Genera el PDF desde el HTML del recibo y abre el menú de compartir nativo.
 *
 * @param data Datos del recibo (se usan para el diálogo de compartir).
 * @param html HTML autocontenido del recibo (membrete, orden, cliente, valores).
 * @returns 'shared' si se abrió el share sheet, 'unavailable' si el
 *          dispositivo no tiene apps de compartir, 'error' en fallo.
 */
export async function shareReceiptPdf(
  data: ReceiptPdfData,
  html: string,
): Promise<ReceiptShareResult> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) {
      return 'unavailable';
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Compartir recibo ${data.orderId}`,
      UTI: 'com.adobe.pdf',
    });
    return 'shared';
  } catch (error) {
    console.error('Error generando el PDF del recibo:', error);
    return 'error';
  }
}