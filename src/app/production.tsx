import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Shape, Spacing, tokens } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useBilling } from '@/context/billing-context';
import { useRepair } from '@/context/repair-context';
import { useTheme } from '@/hooks/use-theme';
import type { TechnicianMonthlyPerformance } from '@/types/billing';
import { formatCOP } from '@/utils/format';
import { buildPeriodOptions } from '@/utils/billing-performance';

export default function ProductionHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { currentPeriod, closures, fetchMonthlyPerformance } = useBilling();
  const { repairs } = useRepair();

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [myPerf, setMyPerf] = useState<TechnicianMonthlyPerformance | null>(null);
  const [loading, setLoading] = useState(false);

  // Period options exactly like admin screen
  const periodOptions = useMemo(
    () => buildPeriodOptions(currentPeriod, closures.map((c) => c.period), repairs),
    [currentPeriod, closures, repairs]
  );
  const effectivePeriod = selectedPeriod ?? currentPeriod ?? periodOptions[0]?.period ?? null;

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'technician') {
      router.replace('/(tabs)');
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (effectivePeriod && currentUser?.role === 'technician') {
      let cancelled = false;
      setLoading(true);
      fetchMonthlyPerformance(effectivePeriod).then((res) => {
        if (!cancelled) {
          if (res.ok) {
            const perf = res.data.find((p) => p.technicianId === currentUser.id);
            setMyPerf(perf || null);
          } else {
            setMyPerf(null);
          }
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [effectivePeriod, currentUser, fetchMonthlyPerformance, repairs]);

  if (!currentUser || currentUser.role !== 'technician') {
    return null;
  }

  const commissionRatePct = myPerf?.commissionRate ? Math.round(myPerf.commissionRate * 100) : 0;

  return (
    <Screen title="Historial de Producción" showBackButton>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Selecciona el mes</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Consulta tu rendimiento histórico.
        </ThemedText>

        {periodOptions.length > 0 ? (
          <View style={styles.periodRow}>
            {periodOptions.map((option) => {
              const isSelected = option.period === effectivePeriod;
              return (
                <Pressable
                  key={option.period}
                  onPress={() => setSelectedPeriod(option.period)}
                  style={({ pressed }) => [
                    styles.periodChip,
                    pressed && styles.pressed,
                    isSelected
                      ? { backgroundColor: Brand.primary }
                      : { backgroundColor: theme.surfaceContainerHigh },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={
                      isSelected
                        ? { color: Brand.onBrand }
                        : undefined
                    }>
                    {option.isCurrent ? `${option.label} (En Curso)` : option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic', marginTop: Spacing.two }}>
            Aún no hay historial de producción disponible.
          </ThemedText>
        )}

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

        {loading ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.statusText}>
            Cargando rendimiento...
          </ThemedText>
        ) : !myPerf || myPerf.deliveredCount === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.statusText}>
            No tienes órdenes entregadas en este mes.
          </ThemedText>
        ) : (
          <View style={styles.resultsContainer}>
            <View style={styles.headerBox}>
              <ThemedText type="title" style={{ color: Brand.primary }}>
                {myPerf.deliveredCount}
              </ThemedText>
              <ThemedText type="smallBold">Equipos Entregados</ThemedText>
            </View>

            <View style={[styles.metricBox, { backgroundColor: theme.surfaceContainerHigh }]}>
              <ThemedText type="small" themeColor="textSecondary">Generado en total</ThemedText>
              <ThemedText type="subtitle">{formatCOP(myPerf.totalRevenue)}</ThemedText>
            </View>

            <View style={[styles.metricBox, { backgroundColor: theme.surfaceContainerHigh }]}>
              <ThemedText type="small" themeColor="textSecondary">Costo en repuestos</ThemedText>
              <ThemedText type="subtitle" style={{ color: Brand.warning }}>
                {formatCOP(myPerf.totalPartsCost)}
              </ThemedText>
            </View>

            <View style={[styles.metricBox, { backgroundColor: theme.surfaceContainerHigh }]}>
              <ThemedText type="small" themeColor="textSecondary">Producción neta</ThemedText>
              <ThemedText type="subtitle">
                {formatCOP(myPerf.netProduction)}
              </ThemedText>
            </View>

            <View style={[styles.highlightBox, { backgroundColor: `${Brand.success}14`, borderColor: `${Brand.success}4d` }]}>
              <ThemedText type="smallBold" style={{ color: Brand.success }}>
                Tu Comisión ({commissionRatePct}%)
              </ThemedText>
              <ThemedText type="title" style={{ color: Brand.success }}>
                {formatCOP(myPerf.commissionTotal)}
              </ThemedText>
            </View>
          </View>
        )}
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Shape.xl,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  periodChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Shape.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.three,
  },
  statusText: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
  resultsContainer: {
    gap: Spacing.three,
  },
  headerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  metricBox: {
    padding: Spacing.three,
    borderRadius: Shape.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  highlightBox: {
    padding: Spacing.four,
    borderRadius: Shape.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
