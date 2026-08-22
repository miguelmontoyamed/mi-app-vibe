import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_CANCEL_LABEL,
  DEFAULT_CONFIRM_LABEL,
  resolveConfirmDialog,
} from '../../../utils/confirm-dialog.ts';

describe('resolveConfirmDialog — defaults MD3', () => {
  it('sin opciones: Confirmar / Cancelar, variante primary, habilitado', () => {
    assert.deepEqual(resolveConfirmDialog(), {
      confirmLabel: DEFAULT_CONFIRM_LABEL,
      cancelLabel: DEFAULT_CANCEL_LABEL,
      danger: false,
      disabled: false,
    });
    assert.equal(DEFAULT_CONFIRM_LABEL, 'Confirmar');
    assert.equal(DEFAULT_CANCEL_LABEL, 'Cancelar');
  });
});

describe('resolveConfirmDialog — textos personalizados', () => {
  it('override de ambas etiquetas', () => {
    const r = resolveConfirmDialog({ confirmLabel: 'Sí, eliminar', cancelLabel: 'Conservar' });
    assert.equal(r.confirmLabel, 'Sí, eliminar');
    assert.equal(r.cancelLabel, 'Conservar');
    assert.equal(r.danger, false);
  });
  it('override parcial: cancel por defecto se conserva', () => {
    const r = resolveConfirmDialog({ confirmLabel: 'Eliminar' });
    assert.equal(r.confirmLabel, 'Eliminar');
    assert.equal(r.cancelLabel, 'Cancelar');
  });
});

describe('resolveConfirmDialog — variante semántica', () => {
  it('danger marca la acción como destructiva', () => {
    assert.equal(resolveConfirmDialog({ variant: 'danger' }).danger, true);
  });
  it('primary NO es destructiva', () => {
    assert.equal(resolveConfirmDialog({ variant: 'primary' }).danger, false);
  });
});

describe('resolveConfirmDialog — estado loading', () => {
  it('loading true deshabilita las acciones', () => {
    assert.equal(resolveConfirmDialog({ loading: true }).disabled, true);
  });
  it('loading false/ausente mantiene habilitado', () => {
    assert.equal(resolveConfirmDialog({ loading: false }).disabled, false);
    assert.equal(resolveConfirmDialog({}).disabled, false);
  });
  it('combinación completa: danger + loading + textos', () => {
    assert.deepEqual(
      resolveConfirmDialog({
        variant: 'danger',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        loading: true,
      }),
      { confirmLabel: 'Eliminar', cancelLabel: 'Cancelar', danger: true, disabled: true }
    );
  });
});
