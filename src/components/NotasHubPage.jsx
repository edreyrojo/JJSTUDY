import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore'; 
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
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

const NotasHubPage = ({ onBack, onNavigateToVideo, usuario, styles }) => {
    const [cargando, setCargando] = useState(true);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [busquedaNota, setBusquedaNota] = useState("");

    // 🛡️ Optimización de ciclo de vida para el listener de tamaño de pantalla
    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 🛡️ Simulación de carga defensiva si el usuario tarda en sincronizar
    useEffect(() => {
        if (!usuario) {
            const timer = setTimeout(() => setCargando(false), 1500);
            return () => clearTimeout(timer);
        }
        setCargando(false);
    }, [usuario]);

    // ⚡ USO DE USEMEMO: Procesamos, ordenamos y filtramos las notas eficientemente
    const notas = useMemo(() => {
        if (!usuario?.notas) return [];

        const listaConvertida = Object.entries(usuario.notas).map(([id, data]) => {
            const esObjeto = typeof data === 'object' && data !== null;
            return {
                id: id,
                titulo: esObjeto && data.titulo ? data.titulo : "NOTA TÉCNICA",
                texto: esObjeto ? (data.texto || "") : data,
                fecha: esObjeto && data.fecha ? data.fecha : "Reciente",
                videoId: esObjeto && data.videoId ? data.videoId : id,
                timestamp: esObjeto && data.timestamp ? data.timestamp : (!isNaN(parseInt(id)) ? parseInt(id) : 0)
            };
        });

        listaConvertida.sort((a, b) => {
            if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
            const idA = parseInt(a.id);
            const idB = parseInt(b.id);
            if (!isNaN(idA) && !isNaN(idB) && idA > 10000000) return idB - idA;
            
            const dateA = new Date(a.fecha).getTime();
            const dateB = new Date(b.fecha).getTime();
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            
            return 0; 
        });

        // Aplicar filtro de búsqueda interna si existe
        if (!busquedaNota.trim()) return listaConvertida;

        const termino = busquedaNota.toLowerCase();
        return listaConvertida.filter(n => 
            n.titulo.toLowerCase().includes(termino) || 
            n.texto.toLowerCase().includes(termino)
        );
    }, [usuario?.notas, busquedaNota]);

    // Función para eliminar notas con sincronización Firestore
    const eliminarNota = async (idNota) => {
        if (window.confirm("¿Seguro que deseas eliminar esta nota del Vault?")) {
            try {
                const userRef = doc(db, "usuarios", usuario.uid);
                const nuevasNotas = { ...usuario.notas };
                delete nuevasNotas[idNota];
                
                await updateDoc(userRef, { notas: nuevasNotas });
                notify("Nota eliminada del Vault.");
            } catch (err) {
                console.error("Error al eliminar nota:", err);
                notify("No se pudo eliminar la nota.", "error");
            }
        }
    };

    if (cargando) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ color: '#d4af37', fontFamily: 'monospace', letterSpacing: '2px' }}>ACCEDIENDO AL VAULT...</div>
            </div>
        );
    }

    const totalNotasOriginales = usuario?.notas ? Object.keys(usuario.notas).length : 0;

    return (
        <div style={{
            // 🛡️ Protección adaptativa contra notches y safe areas
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 20px)' : '35px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 25px)' : '45px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 18px)' : '40px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 18px)' : '40px',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <style>{`
                .nota-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .nota-card:hover {
                    transform: translateY(-5px);
                    border-color: #d4af37 !important;
                    box-shadow: 0 10px 30px rgba(212, 175, 55, 0.18);
                }
                .delete-btn {
                    transition: all 0.2s ease;
                }
                .delete-btn:hover {
                    color: #ff4444 !important;
                    transform: scale(1.15);
                }
            `}</style>

            {/* Header Rediseñado con Estilo Terminal */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                maxWidth: '1200px', 
                margin: '0 auto 24px auto',
                width: '100%',
                boxSizing: 'border-box',
                gap: '15px',
                borderBottom: '1px solid #1a1a1a',
                paddingBottom: '15px'
            }}>
                <button 
                    onClick={onBack} 
                    style={{ 
                        ...(styles.btnOutline || {}), 
                        width: 'auto', 
                        padding: esMovil ? '10px 16px' : '10px 22px', 
                        fontSize: esMovil ? '0.9rem' : '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        borderColor: '#d4af37',
                        color: '#d4af37',
                        backgroundColor: '#0c0c0c',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        fontWeight: '600'
                    }}
                >
                    ← {esMovil ? '' : 'VOLVER'}
                </button>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ ...(styles.goldTitle || {}), margin: 0, fontSize: esMovil ? '1.1rem' : '1.5rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#d4af37' }}>
                        BITÁCORA TÉCNICA
                    </h2>
                    <span style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '1px' }}>REGISTRO AVANZADO VAULT</span>
                </div>
            </div>

            {/* Barra de Búsqueda Estilizada */}
            {totalNotasOriginales > 0 && (
                <div style={{ 
                    maxWidth: '1200px', 
                    width: '100%', 
                    margin: '0 auto 20px auto', 
                    position: 'relative',
                    boxSizing: 'border-box'
                }}>
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', pointerEvents: 'none' }}>
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar en tus notas técnicas..."
                        style={{
                            width: '100%',
                            padding: '14px 42px 14px 42px',
                            backgroundColor: '#0c0c0c',
                            border: '1px solid #2a2a2a',
                            color: '#fff',
                            borderRadius: '10px',
                            fontSize: '0.95rem',
                            boxSizing: 'border-box',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#d4af37'}
                        onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
                        value={busquedaNota}
                        onChange={(e) => setBusquedaNota(e.target.value)}
                    />
                    {busquedaNota && (
                        <button
                            onClick={() => setBusquedaNota("")}
                            style={{
                                position: 'absolute',
                                right: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#888',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {/* Contador de Notas */}
            <div style={{ 
                maxWidth: '1200px', 
                width: '100%', 
                margin: '0 auto 15px auto', 
                fontSize: '0.75rem', 
                color: '#d4af37', 
                opacity: 0.8,
                display: 'flex', 
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                letterSpacing: '0.5px'
            }}>
                <span>TOTAL REGISTROS: {totalNotasOriginales}</span>
                {busquedaNota && <span>COINCIDENCIAS: {notas.length}</span>}
            </div>

            {/* Grid Responsivo de Tarjetas */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: esMovil ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '18px',
                maxWidth: '1200px',
                margin: '0 auto',
                paddingBottom: '40px',
                width: '100%',
                boxSizing: 'border-box',
                flex: 1
            }}>
                {notas.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '60px', padding: '45px', border: '1px dashed #222', borderRadius: '12px', backgroundColor: '#070707' }}>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px', color: '#d4af37' }}>🛡️</span>
                        <p style={{ color: '#888', fontSize: '0.95rem', margin: 0 }}>
                            {totalNotasOriginales === 0 
                                ? "Bitácora vacía. Añade notas técnicas mientras estudias los instruccionales en el mapa." 
                                : "No se encontraron notas con ese criterio de búsqueda."}
                        </p>
                    </div>
                ) : (
                    notas.map((n) => {
                        const match = n.texto.match(/\[(\d+):(\d+)\]/);
                        const segs = match ? (parseInt(match[1]) * 60 + parseInt(match[2])) : 0;

                        return (
                            <div key={n.id} className="nota-card" style={{
                                ...(styles?.card || {}),
                                border: '1px solid #1f1f1f',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '210px',
                                justifyContent: 'space-between',
                                backgroundColor: '#0a0a0a',
                                boxSizing: 'border-box',
                                position: 'relative',
                                borderRadius: '12px',
                                width: '100%',
                                minWidth: '0',  
                                maxWidth: '100%', 
                                overflow: 'hidden' 
                            }}>
                                <div style={{ overflow: 'hidden', width: '100%', minWidth: '0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-start', width: '100%', minWidth: '0' }}>
                                        <h4 style={{
                                            color: '#d4af37',
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            paddingRight: '30px', 
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flex: 1,
                                            minWidth: '0',
                                            letterSpacing: '1.2px',
                                            fontWeight: '700'
                                        }}>
                                            {n.titulo.toUpperCase()}
                                        </h4>
                                        <button
                                            className="delete-btn"
                                            onClick={() => eliminarNota(n.id)}
                                            title="Eliminar nota"
                                            style={{ 
                                                color: '#666', 
                                                background: 'none', 
                                                border: 'none', 
                                                fontSize: '1.4rem', 
                                                cursor: 'pointer', 
                                                position: 'absolute', 
                                                top: '14px', 
                                                right: '16px',
                                                padding: '4px',
                                                zIndex: 10,
                                                lineHeight: 1
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <p style={{
                                        color: '#cccccc',
                                        fontSize: '0.85rem',
                                        lineHeight: '1.6',
                                        display: '-webkit-box',
                                        WebkitLineClamp: '4', 
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        whiteSpace: 'pre-wrap',
                                        margin: 0,
                                        overflowWrap: 'break-word',
                                        wordBreak: 'break-word'
                                    }}>
                                        {n.texto}
                                    </p>
                                </div>

                                {/* Fila Inferior Única: Fecha, Estado y Botón Play ancho y centrado */}
                                <div style={{
                                    marginTop: '16px',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    borderTop: '1px solid #1a1a1a',
                                    paddingTop: '12px',
                                    width: '100%',
                                    minWidth: '0'
                                }}>
                                    <span style={{ fontSize: '0.7rem', color: '#777', fontWeight: '600' }}>
                                        {n.fecha.split(',')[0]}
                                    </span>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {n.videoId && (
                                            <span style={{ fontSize: '0.7rem', color: '#d4af37', fontWeight: 'bold', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.25)', whiteSpace: 'nowrap' }}>
                                                {match ? match[0] : 'VINCULADO'}
                                            </span>
                                        )}

                                        {n.videoId && (
                                            <button
                                                onClick={() => onNavigateToVideo({ id: n.videoId, titulo: n.titulo, startTime: segs })}
                                                title="Abrir en reproductor"
                                                style={{
                                                    backgroundColor: '#d4af37',
                                                    color: '#000',
                                                    border: 'none',
                                                    width: '54px',
                                                    height: '32px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.85rem',
                                                    flexShrink: 0,
                                                    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
                                                    transition: 'transform 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                ▶
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default NotasHubPage;