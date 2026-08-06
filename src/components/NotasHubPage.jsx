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

    // ⚡ USO DE USEMEMO (Buenas prácticas de React): 
    // Procesamos y ordenamos las notas únicamente cuando el objeto `usuario.notas` cambia,
    // evitando recálculos pesados de ordenamiento en cada renderizado de la UI.
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

        return listaConvertida;
    }, [usuario?.notas]);

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

    return (
        <div style={{
            // 🛡️ Protección adaptativa contra notches y safe areas
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 20px)' : '40px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 30px)' : '50px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 16px)' : '40px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 16px)' : '40px',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden' 
        }}>
            <style>{`
                .nota-card {
                    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
                }
                .nota-card:hover {
                    transform: translateY(-4px);
                    border-color: #d4af37 !important;
                    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.15);
                }
                .delete-btn {
                    transition: color 0.2s ease, transform 0.2s ease;
                }
                .delete-btn:hover {
                    color: #ff4444 !important;
                    transform: scale(1.1);
                }
            `}</style>

            {/* Header del Hub */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
                maxWidth: '1200px', 
                margin: '0 auto 30px auto',
                width: '100%',
                boxSizing: 'border-box',
                gap: '15px'
            }}>
                <button 
                    onClick={onBack} 
                    style={{ 
                        ...(styles.btnOutline || {}), 
                        width: 'auto', 
                        padding: esMovil ? '10px 18px' : '10px 20px', 
                        fontSize: esMovil ? '1rem' : '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        borderColor: '#d4af37',
                        color: '#d4af37',
                        cursor: 'pointer',
                        borderRadius: '6px'
                    }}
                >
                    ←
                </button>
                <h2 style={{ ...(styles.goldTitle || {}), margin: 0, fontSize: esMovil ? '1.1rem' : '1.4rem', letterSpacing: '3px', textTransform: 'uppercase' }}>
                    BITÁCORA TÉCNICA
                </h2>
            </div>

            {/* Grid Responsivo Inteligente (PC vs Móvil) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: esMovil ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
                maxWidth: '1200px',
                margin: '0 auto',
                paddingBottom: '40px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {notas.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '80px', padding: '40px', border: '1px dashed #222', borderRadius: '12px' }}>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>🛡️</span>
                        <p style={{ color: '#888', fontSize: '0.95rem' }}>Bitácora vacía. Añade notas técnicas mientras estudias los instruccionales en el mapa.</p>
                    </div>
                ) : (
                    notas.map((n) => {
                        const match = n.texto.match(/\[(\d+):(\d+)\]/);
                        const segs = match ? (parseInt(match[1]) * 60 + parseInt(match[2])) : 0;

                        return (
                            <div key={n.id} className="nota-card" style={{
                                ...(styles?.card || {}),
                                border: '1px solid #222',
                                padding: '22px',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: esMovil ? '210px' : '230px',
                                justifyContent: 'space-between',
                                backgroundColor: '#0f0f0f',
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
                                            fontSize: '0.85rem',
                                            paddingRight: '35px', 
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flex: 1,
                                            minWidth: '0',
                                            letterSpacing: '1px'
                                        }}>
                                            {n.titulo.toUpperCase()}
                                        </h4>
                                        <button
                                            className="delete-btn"
                                            onClick={() => eliminarNota(n.id)}
                                            title="Eliminar nota"
                                            style={{ 
                                                color: '#555', 
                                                background: 'none', 
                                                border: 'none', 
                                                fontSize: esMovil ? '1.5rem' : '1.3rem', 
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
                                        color: '#ccc',
                                        fontSize: esMovil ? '0.9rem' : '0.85rem',
                                        lineHeight: '1.6',
                                        display: '-webkit-box',
                                        WebkitLineClamp: esMovil ? '5' : '4', 
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

                                <div style={{
                                    marginTop: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    borderTop: '1px solid #222',
                                    paddingTop: '15px',
                                    width: '100%',
                                    minWidth: '0'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold' }}>
                                            {n.fecha.split(',')[0]}
                                        </span>
                                        {n.videoId && (
                                            <span style={{ fontSize: '0.7rem', color: '#d4af37', fontWeight: 'bold', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                                                {match ? match[0] : 'VINCULADO'}
                                            </span>
                                        )}
                                    </div>

                                    {n.videoId && (
                                        <button
                                            onClick={() => onNavigateToVideo({ id: n.videoId, titulo: n.titulo, startTime: segs })}
                                            style={{
                                                ...(styles.btnGold || {}),
                                                width: '100%',
                                                padding: esMovil ? '12px 0' : '10px 0', 
                                                fontSize: esMovil ? '0.8rem' : '0.75rem',
                                                fontWeight: 'bold',
                                                margin: 0,
                                                borderRadius: '6px',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer',
                                                letterSpacing: '1px',
                                                backgroundColor: '#d4af37',
                                                color: '#000',
                                                border: 'none'
                                            }}
                                        >
                                            ▶ ABRIR EN REPRODUCTOR
                                        </button>
                                    )}
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