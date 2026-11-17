import React, { useState, useEffect, useMemo } from 'react';
import { buscarTecnicas, FACETAS, ESTADISTICAS, esVideoGratis } from '../data/vaultIndex';
import { tieneAccesoVideo, pedirAcceso, tieneAccesoVideoDinamico } from '../utils/accesoVault';
import { mensajeContenidoBloqueado } from '../i18n/translate';
import { normalizarVideoDinamico } from '../utils/rutasAprendizaje';
import { normalizar } from '../data/taxonomia';
import VaultIcon from './VaultIcon';

const FILTROS_VACIOS = { posicion: null, tipo: null, modalidad: null, autor: null, etiqueta: null };

const Chip = ({ activo, onClick, children, count, tono = 'gold' }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            padding: '5px 10px',
            borderRadius: '999px',
            border: `1px solid ${activo ? (tono === 'green' ? '#4CAF50' : '#d4af37') : '#2a2a2a'}`,
            backgroundColor: activo ? (tono === 'green' ? '#4CAF50' : '#d4af37') : '#0d0d0d',
            color: activo ? '#000' : '#bbb',
            fontSize: '0.7rem',
            fontWeight: activo ? 'bold' : 'normal',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
        }}
    >
        {children}
        {typeof count === 'number' && (
            <span style={{ opacity: 0.65, fontSize: '0.62rem' }}>{count}</span>
        )}
    </button>
);

const SeccionFiltro = ({ titulo, children, abierta = true }) => (
    <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#d4af37', fontSize: '0.65rem', letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
            {titulo}
        </div>
        {abierta && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{children}</div>}
    </div>
);

