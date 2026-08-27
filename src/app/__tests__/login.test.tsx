import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import LoginScreen from '../login';

// Mocks
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
  Link: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000',
    border: '#ccc',
    background: '#fff',
    textSecondary: '#666',
  }),
}));

const mockLogin = jest.fn();
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
    signInWithGoogle: jest.fn(),
    resendRegistration: jest.fn(),
  }),
}));

jest.mock('@/lib/google-auth', () => ({
  isGoogleConfigured: true,
  useGoogleSignIn: () => ({
    prompt: jest.fn(),
    inProgress: false,
    error: null,
  }),
}));

jest.mock('@/lib/supabase-auth', () => ({
  supabaseSignInWithGoogleRedirect: jest.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByTestId } = render(<LoginScreen />);
    expect(getByTestId('login-email-input')).toBeTruthy();
    expect(getByTestId('login-password-input')).toBeTruthy();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('shows error banner on invalid credentials and hides it on type', async () => {
    mockLogin.mockResolvedValue({ ok: false, reason: 'invalid' });
    
    const { getByTestId, queryByTestId, findByTestId } = render(<LoginScreen />);
    
    // initially no error
    expect(queryByTestId('login-error-message')).toBeNull();

    // fill and submit
    fireEvent.changeText(getByTestId('login-email-input'), 'test@test.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'password');
    
    await act(async () => {
      fireEvent.press(getByTestId('login-submit-button'));
    });

    // should show error
    const errorMessage = await findByTestId('login-error-message');
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.props.children.props.children).toBe('Correo o contraseña incorrectos.');

    // type in input should hide error
    fireEvent.changeText(getByTestId('login-email-input'), 'test@test.com2');
    expect(queryByTestId('login-error-message')).toBeNull();
  });
});
