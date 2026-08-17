import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary raíz: si cualquier componente revienta en runtime (render,
 * efectos o el árbol de providers), mostramos un mensaje amigable con recarga
 * en lugar de una pantalla en blanco. Previene que una futura actualización
 * "crashee" visualmente a los usuarios sin explicación.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Dejar rastro en consola para diagnóstico, sin exponerlo al usuario.
    console.error('[ErrorBoundary] Error capturado:', error);
    if (info.componentStack) {
      console.error('[ErrorBoundary] Componente:', info.componentStack);
    }
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Ups, algo salió mal</Text>
          <Text style={styles.message}>
            La aplicación encontró un problema inesperado. Recarga la página para intentarlo de
            nuevo.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.handleReload}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Recargar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1B1F',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    color: '#49454F',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6750A4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});