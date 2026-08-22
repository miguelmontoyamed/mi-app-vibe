/**
 * Lógica pura del ConfirmDialog MD3 (sin React/RN) para poder testearla con
 * `node --test`. La vista (`confirm-dialog.tsx`) solo la consume.
 */

export type ConfirmDialogVariant = 'danger' | 'primary';

export interface ConfirmDialogOptions {
  variant?: ConfirmDialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true mientras corre la acción: deshabilita ambas acciones. */
  loading?: boolean;
}

export interface ResolvedConfirmDialog {
  confirmLabel: string;
  cancelLabel: string;
  /** true cuando la acción es destructiva → botón con Brand.danger. */
  danger: boolean;
  /** true si las acciones deben estar deshabilitadas. */
  disabled: boolean;
}

/** Etiquetas por defecto exigidas por la especificación MD3. */
export const DEFAULT_CONFIRM_LABEL = 'Confirmar';
export const DEFAULT_CANCEL_LABEL = 'Cancelar';

/**
 * Resuelve textos y estado del diálogo aplicando defaults:
 *   confirmLabel 'Confirmar', cancelLabel 'Cancelar', variante 'primary'
 *   y disabled solo mientras `loading` sea true.
 */
export function resolveConfirmDialog(options: ConfirmDialogOptions = {}): ResolvedConfirmDialog {
  return {
    confirmLabel: options.confirmLabel ?? DEFAULT_CONFIRM_LABEL,
    cancelLabel: options.cancelLabel ?? DEFAULT_CANCEL_LABEL,
    danger: options.variant === 'danger',
    disabled: options.loading === true,
  };
}
