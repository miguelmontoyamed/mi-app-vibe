import { useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { ThemedText } from '@/components/themed-text';
import { Shape, Spacing, tokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  buildPatternValue,
  buildPinValue,
  parseDeviceSecurity,
  parsePatternSequence,
  patternNodeCenters,
  patternSegments,
} from '@/utils/device-security';

/**
 * DeviceSecurityInput — selector interactivo de seguridad del dispositivo
 * para la recepción de equipos (Material Design 3 + Liquid Glass sutil).
 *
 * Tres modos (chips):
 *   - 'none'    → sin clave.
 *   - 'pin'     → PIN numérico o contraseña alfanumérica (prefijo automático:
 *                 solo dígitos → 'PIN: x'; con letras → 'Contraseña: x').
 *   - 'pattern' → cuadrícula táctil 3x3: tocar nodo por nodo O ARRASTRAR el
 *                 trazo (responder con captura en el grid; funciona con mouse
 *                 en web); nodos de 44px accesibles y botón "Limpiar trazo".
 *                 Resultado tipo 'Patrón: 1-2-5-8-9'.
 *
 * El valor emitido via `onChange` usa los prefijos históricos y se guarda en
 * `repairs.unlock_code` (columna existente; sin migración ni cambios de RLS).
 *
 * Componente NO CONTROLADO: lee `defaultValue` UNA sola vez. Para resetearlo
 * tras guardar, remóntalo desde el padre cambiando su `key` (idiom React) —
 * así evitamos setState síncrono en efectos (regla react-hooks).
 *
 * Nota de implementación: el trazo usa la Responder API del contenedor con
 * `onStartShouldSetResponderCapture` (tap y arrastre unificados vía
 * locationX/Y) — cero refs en render (regla react-hooks/refs).
 */

type SecurityMode = 'none' | 'pin' | 'pattern';

const MODE_OPTIONS: readonly { mode: SecurityMode; label: string }[] = [
  { mode: 'none', label: 'Ninguna' },
  { mode: 'pin', label: 'PIN / Contraseña' },
  { mode: 'pattern', label: 'Patrón' },
];

/** Diámetro visual/táctil de cada nodo del patrón (≥44px requerido). */
const NODE_HIT = 44;

/** Radio efectivo de captura del dedo alrededor del centro de un nodo. */
const NODE_CAPTURE_RADIUS = NODE_HIT / 2 + 8;

/** Lado máximo de la cuadrícula (en formularios anchos no crece al infinito). */
const MAX_GRID_SIDE = 260;

export function DeviceSecurityInput({
  defaultValue = '',
  onChange,
}: {
  /** Valor inicial completo (ej. 'PIN: 1234' / 'Patrón: 1-2-5-8-9' / ''). */
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const theme = useTheme();
  const initial = parseDeviceSecurity(defaultValue);
  const [mode, setMode] = useState<SecurityMode>(
    initial.kind === 'pattern' ? 'pattern' : initial.kind === 'none' ? 'none' : 'pin'
  );
  const [pinText, setPinText] = useState(
    initial.kind === 'pin' || initial.kind === 'password' ? initial.payload : ''
  );
  const [sequence, setSequence] = useState<number[]>(
    initial.kind === 'pattern' ? parsePatternSequence(initial.payload) : []
  );

  // Ancho medido del bloque del patrón → lado cuadrado real de la cuadrícula.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const side = Math.min(measuredWidth || 216, MAX_GRID_SIDE);

  const addNode = (node: number) => {
    setSequence((prev) => {
      if (prev.includes(node)) {
        return prev;
      }
      const next = [...prev, node];
      onChange?.(buildPatternValue(next));
      return next;
    });
  };

  const clearPattern = () => {
    setSequence([]);
    onChange?.('');
  };

  /** Hit-test del trazo: agrega todos los nodos bajo el puntero (coords grid). */
  const hitTestGrid = (x: number, y: number) => {
    if (side <= 0) return;
    const centers = patternNodeCenters(side);
    // Sin break: un arrastre rápido puede cruzar varios nodos por evento.
    for (let i = 0; i < centers.length; i += 1) {
      const d = Math.hypot(x - centers[i].x, y - centers[i].y);
      if (d <= NODE_CAPTURE_RADIUS) {
        addNode(i + 1);
      }
    }
  };

  const handleGridGrant = (e: GestureResponderEvent) => {
    hitTestGrid(e.nativeEvent.locationX, e.nativeEvent.locationY);
  };
  const handleGridMove = (e: GestureResponderEvent) => {
    hitTestGrid(e.nativeEvent.locationX, e.nativeEvent.locationY);
  };

  const selectMode = (next: SecurityMode) => {
    setMode(next);
    if (next === 'none') {
      setPinText('');
      setSequence([]);
      onChange?.('');
      return;
    }
    if (next === 'pin') {
      setSequence([]);
      onChange?.(buildPinValue(pinText));
      return;
    }
    // pattern: el valor pasa a ser el del trazo actual (vacío si no hay).
    onChange?.(buildPatternValue(sequence));
  };

  const renderPatternGrid = () => (
    <View style={styles.patternBlock}>
      <View
        style={styles.gridMeasure}
        onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}>
        <View
          onStartShouldSetResponderCapture={() => true}
          onResponderGrant={handleGridGrant}
          onResponderMove={handleGridMove}
          style={[styles.grid, { width: side, height: side, borderColor: theme.border, backgroundColor: theme.surfaceContainerHigh }]}>
          {patternSegments(sequence, side).map((seg, i) => {
            const dx = seg.to.x - seg.from.x;
            const dy = seg.to.y - seg.from.y;
            const length = Math.hypot(dx, dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <View
                key={`line-${i}`}
                pointerEvents="none"
                style={[
                  styles.line,
                  {
                    left: (seg.from.x + seg.to.x) / 2 - length / 2,
                    top: (seg.from.y + seg.to.y) / 2 - styles.line.height / 2,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
          {patternNodeCenters(side).map((center, i) => {
            const active = sequence.includes(i + 1);
            return (
              <View
                key={i}
                pointerEvents="none"
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Nodo ${i + 1}${active ? ' seleccionado' : ''}`}
                onAccessibilityTap={() => addNode(i + 1)}
                style={[
                  styles.node,
                  { left: center.x - NODE_HIT / 2, top: center.y - NODE_HIT / 2 },
                  active && styles.nodeActive,
                ]}>
                {active ? (
                  <View style={styles.nodeDotActive} />
                ) : (
                  <Text style={[styles.nodeNumber, { color: theme.textSecondary }]}>{i + 1}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <Button
        label="🧹 Limpiar trazo"
        variant="secondary"
        onPress={clearPattern}
        style={styles.clearBtn}
      />
    </View>
  );

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Código / Desbloqueo</ThemedText>

      {/* Selector de modo (chips MD3) */}
      <View style={styles.chipsRow}>
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.mode;
          return (
            <TouchableOpacity
              key={option.mode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Modo de seguridad: ${option.label}`}
              onPress={() => selectMode(option.mode)}
              style={[styles.chip, { backgroundColor: theme.surfaceContainerHigh }, selected && styles.chipSelected]}>
              <Text
                style={[
                  styles.chipText,
                  { color: theme.textSecondary },
                  selected && styles.chipTextSelected,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'pin' ? (
        <FormInput
          label="PIN o Contraseña del equipo"
          placeholder="Ej. 1234 o miClave2026"
          value={pinText}
          onChangeText={(text) => {
            setPinText(text);
            onChange?.(buildPinValue(text));
          }}
          maxLength={20}
          autoCapitalize="none"
        />
      ) : null}

      {mode === 'pattern' ? renderPatternGrid() : null}

      {mode === 'none' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Sin clave registrada. El equipo se entregará sin restricción de desbloqueo.
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * PatternPreview — vista previa compacta y SOLO LECTURA de un patrón 3x3
 * (detalle de la orden): nodos marcados + líneas del trazo, sin interacción.
 */
export function PatternPreview({
  sequence,
  size = 84,
}: {
  sequence: readonly number[];
  size?: number;
}) {
  const theme = useTheme();
  const nodeDiameter = Math.max(10, Math.round(size / 6));
  return (
    <View
      style={[
        styles.previewGrid,
        { width: size, height: size, borderColor: theme.border, backgroundColor: theme.surfaceContainerHigh },
      ]}>
      {patternSegments(sequence, size).map((seg, i) => {
        const dx = seg.to.x - seg.from.x;
        const dy = seg.to.y - seg.from.y;
        const length = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`p-${i}`}
            pointerEvents="none"
            style={[
              styles.line,
              styles.previewLine,
              {
                left: (seg.from.x + seg.to.x) / 2 - length / 2,
                top: (seg.from.y + seg.to.y) / 2 - styles.line.height / 2,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
      {patternNodeCenters(size).map((center, i) => {
        const active = sequence.includes(i + 1);
        return (
          <View
            key={`pn-${i}`}
            style={[
              styles.previewNode,
              { borderColor: theme.border },
              {
                left: center.x - nodeDiameter / 2,
                top: center.y - nodeDiameter / 2,
                width: nodeDiameter,
                height: nodeDiameter,
                borderRadius: nodeDiameter / 2,
              },
              active && styles.previewNodeActive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.sm,
    borderRadius: Shape.full,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary.default,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  patternBlock: {
    gap: Spacing.two,
  },
  gridMeasure: {
    width: '100%',
    alignItems: 'flex-start',
  },
  grid: {
    // Ancla los nodos/líneas absolutos al cuadrado (crítico en web).
    position: 'relative',
    borderRadius: Shape.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    width: NODE_HIT,
    height: NODE_HIT,
    borderRadius: NODE_HIT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.primary.default,
    backgroundColor: 'transparent',
  },
  nodeActive: {
    borderColor: 'transparent',
    backgroundColor: tokens.colors.primary.default,
  },
  nodeDotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
  },
  nodeNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  line: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.primary.default,
  },
  clearBtn: {
    alignSelf: 'flex-start',
  },
  previewGrid: {
    // Contexto de posicionamiento: en web los hijos `absolute` se anclan al
    // ancestro posicionado más cercano; sin esto se escapan al documento.
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Shape.md,
    borderWidth: 1,
  },
  previewLine: {
    height: 2,
    opacity: 0.9,
  },
  previewNode: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  previewNodeActive: {
    backgroundColor: tokens.colors.primary.default,
    borderColor: 'transparent',
  },
});
