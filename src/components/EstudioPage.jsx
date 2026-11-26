import React, { useState, useEffect, useRef } from 'react';
// IMPORTANTE: Importaciones para Firestore
import { db } from '../firebase';
import { doc, setDoc, addDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { obtenerTecnica } from '../data/vaultIndex';
import { tieneAccesoVideo, pedirAcceso } from '../utils/accesoVault';
import { driveMediaUrl } from '../utils/driveVideo';
import { mensajeContenidoBloqueado } from '../i18n/translate';
import VaultIcon from './VaultIcon';
import { useDialogA11y } from '../hooks/useDialogA11y';

const EstudioPage = ({ video, onBack, onSelectVideo, onNavigateToNotes, vistos = [], toggleVisto, usuario, styles = {}, getAdjacentVideo, accesoRutas }) => {
    // --- ESTADOS ---
    const [nota, setNota] = useState("");
    const [timestamp, setTimestamp] = useState("");
    const [tiempoActivo, setTiempoActivo] = useState(video?.startTime || 0);
    const [nombreMarcador, setNombreMarcador] = useState("");
    const [marcasGlobales, setMarcasGlobales] = useState([]);
    const [duracionVideo, setDuracionVideo] = useState(0);
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef(null);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [esTablet, setEsTablet] = useState(() => {
        const ancho = window.innerWidth;
        return ancho >= 768 && ancho < 1100;
    });
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const [mostrarAlerta, setMostrarAlerta] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState("");
    
    // --- ESTADOS PARA REPORTES ---
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [enviandoReporte, setEnviandoReporte] = useState(false);
    const reporteDialogRef = useDialogA11y(mostrarReporte, () => setMostrarReporte(false));

    const navegarVideo = (direccion) => {
        if (!getAdjacentVideo || !video) return;
        const siguiente = getAdjacentVideo(video, direccion);
        if (!siguiente) {
            setMensajeAlerta(direccion === 'next' ? "Fin del curso" : "Inicio del curso");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
            return;
        }

        const tecnica = obtenerTecnica(siguiente.id);
        if (tecnica && !tieneAccesoVideo(usuario, tecnica, accesoRutas)) {
            if (window.confirm(mensajeContenidoBloqueado(tecnica))) {
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
    const puedeAnterior = !tecnicaAnterior || tieneAccesoVideo(usuario, tecnicaAnterior, accesoRutas);
    const puedeSiguiente = !tecnicaSiguiente || tieneAccesoVideo(usuario, tecnicaSiguiente, accesoRutas);
    // Si una marca quedó guardada con un minuto mayor a la duración real del
    // video, no se muestra: no se puede saltar a un punto que no existe.
    const marcasGlobalesVisibles = marcasGlobales.filter(
        (marca) => !duracionVideo || Number(marca.segundos) <= duracionVideo + 1
    );

    // --- EFECTOS ---
    useEffect(() => {
        if (video) {
            setVideoError(false);
            setDuracionVideo(0);
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

    // Marcas de tiempo globales creadas por el administrador para este video.
    useEffect(() => {
        if (!video?.id) {
            setMarcasGlobales([]);
            return undefined;
        }
        const q = query(collection(db, 'marcasVideo'), where('videoId', '==', video.id));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const lista = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => Number(a.segundos) - Number(b.segundos));
                setMarcasGlobales(lista);
            },
            (error) => {
                console.error('No se pudieron cargar los marcadores globales:', error);
                setMarcasGlobales([]);
            }
        );
        return () => unsub();
    }, [video?.id]);

    // Busca el minuto exacto en el reproductor nativo cuando el usuario toca
    // una marca de tiempo (global o privada).
    useEffect(() => {
        if (video?.fuente === 'youtube' || videoError) return;
        const player = videoRef.current;
        if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
        const destino = Math.min(Math.max(0, tiempoActivo), Math.max(0, player.duration - 0.5));
        if (Math.abs(player.currentTime - destino) > 0.75) {
            try {
                player.currentTime = destino;
            } catch (error) {
                console.error('No se pudo mover el video:', error);
            }
        }
    }, [tiempoActivo, video?.id, video?.fuente, videoError]);

    useEffect(() => {
        const handleResize = () => {
            const ancho = window.innerWidth;
            setEsMovil(ancho < 768);
            setEsTablet(ancho >= 768 && ancho < 1100);
        };
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
                        cursoTitulo: video.cursoTitulo || '',
                        fuente: video.fuente || 'drive',
                        fecha: new Date().toLocaleString(),
                        videoId: video.id
                    }
                }
            }, { merge: true });
            setMensajeAlerta("Vault sincronizado");
            setMostrarAlerta(true);
            setTimeout(() => setMostrarAlerta(false), 2000);
        } catch (err) { 
            console.error("Error al guardar nota:", err);
            setMensajeAlerta("Error al guardar."); 
            setMostrarAlerta(true); 
            setTimeout(() => setMostrarAlerta(false), 2000);
        }
    };

    const saltarASegundos = (segundos) => {
        const valor = Number(segundos);
        if (Number.isFinite(valor) && valor >= 0) setTiempoActivo(Math.round(valor));
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
                mensaje: `ERROR DE CARGA EN VIDEO: "${video?.titulo}" (ID: ${video?.id}). El alumno informa que el contenido no es accesible.`,
                fecha: new Date().toLocaleString(),
                estado: "pendiente",
                tipo: "video_fail",
                videoId: video?.id
            });
            setMensajeAlerta("Reporte enviado a Ngasi");
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
    // superior de Drive con rm=minimal. Los videos indexados de YouTube usan
    // su propio embed para no mezclar fuentes.
    const fuente = video?.fuente === 'youtube' ? 'youtube' : 'drive';
    const driveId = video?.driveId || video?.id;
    const youtubeId = video?.youtubeId || '';
    const paramsDrive = [];
    if (esMovil) paramsDrive.push('rm=minimal');
    if (tiempoActivo) paramsDrive.push(`t=${tiempoActivo}`);
    const driveSrc = `https://drive.google.com/file/d/${driveId}/preview${paramsDrive.length ? `?${paramsDrive.join('&')}` : ''}`;
    const youtubeSrc = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1${tiempoActivo ? `&start=${tiempoActivo}` : ''}`;
    const videoSrc = fuente === 'youtube' ? youtubeSrc : driveSrc;
    const driveApiSrc = driveMediaUrl(driveId);
    const usarNativo = fuente === 'drive' && !videoError;

    const tamanoBotonBarra = '40px';
    const estiloIconoBarra = {
        ...(styles.btnOutline || {}),
        width: tamanoBotonBarra,
        height: tamanoBotonBarra,
        minWidth: tamanoBotonBarra,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        flexShrink: 0,
        cursor: 'pointer',
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: esMovil ? 'column' : 'row', 
            minHeight: 'var(--app-vh)', 
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
                    paddingTop: `calc(env(safe-area-inset-top, 0px) + ${esMovil ? '6px' : '10px'})`,
                    paddingBottom: '8px',
                    paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
                    paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '8px',
                    backgroundColor: '#0a0a0a', 
                    minHeight: esMovil ? '55px' : '65px', 
                    boxSizing: 'border-box',
                    borderBottom: '1px solid #1a1a1a',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20
                }}>
                    {/* BOTONES DE NAVEGACIÓN */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={onBack}
                            title="Volver al mapa"
                            aria-label="Volver al mapa"
                            style={estiloIconoBarra}
                        >
                            <VaultIcon name="map" size={17} />
                        </button>

                        {videoAnterior && (
                            <button
                                type="button"
                                onClick={() => navegarVideo('prev')}
                                title="Lección anterior"
                                aria-label="Lección anterior"
                                style={estiloIconoBarra}
                            >
                                {puedeAnterior ? <VaultIcon name="chevronLeft" size={16} /> : <VaultIcon name="lock" size={15} color="#d4af37" />}
                            </button>
                        )}

                        {videoSiguiente && (
                            <button
                                type="button"
                                onClick={() => navegarVideo('next')}
                                title="Siguiente lección"
                                aria-label="Siguiente lección"
                                style={estiloIconoBarra}
                            >
                                {puedeSiguiente ? <VaultIcon name="chevronRight" size={16} /> : <VaultIcon name="lock" size={15} color="#d4af37" />}
                            </button>
                        )}
                    </div>

                    {/* TÍTULO EN DESKTOP (CENTRADITO) */}
                    {!esMovil && !esTablet && (
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 10px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.55rem', color: '#d4af37', letterSpacing: '2px', display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>MODO ESTUDIO</span>
                            <h2 style={{ fontSize: '0.9rem', color: '#d4af37', margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '1px' }}>{video?.titulo}</h2>
                        </div>
                    )}

                    {/* HERRAMIENTAS DERECHAS */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => setPantallaCompleta(v => !v)}
                            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                            aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                            style={estiloIconoBarra}
                        >
                            <VaultIcon name="fullscreen" size={17} />
                        </button>
                        <button
                            type="button"
                            onClick={onNavigateToNotes}
                            title="Bitácora"
                            aria-label="Bitácora"
                            style={(esMovil || esTablet) ? estiloIconoBarra : {
                                background: 'transparent',
                                border: '1px solid #d4af37',
                                color: '#d4af37',
                                borderRadius: '8px',
                                padding: '0 10px',
                                height: '40px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                        >
                            {(esMovil || esTablet)
                                ? <VaultIcon name="notebook" size={17} />
                                : 'BITÁCORA'}
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleVisto(video?.id)}
                            title={isCompletado ? 'Lección completada' : 'Marcar como vista'}
                            aria-label={isCompletado ? 'Lección completada' : 'Marcar como vista'}
                            style={{
                                ...estiloIconoBarra,
                                color: isCompletado ? '#d4af37' : '#888',
                                borderColor: isCompletado ? '#d4af37' : '#333',
                                background: isCompletado ? 'rgba(212,175,55,0.08)' : '#111',
                            }}
                        >
                            <VaultIcon name="eye" size={18} />
                        </button>
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
                            padding: `calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 12px) 8px calc(env(safe-area-inset-left, 0px) + 12px)`,
                            backgroundColor: '#0a0a0a',
                            borderBottom: '1px solid #222',
                            flexShrink: 0
                        }}>
                            <span style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {video?.titulo}
                            </span>
                            <button
                                onClick={() => setPantallaCompleta(false)}
                                style={{ ...(styles.btnOutline || {}), width: 'auto', padding: '6px 10px', fontSize: '0.7rem', borderColor: '#d4af37', color: '#d4af37', borderRadius: '6px', cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            >
                                <VaultIcon name="close" size={12} /> SALIR
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
                        {usarNativo ? (
                            <video
                                ref={videoRef}
                                src={driveApiSrc}
                                poster={`https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`}
                                controls
                                playsInline
                                preload="metadata"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', objectFit: 'contain' }}
                                onLoadedMetadata={(event) => {
                                    const player = event.currentTarget;
                                    setDuracionVideo(Number.isFinite(player.duration) ? player.duration : 0);
                                    if (tiempoActivo > 0 && Number.isFinite(player.duration)) {
                                        player.currentTime = Math.min(tiempoActivo, Math.max(0, player.duration - 0.5));
                                    }
                                }}
                                onError={() => setVideoError(true)}
                            >
                                Tu navegador no puede reproducir este video.
                            </video>
                        ) : (
                            <iframe
                                key={`${fuente}-${video?.id}-${tiempoActivo}`}
                                src={videoSrc}
                                title={video?.titulo || 'Reproductor de video'}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                            ></iframe>
                        )}
                    </div>
                </div>

                {/* TÍTULO EN MÓVIL (COMPACTO, JUSTO DEBAJO DEL VIDEO) */}
                {esMovil && (
                    <div style={{ padding: `8px calc(env(safe-area-inset-right, 0px) + 15px) 8px calc(env(safe-area-inset-left, 0px) + 15px)`, textAlign: 'center', backgroundColor: '#070707' }}>
                        <span style={{ fontSize: '0.5rem', color: '#d4af37', letterSpacing: '2px', display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>MODO ESTUDIO</span>
                        <h2 style={{ fontSize: '0.85rem', color: '#d4af37', margin: 0, fontWeight: 'bold', wordBreak: 'break-word', letterSpacing: '0.5px', lineHeight: '1.3' }}>{video?.titulo}</h2>
                    </div>
                )}

                {/* SIGUIENTE LECCIÓN Y REPORTE DE FALLO */}
                <div style={{
                    paddingTop: '10px',
                    paddingRight: 'calc(env(safe-area-inset-right, 0px) + 15px)',
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                    paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 15px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    backgroundColor: esMovil ? '#070707' : 'transparent'
                }}>
                    <button
                        type="button"
                        onClick={() => navegarVideo('next')}
                        title="Siguiente lección"
                        aria-label="Siguiente lección"
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
                        <VaultIcon name="skipNext" size={18} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setMostrarReporte(true)}
                        title="Reportar fallo técnico"
                        aria-label="Reportar fallo técnico"
                        style={{
                            ...estiloIconoBarra,
                            color: '#d4af37',
                            borderColor: 'rgba(212,175,55,0.45)',
                            background: 'rgba(212,175,55,0.06)',
                        }}
                    >
                        <VaultIcon name="flag" size={18} />
                    </button>
                </div>
            </div>

            {/* SECCIÓN DERECHA: NOTAS Y SINCRONIZACIÓN MANUAL */}
            <div style={{ flex: 1, overflowY: 'auto', padding: `18px calc(env(safe-area-inset-right, 0px) + 18px) calc(env(safe-area-inset-bottom, 0px) + 18px) calc(env(safe-area-inset-left, 0px) + 18px)`, backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

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

                {/* MARCAS GLOBALES DEL ADMINISTRADOR */}
                {marcasGlobalesVisibles.length > 0 && (
                    <div style={{ backgroundColor: '#111', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid rgba(212,175,55,0.35)' }}>
                        <p style={{ fontSize: '0.62rem', color: '#d4af37', margin: '0 0 8px 0', letterSpacing: '1px', fontWeight: 'bold' }}>
                            MARCADORES DEL PROFESOR:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {marcasGlobalesVisibles.map((marca) => (
                                <button
                                    key={marca.id}
                                    type="button"
                                    onClick={() => saltarASegundos(marca.segundos)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', textAlign: 'left', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '7px', padding: '8px', cursor: 'pointer', color: '#ddd', width: '100%', boxSizing: 'border-box' }}
                                >
                                    <span style={{ flexShrink: 0, backgroundColor: '#d4af37', color: '#000', borderRadius: '4px', padding: '2px 6px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                                        {marca.tiempo || '00:00'}
                                    </span>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                        <strong style={{ fontSize: '0.75rem', color: '#eee' }}>{marca.titulo}</strong>
                                        {marca.descripcion && (
                                            <small style={{ fontSize: '0.65rem', color: '#888', lineHeight: 1.35 }}>{marca.descripcion}</small>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* TRACKER DE MARCAS DINÁMICO */}
                <p style={{ fontSize: '0.6rem', color: '#d4af37', opacity: 0.7, margin: '0 0 8px 4px', letterSpacing: '1px' }}>MIS MARCADORES EN ESTE VIDEO:</p>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px', scrollbarWidth: 'none' }}>
                    {(nota.match(/\[\d+:\d+\]\s*(?:-?\s*([^[\n]*))?/g) || []).map((marcaCompleta, i) => {
                        const tiempoMatch = marcaCompleta.match(/\[\d+:\d+\]/);
                        if (!tiempoMatch) return null;
                        const tiempo = tiempoMatch[0];
                        const nombre = marcaCompleta.replace(tiempo, "").replace(/^\s*-\s*/, "").trim() || "Marca";
                        return (
                            <button key={i} onClick={() => saltarATiempo(tiempo)} style={{ fontSize: '0.65rem', padding: '6px 12px', backgroundColor: '#d4af3711', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <VaultIcon name="pin" size={11} /> {tiempo} {nombre}
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
                    <div ref={reporteDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Reportar video" style={{ backgroundColor: '#111', border: '1px solid #d4af37', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '350px', textAlign: 'center', boxSizing: 'border-box' }}>
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