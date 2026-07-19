import React, { useState, useEffect } from 'react';
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
    const [notas, setNotas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!usuario) {
            const timer = setTimeout(() => setCargando(false), 2000);
            return () => clearTimeout(timer);
        }

        if (usuario.notas) {
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

            setNotas(listaConvertida);
        } else {
            setNotas([]);
        }
        setCargando(false);
    }, [usuario]);

    const eliminarNota = async (idNota) => {
        if (window.confirm("¿Seguro que deseas eliminar esta nota del Vault?")) {
            try {
                const userRef = doc(db, "usuarios", usuario.uid);
                const nuevasNotas = { ...usuario.notas };
                delete nuevasNotas[idNota];
                
                await updateDoc(userRef, { notas: nuevasNotas });
                setNotas(prevNotas => prevNotas.filter(n => n.id !== idNota));
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
                <div style={{ color: '#d4af37', fontFamily: 'monospace' }}>ACCEDIENDO AL VAULT...</div>
            </div>
        );
    }

    return (
        <div style={{
            // 🛡️ PROTECCIÓN TOTAL CONTRA NOTCH (Safe Area Insets de 4 Puntos)
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 20px)' : '30px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 30px)' : '40px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 15px)' : '30px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 15px)' : '30px',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden' 
        }}>

            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                maxWidth: '1200px', 
                margin: '0 auto 20px auto',
                width: '100%',
                boxSizing: 'border-box',
                gap: '10px'
            }}>
                <button 
                    onClick={onBack} 
                    style={{ 
                        ...(styles.btnOutline || {}), 
                        width: 'auto', 
                        padding: esMovil ? '10px 15px' : '8px 15px', 
                        fontSize: esMovil ? '1rem' : '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                    }}
                >
                    ←
                </button>
                <h2 style={{ ...(styles.goldTitle || {}), margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>
                    BITÁCORA
                </h2>
            </div>

            {/* Grid Responsivo Inteligente */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: esMovil ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '15px',
                maxWidth: '1200px',
                margin: '0 auto',
                paddingBottom: '40px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {notas.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '50px' }}>
                        <p style={{ color: '#444' }}>Bitácora vacía. Añade notas mientras estudias un instruccional.</p>
                    </div>
                ) : (
                    notas.map((n) => {
                        const match = n.texto.match(/\[(\d+):(\d+)\]/);
                        const segs = match ? (parseInt(match[1]) * 60 + parseInt(match[2])) : 0;

                        return (
                            <div key={n.id} style={{
                                ...(styles?.card || {}),
                                border: '1px solid #222',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: esMovil ? '220px' : '200px',
                                justifyContent: 'space-between',
                                backgroundColor: '#0a0a0a',
                                boxSizing: 'border-box',
                                position: 'relative',
                                borderRadius: '10px',
                                width: '100%',
                                minWidth: '0',  
                                maxWidth: '100%', 
                                overflow: 'hidden' 
                            }}>
                                <div style={{ overflow: 'hidden', width: '100%', minWidth: '0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start', width: '100%', minWidth: '0' }}>
                                        <h4 style={{
                                            color: '#d4af37',
                                            margin: 0,
                                            fontSize: '0.8rem',
                                            paddingRight: '35px', 
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flex: 1,
                                            minWidth: '0' 
                                        }}>
                                            {n.titulo.toUpperCase()}
                                        </h4>
                                        <button
                                            onClick={() => eliminarNota(n.id)}
                                            style={{ 
                                                color: '#666', 
                                                background: 'none', 
                                                border: 'none', 
                                                fontSize: esMovil ? '1.5rem' : '1.2rem', 
                                                cursor: 'pointer', 
                                                position: 'absolute', 
                                                top: '12px', 
                                                right: '15px',
                                                padding: '5px',
                                                zIndex: 10
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <p style={{
                                        color: '#ccc',
                                        fontSize: esMovil ? '0.85rem' : '0.8rem',
                                        lineHeight: '1.5',
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
                                    marginTop: '15px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    borderTop: '1px solid #1a1a1a',
                                    paddingTop: '15px',
                                    width: '100%',
                                    minWidth: '0'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>
                                            {n.fecha.split(',')[0]}
                                        </span>
                                        {n.videoId && (
                                            <span style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold', backgroundColor: '#d4af3711', padding: '2px 8px', borderRadius: '4px' }}>
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
                                                padding: esMovil ? '12px 0' : '8px 0', 
                                                fontSize: esMovil ? '0.75rem' : '0.65rem',
                                                fontWeight: 'bold',
                                                margin: 0,
                                                borderRadius: '6px',
                                                boxSizing: 'border-box' 
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