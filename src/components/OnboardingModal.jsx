// src/components/OnboardingModal.jsx
import React, { useState, useEffect } from 'react';
import { crearNuevoTeam, vincularInstructorASede, migrarDatosLegacy } from '../utils/teamsService';

const OnboardingModal = ({ usuario, styles, onComplete }) => {
    // Protección: Si styles no llega, evitamos que la app crashee
    const s = styles || {};
    
    const [paso, setPaso] = useState('elegir'); 
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

    // --- LÓGICA DE MIGRACIÓN AUTOMÁTICA ---
    useEffect(() => {
        const verificarMigracion = async () => {
            // Si el usuario ya es profesor pero no tiene teamId, es un usuario "Legacy" (como Gustavo)
            if (usuario?.rol === 'profesor' && !usuario?.teamId) {
                setPaso('migrando');
                setCargando(true);
                try {
                    console.log("Detectado usuario Legacy. Iniciando migración de bóveda...");
                    const resultado = await migrarDatosLegacy(usuario);
                    onComplete(resultado); // Cierra el modal y actualiza App
                } catch (e) {
                    setError("Error en la migración. Contacta a soporte.");
                    setPaso('elegir');
                } finally {
                    setCargando(false);
                }
            }
        };
        verificarMigracion();
    }, [usuario, onComplete]);

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

    // Estilos dinámicos
    const estiloBase = {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.98)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '20px', boxSizing: 'border-box'
    };

    return (
        <div style={estiloBase}>
            <div style={{ ...s.card, width: '100%', maxWidth: '480px', padding: '40px', border: '1px solid #d4af37' }}>

                {/* HEADER */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ ...s.goldTitle, fontSize: '1.5rem', marginBottom: '5px' }}>
                        LA FORTUNA VAULT
                    </h2>
                    <p style={{ color: '#666', fontSize: '0.7rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        Módulo de Configuración Inicial
                    </p>
                </div>

                {/* VISTA: MIGRANDO (Para Gustavo) */}
                {paso === 'migrando' && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                        <p style={{ color: '#d4af37' }}>MIGRANDO TU BÓVEDA...</p>
                        <p style={{ color: '#555', fontSize: '0.8rem' }}>Estamos actualizando tus sedes y alumnos a la nueva arquitectura.</p>
                    </div>
                )}

                {/* VISTA: ELEGIR ROL */}
                {paso === 'elegir' && !cargando && (
                    <div>
                        <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '30px' }}>
                            ¿Cómo vas a usar el sistema?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button onClick={() => setPaso('propietario')} style={{ background: 'linear-gradient(135deg, #d4af37 0%, #a0832a 100%)', border: 'none', borderRadius: '12px', padding: '20px', cursor: 'pointer', textAlign: 'left', color: '#000' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>SOY PROFESOR / FUNDADOR</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Crear mi team y gestionar mis sedes</div>
                            </button>

                            <button onClick={() => setPaso('instructor')} style={{ background: 'transparent', border: '1px solid #333', borderRadius: '12px', padding: '20px', cursor: 'pointer', textAlign: 'left', color: '#fff' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>SOY INSTRUCTOR</div>
                                <div style={{ fontSize: '0.7rem', color: '#666' }}>Tengo un código de mi sede para vincularme</div>
                            </button>
                        </div>
                    </div>
                )}

                {/* VISTA: FORMULARIO PROPIETARIO */}
                {paso === 'propietario' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input placeholder="NOMBRE DEL TEAM (Ej: Bujutsu)" style={s.input} value={formProp.nombreTeam} onChange={e => setFormProp({ ...formProp, nombreTeam: e.target.value })} />
                        <input placeholder="NOMBRE DE SEDE (Ej: Sede Xalapa)" style={s.input} value={formProp.nombreSede} onChange={e => setFormProp({ ...formProp, nombreSede: e.target.value })} />
                        <input placeholder="CIUDAD" style={s.input} value={formProp.ciudad} onChange={e => setFormProp({ ...formProp, ciudad: e.target.value })} />
                        
                        {error && <p style={{ color: '#ff4444', fontSize: '0.7rem', textAlign: 'center' }}>{error}</p>}
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleCrearTeam} disabled={cargando} style={{ ...s.btnGold, flex: 2 }}>{cargando ? 'PROCESANDO...' : 'CREAR TEAM'}</button>
                            <button onClick={() => setPaso('elegir')} style={{ ...s.btnOutline, flex: 1 }}>ATRÁS</button>
                        </div>
                    </div>
                )}

                {/* VISTA: FORMULARIO INSTRUCTOR */}
                {paso === 'instructor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <p style={{ color: '#555', fontSize: '0.8rem' }}>Ingresa el código TEAM-XXX que te proporcionó tu profesor.</p>
                        <input placeholder="CÓDIGO DE SEDE" style={{ ...s.input, textAlign: 'center', letterSpacing: '2px' }} value={codigoInstructor} onChange={e => setCodigoInstructor(e.target.value.toUpperCase())} />
                        
                        {error && <p style={{ color: '#ff4444', fontSize: '0.7rem', textAlign: 'center' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleVincular} disabled={cargando} style={{ ...s.btnGold, flex: 2 }}>{cargando ? 'VINCULANDO...' : 'VINCULARME'}</button>
                            <button onClick={() => setPaso('elegir')} style={{ ...s.btnOutline, flex: 1 }}>ATRÁS</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;