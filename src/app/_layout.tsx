import '@/lib/web-polyfills';

import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { RepairProvider } from '@/context/repair-context';
import { WorkshopProvider, useWorkshop } from '@/context/workshop-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, hydrated } = useAuth();
  const { hydrated: workshopHydrated, subscription } = useWorkshop();
  const router = useRouter();

  // Monetización: si el taller está expirado (trial o suscripción vencidos),
  // la zona protegida queda inaccesible y se fuerza el paywall. El guard del
  // Stack bloquea la navegación y el efecto cubre el caso de expiración en
  // caliente (sesión abierta cuando vence la fecha).
  const workshopExpired = subscription.isExpired;

  useEffect(() => {
    if (!hydrated || !workshopHydrated) return;
    if (isAuthenticated && workshopExpired) {
      router.replace('/paywall');
    }
  }, [hydrated, workshopHydrated, isAuthenticated, workshopExpired, router]);

  // Esperar la restauración de la sesión de Supabase ANTES de montar el router.
  // Si el Stack se monta con `isAuthenticated=false` (estado inicial) y la
  // sesión se restaura después, el guard no re-navega y el usuario queda
  // atrapado en /login tras un reload. Montar solo con `hydrated` garantiza que
  // la primera render del guard ya decide con la sesión real
  // (AnimatedSplashOverlay cubre la pausa). Igual con el estado del taller:
  // esperar `workshopHydrated` evita un flash de la zona protegida a un taller
  // expirado antes de que el paywall tome el control.
  if (!hydrated || !workshopHydrated) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated && !workshopExpired}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="receipt/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="taller" options={{ headerShown: false }} />
        <Stack.Screen name="super-admin" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="paywall" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ErrorBoundary>
        <AuthProvider>
        <RepairProvider>
          <WorkshopProvider>
            <RootNavigator />
            <AnimatedSplashOverlay />
          </WorkshopProvider>
        </RepairProvider>
      </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}