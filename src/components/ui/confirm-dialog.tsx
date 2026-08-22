import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Brand, Elevation, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveConfirmDialog, type ConfirmDialogVariant } from '@/utils/confirm-dialog';

/**
 * ConfirmDialog — modal universal de confirmación Material Design 3 +
 * Liquid Glass para acciones críticas (eliminar orden/técnico, etc.).
 *
 * - Scrim translúcido presionable → onCancel (deshabilitado mientras loading).
 * - Web: desenfoque de fondo (backdrop-filter: blur(8px)); nativo degrada a
 *   scrim sólido (degradación Liquid Glass de AGENTS.md §3).
 * - Botones ≥ TouchTarget.min (44px) vía <Button/>; variante 'danger' usa
 *   Brand.danger; loading muestra ActivityIndicator y deshabilita ambas.
 *
 * Lógica de defaults testeable en `src/utils/confirm-dialog.ts` (node --test).
 */

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Blur web-only (idiom del repo: cast estructural como en button.tsx). */
const webBackdropStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as unknown as ViewStyle)
    : null;

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const resolved = resolveConfirmDialog({ variant, confirmLabel, cancelLabel, loading });
  const accent = resolved.danger ? Brand.danger : Brand.primary;
  const icon: keyof typeof Ionicons.glyphMap = resolved.danger
    ? 'alert-circle-outline'
    : 'help-circle-outline';

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!resolved.disabled) onCancel();
      }}>
      <Pressable
        testID="confirm-scrim"
        accessibilityRole="button"
        accessibilityLabel="Cerrar diálogo"
        disabled={resolved.disabled}
        onPress={onCancel}
        style={[styles.scrim, webBackdropStyle]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceContainerHigh,
              borderColor: theme.border,
            },
            Elevation.level3,
          ]}>
          {/* Badge semántico */}
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Ionicons name={icon} size={22} color="#ffffff" />
          </View>

          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {message}
          </ThemedText>

          <View style={styles.actions}>
            <Button
              label={resolved.cancelLabel}
              variant="secondary"
              onPress={onCancel}
              disabled={resolved.disabled}
              testID="cancel-button"
              style={styles.actionBtn}
            />
            <View style={styles.confirmWrap}>
              <Button
                label={resolved.confirmLabel}
                variant={resolved.danger ? 'danger' : 'primary'}
                onPress={onConfirm}
                disabled={resolved.disabled}
                testID="confirm-button"
                style={styles.actionBtn}
              />
              {loading ? (
                <View pointerEvents="none" style={styles.loadingOverlay} testID="confirm-loading">
                  <ActivityIndicator color="#ffffff" />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Shape.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.one,
  },
  actionBtn: {
    minHeight: TouchTarget.min,
    flex: 1,
  },
  confirmWrap: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
