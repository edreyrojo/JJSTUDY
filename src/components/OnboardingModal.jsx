// OnboardingModal.jsx
// Modal de primer arranque — decide si el usuario es Propietario o Instructor
// Se muestra cuando el usuario no tiene teamId configurado

import React, { useState } from 'react';
import { crearNuevoTeam, vincularInstructorASede, migrarDatosLegacy } from './teamsService';

const OnboardingModal = ({ usuario, styles, onComplete }) => {
    const [paso, setPaso] = useState('elegir'); // 'elegir' | 'propietario' | 'instructor' | 'migrando'
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    // Formulario propietario
    const [formProp, setFormProp] = useState({
        nombreTeam: '',
        nombreSede: '',
        ciudad: ''
    });

    // Formulario instructor
    const [codigoInstructor, setCodigoInstructor] = useState('');

    const handleCrearTeam = async () => {
        if (!formProp.nombreTeam || !formProp.nombreSede || !formProp.ciudad) {
            setError('Completa todos los campos.');
            return;
        }
        setCargando(true);
        setError('');
        try {
            const result = await crearNuevoTeam({
                uid: usuario.uid,
                ...formProp
            });
            onComplete(result);
        } catch (e) {
            setError('Error al crear el team. Intenta de nuevo.');
            console.error(e);
        } finally {
            setCargando(false);
        }
    };

    const handleVincular = async () => {
        if (!codigoInstructor.trim()) {
            setError('Ingresa el código que te dio tu profesor.');
            return;
        }
        setCargando(true);
        setError('');
        try {
            const result = await vincularInstructorASede(usuario.uid, codigoInstructor);
            onComplete(result);
        } catch (e) {
            setError(e.message || 'Error al vincular. Verifica el código.');
        } finally {
            setCargando(false);
        }
    };

    const estiloBase = {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.98)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '20px', boxSizing: 'border-box'
    };

    const estiloCard = {
        ...styles.card,
        width: '100%', maxWidth: '480px',
        padding: '40px', border: '1px solid #d4af37'
    };

    return (
        <div style={estiloBase}>
            <div style={estiloCard}>

                {/* LOGO / ICONO */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🥋</div>
                    <h2 style={{ ...styles.goldTitle, fontSize: '1.5rem', marginBottom: '5px' }}>
                        BIENVENIDO AL VAULT
                    </h2>
                    <p style={{ color: '#555', fontSize: '0.8rem', letterSpacing: '1px' }}>
                        SISTEMA DE GESTIÓN BJJ
                    </p>
                </div>

                {/* PASO 1: ELEGIR ROL */}
                {paso === 'elegir' && (
                    <div>
                        <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '30px' }}>
                            ¿Cómo vas a usar el sistema?
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button
                                onClick={() => setPaso('propietario')}
                                style={{
                                    background: 'linear-gradient(135deg, #d4af37 0%, #a0832a 100%)',
                                    border: 'none', borderRadius: '12px',
                                    padding: '20px', cursor: 'pointer',
                                    textAlign: 'left', color: '#000'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🏯</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '3px' }}>
                                    SOY PROFESOR / FUNDADOR
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                    Crear mi team y gestionar mis sedes
                                </div>
                            </button>

                            <button
                                onClick={() => setPaso('instructor')}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #333', borderRadius: '12px',
                                    padding: '20px', cursor: 'pointer',
                                    textAlign: 'left', color: '#fff'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>👊</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '3px' }}>
                                    SOY INSTRUCTOR
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                    Tengo un código de mi profesor para vincularme
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 2A: CREAR TEAM (PROPIETARIO) */}
                {paso === 'propietario' && (
                    <div>
                        <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '20px', letterSpacing: '1px' }}>
                            I. DATOS DE TU TEAM
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>
                                    NOMBRE DEL TEAM / ACADEMIA
                                </label>
                                <input
                                    placeholder="Ej: Team Hakagure, Hannya Academy, Haka..."
                                    style={{ ...styles.input, width: '100%', margin: 0 }}
                                    value={formProp.nombreTeam}
                                    onChange={e => setFormProp({ ...formProp, nombreTeam: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>
                                    NOMBRE DE TU SEDE PRINCIPAL
                                </label>
                                <input
                                    placeholder="Ej: Bujutsu Veracruz, Hannya HQ..."
                                    style={{ ...styles.input, width: '100%', margin: 0 }}
                                    value={formProp.nombreSede}
                                    onChange={e => setFormProp({ ...formProp, nombreSede: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>
                                    CIUDAD
                                </label>
                                <input
                                    placeholder="Ej: Xalapa, León, Guanajuato..."
                                    style={{ ...styles.input, width: '100%', margin: 0 }}
                                    value={formProp.ciudad}
                                    onChange={e => setFormProp({ ...formProp, ciudad: e.target.value })}
                                />
                            </div>
                        </div>

                        {error && (
                            <p style={{ color: '#ff4444', fontSize: '0.75rem', marginTop: '12px', textAlign: 'center' }}>
                                {error}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                            <button
                                onClick={handleCrearTeam}
                                disabled={cargando}
                                style={{ ...styles.btnGold, flex: 2, opacity: cargando ? 0.6 : 1 }}
                            >
                                {cargando ? 'CREANDO...' : 'CREAR MI TEAM 🏯'}
                            </button>
                            <button
                                onClick={() => { setPaso('elegir'); setError(''); }}
                                style={{ ...styles.btnOutline, flex: 1 }}
                            >
                                ATRÁS
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 2B: VINCULAR INSTRUCTOR */}
                {paso === 'instructor' && (
                    <div>
                        <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '1px' }}>
                            CÓDIGO DE ACCESO A TU SEDE
                        </p>
                        <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '20px' }}>
                            Tu profesor te habrá compartido un código con formato como:<br />
                            <code style={{ color: '#d4af37', fontSize: '0.85rem' }}>HAKA-LEO-001</code>
                        </p>

                        <input
                            placeholder="Pega el código aquí..."
                            style={{ ...styles.input, width: '100%', margin: '0 0 5px 0', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}
                            value={codigoInstructor}
                            onChange={e => setCodigoInstructor(e.target.value.toUpperCase())}
                        />

                        {error && (
                            <p style={{ color: '#ff4444', fontSize: '0.75rem', marginTop: '8px', textAlign: 'center' }}>
                                {error}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                            <button
                                onClick={handleVincular}
                                disabled={cargando}
                                style={{ ...styles.btnGold, flex: 2, opacity: cargando ? 0.6 : 1 }}
                            >
                                {cargando ? 'VERIFICANDO...' : 'VINCULARME 👊'}
                            </button>
                            <button
                                onClick={() => { setPaso('elegir'); setError(''); }}
                                style={{ ...styles.btnOutline, flex: 1 }}
                            >
                                ATRÁS
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
