import React from 'react';

const InstalacionModal = ({ isOpen, onClose, styles = {} }) => {
    if (!isOpen) return null;

    // Detectamos si es iOS para dar las instrucciones precisas
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box'
        }}>
            <div style={{
                backgroundColor: '#111', border: '1px solid #d4af37', padding: '30px',
                borderRadius: '15px', textAlign: 'center', maxWidth: '400px', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: '#666', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                    ×
                </button>

                <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>INSTALAR VAULT</h3>

                {esIOS ? (
                    <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        <p>Para llevar **La Fortuna** en tu iPhone:</p>
                        <ol style={{ textAlign: 'left', marginTop: '15px' }}>
                            <li>Toca el botón **Compartir** <span style={{ fontSize: '1.2rem' }}>⎋</span> (abajo en el centro).</li>
                            <li>Desliza hacia arriba y busca **"Añadir a pantalla de inicio"** ➕.</li>
                            <li>Presiona **"Añadir"** en la esquina superior derecha.</li>
                        </ol>
                    </div>
                ) : (
                    <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        <p>Para instalar en tu Android:</p>
                        <ol style={{ textAlign: 'left', marginTop: '15px' }}>
                            <li>Toca los **tres puntos** ⋮ en la esquina superior derecha.</li>
                            <li>Selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.</li>
                        </ol>
                    </div>
                )}

                <button onClick={onClose} style={{ ...styles.btnGold, marginTop: '20px' }}>ENTENDIDO</button>
            </div>
        </div>
    );
};

export default InstalacionModal;