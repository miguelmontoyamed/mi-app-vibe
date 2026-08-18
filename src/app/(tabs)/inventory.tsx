import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BREAKPOINTS, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useRepair } from '@/context/repair-context';
import { formatCOP } from '@/utils/format';

const MAX_LENGTHS = {
  name: 80,
  category: 40,
  stock: 6,
  price: 10,
} as const;

const STOCK_REGEX = /^\d+$/;
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

function notify(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('Aviso', message);
  }
}

export default function InventoryScreen() {
  const { inventory, addInventoryPart, updateInventoryStock } = useRepair();
  const { currentUser } = useAuth();
  // RBAC: el inventario es de solo lectura para el técnico (crear/ajustar = admin).
  const isAdmin = currentUser?.role === 'admin';
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.mobile;

  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPart = async () => {
    if (!name.trim() || !category.trim() || !stock.trim() || !price.trim()) {
      notify('Complete todos los campos de la pieza.');
      return;
    }

    if (!STOCK_REGEX.test(stock.trim())) {
      notify('Ingrese un stock válido (número entero, ej. 5).');
      return;
    }
    if (!MONEY_REGEX.test(price.trim())) {
      notify('Ingrese un precio válido (ej. 25.50).');
      return;
    }

    const stockNum = parseInt(stock, 10);
    const priceNum = parseFloat(price);

    if (stockNum < 0 || priceNum < 0) {
      notify('Ingrese valores válidos para stock y precio.');
      return;
    }

    await addInventoryPart({
      name: name.trim(),
      category: category.trim(),
      stock: stockNum,
      price: priceNum,
    });

    notify('Pieza agregada al inventario.');

    setName('');
    setCategory('');
    setStock('');
    setPrice('');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Inventario de Repuestos
        </ThemedText>
        <ThemedText themeColor="textSecondary">Control de piezas, stock y precios</ThemedText>
      </View>

      {/* Tablet+: form left (40%), search + list right (60%). Mobile: stacked. */}
      <View style={[styles.mainRow, isTablet && styles.mainRowTablet]}>
        {/* Add Part Form — solo el dueño (admin) puede crear piezas. */}
        {isAdmin && (
        <ThemedView
          type="backgroundElement"
          style={[styles.formCard, isTablet && styles.formCardTablet]}>
          <ThemedText type="subtitle" style={styles.formTitle}>
            Registrar Nueva Pieza
          </ThemedText>
          <View style={styles.formRow}>
            <View style={styles.formRowGrow}>
              <FormInput
                label="Nombre"
                required
                placeholder="Ej. Pantalla OLED"
                value={name}
                onChangeText={setName}
                maxLength={MAX_LENGTHS.name}
              />
            </View>
            <View style={styles.formRowShrink}>
              <FormInput
                label="Categoría"
                required
                placeholder="Ej. Pantallas"
                value={category}
                onChangeText={setCategory}
                maxLength={MAX_LENGTHS.category}
              />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formRowShrink}>
              <FormInput
                label="Stock"
                required
                placeholder="Ej. 5"
                keyboardType="numeric"
                value={stock}
                onChangeText={setStock}
                maxLength={MAX_LENGTHS.stock}
              />
            </View>
            <View style={styles.formRowShrink}>
              <FormInput
                label="Precio (COP)"
                required
                placeholder="Ej. 340000"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                maxLength={MAX_LENGTHS.price}
              />
            </View>
            <Button label="+ Agregar" onPress={handleAddPart} style={styles.addButton} />
          </View>
        </ThemedView>
        )}

        <View style={[styles.listColumn, isTablet && styles.listColumnTablet]}>
          {/* Search Bar */}
          <FormInput
            label="Buscar repuesto"
            placeholder="Buscar por nombre o categoría..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />

          {/* Inventory List */}
          <View style={styles.listContainer}>
            {filteredInventory.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  No se encontraron repuestos en el inventario.
                </ThemedText>
              </ThemedView>
            ) : (
              filteredInventory.map((item) => (
                <ThemedView key={item.id} type="backgroundElement" style={styles.partCard}>
                  <View style={styles.partInfo}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Categoría: {item.category} | Precio: {formatCOP(item.price)}
                    </ThemedText>
                  </View>

                  <View style={styles.stockControl}>
                    <ThemedText
                      type="smallBold"
                      style={[styles.stockText, item.stock <= 2 && { color: Brand.danger }]}>
                      Stock: {item.stock}
                    </ThemedText>
                    {/* Ajuste de stock: solo el dueño (admin); el técnico solo consulta. */}
                    {isAdmin && (
                    <View style={styles.stockButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.stockBtn, pressed && styles.pressed]}
                        onPress={() => void updateInventoryStock(item.id, -1)}>
                        <ThemedText style={styles.stockBtnText}>−</ThemedText>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.stockBtn, pressed && styles.pressed]}
                        onPress={() => void updateInventoryStock(item.id, 1)}>
                        <ThemedText style={styles.stockBtnText}>+</ThemedText>
                      </Pressable>
                    </View>
                    )}
                  </View>
                </ThemedView>
              ))
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  mainRow: {
    gap: Spacing.four,
  },
  mainRowTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  formCardTablet: {
    width: '40%',
  },
  listColumn: {
    gap: Spacing.four,
  },
  listColumnTablet: {
    flex: 1,
  },
  formTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  formRowGrow: {
    flex: 2,
  },
  formRowShrink: {
    flex: 1,
  },
  addButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    minWidth: 104,
  },
  searchInput: {
    paddingVertical: Spacing.two,
  },
  listContainer: {
    gap: Spacing.three,
  },
  emptyContainer: {
    padding: Spacing.six,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  partCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partInfo: {
    flex: 1,
    gap: 2,
  },
  stockControl: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  stockText: {
    fontSize: 14,
  },
  stockButtons: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  stockBtn: {
    backgroundColor: Brand.secondary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockBtnText: {
    color: Brand.onBrand,
    fontWeight: 'bold',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
