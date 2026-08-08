import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { RepairProvider } from '@/context/repair-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, hydrated } = useAuth();

  // Esperar la hidratación de AsyncStorage ANTES de montar el router. Si el
  // Stack se monta con `isAuthenticated=false` (estado inicial) y la sesión se
  // restaura después, el guard no re-navega y el usuario queda atrapado en
  // /login tras un reload. Montar solo con `hydrated` garantiza que la primera
  // render del guard ya decide con la sesión real (AnimatedSplashOverlay cubre
  // la pausa).
  if (!hydrated) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="receipt/[id]" options={{ headerShown: false }} />
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
      <AuthProvider>
        <RepairProvider>
          <RootNavigator />
          <AnimatedSplashOverlay />
        </RepairProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}