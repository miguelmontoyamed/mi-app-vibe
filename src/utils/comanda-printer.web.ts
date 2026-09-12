/**
 * Impresión de comandas en WEB.
 *
 * `expo-print` en web solo llama a `window.print()` sin formato térmico, así
 * que aquí se inyecta la plantilla HTML de la etiqueta en un iframe oculto
 * (documento limpio: no hereda estilos de la app) y se dispara la impresión
 * del navegador, donde el usuario elige su impresora térmica o de etiquetas.
 * El iframe evita los bloqueadores de ventanas emergentes de los POS.
 *
 * El módulo NO importa `theme.ts` (arrastraría `global.css` + react-native y
 * rompería el test en Node). Debe llamarse desde un gesto del usuario.
 */

import { buildComandaHtml } from './comanda-template.ts';
import type { ComandaData, ComandaPrintResult, ComandaWidth } from './comanda-printer-types.ts';

/**
 * Inyecta la comanda en un iframe oculto e imprime desde el navegador.
 *
 * @param data Datos de la etiqueta (taller, orden, cliente, equipo).
 * @param width Ancho del papel: '80mm' (defecto) o '58mm'.
 * @returns 'printed' si se disparó, 'blocked' si el navegador lo impidió,
 *          'unavailable' sin DOM, 'error' en fallo.
 */
export async function printComanda(
  data: ComandaData,
  width: ComandaWidth = '80mm',
): Promise<ComandaPrintResult> {
  try {
    if (typeof window === 'undefined' || !window.document?.body) {
      return 'unavailable';
    }
    const frame = window.document.createElement('iframe');
    frame.setAttribute('title', `Comanda ${data.orderId}`);
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    window.document.body.appendChild(frame);
    const frameDoc = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDoc || !frameWindow) {
      frame.remove();
      return 'blocked';
    }
    frameDoc.open();
    frameDoc.write(buildComandaHtml(data, width));
    frameDoc.close();
    let cleaned = false;
    const cleanup = () => {
      if (!cleaned) {
        cleaned = true;
        frame.remove();
      }
    };
    // Retirar el iframe solo cuando el diálogo se cierra o imprime (nunca por
    // timeout corto: el operario puede tardar y la térmica recibir el spool).
    frameWindow.onafterprint = cleanup;
    const doPrint = () => {
      frameWindow.focus();
      frameWindow.print();
    };
    // Imprimir únicamente con el DOM del iframe ya renderizado (evita hojas
    // en blanco en WebKit/Safari).
    if (frameDoc.readyState === 'complete') {
      doPrint();
    } else {
      frameWindow.addEventListener('load', () => doPrint(), { once: true });
    }
    // Rescate amplio por si el evento no dispara (pestaña cerrada, etc.).
    window.setTimeout(cleanup, 60000);
    return 'printed';
  } catch (error) {
    console.error('Error imprimiendo la comanda:', error);
    return 'error';
  }
}
