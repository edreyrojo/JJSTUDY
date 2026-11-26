import React from 'react';

/**
 * Evita la pantalla negra cuando un componente lanza un error inesperado.
 * Muestra una salida clara y permite recargar o limpiar solo datos locales
 * de la app (no toca la sesión de Firebase).
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary:', error, info);
    }

    limpiarDatosLocales = () => {
        try {
            Object.keys(localStorage)
                .filter((clave) => clave.startsWith('lafortuna_'))
                .forEach((clave) => localStorage.removeItem(clave));
        } catch {
            /* almacenamiento no disponible */
        }
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div style={{
                minHeight: 'var(--app-vh)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '24px',
                backgroundColor: '#0a0a0a',
                color: '#fff',
                textAlign: 'center',
                boxSizing: 'border-box'
            }}>
                <h1 style={{ color: '#d4af37', letterSpacing: '2px', margin: 0 }}>
                    ALGO SALIÓ MAL
                </h1>
                <p style={{ color: '#bbb', maxWidth: '460px', lineHeight: 1.6, margin: 0 }}>
                    La aplicación encontró un error inesperado. Puedes recargar para continuar.
                    Si el problema sigue, limpia los datos locales de La Fortuna.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '11px 18px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#d4af37',
                            color: '#000',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        RECARGAR
                    </button>
                    <button
                        type="button"
                        onClick={this.limpiarDatosLocales}
                        style={{
                            padding: '11px 18px',
                            borderRadius: '8px',
                            border: '1px solid #444',
                            backgroundColor: 'transparent',
                            color: '#aaa',
                            cursor: 'pointer'
                        }}
                    >
                        LIMPIAR DATOS LOCALES
                    </button>
                </div>
                <pre style={{
                    maxWidth: '100%',
                    overflow: 'auto',
                    color: '#555',
                    fontSize: '0.65rem',
                    textAlign: 'left'
                }}>
                    {String(this.state.error?.message || this.state.error || '')}
                </pre>
            </div>
        );
    }
}
