import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { PartAutocompleteInput } from '../part-autocomplete-input';
import type { InventoryPart } from '@/context/repair-context';

const MOCK_INVENTORY: InventoryPart[] = [
  { id: '1', name: 'Pantalla OLED iPhone 11', category: 'Pantallas', stock: 5, price: 180000 },
  { id: '2', name: 'Batería Original Samsung S21', category: 'Baterías', stock: 1, price: 95000 },
];

describe('<PartAutocompleteInput />', () => {
  const onChangeText = jest.fn();
  const onSelectPart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza el label por defecto y el placeholder', () => {
    render(
      <PartAutocompleteInput
        value=""
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );
    expect(screen.getByText('Repuesto / Pieza Requerida (opcional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ej. Pantalla OLED iPhone 11, Batería...')).toBeTruthy();
  });

  it('muestra chip de repuesto manual cuando el texto no coincide con el inventario', () => {
    render(
      <PartAutocompleteInput
        value="Pin de carga especial"
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );
    expect(screen.getByText(/Repuesto manual/i)).toBeTruthy();
  });

  it('muestra chip de coincidencia de inventario cuando el texto coincide exactamente', () => {
    render(
      <PartAutocompleteInput
        value="Pantalla OLED iPhone 11"
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );
    expect(screen.getByText(/En inventario · Stock: 5/i)).toBeTruthy();
  });

  it('muestra lista de sugerencias al enfocar con texto coincidente', () => {
    render(
      <PartAutocompleteInput
        value="pantalla"
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );

    const input = screen.getByPlaceholderText('Ej. Pantalla OLED iPhone 11, Batería...');
    fireEvent(input, 'focus');

    expect(screen.getByText(/Repuestos encontrados en inventario/i)).toBeTruthy();
    expect(screen.getByText('Pantalla OLED iPhone 11')).toBeTruthy();
  });

  it('dispara onSelectPart al seleccionar una sugerencia del inventario', () => {
    render(
      <PartAutocompleteInput
        value="bateria"
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );

    const input = screen.getByPlaceholderText('Ej. Pantalla OLED iPhone 11, Batería...');
    fireEvent(input, 'focus');

    const suggestion = screen.getByText('Batería Original Samsung S21');
    fireEvent.press(suggestion);

    expect(onSelectPart).toHaveBeenCalledWith(MOCK_INVENTORY[1]);
    expect(onChangeText).toHaveBeenCalledWith('Batería Original Samsung S21');
  });

  it('permite limpiar el texto pulsando el botón Limpiar', () => {
    render(
      <PartAutocompleteInput
        value="Texto para borrar"
        onChangeText={onChangeText}
        inventory={MOCK_INVENTORY}
        onSelectPart={onSelectPart}
      />
    );

    const clearBtn = screen.getByText('Limpiar');
    fireEvent.press(clearBtn);

    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
