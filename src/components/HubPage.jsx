import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, query, orderBy, limit, getDocs, updateDoc } from 'firebase/firestore';

const HubPage = ({
    onNavigate,
    onContinue,
    hasSession,
    userRole,
    onLogout,
    usuario,
    styles = {}
}) => {
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
        const fetchAcademiaInfo = async () => {
            if (usuario?.academiaId) {
                try {
                    const academiaRef = doc(db, "academias", usuario.academiaId);
                    const academiaSnap = await getDoc(academiaRef);
                    if (academiaSnap.exists() && academiaSnap.data().logoBase64) {
                        setFondoAcademia(academiaSnap.data().logoBase64);
                    }
                } catch (error) {
                    console.error("Error al cargar el logo:", error);
                }
            }
        };
        fetchAcademiaInfo();
    }, [usuario?.academiaId]);

    // Efecto para buscar el último anuncio
    useEffect(() => {
        const fetchUltimoAnuncio = async () => {
            try {
                // Buscamos solo 1 anuncio, el más reciente
                const q = query(collection(db, "anuncios"), orderBy("fecha", "desc"), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const anuncioData = snap.docs[0].data();
                    const anuncioId = snap.docs[0].id;

                    setAnuncioReciente({ id: anuncioId, ...anuncioData });

                    // SOLUCIÓN: Revisamos la base de datos Y la memoria local del navegador
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

    // Función para abrir el anuncio y marcarlo como leído
    const handleAbrirAnuncio = async (e) => {
        e.stopPropagation();
        setShowAnuncio(true);
        setHayNotificacion(false);

        // SOLUCIÓN: Guardamos el ID del anuncio en la memoria local al instante
        if (anuncioReciente?.id) {
            localStorage.setItem('ultimoAnuncioVisto', anuncioReciente.id);
        }

        if (usuario?.uid && anuncioReciente?.id !== usuario?.ultimoAnuncioVisto) {
            try {
                // Actualizamos el perfil en la base de datos (segundo plano)
                const userRef = doc(db, "usuarios", usuario.uid);
                await updateDoc(userRef, {
                    ultimoAnuncioVisto: anuncioReciente.id
                });
            } catch (error) {
                console.error("No se pudo actualizar el estado de lectura:", error);
            }
        }
    };

    // Función de Soporte Original
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
            if (typeof notify === 'function') notify("Mensaje enviado a Ngasi. Revisaré el sistema pronto. 🛡️");
            else alert("Mensaje enviado a Ngasi. Revisaré el sistema pronto. 🛡️");

            setMensajeSoporte("");
            setShowSoporte(false);
        } catch (error) {
            console.error("Error soporte:", error);
            if (typeof notify === 'function') notify("No se pudo enviar el reporte.");
            else alert("No se pudo enviar el reporte.");
        } finally {
            setEnviando(false);
        }
    };

    const tienePerfil = usuario?.fotoBase64 && usuario?.fotoBase64.length > 0;
    const grados = usuario?.grados || 0;
    const cinturon = usuario?.cinturon || 'Blanco';

    const contenedorEstilos = {
        ...styles.container,
        position: 'relative',
        minHeight: '100vh',
        backgroundImage: fondoAcademia
            ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${fondoAcademia})`
            : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
    };

    return (
        <div style={contenedorEstilos}>

            <style>{`
                .user-profile-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(10, 10, 10, 0.8);
                    border: 1px solid #d4af37;
                    border-radius: 12px;
                    padding: 10px;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    z-index: 100;
                    margin: 0 auto 20px auto; 
                    width: 140px;
                    backdrop-filter: blur(5px);
                    position: relative; /* Importante para posicionar la campanita */
                }
                .user-profile-card:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
                }
                
                /* Animación de latido para la notificación */
                @keyframes pulse-rojo {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 50, 50, 0.7); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 50, 50, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 50, 50, 0); }
                }

                @media (min-width: 768px) {
                    .user-profile-card {
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        margin: 0;
                    }
                }
            `}</style>

            {/* --- TARJETA DE USUARIO --- */}
            <div className="user-profile-card" onClick={() => onNavigate('mi_cuenta')}>

                {/* --- BOTÓN DE NOTIFICACIÓN SUPERPUESTO --- */}
                {(hayNotificacion || anuncioReciente) && (
                    <div
                        onClick={handleAbrirAnuncio}
                        style={{
                            position: 'absolute', top: '-10px', left: '-10px',
                            backgroundColor: hayNotificacion ? '#ff3333' : '#222',
                            border: `2px solid ${hayNotificacion ? '#ffcccc' : '#d4af37'}`,
                            borderRadius: '50%', width: '30px', height: '30px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            cursor: 'pointer', zIndex: 101,
                            animation: hayNotificacion ? 'pulse-rojo 2s infinite' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                        }}
                        title="Actualizaciones de Ngasi"
                    >
                        {/* SVG de Campanita / Anuncio */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hayNotificacion ? "#fff" : "#d4af37"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        {/* Puntito extra si no se ha leído */}
                        {hayNotificacion && (
                            <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', backgroundColor: '#fff', borderRadius: '50%' }} />
                        )}
                    </div>
                )}

                {tienePerfil ? (
                    <>
                        <div style={{
                            width: '55px', height: '55px', borderRadius: '10px',
                            backgroundImage: `url(${usuario.fotoBase64})`, backgroundSize: 'cover',
                            backgroundPosition: 'center', border: '2px solid #333', marginBottom: '8px'
                        }} />
                        <p style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', margin: '0 0 5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {usuario?.nombre || 'Guerrero'}
                        </p>

                        <div style={{
                            height: '12px', width: '100%', backgroundColor: coloresCinturon[cinturon],
                            borderRadius: '2px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            border: '1px solid #222', overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%', width: '35px', backgroundColor: cinturon === 'Negro' ? '#D32F2F' : '#111',
                                display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', borderLeft: '1px solid rgba(0,0,0,0.3)'
                            }}>
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} style={{ height: '100%', width: '3px', backgroundColor: i < grados ? '#FFF' : 'transparent', borderRight: i < grados ? '1px solid rgba(0,0,0,0.2)' : 'none' }} />
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '10px 5px' }}>
                        <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '5px' }}>⚠️</span>
                        <p style={{ color: '#d4af37', fontSize: '0.7rem', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>
                            ACTUALIZA<br />TU PERFIL
                        </p>
                    </div>
                )}
            </div>

            <h1 style={{ ...styles.goldTitle, marginTop: '20px', position: 'relative', zIndex: 10 }}>LA FORTUNA VAULT</h1>

            {/* BOTONES DEL HUB */}
            <div style={{ ...styles.grid, position: 'relative', zIndex: 10 }}>
                <button style={{ ...styles.hubBtn, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('mapa')}>MAPA</button>
                <button style={{ ...styles.hubBtn, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('notas_hub')}>BITÁCORA</button>
                <button style={{ ...styles.hubBtn, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('busqueda')}>BUSCAR</button>
                <button style={{ ...styles.hubBtn, backgroundColor: 'rgba(5,5,5,0.8)', border: '1px dashed #444', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('instalar')}>INSTALAR APP</button>

                {hasSession && (
                    <button style={{ ...styles.hubBtn, border: '1px solid #d4af37', backgroundColor: 'rgba(212, 175, 55, 0.1)', backdropFilter: 'blur(5px)' }} onClick={onContinue}>CONTINUAR ESTUDIO</button>
                )}

                <button style={{ ...styles.hubBtn, border: '1px solid #d4af37', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('planeador')}>PLANEAR CLASE</button>

                {['admin', 'profesor'].includes(userRole) && (
                    <button style={{ ...styles.hubBtn, border: '1px solid #d4af37', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('alumnos')}>GESTIÓN DOJO</button>
                )}

                <button style={{ ...styles.hubBtn, backgroundColor: 'rgba(17,17,17,0.8)', border: '1px solid #d4af37', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('mi_cuenta')}>MI CUENTA</button>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
                    <button style={{ ...styles.hubBtn, flex: 1, border: '1px solid #ff4444', color: '#ff4444', margin: 0, padding: '20px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => setShowSoporte(true)}>SOPORTE</button>
                    <button style={{ ...styles.hubBtn, flex: 1, border: '1px solid #4CAF50', color: '#4CAF50', margin: 0, padding: '20px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={() => setShowTutoriales(true)}>TUTORIALES</button>
                </div>

                {userRole === 'admin' && (
                    <button style={{ ...styles.hubBtn, gridColumn: 'span 2', backgroundColor: 'rgba(26,26,26,0.9)', color: '#d4af37', backdropFilter: 'blur(5px)' }} onClick={() => onNavigate('admin')}>CONTROL DE ACCESOS</button>
                )}
            </div>

            <button onClick={onLogout} style={{ ...styles.btnOutline, marginTop: '40px', width: '200px', position: 'relative', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                CERRAR SESIÓN
            </button>


            {/* --- MODAL DE ACTUALIZACIONES --- */}
            {showAnuncio && anuncioReciente && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #d4af37', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <span style={{ fontSize: '1.5rem' }}>📢</span>
                            <h3 style={{ color: '#d4af37', margin: 0, letterSpacing: '1px' }}>{anuncioReciente.titulo || "Nueva Actualización"}</h3>
                        </div>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {anuncioReciente.mensaje}
                        </p>
                        <p style={{ color: '#666', fontSize: '0.7rem', textAlign: 'right', marginTop: '20px' }}>
                            Publicado por Ngasi: {anuncioReciente.fecha || 'Recientemente'}
                        </p>
                        <button onClick={() => setShowAnuncio(false)} style={{ ...styles.btnGold, width: '100%', marginTop: '10px' }}>
                            ENTENDIDO OSS
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODAL DE SOPORTE --- */}
            {showSoporte && (
                // ... Código intacto de tu modal
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #ff4444', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ color: '#ff4444', marginTop: 0, letterSpacing: '2px' }}>CONTACTAR A SOPORTE</h3>
                        <textarea value={mensajeSoporte} onChange={(e) => setMensajeSoporte(e.target.value)} placeholder="Escribe tu mensaje aquí..." style={{ width: '100%', height: '120px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '20px' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowSoporte(false)} style={{ ...styles.btnOutline, flex: 1, borderColor: '#444', color: '#666' }}>CANCELAR</button>
                            <button onClick={handleEnviarSoporte} disabled={enviando || !mensajeSoporte.trim()} style={{ ...styles.btnGold, flex: 1, backgroundColor: enviando ? '#444' : '#ff4444', color: '#fff' }}>{enviando ? 'ENVIANDO...' : 'ENVIAR'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DE TUTORIALES --- */}
            {showTutoriales && (
                // ... Código intacto de tu modal
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #4CAF50', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <h3 style={{ color: '#4CAF50', marginTop: 0, letterSpacing: '2px', textAlign: 'center' }}>TUTORIALES DE LA APP</h3>
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