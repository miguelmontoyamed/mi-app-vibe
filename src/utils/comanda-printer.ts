/**
 * Impresión de comandas en iOS/Android.
 *
 * Usa `expo-print` para abrir el diálogo de impresión del sistema con la
 * plantilla HTML de la etiqueta (58/80mm); ahí el usuario elige la impresora
 * térmica o de etiquetas conectada.
 *
 * En web este módulo NO se usa: Metro resuelve `comanda-printer.web.ts`
 * (ventana emergente + `window.print`). Ambos exportan `printComanda` con el
 * mismo contrato, así las pantallas importan `@/utils/comanda-printer` sin
 * conocer la plataforma.
 */

import * as Print from 'expo-print';

import { buildComandaHtml } from './comanda-template.ts';
import type { ComandaData, ComandaPrintResult, ComandaWidth } from './comanda-printer-types.ts';

/**
 * Abre el diálogo de impresión del sistema con la comanda de la orden.
 *
 * @param data Datos de la etiqueta (taller, orden, cliente, equipo).
 * @param width Ancho del papel: '80mm' (defecto) o '58mm'.
 * @returns 'printed' si se abrió el diálogo, 'error' en fallo.
 */
export async function printComanda(
  data: ComandaData,
  width: ComandaWidth = '80mm',
): Promise<ComandaPrintResult> {
  try {
    await Print.printAsync({ html: buildComandaHtml(data, width) });
    return 'printed';
  } catch (error) {
    console.error('Error imprimiendo la comanda:', error);
    return 'error';
  }
}
