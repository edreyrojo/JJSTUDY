import React, { useState, useEffect } from 'react';
// IMPORTANTE: Necesitas estas importaciones para Firestore
import { db } from '../firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

const EstudioPage = ({ video, onBack, onSelectVideo, onNavigateToNotes, vistos = [], toggleVisto, usuario, styles = {}, getAdjacentVideo }) => {
    // --- ESTADOS EXISTENTES ---
    const [nota, setNota] = useState("");
    const [segundosCorriendo, setSegundosCorriendo] = useState(0);
    const [isCronometroActivo, setIsCronometroActivo] = useState(false);
    const [timestamp, setTimestamp] = useState("");
    const [tiempoActivo, setTiempoActivo] = useState(video?.startTime || 0);
    const [nombreMarcador, setNombreMarcador] = useState("");
    const [esMovil, setEsMovil] = React.useState(window.innerWidth < 768);
    const [mostrarAlerta, setMostrarAlerta] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState("");
    const navegarVideo = (direccion) => {
        if (!getAdjacentVideo || !video) return;
        const siguiente = getAdjacentVideo(video, direccion);
        if (siguiente) {
            // Usamos onSelectVideo que ya viene de App.jsx para cambiar el video actual
            onSelectVideo(siguiente);
        } else {
            setMensajeAlerta(direccion === 'next' ? "Fin del curso 🥋" : "Inicio del curso 🥋");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
        }
    };

    // --- NUEVOS ESTADOS PARA REPORTES ---
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [enviandoReporte, setEnviandoReporte] = useState(false);

    // --- EFECTOS ---
    React.useEffect(() => {
        if (video) {
            const notaExistente = usuario?.notas?.[video.id];
            const textoCargado = typeof notaExistente === 'string' ? notaExistente : (notaExistente?.texto || "");
            setNota(textoCargado);

            if (video.startTime !== undefined) {
                setTiempoActivo(video.startTime);
                setSegundosCorriendo(video.startTime);
            } else {
                setTiempoActivo(0);
                setSegundosCorriendo(0);
            }
        }
    }, [video, usuario]);

    React.useEffect(() => {
        let intervalo;
        if (isCronometroActivo) {
            intervalo = setInterval(() => setSegundosCorriendo(s => s + 1), 1000);
        }
        return () => clearInterval(intervalo);
    }, [isCronometroActivo]);

    React.useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- FUNCIONES ---
    const formatearTiempo = (seg) => {
        const m = Math.floor(seg / 60).toString().padStart(2, '0');
        const s = (seg % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const insertarMarcaDeTiempo = () => {
        const tiempoAUsar = timestamp.trim() || formatearTiempo(segundosCorriendo);
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
        } catch (err) { setMensajeAlerta("Error al guardar."); setMostrarAlerta(true); }
    };

    const saltarATiempo = (marcaTexto) => {
        const coincidencia = marcaTexto.match(/(\d+):(\d+)/);
        if (coincidencia) {
            const segs = parseInt(coincidencia[1]) * 60 + parseInt(coincidencia[2]);
            setTiempoActivo(segs);
            setSegundosCorriendo(segs);
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
            setMensajeAlerta("No se pudo enviar el reporte.");
            setMostrarAlerta(true);
        } finally {
            setEnviandoReporte(false);
        }
    };

    const isCompletado = vistos.includes(video?.id);

    return (
        <div style={{ display: 'flex', flexDirection: esMovil ? 'column' : 'row', height: '100vh', width: '100vw', backgroundColor: '#000', color: '#fff', overflow: 'hidden' }}>

            {/* SECCIÓN IZQUIERDA: VIDEO */}
            <div style={{ flex: esMovil ? 'none' : 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #222' }}>

                {/* HEADER CON NAVEGACIÓN MEJORADA */}
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a0a0a', minHeight: '70px' }}>
                    {/* CONTENEDOR DE NAVEGACIÓN DINÁMICA */}
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={onBack} style={{ ...(styles.btnOutline || {}), width: 'auto', padding: '8px 12px' }}>←</button>

                        {/* Solo aparece si existe un video previo */}
                        {getAdjacentVideo(video, 'prev') && (
                            <button
                                onClick={() => navegarVideo('prev')}
                                style={{
                                    ...(styles.btnOutline || {}),
                                    width: 'auto',
                                    padding: '8px 12px',
                                    border: '1px solid #d4af37',
                                    color: '#d4af37'
                                }}
                            >
                                ◁
                            </button>
                        )}

                        {/* Solo aparece si existe un video siguiente */}
                        {getAdjacentVideo(video, 'next') && (
                            <button
                                onClick={() => navegarVideo('next')}
                                style={{
                                    ...(styles.btnOutline || {}),
                                    width: 'auto',
                                    padding: '8px 12px',
                                    border: '1px solid #d4af37',
                                    color: '#d4af37'
                                }}
                            >
                                ▷
                            </button>
                        )}
                    </div>

                    <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                        <span style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '2px', display: 'block' }}>MODO ESTUDIO</span>
                        <h2 style={{ fontSize: '0.9rem', color: '#d4af37', margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video?.titulo}</h2>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button onClick={onNavigateToNotes} style={{ background: 'none', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '4px', fontSize: '0.6rem', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>BITÁCORA</button>
                        <div style={{ cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => toggleVisto(video?.id)}>{isCompletado ? '✅' : '⚪'}</div>
                    </div>
                </div>

                {/* CONTENEDOR DE VIDEO */}
                <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#000', position: 'relative' }}>
                    <iframe
                        key={`${video?.id}-${tiempoActivo}`}
                        src={`https://drive.google.com/file/d/${video?.id}/preview${tiempoActivo ? `?t=${tiempoActivo}` : ''}`}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen
                    ></iframe>
                </div>

                {/* ACCIONES RÁPIDAS DE VIDEO */}
                <div style={{ padding: '8px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={() => navegarVideo('next')}
                        style={{ background: '#d4af3722', border: '1px solid #d4af37', color: '#d4af37', fontSize: '0.6rem', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        SIGUIENTE LECCIÓN ▷
                    </button>

                    <button
                        onClick={() => setMostrarReporte(true)}
                        style={{ background: 'none', border: 'none', color: '#ff6905', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        ¿Problemas con el video? Reportar fallo técnico
                    </button>
                </div>
            </div>

            {/* SECCIÓN DERECHA: NOTAS */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>

                <div style={{ marginBottom: '15px' }}>
                    <h3 style={{ color: '#d4af37', fontSize: '0.8rem', margin: '0 0 5px 0', letterSpacing: '1px' }}>OBSERVACIONES TÉCNICAS:</h3>
                    <p style={{ color: '#555', fontSize: '0.7rem', margin: 0, fontStyle: 'italic' }}>{video?.titulo}</p>
                </div>

                {/* PANEL DE CONTROL DEL CRONÓMETRO */}
                <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.1rem', color: '#d4af37', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatearTiempo(segundosCorriendo)}</span>
                        <button onClick={() => setIsCronometroActivo(!isCronometroActivo)} style={{ ...(styles.btnGold || {}), width: 'auto', padding: '6px 15px', fontSize: '0.65rem' }}>
                            {isCronometroActivo ? 'PAUSAR SYNC' : 'INICIAR SYNC'}
                        </button>
                    </div>
                    <input placeholder="Nombre de la posición o detalle..." value={nombreMarcador} onChange={(e) => setNombreMarcador(e.target.value)} style={{ ...(styles.input || {}), marginBottom: '10px', fontSize: '0.8rem' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input placeholder="00:00" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} style={{ width: '75px', backgroundColor: '#000', border: '1px solid #333', color: '#d4af37', textAlign: 'center', borderRadius: '5px', fontWeight: 'bold' }} />
                        <button onClick={insertarMarcaDeTiempo} style={{ flex: 1, ...(styles.btnGold || {}), fontSize: '0.7rem', fontWeight: 'bold' }}>+ AÑADIR A BITÁCORA</button>
                    </div>
                </div>

                {/* TRACKER DE MARCAS DINÁMICO */}
                <p style={{ fontSize: '0.6rem', color: '#444', margin: '0 0 8px 5px', letterSpacing: '1px' }}>MARCADORES EN ESTE VIDEO:</p>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '15px', scrollbarWidth: 'none' }}>
                    {(nota.match(/\[\d+:\d+\]\s*(?:-?\s*([^[\n]*))?/g) || []).map((marcaCompleta, i) => {
                        const tiempoMatch = marcaCompleta.match(/\[\d+:\d+\]/);
                        if (!tiempoMatch) return null;
                        const tiempo = tiempoMatch[0];
                        const nombre = marcaCompleta.replace(tiempo, "").replace(/^\s*-\s*/, "").trim() || "Marca";
                        return (
                            <button key={i} onClick={() => saltarATiempo(tiempo)} style={{ fontSize: '0.65rem', padding: '8px 14px', backgroundColor: '#d4af3711', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                📍 {tiempo} {nombre}
                            </button>
                        );
                    })}
                </div>

                <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    style={{ flex: 1, minHeight: '200px', backgroundColor: '#0a0a0a', color: '#ddd', padding: '15px', borderRadius: '8px', border: '1px solid #222', fontSize: '0.85rem', resize: 'none', lineHeight: '1.6' }}
                    placeholder="Escribe aquí los detalles del sistema..."
                />

                <button style={{ ...(styles.btnGold || {}), marginTop: '15px', padding: '15px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.1)' }} onClick={guardar}>GUARDAR CAMBIOS</button>
            </div>

            {/* MODAL DE REPORTE TÉCNICO */}
            {mostrarReporte && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005, padding: '20px' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #ff4444', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
                        <h3 style={{ color: '#ff4444', marginTop: 0 }}>REPORTAR VIDEO</h3>
                        <p style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: '1.5' }}>
                            ¿El video <b>"{video?.titulo}"</b> no carga o tiene errores? Ngasi revisará el enlace en el Vault.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setMostrarReporte(false)} style={{ flex: 1, padding: '10px', background: '#222', color: '#666', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CANCELAR</button>
                            <button
                                onClick={enviarReporteVideo}
                                disabled={enviandoReporte}
                                style={{ flex: 1, padding: '10px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
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