const BusquedaPage = ({ onBack, onSelectVideo, styles, usuario, vistos = [], videosIndexados = [], accesoRutas }) => {
    const [termino, setTermino] = useState('');
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [limite, setLimite] = useState(60);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 900);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(window.innerWidth >= 900);
    const [verTodasEtiquetas, setVerTodasEtiquetas] = useState(false);

    useEffect(() => {
        const onResize = () => {
            const movil = window.innerWidth < 900;
            setEsMovil(movil);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const resultados = useMemo(() => buscarTecnicas(termino, filtros), [termino, filtros]);
    const visibles = useMemo(() => resultados.slice(0, limite), [resultados, limite]);

    const dinamicos = useMemo(() => {
        const tokens = normalizar(termino).split(' ').filter(Boolean);
        return videosIndexados
            .map((video) => normalizarVideoDinamico(video))
            .filter((video) => video.id && tieneAccesoVideoDinamico(usuario, video, accesoRutas))
            .filter((video) => {
                if (filtros.posicion && video.posicion !== filtros.posicion) return false;
                if (filtros.tipo && video.tipo !== filtros.tipo) return false;
                if (filtros.modalidad && video.modalidad !== filtros.modalidad) return false;
                if (filtros.autor && video.autor !== filtros.autor) return false;
                if (filtros.etiqueta && !video.etiquetas.includes(filtros.etiqueta)) return false;
                if (tokens.length === 0) return true;
                return tokens.every((token) => video.busca.includes(token));
            })
            .slice(0, 30);
    }, [videosIndexados, usuario, accesoRutas, termino, filtros]);

    const totalResultados = resultados.length + dinamicos.length;

    const activos = Object.entries(filtros).filter(([, v]) => v);

    const alternarFiltro = (campo, valor) => {
        setFiltros(prev => ({ ...prev, [campo]: prev[campo] === valor ? null : valor }));
        setLimite(60);
    };

    const limpiarTodo = () => {
        setFiltros(FILTROS_VACIOS);
        setTermino('');
        setLimite(60);
    };

    const abrirTecnica = (t) => {
        if (tieneAccesoVideo(usuario, t, accesoRutas)) {
            onSelectVideo({ titulo: t.nombre, id: t.id });
            return;
        }
        if (window.confirm(mensajeContenidoBloqueado(t))) {
            pedirAcceso(usuario, t.cursoTitulo);
        }
    };

    const etiquetasVisibles = verTodasEtiquetas ? FACETAS.ETIQUETAS : FACETAS.ETIQUETAS.slice(0, 22);

    return (
        <div style={{
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : '24px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 12px)' : '24px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 12px)' : '24px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 12px)' : '24px',
            backgroundColor: '#000', color: '#fff', height: '100vh', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden',
        }}>
            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexShrink: 0 }}>
                <button onClick={onBack} style={{ ...(styles?.btnOutline || {}), width: 'auto', padding: '9px 14px', fontSize: '0.8rem', borderColor: '#d4af37', color: '#d4af37', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#111' }}>
                    ← {esMovil ? '' : 'VOLVER'}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: '#d4af37', margin: 0, fontSize: esMovil ? '1rem' : '1.3rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Búsqueda Vault
                    </h2>
                    <div style={{ color: '#666', fontSize: '0.65rem', marginTop: '2px' }}>
                        {ESTADISTICAS.videos} videos · {ESTADISTICAS.cursos} cursos · {ESTADISTICAS.posiciones} posiciones · {ESTADISTICAS.etiquetas} etiquetas
                    </div>
                </div>
                {esMovil && (
                    <button onClick={() => setFiltrosAbiertos(v => !v)} style={{ ...(styles?.btnOutline || {}), width: 'auto', padding: '9px 12px', fontSize: '0.72rem', borderColor: filtrosAbiertos ? '#d4af37' : '#333', color: filtrosAbiertos ? '#d4af37' : '#aaa', borderRadius: '8px', backgroundColor: '#111' }}>
                        {filtrosAbiertos ? 'OCULTAR FILTROS' : `FILTROS${activos.length ? ` (${activos.length})` : ''}`}
                    </button>
                )}
            </div>

            {/* BUSCADOR */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '10px', flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', display: 'flex', alignItems: 'center' }}><VaultIcon name="search" size={15} /></span>
                <input
                    type="text"
                    placeholder="Busca técnica, posición, autor, etiqueta... (ej: darce, media guardia, Gordon)"
                    value={termino}
                    onChange={(e) => { setTermino(e.target.value); setLimite(60); }}
                    style={{ width: '100%', padding: '13px 42px 13px 40px', backgroundColor: '#111', border: '1px solid #d4af37', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                />
                {termino && (
                    <button onClick={() => { setTermino(''); setLimite(60); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><VaultIcon name="close" size={14} color="#888" /></button>
                )}
            </div>

            {/* FILTROS ACTIVOS */}
            {activos.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', flexShrink: 0 }}>
                    <span style={{ color: '#666', fontSize: '0.65rem' }}>FILTROS:</span>
                    {activos.map(([campo, valor]) => (
                        <Chip key={campo} activo onClick={() => alternarFiltro(campo, valor)}>
                            {valor} <VaultIcon name="close" size={10} color="#000" />
                        </Chip>
                    ))}
                    <button onClick={limpiarTodo} style={{ background: 'none', border: 'none', color: '#ff6666', fontSize: '0.68rem', cursor: 'pointer', textDecoration: 'underline' }}>
                        Limpiar todo
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, flexDirection: esMovil ? 'column' : 'row' }}>
                {/* PANEL DE FILTROS */}
                {(filtrosAbiertos || !esMovil) && (
                    <aside style={{
                        width: esMovil ? '100%' : '270px',
                        flexShrink: 0,
                        overflowY: 'auto',
                        border: '1px solid #1c1c1c',
                        borderRadius: '10px',
                        padding: '14px',
                        backgroundColor: '#070707',
                        maxHeight: esMovil ? '38vh' : '100%',
                        boxSizing: 'border-box',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px' }}>FILTROS</span>
                            {activos.length > 0 && <button onClick={limpiarTodo} style={{ background: 'none', border: 'none', color: '#ff6666', fontSize: '0.65rem', cursor: 'pointer' }}>LIMPIAR</button>}
                        </div>

                        <SeccionFiltro titulo="Posición">
                            {FACETAS.POSICION.map(f => (
                                <Chip key={f.valor} activo={filtros.posicion === f.valor} count={f.videos} onClick={() => alternarFiltro('posicion', f.valor)}>
                                    {f.valor}
                                </Chip>
                            ))}
                        </SeccionFiltro>

                        <SeccionFiltro titulo="Tipo">
                            {FACETAS.TIPO.map(f => (
                                <Chip key={f.valor} activo={filtros.tipo === f.valor} count={f.videos} onClick={() => alternarFiltro('tipo', f.valor)}>
                                    {f.valor}
                                </Chip>
                            ))}
                        </SeccionFiltro>

                        <SeccionFiltro titulo="Modalidad">
                            {FACETAS.MODALIDAD.map(f => (
                                <Chip key={f.valor} activo={filtros.modalidad === f.valor} count={f.videos} onClick={() => alternarFiltro('modalidad', f.valor)} tono="green">
                                    {f.valor}
                                </Chip>
                            ))}
                        </SeccionFiltro>

                        <SeccionFiltro titulo="Autor">
                            {FACETAS.AUTORES.map(f => (
                                <Chip key={f.valor} activo={filtros.autor === f.valor} count={f.videos} onClick={() => alternarFiltro('autor', f.valor)}>
                                    {f.valor}
                                </Chip>
                            ))}
                        </SeccionFiltro>

                        <SeccionFiltro titulo="Etiquetas">
                            {etiquetasVisibles.map(f => (
                                <Chip key={f.valor} activo={filtros.etiqueta === f.valor} count={f.videos} onClick={() => alternarFiltro('etiqueta', f.valor)}>
                                    {f.valor}
                                </Chip>
                            ))}
                            {FACETAS.ETIQUETAS.length > 22 && (
                                <button onClick={() => setVerTodasEtiquetas(v => !v)} style={{ background: 'none', border: 'none', color: '#d4af37', fontSize: '0.68rem', cursor: 'pointer', textDecoration: 'underline' }}>
                                    {verTodasEtiquetas ? 'Ver menos' : `Ver todas (${FACETAS.ETIQUETAS.length})`}
                                </button>
                            )}
                        </SeccionFiltro>
                    </aside>
                )}

                {/* RESULTADOS */}
                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
                        <span style={{ color: '#888', fontSize: '0.72rem' }}>
                            {totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'}
                            {dinamicos.length > 0 ? ` · ${dinamicos.length} de tus rutas` : ''}
                            {resultados.length > visibles.length ? ` · mostrando ${visibles.length} del Vault` : ''}
                        </span>
                        {termino && <span style={{ color: '#555', fontSize: '0.68rem' }}>“{termino}”</span>}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', paddingBottom: '16px' }}>
                        {totalResultados === 0 && (
                            <div style={{ textAlign: 'center', marginTop: '50px', color: '#666' }}>
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><VaultIcon name="bookOpen" size={40} color="#d4af37" /></div>
                                <p style={{ color: '#999', margin: '0 0 6px' }}>No se encontraron técnicas</p>
                                <p style={{ fontSize: '0.8rem', color: '#555' }}>Prueba con otra palabra o quita algún filtro.</p>
                            </div>
                        )}

                        {dinamicos.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d4af37', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.8px', marginTop: '2px' }}>
                                <VaultIcon name="route" size={12} /> VIDEOS DE TUS RUTAS · {dinamicos.length}
                            </div>
                        )}

                        {dinamicos.map((video) => {
                            const visto = vistos.includes(video.id);
                            const esYoutube = video.fuente === 'youtube';
                            return (
                                <button
                                    key={`dinamico-${video.id}`}
                                    type="button"
                                    onClick={() => onSelectVideo({
                                        titulo: video.nombre,
                                        id: video.id,
                                        fuente: video.fuente,
                                        driveId: video.driveId,
                                        youtubeId: video.youtubeId
                                    })}
                                    style={{
                                        textAlign: 'left', width: '100%', padding: '12px 14px',
                                        backgroundColor: '#0a0a0a', border: `1px solid ${visto ? '#2e5c2e' : 'rgba(212,175,55,0.28)'}`,
                                        borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                        gap: '6px', flexShrink: 0
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: visto ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: esMovil ? '0.88rem' : '0.95rem', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {visto && <VaultIcon name="check" size={12} color="#4CAF50" />}
                                            <VaultIcon name={esYoutube ? 'youtube' : 'drive'} size={13} color={esYoutube ? '#ff6b6b' : '#8fa8ff'} />
                                            <span>{video.nombre}</span>
                                        </span>
                                        <span style={{ color: '#555', fontSize: '0.62rem', whiteSpace: 'nowrap', paddingTop: '3px' }}>{video.modalidad}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', fontSize: '0.68rem', color: '#777' }}>
                                        <span style={{ color: '#bbb' }}>{video.cursoTitulo}</span>
                                        <span style={{ opacity: 0.4 }}>•</span>
                                        <span>{video.autor}</span>
                                        {video.duracion && <><span style={{ opacity: 0.4 }}>•</span><span>{video.duracion}</span></>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                        <span style={{ fontSize: '0.62rem', color: '#0a0a0a', backgroundColor: '#d4af37', borderRadius: '3px', padding: '2px 6px', fontWeight: 'bold' }}>{video.posicion}</span>
                                        <span style={{ fontSize: '0.62rem', color: '#d4af37', border: '1px solid #3a3320', borderRadius: '3px', padding: '2px 6px' }}>{video.tipo}</span>
                                        {(video.etiquetas || []).slice(0, 4).map((etiqueta) => (
                                            <span key={etiqueta} style={{ fontSize: '0.6rem', color: '#8a8a8a', border: '1px solid #262626', borderRadius: '3px', padding: '2px 6px' }}>{etiqueta}</span>
                                        ))}
                                    </div>
                                </button>
                            );
                        })}

                        {visibles.map((t, i) => {
                            const visto = vistos.includes(t.id);
                            const bloqueado = !tieneAccesoVideo(usuario, t, accesoRutas);
                            return (
                                <button
                                    key={`${t.id}-${i}`}
                                    type="button"
                                    onClick={() => abrirTecnica(t)}
                                    style={{
                                        textAlign: 'left',
                                        width: '100%',
                                        padding: '12px 14px',
                                        backgroundColor: '#0a0a0a',
                                        border: `1px solid ${visto ? '#2e5c2e' : '#1f1f1f'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        flexShrink: 0,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: visto ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: esMovil ? '0.88rem' : '0.95rem', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {visto && <VaultIcon name="check" size={12} color="#4CAF50" />}
                                            {bloqueado && <VaultIcon name="lock" size={12} color="#d4af37" />}
                                            <span>{t.nombre}</span>
                                        </span>
                                        <span style={{ color: '#555', fontSize: '0.62rem', whiteSpace: 'nowrap', paddingTop: '3px' }}>
                                            {t.modalidad}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', fontSize: '0.68rem', color: '#777' }}>
                                        <span style={{ color: '#bbb' }}>{t.cursoTitulo}</span>
                                        <span style={{ opacity: 0.4 }}>•</span>
                                        <span>{t.volumenNombre}</span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                        {esVideoGratis(t) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: '#000', backgroundColor: '#d4af37', borderRadius: '3px', padding: '2px 6px', fontWeight: 'bold' }}>
                                                <VaultIcon name="gift" size={11} color="#000" /> GRATIS
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.62rem', color: '#0a0a0a', backgroundColor: '#d4af37', borderRadius: '3px', padding: '2px 6px', fontWeight: 'bold' }}>{t.posicion}</span>
                                        <span style={{ fontSize: '0.62rem', color: '#d4af37', border: '1px solid #3a3320', borderRadius: '3px', padding: '2px 6px' }}>{t.tipo}</span>
                                        {t.etiquetas.slice(0, 4).map(e => (
                                            <span key={e} style={{ fontSize: '0.6rem', color: '#8a8a8a', border: '1px solid #262626', borderRadius: '3px', padding: '2px 6px' }}>{e}</span>
                                        ))}
                                        {t.etiquetas.length > 4 && <span style={{ fontSize: '0.6rem', color: '#555' }}>+{t.etiquetas.length - 4}</span>}
                                    </div>
                                </button>
                            );
                        })}

                        {resultados.length > visibles.length && (
                            <button
                                onClick={() => setLimite(l => l + 60)}
                                style={{ ...(styles?.btnOutline || {}), width: '100%', padding: '12px', borderColor: '#d4af37', color: '#d4af37', backgroundColor: '#0d0d0d', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }}
                            >
                                CARGAR 60 MÁS ({resultados.length - visibles.length} restantes)
                            </button>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BusquedaPage;
