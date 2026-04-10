import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';


const NotasHubPage = ({ onBack, onNavigateToVideo, usuario, styles }) => {
    const [notas, setNotas] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!usuario) {
            const timer = setTimeout(() => setCargando(false), 2000);
            return () => clearTimeout(timer);
        }

        if (usuario.notas) {
            const listaConvertida = Object.entries(usuario.notas).map(([id, data]) => ({
                id: id,
                titulo: data.titulo || "NOTA TÉCNICA",
                texto: typeof data === 'string' ? data : (data.texto || ""),
                fecha: data.fecha || "Reciente",
                videoId: data.videoId || id
            }));

            listaConvertida.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setNotas(listaConvertida);
        } else {
            setNotas([]);
        }
        setCargando(false);
    }, [usuario]);

    // ... (eliminarNota se mantiene igual)

    if (cargando) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ color: '#d4af37', fontFamily: 'monospace' }}>ACCEDIENDO AL VAULT...</div>
            </div>
        );
    }

    return (
        <div style={{
            padding: '15px',
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden' // 🛠️ Evita cualquier empuje lateral
        }}>

            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                maxWidth: '1200px', // Un poco más ancho para escritorio
                margin: '0 auto 20px auto',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '8px 15px', fontSize: '0.7rem' }}>← VOLVER</button>
                <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1rem' }}>BITÁCORA</h2>
            </div>

            {/* Grid Responsivo Inteligente */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: '15px',
                maxWidth: '1200px',
                margin: '0 auto',
                paddingBottom: '40px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {notas.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '50px' }}>
                        <p style={{ color: '#444' }}>Bitácora vacía.</p>
                    </div>
                ) : (
                    notas.map((n) => {
                        const match = n.texto.match(/\[(\d+):(\d+)\]/);
                        const segs = match ? (parseInt(match[1]) * 60 + parseInt(match[2])) : 0;

                        return (
                            <div key={n.id} style={{
                                ...(styles?.card || {}),
                                border: '1px solid #222',
                                padding: '15px',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '200px',
                                justifyContent: 'space-between',
                                backgroundColor: '#0a0a0a',
                                boxSizing: 'border-box', // 🛠️ Clave para que el padding no "empuje"
                                position: 'relative',
                                borderRadius: '8px',
                                width: '100%' // 🛠️ Asegura que ocupe su celda del grid
                            }}>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <h4 style={{
                                            color: '#d4af37',
                                            margin: 0,
                                            fontSize: '0.75rem',
                                            paddingRight: '20px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {n.titulo.toUpperCase()}
                                        </h4>
                                        <button
                                            onClick={() => eliminarNota(n.id)}
                                            style={{ color: '#444', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', position: 'absolute', top: '10px', right: '10px' }}
                                        >×</button>
                                    </div>

                                    <p style={{
                                        color: '#aaa',
                                        fontSize: '0.8rem',
                                        lineHeight: '1.4',
                                        display: '-webkit-box',
                                        WebkitLineClamp: '4', // Limitamos a 4 líneas para mantener uniformidad
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        whiteSpace: 'pre-wrap',
                                        margin: 0
                                    }}>
                                        {n.texto}
                                    </p>
                                </div>

                                <div style={{
                                    marginTop: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    borderTop: '1px solid #1a1a1a',
                                    paddingTop: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.6rem', color: '#444' }}>
                                            {n.fecha.split(',')[0]}
                                        </span>
                                        {n.videoId && (
                                            <span style={{ fontSize: '0.6rem', color: '#d4af37', fontWeight: 'bold' }}>
                                                {match ? match[0] : 'VIDEO'}
                                            </span>
                                        )}
                                    </div>

                                    {n.videoId && (
                                        <button
                                            onClick={() => onNavigateToVideo({ id: n.videoId, titulo: n.titulo, startTime: segs })}
                                            style={{
                                                ...styles.btnGold,
                                                width: '100%',
                                                padding: '8px 0',
                                                fontSize: '0.65rem',
                                                fontWeight: 'bold',
                                                margin: 0 // 🛠️ Evita márgenes extra que empujen
                                            }}
                                        >
                                            ABRIR EN REPRODUCTOR
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