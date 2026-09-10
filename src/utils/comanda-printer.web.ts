/**
 * Impresión de comandas en WEB.
 *
 * `expo-print` en web solo llama a `window.print()` sin formato térmico, así
 * que aquí se abre una ventana emergente con la plantilla HTML de la etiqueta
 * (58/80mm vía `@page`) y se dispara la impresión del navegador, donde el
 * usuario elige su impresora térmica o de etiquetas.
 *
 * El módulo NO importa `theme.ts` (arrastraría `global.css` + react-native y
 * rompería el test en Node). Debe llamarse desde un gesto del usuario
 * (toque/clic) o el navegador bloqueará la ventana emergente.
 */

import { buildComandaHtml } from './comanda-template.ts';
import type { ComandaData, ComandaPrintResult, ComandaWidth } from './comanda-printer-types.ts';

/**
 * Abre la ventana de impresión del navegador con la comanda de la orden.
 *
 * @param data Datos de la etiqueta (taller, orden, cliente, equipo).
 * @param width Ancho del papel: '80mm' (defecto) o '58mm'.
 * @returns 'printed' si se abrió, 'blocked' si el navegador bloqueó la
 *          ventana, 'unavailable' sin `window`, 'error' en fallo.
 */
export async function printComanda(
  data: ComandaData,
  width: ComandaWidth = '80mm',
): Promise<ComandaPrintResult> {
  try {
    if (typeof window === 'undefined') {
      return 'unavailable';
    }
    const popup = window.open('', '_blank', 'width=360,height=640');
    if (!popup) {
      return 'blocked';
    }
    popup.document.write(buildComandaHtml(data, width));
    popup.document.close();
    popup.focus();
    popup.print();
    return 'printed';
  } catch (error) {
    console.error('Error imprimiendo la comanda:', error);
    return 'error';
  }
}
