import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Elevation, Glass, Shape, Spacing, TouchTarget } from '@/constants/theme';
import type { InventoryPart } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/utils/format';
import { matchInventoryPart, searchInventoryParts } from '@/utils/part-search';

export interface PartAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  inventory: readonly InventoryPart[];
  onSelectPart: (part: InventoryPart) => void;
  placeholder?: string;
  maxLength?: number;
}

export function PartAutocompleteInput({
  label = 'Repuesto / Pieza Requerida (opcional)',
  value,
  onChangeText,
  inventory,
  onSelectPart,
  placeholder = 'Ej. Pantalla OLED iPhone 11, Batería...',
  maxLength = 100,
}: PartAutocompleteInputProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [isFocused, setIsFocused] = useState(false);

  // Sugerencias filtradas en tiempo real
  const suggestions = searchInventoryParts(inventory, value, 6);
  // Verificación si el texto actual coincide con un repuesto del inventario
  const matchedPart = matchInventoryPart(inventory, value);

  const handleSelect = (part: InventoryPart) => {
    onSelectPart(part);
    onChangeText(part.name);
    setIsFocused(false);
  };

  const handleClear = () => {
    onChangeText('');
  };

  const isGlass = Platform.OS === 'web';
  const glassStyle = isGlass ? Glass[scheme] : null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {value.trim().length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
            <ThemedText style={styles.clearBtnText}>Limpiar</ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: isFocused ? Brand.primary : theme.border,
              backgroundColor: theme.background,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Retardo breve para permitir que el toque en la sugerencia se registre antes de cerrar
            setTimeout(() => setIsFocused(false), 200);
          }}
          maxLength={maxLength}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {/* Menú de sugerencias desplegable */}
      {isFocused && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: glassStyle?.background || theme.backgroundElement,
              borderColor: glassStyle?.border || theme.border,
            },
            Elevation.level2,
          ]}>
          <View style={styles.dropdownHeader}>
            <ThemedText style={styles.dropdownHeaderText}>
              📦 Repuestos encontrados en inventario ({suggestions.length}):
            </ThemedText>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="always"
            style={styles.dropdownScroll}
            nestedScrollEnabled>
            {suggestions.map((item) => {
              const hasStock = item.stock > 0;
              const isLowStock = item.stock > 0 && item.stock <= 2;

              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    { borderBottomColor: theme.border },
                    pressed && styles.suggestionPressed,
                  ]}
                  onPress={() => handleSelect(item)}>
                  <View style={styles.suggestionInfo}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.category ? `${item.category} · ` : ''}
                      <ThemedText
                        style={[
                          styles.stockBadge,
                          !hasStock
                            ? styles.stockEmpty
                            : isLowStock
                            ? styles.stockLow
                            : styles.stockOk,
                        ]}>
                        Stock: {item.stock}
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <View style={styles.suggestionPrice}>
                    <ThemedText style={styles.priceText}>{formatCOP(item.price)}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Indicador de estado de coincidencia */}
      {value.trim().length > 0 && !isFocused && (
        <View style={styles.statusFooter}>
          {matchedPart ? (
            <View style={[styles.statusChip, styles.statusChipInventory]}>
              <ThemedText style={styles.statusChipTextInventory}>
                📦 En inventario · Stock: {matchedPart.stock} · Valor sugerido: {formatCOP(matchedPart.price)}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.statusChip, styles.statusChipManual]}>
              <ThemedText style={styles.statusChipTextManual}>
                ✍️ Repuesto manual (no afecta inventario del taller)
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    position: 'relative',
    zIndex: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  clearBtnText: {
    fontSize: 12,
    color: Brand.primary,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: Shape.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: TouchTarget.min,
  },
  dropdown: {
    position: 'relative',
    marginTop: Spacing.one,
    borderWidth: 1,
    borderRadius: Shape.md,
    maxHeight: 220,
    overflow: 'hidden',
    zIndex: 50,
  },
  dropdownHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.primary,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  suggestionPressed: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  suggestionInfo: {
    flex: 1,
    gap: 2,
  },
  suggestionPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },
  stockBadge: {
    fontWeight: '600',
    fontSize: 12,
  },
  stockOk: {
    color: Brand.success,
  },
  stockLow: {
    color: Brand.warning,
  },
  stockEmpty: {
    color: Brand.danger,
  },
  statusFooter: {
    marginTop: Spacing.half,
  },
  statusChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Shape.sm,
    alignSelf: 'flex-start',
  },
  statusChipInventory: {
    backgroundColor: '#dcfce7',
  },
  statusChipTextInventory: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
  },
  statusChipManual: {
    backgroundColor: '#f1f5f9',
  },
  statusChipTextManual: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
