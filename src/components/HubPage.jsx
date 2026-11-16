import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, query, orderBy, limit, getDocs, updateDoc, where } from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';

const HubPage = ({
    onNavigate,
    onContinue,
    hasSession,
    userRole,
    onLogout,
    usuario,
    styles = {}
}) => {
    const [showSoporte, setShowSoporte] = useState(false);
    const [mensajeSoporte, setMensajeSoporte] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [showTutoriales, setShowTutoriales] = useState(false);
    const [fondoAcademia, setFondoAcademia] = useState(null);
    const [anuncioReciente, setAnuncioReciente] = useState(null);
    const [hayNotificacion, setHayNotificacion] = useState(false);
    const [showAnuncio, setShowAnuncio] = useState(false);
    const [ancho, setAncho] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setAncho(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const esMovil = ancho < 768;
    const esTablet = ancho >= 768 && ancho < 1100;
    const esStaff = ['admin', 'profesor', 'instructor'].includes(userRole);
    const esAdmin = userRole === 'admin';
    const esMaestro = ['admin', 'profesor'].includes(userRole);

    const coloresCinturon = {
        'Blanco': '#FFFFFF', 'Azul': '#2196F3', 'Morado': '#9C27B0',
        'Café': '#795548', 'Negro': '#212121'
    };

    const notificar = (texto, icon = 'success') => {
        Swal.fire({
            text: texto,
            icon,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            iconColor: '#d4af37',
            border: '1px solid #d4af37',
            customClass: {
                popup: 'gold-border-alert'
            }
        });
    };

    const handleConfirmarLogout = () => {
        Swal.fire({
            title: '¿CERRAR SESIÓN?',
            text: '¿Estás seguro de que deseas salir del Vault? Esto bloqueará el acceso hasta tu próximo ingreso.',
            icon: 'warning',
            background: '#0a0a0a',
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'SÍ, CERRAR SESIÓN',
            cancelButtonText: 'CANCELAR',
            iconColor: '#d4af37',
            customClass: {
                popup: 'gold-border-alert'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                onLogout();
            }
        });
    };

    useEffect(() => {
        const teamId = usuario?.teamId;
        const academiaId = usuario?.academiaId;
        const uid = usuario?.uid;
        if (!uid) return;

        const fetchFondoApp = async () => {
            const IMAGEN_POR_DEFECTO = 'https://images.unsplash.com/photo-1564415315949-26bf26eb4e3e?q=80&w=1000&auto=format&fit=crop';

            try {
                if (teamId || uid) {
                    const idBusquedaSede = teamId || uid;
                    const qSede = query(collection(db, 'sedes'), where('teamId', '==', idBusquedaSede));
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

                if (academiaId || uid) {
                    const idBusquedaAcademia = academiaId || uid;
                    const qAcademia = query(collection(db, 'academias'), where('academiaId', '==', idBusquedaAcademia));
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
                console.error('Error en la carga del fondo:', error);
                setFondoAcademia(IMAGEN_POR_DEFECTO);
            }
        };

        fetchFondoApp();
    }, [usuario?.teamId, usuario?.academiaId, usuario?.uid]);

    useEffect(() => {
        const fetchUltimoAnuncio = async () => {
            try {
                const q = query(collection(db, 'anuncios'), orderBy('fecha', 'desc'), limit(1));
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
                console.error('Error al buscar anuncios:', error);
            }
        };

        if (usuario?.uid) {
            fetchUltimoAnuncio();
        }
    }, [usuario?.uid, usuario?.ultimoAnuncioVisto]);

    const handleAbrirAnuncio = async (e) => {
        e.stopPropagation();
        setShowAnuncio(true);
        setHayNotificacion(false);

        if (anuncioReciente?.id) {
            localStorage.setItem('ultimoAnuncioVisto', anuncioReciente.id);
        }

        if (usuario?.uid && anuncioReciente?.id !== usuario?.ultimoAnuncioVisto) {
            try {
                const userRef = doc(db, 'usuarios', usuario.uid);
                await updateDoc(userRef, {
                    ultimoAnuncioVisto: anuncioReciente.id
                });
            } catch (error) {
                console.error('No se pudo actualizar el estado de lectura:', error);
            }
        }
    };

    const handleEnviarSoporte = async () => {
        if (!mensajeSoporte.trim()) return;
        setEnviando(true);
        try {
            await addDoc(collection(db, 'soporte'), {
                uid: usuario?.uid || 'anonimo',
                nombre: usuario?.nombre || 'Usuario sin nombre',
                email: usuario?.email || 'Sin email',
                mensaje: mensajeSoporte,
                fecha: new Date().toLocaleString(),
                estado: 'pendiente',
                rolAlMomento: userRole
            });
            notificar('Mensaje enviado a Ngasi. Revisaré el sistema pronto.');
            setMensajeSoporte('');
            setShowSoporte(false);
        } catch (error) {
            console.error('Error soporte:', error);
            notificar('No se pudo enviar el reporte.', 'error');
        } finally {
            setEnviando(false);
        }
    };

    if (!usuario) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#d4af37', fontSize: '1.2rem', backgroundColor: '#0a0a0a', padding: '20px', textAlign: 'center' }}>
                <p style={{ letterSpacing: '1px' }}>Conectando al tatami digital...</p>
            </div>
        );
    }

    const tienePerfil = usuario?.fotoBase64 && usuario?.fotoBase64.length > 0;
    const grados = usuario?.grados || 0;
    const cinturon = usuario?.cinturon || 'Blanco';

    const herramientasGenerales = [
        { id: 'mapa', label: 'MAPA', description: 'Explora posiciones, autores y cursos', route: 'mapa', icon: 'map' },
        { id: 'notas', label: 'BITÁCORA', description: 'Repasa tus apuntes técnicos', route: 'notas_hub', icon: 'notebook' },
        { id: 'buscar', label: 'BUSCAR', description: 'Por nombre, posición o etiqueta', route: 'busqueda', icon: 'search' },
        { id: 'timer', label: 'TIMER', description: 'Rounds, descansos y control', route: 'timer', icon: 'timer' },
        { id: 'instalar', label: 'INSTALAR', description: 'Acceso directo en tu dispositivo', route: 'instalar', icon: 'download' },
        { id: 'micuenta', label: 'MI PERFIL', description: 'Datos, cinturón y contacto', route: 'mi_cuenta', icon: 'user' }
    ];

    const herramientasGestion = esStaff ? [
        { id: 'planeador', label: 'PLANEADOR', description: 'Diseña tus sesiones y contenidos', route: 'planeador', icon: 'clipboard' },
        { id: 'dojo', label: 'DOJO', description: 'Alumnos, pagos y sedes', route: 'alumnos', icon: 'dojo' }
    ] : [];

    const herramientasDial = [...herramientasGenerales, ...herramientasGestion];
    const tamanoRadial = esMovil
        ? Math.max(240, Math.min(340, ancho - 40))
        : esTablet ? 360 : 420;
    const radioDial = esMovil ? tamanoRadial * 0.35 : esTablet ? 128 : 155;
    const tamanoBoton = esMovil
        ? (tamanoRadial <= 280 ? 52 : tamanoRadial <= 320 ? 58 : 62)
        : esTablet ? 82 : 92;
    const tamanoIcono = esMovil
        ? (tamanoRadial <= 280 ? 15 : 17)
        : esTablet ? 20 : 22;
    const tamanoLetra = esMovil
        ? (tamanoRadial <= 280 ? '0.38rem' : '0.44rem')
        : esTablet ? '0.52rem' : '0.56rem';
    const tamanoCentro = esMovil
        ? (tamanoRadial <= 280 ? 60 : 70)
        : esTablet ? 88 : 98;
    const insetAnillo = esMovil
        ? `${Math.round(tamanoRadial * 0.2)}px`
        : esTablet ? '60px' : '70px';
    const angleStep = (2 * Math.PI) / herramientasDial.length;

    const contenedorEstilos = {
        ...styles.container,
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundAttachment: esMovil ? 'scroll' : 'fixed',
        overflowX: 'hidden',
        boxSizing: 'border-box'
    };

    return (
        <div style={contenedorEstilos}>
            <style>{`
                @keyframes pulse-gold {
                    0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
                }
                @keyframes heartbeat-gold {
                    0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }
                    50% { transform: translate(-50%, -50%) scale(1.05); box-shadow: 0 0 25px rgba(212,175,55,0.7); }
                    100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }
                }

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
                    padding: 6px;
                    margin: 15px auto 5px auto;
                    cursor: pointer;
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.7);
                    z-index: 100;
                    backdrop-filter: blur(6px);
                    box-sizing: border-box;
                }
                .user-profile-card-circular:hover,
                .user-profile-card-circular:focus-visible {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                    outline: none;
                }

                .radial-hub-container {
                    position: relative;
                    margin: 18px auto 10px auto;
                    flex-shrink: 0;
                }

                .radial-ring {
                    position: absolute;
                    border: 1px dashed rgba(212, 175, 55, 0.16);
                    border-radius: 50%;
                    pointer-events: none;
                }

                .center-hub-node {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 98px;
                    height: 98px;
                    border-radius: 50%;
                    background: radial-gradient(circle, #222 0%, #0a0a0a 100%);
                    border: 2px solid #d4af37;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    z-index: 20;
                    transition: all 0.3s ease;
                    color: #d4af37;
                    text-align: center;
                }
                .center-hub-node.active-session {
                    animation: heartbeat-gold 2s infinite;
                    background: radial-gradient(circle, rgba(212,175,55,0.2) 0%, #0a0a0a 100%);
                }
                .center-hub-node.active-session:hover {
                    animation: none;
                    transform: translate(-50%, -50%) scale(1.08);
                    background-color: #d4af37;
                    color: #000;
                    cursor: pointer;
                }
                .center-hub-node span {
                    font-size: 0.55rem;
                    font-weight: bold;
                    letter-spacing: 1px;
                }

                .dial-btn-wrapper {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    z-index: 10;
                }

                .dial-btn {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    width: 92px;
                    height: 92px;
                    border-radius: 50%;
                    background-color: rgba(15, 15, 15, 0.96);
                    border: 1px solid #d4af37;
                    color: #d4af37;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    cursor: pointer;
                    overflow: hidden;
                    transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    padding: 6px;
                }
                .dial-btn:hover,
                .dial-btn:focus-visible {
                    background-color: #d4af37;
                    color: #000;
                    transform: translate(-50%, -50%) scale(1.06);
                    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                    outline: none;
                }
                .dial-btn:active {
                    transform: translate(-50%, -50%) scale(0.98);
                }
                .dial-btn svg {
                    flex-shrink: 0;
                }
                .dial-label {
                    font-size: 0.56rem;
                    font-weight: bold;
                    letter-spacing: 0.5px;
                    line-height: 1.1;
                    text-align: center;
                    max-width: 100%;
                }

                .hub-mobile-card {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    min-height: 64px;
                    padding: 10px;
                    background-color: rgba(15, 15, 15, 0.96);
                    border: 1px solid #333;
                    border-radius: 10px;
                    color: #d4af37;
                    text-align: left;
                    cursor: pointer;
                    transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.15s ease;
                    box-sizing: border-box;
                }
                .hub-mobile-card:hover,
                .hub-mobile-card:focus-visible {
                    border-color: #d4af37;
                    background-color: rgba(212, 175, 55, 0.08);
                    outline: none;
                }
                .hub-mobile-card:active {
                    transform: scale(0.98);
                }
                .hub-mobile-icon {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    background-color: #d4af37;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .hub-mobile-label {
                    display: block;
                    font-size: 0.66rem;
                    font-weight: bold;
                    letter-spacing: 0.5px;
                    line-height: 1.15;
                }
                .hub-mobile-sub {
                    display: block;
                    font-size: 0.55rem;
                    color: #888;
                    line-height: 1.2;
                    margin-top: 2px;
                }

                .hub-actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    max-width: 420px;
                    margin: 18px auto 0;
                }
                .hub-action {
                    flex: 1 1 140px;
                    min-width: 140px;
                    max-width: 200px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 9px 12px;
                    background-color: rgba(0, 0, 0, 0.78);
                    border: 1px solid #333;
                    color: #d4af37;
                    border-radius: 8px;
                    font-size: 0.67rem;
                    font-weight: bold;
                    letter-spacing: 0.4px;
                    cursor: pointer;
                    transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.15s ease;
                    box-sizing: border-box;
                }
                .hub-action:hover,
                .hub-action:focus-visible {
                    border-color: #d4af37;
                    background-color: rgba(212, 175, 55, 0.08);
                    outline: none;
                }
                .hub-action:active {
                    transform: scale(0.98);
                }
                .hub-action-logout {
                    border-color: #3a2a2a;
                }

                @media (max-width: 480px) {
                    .user-profile-card-circular {
                        width: 112px;
                        height: 112px;
                    }
                    .hub-action {
                        font-size: 0.62rem;
                        padding: 8px 10px;
                    }
                }
            `}</style>

            <h1 style={{ ...styles.goldTitle, marginTop: '5px', marginBottom: '0', fontSize: esMovil ? '1.15rem' : '1.35rem', position: 'relative', zIndex: 10, textAlign: 'center' }}>
                LA FORTUNA VAULT
            </h1>
            <p style={{ color: '#777', fontSize: '0.58rem', letterSpacing: '2px', margin: '4px 0 0 0', textAlign: 'center', textTransform: 'uppercase' }}>
                Hub de estudio y gestión
            </p>

            {/* PERFIL CIRCULAR */}
            <div
                className="user-profile-card-circular"
                onClick={() => onNavigate('mi_cuenta')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate('mi_cuenta');
                    }
                }}
                title="Mi perfil"
            >
                {(hayNotificacion || anuncioReciente) && (
                    <button
                        type="button"
                        onClick={handleAbrirAnuncio}
                        style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            backgroundColor: hayNotificacion ? '#d4af37' : '#222',
                            border: `2px solid ${hayNotificacion ? '#f0d67a' : '#d4af37'}`,
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            zIndex: 101,
                            animation: hayNotificacion ? 'pulse-gold 2s infinite' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                            padding: 0
                        }}
                        title="Anuncio reciente"
                        aria-label="Abrir anuncio reciente"
                    >
                        <VaultIcon name="bell" size={13} color={hayNotificacion ? '#000' : '#d4af37'} />
                        {hayNotificacion && (
                            <span style={{ position: 'absolute', top: 1, right: 1, width: '6px', height: '6px', backgroundColor: '#000', borderRadius: '50%' }} />
                        )}
                    </button>
                )}

                {tienePerfil ? (
                    <>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            backgroundImage: `url(${usuario.fotoBase64})`, backgroundSize: 'cover',
                            backgroundPosition: 'center', border: '1.5px solid #d4af37', marginBottom: '2px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                        }} />
                        <p style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 'bold', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '92px', textAlign: 'center' }}>
                            {usuario?.nombre || 'Guerrero'}
                        </p>
                        <div style={{ height: '5px', width: '68px', backgroundColor: coloresCinturon[cinturon], borderRadius: '2px', display: 'flex', justifyContent: 'flex-end', border: '1px solid #111' }}>
                            <div style={{ height: '100%', width: '20px', backgroundColor: cinturon === 'Negro' ? '#D32F2F' : '#111', display: 'flex', justifyContent: 'space-evenly' }}>
                                {[...Array(4)].map((_, i) => <div key={i} style={{ height: '100%', width: '2px', backgroundColor: i < grados ? '#FFF' : 'transparent' }} />)}
                            </div>
                        </div>
                        <span style={{ fontSize: '0.42rem', color: '#d4af37', letterSpacing: '1px', marginTop: '3px' }}>MI PERFIL</span>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <VaultIcon name="user" size={30} color="#d4af37" />
                        <p style={{ color: '#d4af37', fontSize: '0.55rem', fontWeight: 'bold', margin: 0 }}>MI PERFIL</p>
                    </div>
                )}
            </div>

            {/* HERRAMIENTAS: MENÚ RADIAL EN MÓVIL, TABLET Y PC */}
            <div
                className="radial-hub-container"
                style={{ width: `${tamanoRadial}px`, height: `${tamanoRadial}px` }}
            >
                <div
                    className="radial-ring"
                    style={{ inset: insetAnillo }}
                />

                <div
                    className={`center-hub-node ${hasSession ? 'active-session' : ''}`}
                    onClick={hasSession ? onContinue : undefined}
                    style={{ width: tamanoCentro, height: tamanoCentro, cursor: hasSession ? 'pointer' : 'default' }}
                    title={hasSession ? 'Continuar estudio' : 'La Fortuna Vault'}
                >
                    <VaultIcon
                        name={hasSession ? 'play' : 'shield'}
                        size={hasSession ? Math.round(tamanoCentro * 0.28) : Math.round(tamanoCentro * 0.32)}
                    />
                    <span style={{ fontSize: esMovil ? (tamanoRadial <= 280 ? '0.4rem' : '0.46rem') : '0.55rem' }}>
                        {hasSession ? 'CONTINUAR' : 'VAULT'}
                    </span>
                </div>

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
                                type="button"
                                className="dial-btn"
                                onClick={() => onNavigate(herramienta.route)}
                                title={herramienta.description}
                                aria-label={`${herramienta.label}: ${herramienta.description}`}
                                style={{
                                    width: tamanoBoton,
                                    height: tamanoBoton,
                                    borderRadius: '50%',
                                    gap: esMovil ? 2 : 5,
                                    padding: esMovil ? 3 : 6
                                }}
                            >
                                <VaultIcon name={herramienta.icon} size={tamanoIcono} />
                                <span className="dial-label" style={{ fontSize: tamanoLetra }}>{herramienta.label}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* ACCIONES SECUNDARIAS */}
            <div className="hub-actions">
                <button type="button" className="hub-action" onClick={() => setShowSoporte(true)}>
                    <VaultIcon name="support" size={14} /> SOPORTE
                </button>
                <button type="button" className="hub-action" onClick={() => setShowTutoriales(true)}>
                    <VaultIcon name="tutorial" size={14} /> TUTORIALES
                </button>
                {esMaestro && (
                    <button type="button" className="hub-action" onClick={() => onNavigate('panel_maestro')} title="Panel Maestro">
                        <VaultIcon name="dashboard" size={14} /> PANEL MAESTRO
                    </button>
                )}
                {esAdmin && (
                    <button type="button" className="hub-action" onClick={() => onNavigate('admin')} title="Control de accesos y usuarios">
                        <VaultIcon name="access" size={14} /> CONTROL DE ACCESOS
                    </button>
                )}
                <button type="button" className="hub-action hub-action-logout" onClick={handleConfirmarLogout}>
                    <VaultIcon name="logout" size={14} /> CERRAR SESIÓN
                </button>
            </div>

            {/* MODAL DE ANUNCIO */}
            {showAnuncio && anuncioReciente && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '16px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #d4af37', padding: esMovil ? '20px' : '25px', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <VaultIcon name="megaphone" size={22} color="#d4af37" />
                            <h3 style={{ color: '#d4af37', margin: 0 }}>{anuncioReciente.titulo || 'Nueva actualización'}</h3>
                        </div>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{anuncioReciente.mensaje}</p>
                        <p style={{ color: '#666', fontSize: '0.7rem', textAlign: 'right' }}>Publicado por Ngasi: {anuncioReciente.fecha}</p>
                        <button onClick={() => setShowAnuncio(false)} style={{ ...styles.btnGold, width: '100%', marginTop: '10px' }}>ENTENDIDO OSS</button>
                    </div>
                </div>
            )}

            {/* MODAL DE SOPORTE */}
            {showSoporte && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '16px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #d4af37', padding: esMovil ? '20px' : '25px', borderRadius: '12px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'center', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
                            <VaultIcon name="support" size={20} color="#d4af37" />
                            <h3 style={{ color: '#d4af37', margin: 0 }}>CONTACTAR A SOPORTE</h3>
                        </div>
                        <textarea
                            value={mensajeSoporte}
                            onChange={(e) => setMensajeSoporte(e.target.value)}
                            placeholder="Escribe tu mensaje aquí..."
                            style={{ width: '100%', height: '120px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#d4af37'}
                            onBlur={(e) => e.target.style.borderColor = '#333'}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowSoporte(false)} style={{ ...styles.btnOutline, flex: 1, borderColor: '#444', color: '#888' }}>CANCELAR</button>
                            <button
                                onClick={handleEnviarSoporte}
                                disabled={enviando || !mensajeSoporte.trim()}
                                style={{ ...styles.btnGold, flex: 1, backgroundColor: enviando ? '#b8962d' : '#d4af37', color: '#000', opacity: (enviando || !mensajeSoporte.trim()) ? 0.6 : 1, cursor: (enviando || !mensajeSoporte.trim()) ? 'not-allowed' : 'pointer' }}
                            >
                                {enviando ? 'ENVIANDO...' : 'ENVIAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE TUTORIALES */}
            {showTutoriales && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001, padding: '16px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #d4af37', padding: esMovil ? '20px' : '25px', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                            <VaultIcon name="tutorial" size={20} color="#d4af37" />
                            <h3 style={{ color: '#d4af37', margin: 0 }}>TUTORIALES DE LA APP</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => window.open('TU_LINK_AQUI', '_blank')}
                                className="hub-mobile-card"
                                style={{ width: '100%', justifyContent: 'flex-start' }}
                            >
                                <span className="hub-mobile-icon">
                                    <VaultIcon name="play" size={14} color="#000" />
                                </span>
                                <span style={{ minWidth: 0 }}>
                                    <span className="hub-mobile-label">1. Introducción al Vault</span>
                                    <span className="hub-mobile-sub">Conceptos básicos y navegación.</span>
                                </span>
                            </button>
                        </div>
                        <button onClick={() => setShowTutoriales(false)} style={{ ...styles.btnOutline, width: '100%', marginTop: '20px', borderColor: '#d4af37', color: '#d4af37' }}>CERRAR</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HubPage;
