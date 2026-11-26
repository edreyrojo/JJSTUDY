import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { obtenerTecnica } from '../data/vaultIndex';
import { translateText } from '../i18n/translate';
import VaultIcon from './VaultIcon';

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

const SIN_CURSO = 'SIN CURSO';

const NotasHubPage = ({ onBack, onNavigateToVideo, usuario, styles = {} }) => {
    const [ancho, setAncho] = useState(window.innerWidth);
    const [busquedaNota, setBusquedaNota] = useState('');
    const [cursoFiltro, setCursoFiltro] = useState('TODOS');

    useEffect(() => {
        const handleResize = () => setAncho(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const esMovil = ancho < 768;
    const esTablet = ancho >= 768 && ancho < 1320;
    const columnas = esMovil ? '1fr' : esTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))';
    const notasUsuario = usuario?.notas;

    const cursosDisponibles = useMemo(() => {
        if (!notasUsuario) return [];
        const set = new Set();
        Object.entries(notasUsuario).forEach(([id, data]) => {
            const esObjeto = typeof data === 'object' && data !== null;
            const videoId = esObjeto && data.videoId ? data.videoId : id;
            const tecnica = obtenerTecnica(videoId);
            set.add((esObjeto && data.cursoTitulo) || tecnica?.cursoTitulo || SIN_CURSO);
        });
        return [...set].sort((a, b) => {
            if (a === SIN_CURSO) return 1;
            if (b === SIN_CURSO) return -1;
            return a.localeCompare(b);
        });
    }, [notasUsuario]);

    const cursoFiltroValido = cursoFiltro === 'TODOS' || cursosDisponibles.includes(cursoFiltro)
        ? cursoFiltro
        : 'TODOS';

    const notas = useMemo(() => {
        if (!notasUsuario) return [];

        const lista = Object.entries(notasUsuario).map(([id, data]) => {
            const esObjeto = typeof data === 'object' && data !== null;
            const texto = esObjeto ? (data.texto || '') : (data || '');
            const videoId = esObjeto && data.videoId ? data.videoId : id;
            const tecnica = obtenerTecnica(videoId);
            const match = texto.match(/\[(\d+):(\d+)\]/);
            const segs = match ? (parseInt(match[1]) * 60 + parseInt(match[2])) : 0;

            return {
                id,
                titulo: esObjeto && data.titulo ? data.titulo : (tecnica?.nombre || 'NOTA TÉCNICA'),
                texto,
                fecha: esObjeto && data.fecha ? data.fecha : 'Reciente',
                videoId,
                timestamp: esObjeto && data.timestamp ? data.timestamp : (!isNaN(parseInt(id)) ? parseInt(id) : 0),
                tecnica,
                cursoTitulo: (esObjeto && data.cursoTitulo) || tecnica?.cursoTitulo || '',
                volumenNombre: tecnica?.volumenNombre || '',
                posicion: tecnica?.posicion || '',
                tipo: tecnica?.tipo || '',
                modalidad: tecnica?.modalidad || '',
                marca: match ? match[0] : '',
                segs,
                cursoClave: (esObjeto && data.cursoTitulo) || tecnica?.cursoTitulo || SIN_CURSO
            };
        });

        lista.sort((a, b) => {
            if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
            const dateA = new Date(a.fecha).getTime();
            const dateB = new Date(b.fecha).getTime();
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            return 0;
        });

        const termino = busquedaNota.trim().toLowerCase();
        const curso = cursoFiltroValido;

        return lista.filter(n => {
            const cumpleCurso = curso === 'TODOS' || n.cursoClave === curso;
            if (!cumpleCurso) return false;
            if (!termino) return true;
            return [
                n.titulo,
                n.texto,
                n.cursoTitulo,
                n.volumenNombre,
                n.posicion,
                n.tipo,
                n.modalidad
            ].some(valor => String(valor || '').toLowerCase().includes(termino));
        });
    }, [notasUsuario, busquedaNota, cursoFiltroValido]);

    const totalNotasOriginales = notasUsuario ? Object.keys(notasUsuario).length : 0;
    const hayFiltro = Boolean(busquedaNota) || cursoFiltroValido !== 'TODOS';

    const eliminarNota = async (idNota) => {
        if (!window.confirm(translateText('¿Seguro que deseas eliminar esta nota del Vault?'))) return;
        try {
            const userRef = doc(db, 'usuarios', usuario.uid);
            const nuevasNotas = { ...usuario.notas };
            delete nuevasNotas[idNota];
            await updateDoc(userRef, { notas: nuevasNotas });
            notify('Nota eliminada del Vault.');
        } catch (err) {
            console.error('Error al eliminar nota:', err);
            notify('No se pudo eliminar la nota.', 'error');
        }
    };

    const abrirNota = (nota) => {
        if (!nota.videoId || !nota.tecnica) return;
        onNavigateToVideo({
            id: nota.videoId,
            titulo: nota.tecnica?.nombre || nota.titulo,
            startTime: nota.segs
        });
    };

    const limpiarFiltros = () => {
        setBusquedaNota('');
        setCursoFiltro('TODOS');
    };

    const TarjetaNota = ({ nota }) => {
        const titulo = nota.tecnica?.nombre || nota.titulo;
        const fechaCorta = nota.fecha.split(',')[0];
        const puedeAbrir = Boolean(nota.tecnica);

        return (
            <article
                className={puedeAbrir ? 'nota-card' : ''}
                role={puedeAbrir ? 'button' : undefined}
                tabIndex={puedeAbrir ? 0 : undefined}
                aria-label={puedeAbrir ? `Abrir video de ${titulo}` : undefined}
                title={puedeAbrir ? 'Abrir video' : undefined}
                onClick={puedeAbrir ? () => abrirNota(nota) : undefined}
                onKeyDown={puedeAbrir ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirNota(nota);
                    }
                } : undefined}
                style={{
                    textAlign: 'left',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #1f1f1f',
                    borderLeft: '2px solid #d4af37',
                    borderRadius: '12px',
                    padding: esMovil ? '15px' : '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                    width: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                    cursor: puedeAbrir ? 'pointer' : 'default',
                    boxSizing: 'border-box',
                    position: 'relative'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{
                            color: '#d4af37',
                            margin: 0,
                            fontSize: esMovil ? '0.85rem' : '0.92rem',
                            letterSpacing: '0.8px',
                            fontWeight: '700',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {titulo.toUpperCase()}
                        </h4>
                        {nota.cursoTitulo && (
                            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.68rem', lineHeight: 1.3 }}>
                                {nota.cursoTitulo}
                                {nota.volumenNombre ? ` · ${nota.volumenNombre}` : ''}
                            </p>
                        )}
                    </div>

                    <button
                        className="delete-btn"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            eliminarNota(nota.id);
                        }}
                        title="Eliminar nota"
                        aria-label="Eliminar nota"
                        style={{
                            color: '#777',
                            background: 'none',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <VaultIcon name="trash" size={14} />
                    </button>
                </div>

                {(nota.posicion || nota.tipo || nota.modalidad) && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {nota.posicion && (
                            <span style={{ fontSize: '0.58rem', color: '#000', backgroundColor: '#d4af37', borderRadius: '3px', padding: '2px 6px', fontWeight: 'bold' }}>
                                {nota.posicion}
                            </span>
                        )}
                        {nota.tipo && (
                            <span style={{ fontSize: '0.58rem', color: '#d4af37', border: '1px solid #3a3320', borderRadius: '3px', padding: '1px 6px' }}>
                                {nota.tipo}
                            </span>
                        )}
                        {nota.modalidad && (
                            <span style={{ fontSize: '0.58rem', color: '#888', border: '1px solid #262626', borderRadius: '3px', padding: '1px 6px' }}>
                                {nota.modalidad}
                            </span>
                        )}
                    </div>
                )}

                {nota.texto?.trim() ? (
                    <p style={{
                        color: '#cccccc',
                        fontSize: esMovil ? '0.8rem' : '0.84rem',
                        lineHeight: '1.55',
                        display: '-webkit-box',
                        WebkitLineClamp: esMovil ? 5 : 6,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word'
                    }}>
                        {nota.texto}
                    </p>
                ) : (
                    <p style={{ color: '#555', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>Sin observaciones escritas.</p>
                )}

                <div style={{ marginTop: 'auto', borderTop: '1px solid #1a1a1a', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.66rem', color: '#777', fontWeight: '600' }}>{fechaCorta}</span>
                        {nota.marca && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.66rem', color: '#d4af37', fontWeight: 'bold', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.25)', whiteSpace: 'nowrap' }}>
                                <VaultIcon name="pin" size={10} /> {nota.marca}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.58rem', color: puedeAbrir ? '#555' : '#777', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                            {puedeAbrir ? 'Nota vinculada' : 'Video no disponible'}
                        </span>
                        {puedeAbrir && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: '#d4af37',
                                color: '#000',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                letterSpacing: '0.5px',
                                flexShrink: 0
                            }}>
                                <VaultIcon name="play" size={10} color="#000" /> ABRIR VIDEO
                            </span>
                        )}
                    </div>
                </div>
            </article>
        );
    };

    return (
        <div style={{
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 14px)' : '30px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 20px)' : '40px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 14px)' : esTablet ? '20px' : '24px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 14px)' : esTablet ? '20px' : '24px',
            minHeight: 'var(--app-vh)',
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
                    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .nota-card:focus-visible {
                    outline: 2px solid #d4af37;
                    outline-offset: 2px;
                }
                @media (hover: hover) {
                    .nota-card:hover {
                        transform: translateY(-4px);
                        border-color: #d4af37 !important;
                        box-shadow: 0 10px 30px rgba(212, 175, 55, 0.18);
                    }
                }
                .delete-btn {
                    transition: color 0.2s ease;
                }
                .delete-btn:hover {
                    color: #d4af37 !important;
                }
            `}</style>

            <div style={{ width: '100%', maxWidth: '1680px', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* ENCABEZADO */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: esMovil ? 'auto 1fr' : 'auto 1fr auto',
                    alignItems: 'center',
                    gap: '10px',
                    paddingBottom: '14px',
                    marginBottom: '16px',
                    borderBottom: '1px solid #1a1a1a',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    <button
                        onClick={onBack}
                        style={{
                            ...(styles.btnOutline || {}),
                            width: 'auto',
                            padding: esMovil ? '9px 12px' : '9px 16px',
                            fontSize: '0.72rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            borderColor: '#d4af37',
                            color: '#d4af37',
                            backgroundColor: '#0c0c0c',
                            cursor: 'pointer',
                            borderRadius: '8px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <VaultIcon name="chevronLeft" size={14} /> VOLVER
                    </button>

                    <div style={{ textAlign: 'center', minWidth: 0 }}>
                        <h2 style={{
                            ...(styles.goldTitle || {}),
                            margin: 0,
                            fontSize: esMovil ? '1rem' : esTablet ? '1.25rem' : '1.5rem',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            color: '#d4af37',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            BITÁCORA TÉCNICA
                        </h2>
                        <span style={{ fontSize: '0.58rem', color: '#888', letterSpacing: '1px' }}>REGISTRO AVANZADO VAULT</span>
                    </div>

                    {!esMovil && (
                        <span style={{
                            padding: '6px 10px',
                            border: '1px solid #d4af37',
                            borderRadius: '6px',
                            color: '#d4af37',
                            fontSize: '0.62rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                        }}>
                            {totalNotasOriginales} {totalNotasOriginales === 1 ? 'NOTA' : 'NOTAS'}
                        </span>
                    )}
                </div>

                {/* BÚSQUEDA Y FILTRO POR CURSO */}
                {totalNotasOriginales > 0 && (
                    <div style={{
                        display: 'flex',
                        flexDirection: esMovil ? 'column' : 'row',
                        gap: '10px',
                        marginBottom: '10px',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                                <VaultIcon name="search" size={15} />
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar en tus notas..."
                                value={busquedaNota}
                                onChange={(e) => setBusquedaNota(e.target.value)}
                                onFocus={(e) => e.target.style.borderColor = '#d4af37'}
                                onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
                                style={{
                                    width: '100%',
                                    padding: '12px 40px 12px 40px',
                                    backgroundColor: '#0c0c0c',
                                    border: '1px solid #2a2a2a',
                                    color: '#fff',
                                    borderRadius: '10px',
                                    fontSize: '0.85rem',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            {busquedaNota && (
                                <button
                                    onClick={() => setBusquedaNota('')}
                                    aria-label="Limpiar búsqueda"
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}
                                >
                                    <VaultIcon name="close" size={13} />
                                </button>
                            )}
                        </div>

                        <select
                            value={cursoFiltroValido}
                            onChange={(e) => setCursoFiltro(e.target.value)}
                            aria-label="Filtrar por curso"
                            style={{
                                width: esMovil ? '100%' : '250px',
                                padding: '12px 14px',
                                backgroundColor: '#0c0c0c',
                                border: '1px solid #2a2a2a',
                                color: '#fff',
                                borderRadius: '10px',
                                fontSize: '0.82rem',
                                boxSizing: 'border-box',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="TODOS">TODOS LOS CURSOS</option>
                            {cursosDisponibles.map(curso => (
                                <option key={curso} value={curso}>{curso}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* CONTADOR */}
                {(esMovil || hayFiltro) && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '12px',
                        color: '#d4af37',
                        fontSize: '0.68rem',
                        letterSpacing: '0.5px',
                        opacity: 0.85
                    }}>
                        <span>
                            {hayFiltro
                                ? `${notas.length} DE ${totalNotasOriginales} ${totalNotasOriginales === 1 ? 'NOTA' : 'NOTAS'}`
                                : `${notas.length} ${notas.length === 1 ? 'NOTA' : 'NOTAS'}`}
                            {cursoFiltroValido !== 'TODOS' ? ` · ${cursoFiltroValido}` : ''}
                        </span>
                        {busquedaNota && <span style={{ color: '#777' }}>FILTRO: “{busquedaNota}”</span>}
                    </div>
                )}

                {/* GRID DE NOTAS */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: columnas,
                    gap: esMovil ? '12px' : '18px',
                    width: '100%',
                    paddingBottom: '20px',
                    boxSizing: 'border-box',
                    alignItems: 'start',
                    alignContent: 'start'
                }}>
                    {notas.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '30px', padding: esMovil ? '30px 18px' : '42px 24px', border: '1px dashed #222', borderRadius: '12px', backgroundColor: '#070707' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                                <VaultIcon name="notes" size={40} color="#d4af37" />
                            </div>
                            <p style={{ color: '#999', fontSize: '0.9rem', margin: '0 0 8px 0' }}>
                                {totalNotasOriginales === 0
                                    ? 'Tu bitácora está vacía. Abre un instruccional y guarda una nota para verla aquí.'
                                    : 'No hay notas que coincidan con la búsqueda o el curso seleccionado.'}
                            </p>
                            <p style={{ color: '#555', fontSize: '0.75rem', margin: '0 0 18px 0' }}>
                                {totalNotasOriginales === 0
                                    ? 'Las notas se crean desde la pantalla de estudio de cada video.'
                                    : 'Prueba con otra palabra o cambia el filtro de curso.'}
                            </p>
                            <button
                                onClick={totalNotasOriginales === 0 ? onBack : limpiarFiltros}
                                style={{
                                    ...(styles.btnOutline || {}),
                                    width: 'auto',
                                    padding: '10px 16px',
                                    fontSize: '0.72rem',
                                    borderColor: '#d4af37',
                                    color: '#d4af37',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                {totalNotasOriginales === 0 ? 'VOLVER AL HUB' : 'LIMPIAR FILTROS'}
                            </button>
                        </div>
                    ) : (
                        notas.map(nota => <TarjetaNota key={nota.id} nota={nota} />)
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotasHubPage;