import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the
 * client side for web. useSyncExternalStore gives us the hydration-safe
 * snapshot without calling setState inside an effect:
 * - server/static snapshot -> 'light' (no hydration mismatch)
 * - client snapshot -> the real color scheme
 */
const emptySubscribe = () => () => {};

export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return hasHydrated ? colorScheme : 'light';
}
