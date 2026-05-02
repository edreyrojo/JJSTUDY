import React, { useState } from 'react';
// IMPORTANTE: Importamos las herramientas de Firebase
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const HubPage = ({
    onNavigate,
    onContinue,
    hasSession,
    userRole,
    onLogout,
    usuario,
    styles = {} // Recibimos styles desde App.jsx
}) => {
    // 1. Estados para el sistema de soporte
    const [showSoporte, setShowSoporte] = useState(false);
    const [mensajeSoporte, setMensajeSoporte] = useState("");
    const [enviando, setEnviando] = useState(false);

    // --- Estado para Tutoriales ---
    const [showTutoriales, setShowTutoriales] = useState(false);

    // 2. Función para guardar el ticket en Firestore
    const handleEnviarSoporte = async () => {
        if (!mensajeSoporte.trim()) return;
        setEnviando(true);
        try {
            await addDoc(collection(db, "soporte"), {
                uid: usuario?.uid || "anonimo",
                nombre: usuario?.nombre || "Usuario sin nombre",
                email: usuario?.email || "Sin email",
                mensaje: mensajeSoporte,
                fecha: new Date().toLocaleString(),
                estado: "pendiente",
                rolAlMomento: userRole
            });
            notify("Mensaje enviado a Ngasi. Revisaré el sistema pronto. 🛡️");
            setMensajeSoporte("");
            setShowSoporte(false);
        } catch (error) {
            console.error("Error soporte:", error);
            notify("No se pudo enviar el reporte.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.goldTitle}>LA FORTUNA VAULT</h1>

            <div style={styles.grid}>
                {/* --- Funciones Originales --- */}
                <button style={styles.hubBtn} onClick={() => onNavigate('mapa')}>MAPA</button>
                <button style={styles.hubBtn} onClick={() => onNavigate('notas_hub')}>BITÁCORA</button>
                <button style={styles.hubBtn} onClick={() => onNavigate('busqueda')}>BUSCAR</button>

                <button
                    style={{ ...styles.hubBtn, backgroundColor: '#050505', border: '1px dashed #444' }}
                    onClick={() => onNavigate('instalar')}
                >
                    INSTALAR APP
                </button>

                {/* Botón de Continuar (Solo si hay sesión activa) */}
                {hasSession && (
                    <button
                        style={{ ...styles.hubBtn, border: '1px solid #d4af37', backgroundColor: '#d4af3722' }}
                        onClick={onContinue}
                    >
                        CONTINUAR ESTUDIO
                    </button>
                )}

                <button style={{ ...styles.hubBtn, border: '1px solid #d4af37' }} onClick={() => onNavigate('planeador')}>
                    PLANEAR CLASE
                </button>

                {/* --- Gestión (Admin/Profesor) --- */}
                {['admin', 'profesor'].includes(userRole) && (
                    <button style={{ ...styles.hubBtn, border: '1px solid #d4af37' }} onClick={() => onNavigate('alumnos')}>
                        GESTIÓN DOJO
                    </button>
                )}
                {/* --- Nuevo Botón: Mi Cuenta --- */}
                <button
                    style={{ ...styles.hubBtn, backgroundColor: '#111', border: '1px solid #d4af37' }}
                    onClick={() => onNavigate('mi_cuenta')}
                >
                    MI CUENTA
                </button>

                {/* --- BOTONES DE APOYO --- */}
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
                    <button
                        style={{ ...styles.hubBtn, flex: 1, border: '1px solid #ff4444', color: '#ff4444', margin: 0, padding: '20px' }}
                        onClick={() => setShowSoporte(true)}
                    >
                        SOPORTE
                    </button>
                    <button
                        style={{ ...styles.hubBtn, flex: 1, border: '1px solid #4CAF50', color: '#4CAF50', margin: 0, padding: '20px' }}
                        onClick={() => setShowTutoriales(true)}
                    >
                        TUTORIALES
                    </button>
                </div>

                {/* --- Control de Accesos (Solo Admin) --- */}
                {userRole === 'admin' && (
                    <button
                        style={{ ...styles.hubBtn, gridColumn: 'span 2', backgroundColor: '#1a1a1a', color: '#d4af37' }}
                        onClick={() => onNavigate('admin')}
                    >
                        CONTROL DE ACCESOS
                    </button>
                )}
            </div>

            <button onClick={onLogout} style={{ ...styles.btnOutline, marginTop: '40px', width: '200px' }}>
                CERRAR SESIÓN
            </button>

            {/* --- MODAL DE SOPORTE --- */}
            {showSoporte && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box'
                }}>
                    <div style={{
                        backgroundColor: '#111', border: '1px solid #ff4444', padding: '25px',
                        borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center'
                    }}>
                        <h3 style={{ color: '#ff4444', marginTop: 0, letterSpacing: '2px' }}>CONTACTAR A SOPORTE</h3>
                        <textarea
                            value={mensajeSoporte}
                            onChange={(e) => setMensajeSoporte(e.target.value)}
                            placeholder="Escribe tu mensaje aquí..."
                            style={{
                                width: '100%', height: '120px', backgroundColor: '#000', color: '#fff',
                                border: '1px solid #333', borderRadius: '6px', padding: '10px',
                                fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '20px'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowSoporte(false)} style={{ ...styles.btnOutline, flex: 1, borderColor: '#444', color: '#666' }}>CANCELAR</button>
                            <button onClick={handleEnviarSoporte} disabled={enviando || !mensajeSoporte.trim()} style={{ ...styles.btnGold, flex: 1, backgroundColor: enviando ? '#444' : '#ff4444', color: '#fff' }}>
                                {enviando ? 'ENVIANDO...' : 'ENVIAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DE TUTORIALES --- */}
            {showTutoriales && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box'
                }}>
                    <div style={{
                        backgroundColor: '#111', border: '1px solid #4CAF50', padding: '25px',
                        borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <h3 style={{ color: '#4CAF50', marginTop: 0, letterSpacing: '2px', textAlign: 'center' }}>TUTORIALES DE LA APP</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => window.open('TU_LINK_AQUI', '_blank')}
                                style={{ backgroundColor: '#000', color: '#fff', border: '1px solid #333', padding: '15px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}
                            >
                                <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.8rem' }}>1. Introducción al Vault</div>
                                <div style={{ fontSize: '0.7rem', color: '#555' }}>Conceptos básicos y navegación.</div>
                            </button>
                        </div>
                        <button
                            onClick={() => setShowTutoriales(false)}
                            style={{ ...styles.btnOutline, width: '100%', marginTop: '20px', borderColor: '#4CAF50', color: '#4CAF50' }}
                        >
                            CERRAR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HubPage;