import React from 'react';

/**
 * Evita la pantalla negra cuando un componente lanza un error inesperado.
 * Si es un chunk viejo tras un deploy, recarga una vez automáticamente.
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

        // Tras un deploy es normal que un chunk viejo ya no exista. En lugar
        // de mostrar una pantalla de error, recargamos una vez para tomar
        // la versión nueva. El flag evita bucles de recarga.
        const mensaje = String(error?.message || error || '');
        const errorDeCarga = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(mensaje);
        if (errorDeCarga) {
            try {
                const CLAVE = 'lafortuna_reload_chunk';
                const ultimo = Number(sessionStorage.getItem(CLAVE) || 0);
                if (Date.now() - ultimo > 20000) {
                    sessionStorage.setItem(CLAVE, String(Date.now()));
                    window.location.reload();
                }
            } catch {
                /* sin sessionStorage */
            }
        }
    }

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
                    NO SE PUDO CARGAR
                </h1>
                <p style={{ color: '#bbb', maxWidth: '460px', lineHeight: 1.6, margin: 0 }}>
                    Revisa tu conexión y recarga. Si el problema continúa, cierra la app
                    y vuelve a abrirla.
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
                        onClick={() => { window.location.href = '/'; }}
                        style={{
                            padding: '11px 18px',
                            borderRadius: '8px',
                            border: '1px solid #444',
                            backgroundColor: 'transparent',
                            color: '#aaa',
                            cursor: 'pointer'
                        }}
                    >
                        VOLVER AL INICIO
                    </button>
                </div>
                <details style={{ maxWidth: '100%', color: '#666', fontSize: '0.7rem' }}>
                    <summary style={{ cursor: 'pointer' }}>Detalle técnico</summary>
                    <pre style={{
                        maxWidth: '100%',
                        overflow: 'auto',
                        color: '#666',
                        fontSize: '0.65rem',
                        textAlign: 'left'
                    }}>
                        {String(this.state.error?.message || this.state.error || '')}
                    </pre>
                </details>
            </div>
        );
    }
}
