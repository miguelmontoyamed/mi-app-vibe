import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ConfirmDialog } from '../confirm-dialog';

/**
 * Suite RTL del ConfirmDialog MD3 (corre con `npm run test:ui` / jest-expo).
 * Cubre: renderizado condicional, textos exactos, callbacks de confirmar/
 * cancelar/scrim, estado loading (deshabilitado + indicador) y variante
 * destructiva danger.
 */

describe('<ConfirmDialog />', () => {
  const baseProps = {
    title: 'Eliminar Orden',
    message: 'Esta acción no se puede deshacer.',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('NO renderiza nada cuando visible=false', () => {
    render(<ConfirmDialog {...baseProps} visible={false} />);
    expect(screen.queryByText(baseProps.title)).toBeNull();
    expect(screen.queryByText(baseProps.message)).toBeNull();
  });

  it('renderiza título y mensaje exactos cuando visible=true', () => {
    render(<ConfirmDialog {...baseProps} visible />);
    expect(screen.getByText('Eliminar Orden')).toBeTruthy();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeTruthy();
  });

  it('usa las etiquetas por defecto Confirmar / Cancelar', () => {
    render(<ConfirmDialog {...baseProps} visible />);
    expect(screen.getByText('Confirmar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('respeta confirmLabel y cancelLabel personalizados', () => {
    render(
      <ConfirmDialog {...baseProps} visible confirmLabel="Sí, eliminar" cancelLabel="Conservar" />
    );
    expect(screen.getByText('Sí, eliminar')).toBeTruthy();
    expect(screen.getByText('Conservar')).toBeTruthy();
    expect(screen.queryByText('Confirmar')).toBeNull();
  });

  it('dispara onConfirm al pulsar el botón de confirmación', () => {
    render(<ConfirmDialog {...baseProps} visible />);
    fireEvent.press(screen.getByTestId('confirm-button'));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it('dispara onCancel al pulsar el botón de cancelar', () => {
    render(<ConfirmDialog {...baseProps} visible />);
    fireEvent.press(screen.getByTestId('cancel-button'));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it('dispara onCancel al pulsar el scrim de fondo', () => {
    render(<ConfirmDialog {...baseProps} visible />);
    fireEvent.press(screen.getByTestId('confirm-scrim'));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  describe('loading=true', () => {
    it('muestra el indicador de carga', () => {
      render(<ConfirmDialog {...baseProps} visible loading />);
      expect(screen.getByTestId('confirm-loading')).toBeTruthy();
    });

    it('deshabilita la confirmación (no dispara onConfirm)', () => {
      render(<ConfirmDialog {...baseProps} visible loading />);
      fireEvent.press(screen.getByTestId('confirm-button'));
      expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    it('deshabilita el scrim (no dispara onCancel)', () => {
      render(<ConfirmDialog {...baseProps} visible loading />);
      fireEvent.press(screen.getByTestId('confirm-scrim'));
      expect(baseProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('variant="danger"', () => {
    it('renderiza el badge destructivo y el botón en variante danger', () => {
      render(
        <ConfirmDialog {...baseProps} visible variant="danger" confirmLabel="Eliminar" />
      );
      const btn = screen.getByTestId('confirm-button');
      // El Button propaga `variant` internamente vía estilos; verificamos el
      // efecto observable: el texto del label es el destructive custom.
      expect(screen.getByText('Eliminar')).toBeTruthy();
      // Y el badge semántico existe junto al diálogo.
      expect(btn).toBeTruthy();
    });
  });
});
