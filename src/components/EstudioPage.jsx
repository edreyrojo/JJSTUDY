import React, { useState, useEffect } from 'react';
// IMPORTANTE: Importaciones para Firestore
import { db } from '../firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { obtenerTecnica } from '../data/vaultIndex';
import { tieneAccesoVideo, pedirAcceso } from '../utils/accesoVault';

const EstudioPage = ({ video, onBack, onSelectVideo, onNavigateToNotes, vistos = [], toggleVisto, usuario, styles = {}, getAdjacentVideo }) => {
    // --- ESTADOS ---
    const [nota, setNota] = useState("");
    const [timestamp, setTimestamp] = useState("");
    const [tiempoActivo, setTiempoActivo] = useState(video?.startTime || 0);
    const [nombreMarcador, setNombreMarcador] = useState("");
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const [mostrarAlerta, setMostrarAlerta] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState("");
    
    // --- ESTADOS PARA REPORTES ---
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [enviandoReporte, setEnviandoReporte] = useState(false);

    const navegarVideo = (direccion) => {
        if (!getAdjacentVideo || !video) return;
        const siguiente = getAdjacentVideo(video, direccion);
        if (!siguiente) {
            setMensajeAlerta(direccion === 'next' ? "Fin del curso 🥋" : "Inicio del curso 🥋");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
            return;
        }

        const tecnica = obtenerTecnica(siguiente.id);
        if (tecnica && !tieneAccesoVideo(usuario, tecnica)) {
            if (window.confirm(
                `CONTENIDO BLOQUEADO 🔒\n\n"${tecnica.nombre}" requiere autorización.\nCada curso tiene un video de prueba gratuito; para ver el resto necesitas acceso.\n\n¿Deseas solicitar acceso a "${tecnica.cursoTitulo}" por WhatsApp?`
            )) {
                pedirAcceso(usuario, tecnica.cursoTitulo);
            }
            return;
        }

        onSelectVideo(siguiente);
    };

    const videoAnterior = getAdjacentVideo && video ? getAdjacentVideo(video, 'prev') : null;
    const videoSiguiente = getAdjacentVideo && video ? getAdjacentVideo(video, 'next') : null;
    const tecnicaAnterior = videoAnterior ? obtenerTecnica(videoAnterior.id) : null;
    const tecnicaSiguiente = videoSiguiente ? obtenerTecnica(videoSiguiente.id) : null;
    const puedeAnterior = !tecnicaAnterior || tieneAccesoVideo(usuario, tecnicaAnterior);
    const puedeSiguiente = !tecnicaSiguiente || tieneAccesoVideo(usuario, tecnicaSiguiente);

    // --- EFECTOS ---
    useEffect(() => {
        if (video) {
            const notaExistente = usuario?.notas?.[video.id];
            const textoCargado = typeof notaExistente === 'string' ? notaExistente : (notaExistente?.texto || "");
            setNota(textoCargado);

            if (video.startTime !== undefined) {
                setTiempoActivo(video.startTime);
            } else {
                setTiempoActivo(0);
            }
        }
    }, [video, usuario]);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- FUNCIONES ---
    const insertarMarcaDeTiempo = () => {
        const tiempoAUsar = timestamp.trim() || "00:00";
        const etiqueta = nombreMarcador.trim() || "Punto de interés";
        const nuevaLinea = `\n[${tiempoAUsar}] - ${etiqueta}`;
        setNota(prev => prev + nuevaLinea);
        setTimestamp("");
        setNombreMarcador("");
    };

    const guardar = async () => {
        if (!video?.id || !usuario?.uid) return;
        try {
            const userRef = doc(db, "usuarios", usuario.uid);
            await setDoc(userRef, {
                notas: {
                    [video.id]: {
                        texto: nota,
                        titulo: video.titulo,
                        fecha: new Date().toLocaleString(),
                        videoId: video.id
                    }
                }
            }, { merge: true });
            setMensajeAlerta("Vault Sincronizado 🛡️");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
        } catch (err) { 
            console.error("Error al guardar nota:", err);
            setMensajeAlerta("Error al guardar."); 
            setMostrarAlerta(true); 
            setTimeout(() => setMostrarAlerta(false), 2000);
        }
    };

    const saltarATiempo = (marcaTexto) => {
        const coincidencia = marcaTexto.match(/(\d+):(\d+)/);
        if (coincidencia) {
            const segs = parseInt(coincidencia[1]) * 60 + parseInt(coincidencia[2]);
            setTiempoActivo(segs);
        }
    };

    // --- FUNCIÓN DE REPORTE DE VIDEO ---
    const enviarReporteVideo = async () => {
        setEnviandoReporte(true);
        try {
            await addDoc(collection(db, "soporte"), {
                uid: usuario?.uid || "anonimo",
                nombre: usuario?.nombre || "Usuario",
                email: usuario?.email || "Sin email",
                mensaje: `⚠️ ERROR DE CARGA EN VIDEO: "${video?.titulo}" (ID: ${video?.id}). El alumno informa que el contenido no es accesible.`,
                fecha: new Date().toLocaleString(),
                estado: "pendiente",
                tipo: "video_fail",
                videoId: video?.id
            });
            setMensajeAlerta("Reporte enviado a Ngasi 🛡️");
            setMostrarAlerta(true);
            setMostrarReporte(false);
            setTimeout(() => setMostrarAlerta(false), 3000);
        } catch (error) {
            console.error("Error al enviar reporte:", error);
            setMensajeAlerta("No se pudo enviar el reporte.");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 3000);
        } finally {
            setEnviandoReporte(false);
        }
    };

    const isCompletado = vistos.includes(video?.id);

    // En móvil usamos 16:9 (la forma real del video) y quitamos la barra
    // superior de Drive con rm=minimal. Antes se forzaba 4:3 + minHeight,
    // lo que dejaba una franja negra encima del video que tapaba los controles.
    const paramsDrive = [];
    if (esMovil) paramsDrive.push('rm=minimal');
    if (tiempoActivo) paramsDrive.push(`t=${tiempoActivo}`);
    const driveSrc = `https://drive.google.com/file/d/${video?.id}/preview${paramsDrive.length ? `?${paramsDrive.join('&')}` : ''}`;

    const abrirEnDrive = () => {
        if (!video?.id) return;
        window.open(`https://drive.google.com/file/d/${video.id}/view`, '_blank', 'noopener,noreferrer');
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: esMovil ? 'column' : 'row', 
            minHeight: '100vh', 
            width: '100%', 
            boxSizing: 'border-box', 
            backgroundColor: '#000', 
            color: '#fff', 
            overflowX: 'hidden' 
        }}>

            {/* SECCIÓN IZQUIERDA: REPRODUCTOR Y CONTROLES */}
            <div style={{ 
                flex: esMovil ? 'none' : 3, 
                width: '100%', 
                boxSizing: 'border-box', 
                display: 'flex', 
                flexDirection: 'column', 
                borderRight: esMovil ? 'none' : '1px solid #222', 
                borderBottom: esMovil ? '1px solid #222' : 'none' 
            }}>

                {/* HEADER COMPACTO CON NOTCH SAFE-AREA */}
                <div style={{ 
                    paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 12px) + 6px)' : '10px',
                    paddingBottom: '8px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    backgroundColor: '#0a0a0a', 
                    minHeight: esMovil ? '55px' : '65px', 
                    boxSizing: 'border-box',
                    borderBottom: '1px solid #1a1a1a'
                }}>
                    {/* BOTONES DE NAVEGACIÓN */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button 
                            onClick={onBack} 
                            style={{ 
                                ...(styles.btnOutline || {}), 
                                width: 'auto', 
                                padding: esMovil ? '6px 12px' : '8px 12px', 
                                fontSize: esMovil ? '0.85rem' : 'inherit',
                                borderColor: '#d4af37',
                                color: '#d4af37',
                                cursor: 'pointer'
                            }}
                        >
                            ←
                        </button>

                        {videoAnterior && (
                            <button
                                onClick={() => navegarVideo('prev')}
                                style={{ 
                                    ...(styles.btnOutline || {}), 
                                    width: 'auto', 
                                    padding: esMovil ? '6px 12px' : '8px 12px', 
                                    border: '1px solid #d4af37', 
                                    color: '#d4af37',
                                    fontSize: esMovil ? '0.85rem' : 'inherit',
                                    cursor: 'pointer'
                                }}
                            >
                                {puedeAnterior ? '◁' : '🔒'}
                            </button>
                        )}

                        {videoSiguiente && (
                            <button
                                onClick={() => navegarVideo('next')}
                                style={{ 
                                    ...(styles.btnOutline || {}), 
                                    width: 'auto', 
                                    padding: esMovil ? '6px 12px' : '8px 12px', 
                                    border: '1px solid #d4af37', 
                                    color: '#d4af37',
                                    fontSize: esMovil ? '0.85rem' : 'inherit',
                                    cursor: 'pointer'
                                }}
                            >
                                {puedeSiguiente ? '▷' : '🔒'}
                            </button>
                        )}
                    </div>

                    {/* TÍTULO EN DESKTOP (CENTRADITO) */}
                    {!esMovil && (
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 10px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.55rem', color: '#d4af37', letterSpacing: '2px', display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>MODO ESTUDIO</span>
                            <h2 style={{ fontSize: '0.9rem', color: '#d4af37', margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '1px' }}>{video?.titulo}</h2>
                        </div>
                    )}

                    {/* HERRAMIENTAS DERECHAS */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                        <button
                            onClick={() => setPantallaCompleta(v => !v)}
                            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                            aria-label="Pantalla completa"
                            style={{
                                background: 'none',
                                border: '1px solid #d4af37',
                                color: '#d4af37',
                                borderRadius: '4px',
                                fontSize: esMovil ? '1rem' : '0.9rem',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                lineHeight: 1
                            }}
                        >
                            ⛶
                        </button>
                        <button 
                            onClick={onNavigateToNotes} 
                            style={{ 
                                background: 'none', 
                                border: '1px solid #d4af37', 
                                color: '#d4af37', 
                                borderRadius: '4px', 
                                fontSize: esMovil ? '0.6rem' : '0.6rem', 
                                padding: esMovil ? '6px 10px' : '5px 10px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold' 
                            }}
                        >
                            BITÁCORA
                        </button>
                        <div 
                            style={{ 
                                cursor: 'pointer', 
                                fontSize: esMovil ? '1.3rem' : '1.2rem', 
                                padding: '2px',
                                color: isCompletado ? '#d4af37' : '#777',
                                filter: isCompletado ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.7))' : 'grayscale(100%) opacity(0.4)',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }} 
                            onClick={() => toggleVisto(video?.id)}
                            title={isCompletado ? "Lección completada" : "Marcar como vista"}
                        >
                            👁️
                        </div>
                    </div>
                </div>

                {/* REPRODUCTOR: 16:9 en móvil para que el video no quede dentro de una caja 4:3 con franjas negras */}
                <div style={{
                    position: pantallaCompleta ? 'fixed' : 'relative',
                    inset: pantallaCompleta ? 0 : undefined,
                    zIndex: pantallaCompleta ? 9990 : 'auto',
                    width: '100%',
                    aspectRatio: pantallaCompleta ? undefined : '16 / 9',
                    backgroundColor: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    marginBottom: pantallaCompleta ? 0 : '8px',
                    overflow: 'hidden'
                }}>
                    {pantallaCompleta && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px',
                            backgroundColor: '#0a0a0a',
                            borderBottom: '1px solid #222',
                            flexShrink: 0
                        }}>
                            <span style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {video?.titulo}
                            </span>
                            <button
                                onClick={() => setPantallaCompleta(false)}
                                style={{ ...(styles.btnOutline || {}), width: 'auto', padding: '6px 10px', fontSize: '0.7rem', borderColor: '#d4af37', color: '#d4af37', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                            >
                                ✕ SALIR
                            </button>
                        </div>
                    )}

                    <div style={{
                        position: pantallaCompleta ? 'relative' : 'absolute',
                        top: pantallaCompleta ? undefined : 0,
                        left: pantallaCompleta ? undefined : 0,
                        flex: pantallaCompleta ? 1 : undefined,
                        minHeight: 0,
                        width: '100%',
                        height: pantallaCompleta ? undefined : '100%'
                    }}>
                        <iframe
                            key={`${video?.id}-${tiempoActivo}`}
                            src={driveSrc}
                            title={video?.titulo || 'Reproductor de video'}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                            allowFullScreen
                        ></iframe>
                    </div>
                </div>

                {/* TÍTULO EN MÓVIL (COMPACTO, JUSTO DEBAJO DEL VIDEO) */}
                {esMovil && (
                    <div style={{ padding: '8px 15px 4px 15px', textAlign: 'center', backgroundColor: '#070707' }}>
                        <span style={{ fontSize: '0.5rem', color: '#d4af37', letterSpacing: '2px', display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>MODO ESTUDIO</span>
                        <h2 style={{ fontSize: '0.85rem', color: '#d4af37', margin: 0, fontWeight: 'bold', wordBreak: 'break-word', letterSpacing: '0.5px', lineHeight: '1.3' }}>{video?.titulo}</h2>
                        <button
                            onClick={() => setPantallaCompleta(true)}
                            style={{ marginTop: '6px', background: 'none', border: 'none', color: '#d4af37', fontSize: '0.62rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            ⛶ Ver en pantalla completa
                        </button>
                    </div>
                )}

                {/* BOTÓN SIGUIENTE LECCIÓN Y REPORTAR FALLO */}
                <div style={{ padding: '10px 15px 16px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', backgroundColor: esMovil ? '#070707' : 'transparent' }}>
                    <button
                        onClick={() => navegarVideo('next')}
                        title="Siguiente lección"
                        style={{ 
                            background: '#111', 
                            border: '1px solid #d4af37', 
                            color: '#d4af37', 
                            fontSize: '1.1rem', 
                            padding: '6px 20px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 10px rgba(212, 175, 55, 0.15)',
                            transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        ⏭
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <button
                            onClick={() => setMostrarReporte(true)}
                            style={{ background: 'none', border: 'none', color: '#d4af37', opacity: 0.8, fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            ¿Problemas con el video? Reportar fallo técnico
                        </button>
                        {esMovil && (
                            <button
                                onClick={abrirEnDrive}
                                style={{ background: 'none', border: 'none', color: '#8a8a8a', fontSize: '0.62rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Si los controles no responden, abrir en Drive ↗
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN DERECHA: NOTAS Y SINCRONIZACIÓN MANUAL */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px', backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

                {!esMovil && (
                    <div style={{ marginBottom: '15px' }}>
                        <h3 style={{ color: '#d4af37', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>OBSERVACIONES TÉCNICAS:</h3>
                        <p style={{ color: '#777', fontSize: '0.7rem', margin: 0, fontStyle: 'italic' }}>{video?.titulo}</p>
                    </div>
                )}

                {/* PANEL DE SINCRONIZACIÓN MANUAL */}
                <div style={{ backgroundColor: '#111', padding: '14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #222' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#d4af37', letterSpacing: '1px', fontWeight: 'bold', display: 'block' }}>SINCRONIZACIÓN MANUAL DE PISTA:</span>
                    </div>
                    <input 
                        placeholder="Título de la posición o detalle..." 
                        value={nombreMarcador} 
                        onChange={(e) => setNombreMarcador(e.target.value)} 
                        style={{ ...(styles.input || {}), marginBottom: '10px', fontSize: '0.8rem', boxSizing: 'border-box', width: '100%', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', padding: '8px 10px', borderRadius: '6px', outline: 'none' }} 
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            placeholder="00:00" 
                            value={timestamp} 
                            onChange={(e) => setTimestamp(e.target.value)} 
                            style={{ width: '80px', backgroundColor: '#0a0a0a', border: '1px solid #333', color: '#d4af37', textAlign: 'center', borderRadius: '6px', fontWeight: 'bold', outline: 'none', padding: '8px', fontSize: '0.85rem' }} 
                        />
                        <button onClick={insertarMarcaDeTiempo} style={{ flex: 1, ...(styles.btnGold || {}), fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', padding: '8px 10px' }}>+ AÑADIR A BITÁCORA</button>
                    </div>
                </div>

                {/* TRACKER DE MARCAS DINÁMICO */}
                <p style={{ fontSize: '0.6rem', color: '#d4af37', opacity: 0.7, margin: '0 0 8px 4px', letterSpacing: '1px' }}>MARCADORES EN ESTE VIDEO:</p>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px', scrollbarWidth: 'none' }}>
                    {(nota.match(/\[\d+:\d+\]\s*(?:-?\s*([^[\n]*))?/g) || []).map((marcaCompleta, i) => {
                        const tiempoMatch = marcaCompleta.match(/\[\d+:\d+\]/);
                        if (!tiempoMatch) return null;
                        const tiempo = tiempoMatch[0];
                        const nombre = marcaCompleta.replace(tiempo, "").replace(/^\s*-\s*/, "").trim() || "Marca";
                        return (
                            <button key={i} onClick={() => saltarATiempo(tiempo)} style={{ fontSize: '0.65rem', padding: '6px 12px', backgroundColor: '#d4af3711', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                                📍 {tiempo} {nombre}
                            </button>
                        );
                    })}
                </div>

                <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    style={{ flex: 1, minHeight: '180px', backgroundColor: '#0a0a0a', color: '#ddd', padding: '12px', borderRadius: '8px', border: '1px solid #222', fontSize: '0.85rem', resize: 'none', lineHeight: '1.5', boxSizing: 'border-box', width: '100%', outline: 'none' }}
                    placeholder="Escribe aquí los detalles del sistema..."
                />

                <button style={{ ...(styles.btnGold || {}), marginTop: '14px', padding: '14px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.1)', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }} onClick={guardar}>GUARDAR CAMBIOS</button>
            </div>

            {/* MODAL DE REPORTE TÉCNICO */}
            {mostrarReporte && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #d4af37', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '350px', textAlign: 'center', boxSizing: 'border-box' }}>
                        <h3 style={{ color: '#d4af37', marginTop: 0 }}>REPORTAR VIDEO</h3>
                        <p style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: '1.5' }}>
                            ¿El video <b>"{video?.titulo}"</b> no carga o tiene errores? Ngasi revisará el enlace en el Vault.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setMostrarReporte(false)} style={{ flex: 1, padding: '10px', background: '#222', color: '#888', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CANCELAR</button>
                            <button
                                onClick={enviarReporteVideo}
                                disabled={enviandoReporte}
                                style={{ flex: 1, padding: '10px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {enviandoReporte ? 'ENVIANDO...' : 'CONFIRMAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ALERTA FLOTANTE */}
            {mostrarAlerta && (
                <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#d4af37', color: '#000', padding: '12px 25px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {mensajeAlerta}
                </div>
            )}
        </div>
    );
};

export default EstudioPage;