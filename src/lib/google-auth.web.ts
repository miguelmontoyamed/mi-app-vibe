import { useCallback, useState } from 'react';

/**
 * Web Google OAuth implementation.
 *
 * On Web, Google Sign-in redirects directly via Supabase Auth
 * (supabaseSignInWithGoogleRedirect) rather than using expo-auth-session popup.
 */

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** True when a Google Client ID has been configured for the build. */
export const isGoogleConfigured = GOOGLE_CLIENT_ID.length > 0;

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}

/** Resultado del sign-in: el perfil + el id_token para puentear a Supabase. */
export interface GoogleAuthResult {
  profile: GoogleProfile;
  idToken: string;
}

/**
 * Hook para web: seguro contra webClientId vacío.
 * En web el sign-in con Google usa la redirección de Supabase.
 */
export function useGoogleSignIn(): {
  prompt: () => Promise<GoogleAuthResult | null>;
  inProgress: boolean;
  error: string | null;
} {
  const [inProgress] = useState(false);
  const [error] = useState<string | null>(null);

  const prompt = useCallback(async (): Promise<GoogleAuthResult | null> => {
    // En web el sign-in ocurre vía redirección con Supabase
    return null;
  }, []);

  return { prompt, inProgress, error };
}
