import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, query, orderBy, limit, getDocs, updateDoc, where } from 'firebase/firestore';

const HubPage = ({
    onNavigate,
    onContinue,
    hasSession,
    userRole,
    onLogout,
    usuario,
    styles = {}
}) => {
    // 🛡️ BLINDAJE: Si no existe el usuario, mostramos pantalla de carga
    if (!usuario) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#d4af37', fontSize: '1.5rem', backgroundColor: '#0a0a0a' }}>
                <p style={{ animation: 'pulse-rojo 2s infinite' }}>Conectando al tatami digital...</p>
            </div>
        );
    }

    // Estados Originales
    const [showSoporte, setShowSoporte] = useState(false);
    const [mensajeSoporte, setMensajeSoporte] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [showTutoriales, setShowTutoriales] = useState(false);
    const [fondoAcademia, setFondoAcademia] = useState(null);

    // Estados para las Notificaciones/Anuncios
    const [anuncioReciente, setAnuncioReciente] = useState(null);
    const [hayNotificacion, setHayNotificacion] = useState(false);
    const [showAnuncio, setShowAnuncio] = useState(false);

    const coloresCinturon = {
        'Blanco': '#FFFFFF', 'Azul': '#2196F3', 'Morado': '#9C27B0',
        'Café': '#795548', 'Negro': '#212121'
    };

    // Efecto para cargar Fondo de Academia
    useEffect(() => {
        const fetchFondoApp = async () => {
            const IMAGEN_POR_DEFECTO = "https://images.unsplash.com/photo-1564415315949-26bf26eb4e3e?q=80&w=1000&auto=format&fit=crop";

            try {
                if (usuario?.teamId || usuario?.uid) {
                    const idBusquedaSede = usuario.teamId || usuario.uid;
                    const qSede = query(collection(db, "sedes"), where("teamId", "==", idBusquedaSede));
                    const sedeSnap = await getDocs(qSede);

                    if (!sedeSnap.empty) {
                        const data = sedeSnap.docs[0].data();
                        const imagen = data.avatarSede || data.logoBase64 || data.logobase64;
                        if (imagen) {
                            setFondoAcademia(imagen);
                            return; 
                        }
                    }
                }

                if (usuario?.academiaId || usuario?.uid) {
                    const idBusquedaAcademia = usuario.academiaId || usuario.uid;
                    const qAcademia = query(collection(db, "academias"), where("academiaId", "==", idBusquedaAcademia));
                    const academiaSnap = await getDocs(qAcademia);

                    if (!academiaSnap.empty) {
                        const data = academiaSnap.docs[0].data();
                        const imagen = data.logoBase64 || data.logobase64;
                        if (imagen) {
                            setFondoAcademia(imagen);
                            return;
                        }
                    }
                }

                setFondoAcademia(IMAGEN_POR_DEFECTO);
            } catch (error) {
                console.error("ERROR CRÍTICO en la carga de datos:", error);
                setFondoAcademia(IMAGEN_POR_DEFECTO);
            }
        };

        if (usuario) {
            fetchFondoApp();
        }
    }, [usuario?.teamId, usuario?.academiaId, usuario?.uid]);

    // Efecto para buscar el último anuncio
    useEffect(() => {
        const fetchUltimoAnuncio = async () => {
            try {
                const q = query(collection(db, "anuncios"), orderBy("fecha", "desc"), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const anuncioData = snap.docs[0].data();
                    const anuncioId = snap.docs[0].id;

                    setAnuncioReciente({ id: anuncioId, ...anuncioData });
                    const vistoLocalmente = localStorage.getItem('ultimoAnuncioVisto');

                    if (usuario?.ultimoAnuncioVisto !== anuncioId && vistoLocalmente !== anuncioId) {
                        setHayNotificacion(true);
                    }
                }
            } catch (error) {
                console.error("Error al buscar anuncios:", error);
            }
        };

        if (usuario?.uid) {
            fetchUltimoAnuncio();
        }
    }, [usuario]);

    const handleAbrirAnuncio = (e) => {
        e.stopPropagation();
        setShowAnuncio(true);
        setHayNotificacion(false);

        if (anuncioReciente?.id) {
            localStorage.setItem('ultimoAnuncioVisto', anuncioReciente.id);
        }

        if (usuario?.uid && anuncioReciente?.id !== usuario?.ultimoAnuncioVisto) {
            try {
                const userRef = doc(db, "usuarios", usuario.uid);
                updateDoc(userRef, {
                    ultimoAnuncioVisto: anuncioReciente.id
                });
            } catch (error) {
                console.error("No se pudo actualizar el estado de lectura:", error);
            }
        }
    };

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
            alert("Mensaje enviado a Ngasi. Revisaré el sistema pronto. 🛡️");
            setMensajeSoporte("");
            setShowSoporte(false);
        } catch (error) {
            console.error("Error soporte:", error);
            alert("No se pudo enviar el reporte.");
        } finally {
            setEnviando(false);
        }
    };

    const tienePerfil = usuario?.fotoBase64 && usuario?.fotoBase64.length > 0;
    const grados = usuario?.grados || 0;
    const cinturon = usuario?.cinturon || 'Blanco';

    // --- LÓGICA DE DISTRIBUCIÓN RADIAL MATEMÁTICA ---
    const herramientasDial = [
        { id: 'mapa', label: 'MAPA', icon: <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>, route: 'mapa' },
        { id: 'notas', label: 'BITÁCORA', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></>, route: 'notas_hub' },
        { id: 'buscar', label: 'BUSCAR', icon: <><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></>, route: 'busqueda' },
        { id: 'timer', label: 'TIMER', icon: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>, route: 'timer' },
        { id: 'planeador', label: 'CLASES', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></>, route: 'planeador' },
        { id: 'instalar', label: 'INSTALAR', icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></>, route: 'instalar' },
        { id: 'micuenta', label: 'MI CUENTA', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></>, route: 'mi_cuenta' }
    ];

    if (['admin', 'profesor', 'instructor'].includes(userRole)) {
        herramientasDial.push({ id: 'dojo', label: 'DOJO', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>, route: 'alumnos' });
    }

    const radioDial = 135; 
    const angleStep = (2 * Math.PI) / herramientasDial.length;

    // 🛡️ CONTENEDOR CON SOPORTE DE NOTCH
    const contenedorEstilos = {
        ...styles.container,
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center', // Corregido de justifyContent a justifyContent (estaba como justify-content)
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 20px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 20px)',
        backgroundImage: fondoAcademia
            ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${fondoAcademia})`
            : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        overflowX: 'hidden',
        boxSizing: 'border-box'
    };

    return (
        <div style={contenedorEstilos}>
            <style>{`
                /* --- Animaciones Base --- */
                @keyframes pulse-rojo {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 50, 50, 0.7); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 50, 50, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 50, 50, 0); }
                }
                @keyframes heartbeat-gold {
                    0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }
                    50% { transform: translate(-50%, -50%) scale(1.05); box-shadow: 0 0 25px rgba(212,175,55,0.7); }
                    100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }
                }

                /* --- Tarjeta de Usuario Circular Centrada --- */
                .user-profile-card-circular {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(12, 12, 12, 0.9);
                    border: 2px solid #d4af37;
                    border-radius: 50%;
                    width: 125px;
                    height: 125px;
                    padding: 8px;
                    margin: 15px auto 5px auto;
                    cursor: pointer;
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.7);
                    z-index: 100;
                    backdrop-filter: blur(6px);
                    box-sizing: border-box;
                }
                .user-profile-card-circular:hover {
                    transform: scale(1.06);
                    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                }

                /* --- Sistema Dial Radial --- */
                .radial-hub-container {
                    position: relative;
                    width: 340px;
                    height: 340px;
                    margin: 20px auto 10px auto;
                }

                /* Núcleo Central (CONTINUAR) */
                .center-hub-node {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90px;
                    height: 90px;
                    border-radius: 50%;
                    background: radial-gradient(circle, #222 0%, #0a0a0a 100%);
                    border: 2px solid #d4af37;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 20;
                    cursor: pointer;
                    transition: all 0.3s;
                    color: #d4af37;
                }
                .center-hub-node.active-session {
                    animation: heartbeat-gold 2s infinite;
                    background: radial-gradient(circle, rgba(212,175,55,0.2) 0%, #0a0a0a 100%);
                }
                .center-hub-node.active-session:hover {
                    animation: none;
                    transform: translate(-50%, -50%) scale(1.1);
                    background-color: #d4af37;
                    color: #000;
                }
                .center-hub-node:hover svg {
                    stroke: #000;
                }

                /* Botones de Herramientas Orbitando */
                .dial-btn-wrapper {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    z-index: 10;
                }

                .dial-btn {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    width: 50px;
                    height: 50px;
                    border-radius: 25px;
                    background-color: rgba(15, 15, 15, 0.95);
                    border: 1px solid #d4af37;
                    color: #d4af37;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    overflow: hidden;
                    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                }

                .dial-btn:hover, .dial-btn:focus {
                    width: 140px;
                    background-color: #d4af37;
                    color: #000;
                    z-index: 50;
                    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                }

                .dial-btn svg {
                    flex-shrink: 0;
                    transition: stroke 0.3s;
                }
                .dial-btn:hover svg {
                    stroke: #000;
                }

                .dial-label {
                    max-width: 0;
                    opacity: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    font-size: 0.75rem;
                    font-weight: bold;
                    letter-spacing: 1px;
                    transition: max-width 0.3s ease, opacity 0.3s ease;
                }

                .dial-btn:hover .dial-label {
                    max-width: 100px;
                    opacity: 1;
                    margin-left: 8px;
                }

                /* Acciones Secundarias Inferiores (Con espacio suficiente para no chocar) */
                .secondary-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                    max-width: 320px;
                    position: relative;
                    z-index: 10;
                    margin-top: 45px;
                }

                @media (max-width: 480px) {
                    .radial-hub-container {
                        width: 280px;
                        height: 280px;
                    }
                    .secondary-actions {
                        margin-top: 35px;
                    }
                }
            `}</style>

            <h1 style={{ ...styles.goldTitle, marginTop: '5px', marginBottom: '0', fontSize: '1.3rem', position: 'relative', zIndex: 10, textAlign: 'center' }}>
                LA FORTUNA VAULT
            </h1>

            {/* --- PANEL DE USUARIO CIRCULAR CENTRADO --- */}
            <div className="user-profile-card-circular" onClick={() => onNavigate('mi_cuenta')}>
                {(hayNotificacion || anuncioReciente) && (
                    <div
                        onClick={handleAbrirAnuncio}
                        style={{
                            position: 'absolute', top: '-2px', right: '-2px',
                            backgroundColor: hayNotificacion ? '#ff3333' : '#222',
                            border: `2px solid ${hayNotificacion ? '#ffcccc' : '#d4af37'}`,
                            borderRadius: '50%', width: '28px', height: '28px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            cursor: 'pointer', zIndex: 101,
                            animation: hayNotificacion ? 'pulse-rojo 2s infinite' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                        }}
                        title="Anuncio Reciente"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hayNotificacion ? "#fff" : "#d4af37"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        {hayNotificacion && <div style={{ position: 'absolute', top: 0, right: 0, width: '7px', height: '7px', backgroundColor: '#fff', borderRadius: '50%' }} />}
                    </div>
                )}

                {tienePerfil ? (
                    <>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '50%',
                            backgroundImage: `url(${usuario.fotoBase64})`, backgroundSize: 'cover',
                            backgroundPosition: 'center', border: '1px solid #d4af37', marginBottom: '4px'
                        }} />
                        <p style={{ color: '#fff', fontSize: '0.62rem', fontWeight: 'bold', margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px', textAlign: 'center' }}>
                            {usuario?.nombre || 'Guerrero'}
                        </p>
                        <div style={{ height: '6px', width: '75px', backgroundColor: coloresCinturon[cinturon], borderRadius: '2px', display: 'flex', justifyContent: 'flex-end', border: '1px solid #111' }}>
                            <div style={{ height: '100%', width: '22px', backgroundColor: cinturon === 'Negro' ? '#D32F2F' : '#111', display: 'flex', justifyContent: 'space-evenly' }}>
                                {[...Array(4)].map((_, i) => <div key={i} style={{ height: '100%', width: '2px', backgroundColor: i < grados ? '#FFF' : 'transparent' }} />)}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <p style={{ color: '#d4af37', fontSize: '0.55rem', fontWeight: 'bold', margin: 0 }}>MI PERFIL</p>
                    </div>
                )}
            </div>

            {/* --- NÚCLEO RADIAL DE HERRAMIENTAS --- */}
            <div className="radial-hub-container">
                
                {/* 1. Botón Central (Continuar o Logo) */}
                <div 
                    className={`center-hub-node ${hasSession ? 'active-session' : ''}`} 
                    onClick={hasSession ? onContinue : undefined}
                    title={hasSession ? "Continuar Estudio" : "La Fortuna Vault"}
                >
                    {hasSession ? (
                        <>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon> 
                            </svg>
                            <span style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '3px', letterSpacing: '1px' }}>CONTINUAR</span>
                        </>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            <path d="M2 12h20"></path>
                        </svg>
                    )}
                </div>

                {/* 2. Distribución Matemática de los Botones del Dial */}
                {herramientasDial.map((herramienta, index) => {
                    const angulo = index * angleStep - (Math.PI / 2);
                    const coordX = Math.cos(angulo) * radioDial;
                    const coordY = Math.sin(angulo) * radioDial;

                    return (
                        <div 
                            key={herramienta.id}
                            className="dial-btn-wrapper"
                            style={{ transform: `translate(${coordX}px, ${coordY}px)` }}
                        >
                            <button 
                                className="dial-btn" 
                                onClick={() => onNavigate(herramienta.route)}
                                title={herramienta.label}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {herramienta.icon}
                                </svg>
                                <span className="dial-label">{herramienta.label}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* --- ACCIONES SECUNDARIAS INFERIORES --- */}
            <div className="secondary-actions">
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={{ ...styles.hubBtn, flex: 1, padding: '10px', border: '1px solid #ff4444', color: '#ff4444', backgroundColor: 'rgba(0,0,0,0.8)', fontSize: '0.75rem', borderRadius: '8px' }} onClick={() => setShowSoporte(true)}>
                        SOPORTE
                    </button>
                    <button style={{ ...styles.hubBtn, flex: 1, padding: '10px', border: '1px solid #4CAF50', color: '#4CAF50', backgroundColor: 'rgba(0,0,0,0.8)', fontSize: '0.75rem', borderRadius: '8px' }} onClick={() => setShowTutoriales(true)}>
                        TUTORIALES
                    </button>
                </div>

                {userRole === 'admin' && (
                    <button style={{ ...styles.hubBtn, padding: '10px', backgroundColor: 'rgba(26,26,26,0.9)', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem' }} onClick={() => onNavigate('admin')}>
                        CONTROL DE ACCESOS
                    </button>
                )}

                <button onClick={onLogout} style={{ ...styles.btnOutline, padding: '10px', backgroundColor: 'rgba(0,0,0,0.6)', fontSize: '0.75rem' }}>
                    CERRAR SESIÓN
                </button>
            </div>

            {/* --- MODALES CONSERVADOS --- */}
            {showAnuncio && anuncioReciente && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #d4af37', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <span style={{ fontSize: '1.5rem' }}>📢</span>
                            <h3 style={{ color: '#d4af37', margin: 0 }}>{anuncioReciente.titulo || "Nueva Actualización"}</h3>
                        </div>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{anuncioReciente.mensaje}</p>
                        <p style={{ color: '#666', fontSize: '0.7rem', textAlign: 'right' }}>Publicado por Ngasi: {anuncioReciente.fecha}</p>
                        <button onClick={() => setShowAnuncio(false)} style={{ ...styles.btnGold, width: '100%', marginTop: '10px' }}>ENTENDIDO OSS</button>
                    </div>
                </div>
            )}

            {showSoporte && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #ff4444', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ color: '#ff4444', marginTop: 0 }}>CONTACTAR A SOPORTE</h3>
                        <textarea value={mensajeSoporte} onChange={(e) => setMensajeSoporte(e.target.value)} placeholder="Escribe tu mensaje aquí..." style={{ width: '100%', height: '120px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '20px' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowSoporte(false)} style={{ ...styles.btnOutline, flex: 1, borderColor: '#444', color: '#666' }}>CANCELAR</button>
                            <button onClick={handleEnviarSoporte} disabled={enviando || !mensajeSoporte.trim()} style={{ ...styles.btnGold, flex: 1, backgroundColor: enviando ? '#444' : '#ff4444', color: '#fff' }}>{enviando ? 'ENVIANDO...' : 'ENVIAR'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showTutoriales && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #4CAF50', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '450px' }}>
                        <h3 style={{ color: '#4CAF50', marginTop: 0, textAlign: 'center' }}>TUTORIALES DE LA APP</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => window.open('TU_LINK_AQUI', '_blank')} style={{ backgroundColor: '#000', color: '#fff', border: '1px solid #333', padding: '15px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}>
                                <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.8rem' }}>1. Introducción al Vault</div>
                                <div style={{ fontSize: '0.7rem', color: '#555' }}>Conceptos básicos y navegación.</div>
                            </button>
                        </div>
                        <button onClick={() => setShowTutoriales(false)} style={{ ...styles.btnOutline, width: '100%', marginTop: '20px', borderColor: '#4CAF50', color: '#4CAF50' }}>CERRAR</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HubPage;