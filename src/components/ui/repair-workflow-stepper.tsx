import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Shape, Spacing, tokens } from '@/constants/theme';
import type { RepairStatus } from '@/context/repair-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * RepairWorkflowStepper — diagrama visual interactivo del flujo de trabajo
 * de una orden (Material Design 3 + Liquid Glass sutil).
 *
 * Estados reales del sistema (fuente: `repair-logic.ts` + constraint SQL):
 *   Pendiente → En Proceso → Listo → Entregado, con rama especial
 *   'Cancelado / No Reparado' acentuada en error.
 *
 * Interacción: con `canEdit`, tocar una etapa POSTERIOR a la actual avanza la
 * orden (`onSelectStatus`). Las etapas pasadas y la actual no son tocables y
 * los estados terminales ('Entregado', cancelado) deshabilitan todo el paso.
 *
 * Accesibilidad: nodos circulares de 40px (≥36 requerido), role="button",
 * etiquetas de accesibilidad en español y activeOpacity 0.7.
 */

type IconName = keyof typeof Ionicons.glyphMap;

const WORKFLOW_STEPS: readonly { status: RepairStatus; icon: IconName; accent: string }[] = [
  { status: 'Pendiente', icon: 'hourglass-outline', accent: tokens.colors.status.pending },
  { status: 'En Proceso', icon: 'construct-outline', accent: tokens.colors.status.inProgress },
  { status: 'Listo', icon: 'checkmark-circle-outline', accent: tokens.colors.status.ready },
  { status: 'Entregado', icon: 'checkmark-done-outline', accent: tokens.colors.status.delivered },
];

const CANCEL_STATUS: RepairStatus = 'Cancelado / No Reparado';
const NODE_SIZE = 40;

type StepState = 'done' | 'active' | 'future';

type StepperProps = {
  /** Estado actual de la orden (fuente de verdad del modelo). */
  status: RepairStatus;
  /** true si el usuario puede avanzar la orden (dueño o técnico asignado). */
  canEdit?: boolean;
  /** Se llama con la etapa elegida SOLO si es posterior a la actual. */
  onSelectStatus?: (next: RepairStatus) => void;
};

export function RepairWorkflowStepper({ status, canEdit = false, onSelectStatus }: StepperProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const isCancelled = status === CANCEL_STATUS;
  const activeIndex = WORKFLOW_STEPS.findIndex((s) => s.status === status);
  // Estados terminales ('Entregado' o cancelado) no permiten avanzar.
  const interactive = canEdit && !isCancelled && activeIndex >= 0 && activeIndex < WORKFLOW_STEPS.length - 1;

  const futureBg = isDark ? '#243244' : '#f1f5f9'; // surfaceContainerHigh del tema
  const futureFg = isDark ? tokens.colors.text.secondaryDark : tokens.colors.text.secondaryLight;
  const mutedLine = isDark ? tokens.colors.border.dark : tokens.colors.border.light;

  const renderNode = (
    step: (typeof WORKFLOW_STEPS)[number],
    index: number,
    state: StepState,
    extra?: { isCancelNode?: boolean }
  ) => {
    const tappable = interactive && state === 'future' && typeof onSelectStatus === 'function';
    const accent = extra?.isCancelNode ? tokens.colors.status.error : step.accent;

    return (
      <View style={styles.stepColumn} key={`${step.status}-${index}`}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!tappable}
          accessibilityRole={tappable ? 'button' : 'image'}
          accessibilityLabel={
            tappable
              ? `Avanzar orden a la etapa ${step.status}`
              : `Etapa ${step.status}${state === 'active' ? ' (actual)' : ''}`
          }
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() => onSelectStatus?.(step.status)}
          style={[
            styles.node,
            state === 'done' || state === 'active' ? { backgroundColor: accent } : null,
            extra?.isCancelNode ? { backgroundColor: tokens.colors.status.error } : null,
            state === 'future' && !extra?.isCancelNode ? { backgroundColor: futureBg } : null,
          ]}>
          <Ionicons
            name={extra?.isCancelNode ? 'close-circle-outline' : state === 'done' ? 'checkmark' : step.icon}
            size={20}
            color={state === 'future' && !extra?.isCancelNode ? futureFg : '#ffffff'}
          />
        </TouchableOpacity>
        <ThemedText
          type="smallBold"
          style={
            extra?.isCancelNode
              ? [styles.stepLabel, { color: tokens.colors.status.error }]
              : [
                  styles.stepLabel,
                  state === 'active' && { color: accent },
                  state === 'future' && styles.stepLabelMuted,
                ]
          }>
          {step.status}
        </ThemedText>
      </View>
    );
  };

  // ── Rama cancelada: pasos atenuados + nodo de error al final ──
  if (isCancelled) {
    const nodes = WORKFLOW_STEPS.map((step, i) => (
      <View style={styles.fragment} key={`c-${step.status}`}>
        {i > 0 ? <View style={[styles.connector, { backgroundColor: mutedLine }]} /> : null}
        <View style={styles.stepColumn}>
          <View style={[styles.node, styles.nodeMuted, { backgroundColor: futureBg }]}>
            <Ionicons name={step.icon} size={18} color={futureFg} />
          </View>
        </View>
      </View>
    ));
    return (
      <View style={styles.wrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {nodes}
          <View style={[styles.connector, { backgroundColor: tokens.colors.status.error }]} />
          {renderNode(
            { status: CANCEL_STATUS, icon: 'close-circle-outline', accent: tokens.colors.status.error },
            WORKFLOW_STEPS.length,
            'active',
            { isCancelNode: true }
          )}
        </ScrollView>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          Orden no realizada — flujo cerrado sin cobro de comisión.
        </ThemedText>
      </View>
    );
  }

  if (activeIndex < 0) {
    return null;
  }

  // ── Flujo normal ──
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {WORKFLOW_STEPS.map((step, i) => {
          const state: StepState = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'future';
          return (
            <View style={styles.fragment} key={step.status}>
              {i > 0 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        i <= activeIndex ? tokens.colors.status.success : mutedLine,
                    },
                  ]}
                />
              ) : null}
              {renderNode(step, i, state)}
            </View>
          );
        })}
      </ScrollView>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {interactive
          ? 'Toca una etapa posterior para actualizar el estado de la orden.'
          : 'Flujo completado.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: Spacing.xs,
  },
  row: {
    alignItems: 'flex-start',
    minWidth: '100%',
  },
  fragment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepColumn: {
    alignItems: 'center',
    width: 76,
    gap: Spacing.xs,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  nodeMuted: {
    opacity: 0.55,
    borderWidth: 1,
    borderRadius: Shape.full,
  },
  connector: {
    height: 3,
    borderRadius: Shape.full,
    marginTop: NODE_SIZE / 2 - 1.5,
    width: 30,
  },
  stepLabel: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  stepLabelMuted: {
    opacity: 0.65,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
  },
});
