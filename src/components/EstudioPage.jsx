import React, { useState, useEffect } from 'react';
// IMPORTANTE: Importaciones para Firestore
import { db } from '../firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo, // 'success', 'error', 'warning', 'info'
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        border: '1px solid #d4af37',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};

const EstudioPage = ({ video, onBack, onSelectVideo, onNavigateToNotes, vistos = [], toggleVisto, usuario, styles = {}, getAdjacentVideo }) => {
    // --- ESTADOS ---
    const [nota, setNota] = useState("");
    const [timestamp, setTimestamp] = useState("");
    const [tiempoActivo, setTiempoActivo] = useState(video?.startTime || 0);
    const [nombreMarcador, setNombreMarcador] = useState("");
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [mostrarAlerta, setMostrarAlerta] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState("");
    
    // --- ESTADOS PARA REPORTES ---
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [enviandoReporte, setEnviandoReporte] = useState(false);

    const navegarVideo = (direccion) => {
        if (!getAdjacentVideo || !video) return;
        const siguiente = getAdjacentVideo(video, direccion);
        if (siguiente) {
            onSelectVideo(siguiente);
        } else {
            setMensajeAlerta(direccion === 'next' ? "Fin del curso 🥋" : "Inicio del curso 🥋");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
        }
    };

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

                        {getAdjacentVideo(video, 'prev') && (
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
                                ◁
                            </button>
                        )}

                        {getAdjacentVideo(video, 'next') && (
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
                                ▷
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

                {/* REPRODUCTOR DE VIDEO OPTIMIZADO CON ESPACIO SUFICIENTE PARA CONTROLES MÓVILES */}
                <div style={{ 
                    width: '100%', 
                    aspectRatio: esMovil ? '4/3' : '16/9', 
                    minHeight: esMovil ? '280px' : 'auto',
                    backgroundColor: '#000', 
                    position: 'relative', 
                    flexShrink: 0,
                    marginBottom: '8px'
                }}>
                    <iframe
                        key={`${video?.id}-${tiempoActivo}`}
                        src={`https://drive.google.com/file/d/${video?.id}/preview${tiempoActivo ? `?t=${tiempoActivo}` : ''}`}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                    ></iframe>
                </div>

                {/* TÍTULO EN MÓVIL (COMPACTO, JUSTO DEBAJO DEL VIDEO) */}
                {esMovil && (
                    <div style={{ padding: '8px 15px 4px 15px', textAlign: 'center', backgroundColor: '#070707' }}>
                        <span style={{ fontSize: '0.5rem', color: '#d4af37', letterSpacing: '2px', display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>MODO ESTUDIO</span>
                        <h2 style={{ fontSize: '0.85rem', color: '#d4af37', margin: 0, fontWeight: 'bold', wordBreak: 'break-word', letterSpacing: '0.5px', lineHeight: '1.3' }}>{video?.titulo}</h2>
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

                    <button
                        onClick={() => setMostrarReporte(true)}
                        style={{ background: 'none', border: 'none', color: '#d4af37', opacity: 0.8, fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        ¿Problemas con el video? Reportar fallo técnico
                    </button>
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