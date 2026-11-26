import React, { useEffect, useMemo, useState } from 'react';
import VaultIcon from './VaultIcon';
import {
    leccionesDeRuta,
    mapaVideos,
    progresoRuta,
    resolverLeccion,
    rutasParaUsuario,
    esAdminRutas
} from '../utils/rutasAprendizaje';
import { obtenerCurso } from '../data/vaultIndex';

const iconoFuente = (fuente) => (fuente === 'youtube' ? 'youtube' : fuente === 'drive' ? 'drive' : 'bookOpen');

const RutasAprendizajePage = ({
    onBack,
    usuario,
    vistos = [],
    rutas = [],
    videos = [],
    asignaciones = [],
    onSelectVideo,
    onOpenBuilder,
    onOpenMapa
}) => {
    const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    const [filtro, setFiltro] = useState('todas');
    const [busqueda, setBusqueda] = useState('');
    const [rutaAbiertaId, setRutaAbiertaId] = useState(null);

    useEffect(() => {
        const alRedimensionar = () => setAncho(window.innerWidth);
        window.addEventListener('resize', alRedimensionar);
        return () => window.removeEventListener('resize', alRedimensionar);
    }, []);

    const esMovil = ancho < 768;

    const videosPorId = useMemo(() => mapaVideos(videos), [videos]);
    const liberadas = useMemo(() => rutasParaUsuario(usuario, rutas, asignaciones), [usuario, rutas, asignaciones]);

    const rutasConProgreso = useMemo(() => liberadas.map((ruta) => ({
        ...ruta,
        progreso: progresoRuta(ruta, vistos, videosPorId)
    })), [liberadas, vistos, videosPorId]);

    const totalLecciones = rutasConProgreso.reduce((n, r) => n + r.progreso.total, 0);
    const totalVistas = rutasConProgreso.reduce((n, r) => n + r.progreso.completadas, 0);
    const porcentajeGlobal = totalLecciones ? Math.round((totalVistas / totalLecciones) * 100) : 0;

    const visibles = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return rutasConProgreso.filter((ruta) => {
            if (filtro === 'en-curso' && !(ruta.progreso.porcentaje > 0 && ruta.progreso.porcentaje < 100)) return false;
            if (filtro === 'completadas' && ruta.progreso.porcentaje < 100) return false;
            if (filtro === 'pendientes' && ruta.progreso.porcentaje > 0) return false;
            if (!texto) return true;
            return [ruta.nombre, ruta.descripcion, ruta.nivel].join(' ').toLowerCase().includes(texto);
        });
    }, [rutasConProgreso, filtro, busqueda]);

    const rutaAbierta = rutasConProgreso.find((r) => r.id === rutaAbiertaId) || null;

    const abrirLeccion = (ruta, leccion) => {
        const playable = resolverLeccion(leccion, videosPorId);
        if (!playable) return;
        if (!onSelectVideo) return;
        onSelectVideo({
            ...playable,
            rutaId: ruta.id,
            rutaNombre: ruta.nombre,
            seccionId: leccion.seccionId
        });
    };

    const continuarRuta = (ruta) => {
        const lecciones = leccionesDeRuta(ruta);
        const pendiente = lecciones.find((leccion) => {
            const playable = resolverLeccion(leccion, videosPorId);
            return playable && !vistos.includes(playable.id);
        }) || lecciones[0];
        if (pendiente) abrirLeccion(ruta, pendiente);
    };

    return (
        <div style={s.root} className="rutas-root">
            <style>{cssRutas}</style>
            <div style={s.shell}>
                <header style={s.header}>
                    <div style={s.headerLeft}>
                        <button type="button" onClick={onBack} style={s.backBtn} title="Volver" aria-label="Volver">
                            <VaultIcon name="chevronLeft" size={16} />
                        </button>
                        <div style={s.titleGroup}>
                            <span style={s.titleIcon}><VaultIcon name="route" size={19} /></span>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={s.title}>RUTAS DE APRENDIZAJE</h1>
                                <p style={s.subtitle}>
                                    {esAdminRutas(usuario)
                                        ? 'Revisa, comparte y construye el camino de tus alumnos'
                                        : 'El camino que tu profesor preparó para ti'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div style={s.headerActions}>
                        {esAdminRutas(usuario) && onOpenBuilder && (
                            <button type="button" onClick={onOpenBuilder} style={s.goldBtn}>
                                <VaultIcon name="settings" size={14} /> {!esMovil && 'CONSTRUCTOR'}
                            </button>
                        )}
                    </div>
                </header>

                {!rutaAbierta && (
                    <>
                        <section style={s.hero}>
                            <div style={s.heroCopy}>
                                <span style={s.eyebrow}>TU PROGRESO</span>
                                <h2 style={s.heroTitle}>
                                    {liberadas.length === 0 ? 'Aún no tienes rutas liberadas' : `${liberadas.length} ${liberadas.length === 1 ? 'ruta disponible' : 'rutas disponibles'}`}
                                </h2>
                                <p style={s.heroText}>
                                    {liberadas.length === 0
                                        ? 'Cuando tu profesor publique una ruta para tu dojo o tu cuenta, aparecerá aquí con sus secciones y lecciones.'
                                        : 'Sigue las secciones en orden, marca cada lección como vista y retoma donde te quedaste.'}
                                </p>
                            </div>
                            <div style={s.heroProgress}>
                                <div style={s.progressRing}>
                                    <svg viewBox="0 0 120 120" width="92" height="92" aria-hidden="true">
                                        <circle cx="60" cy="60" r="52" fill="none" stroke="#1c1c1c" strokeWidth="9" />
                                        <circle
                                            cx="60" cy="60" r="52" fill="none" stroke="#d4af37" strokeWidth="9"
                                            strokeLinecap="round"
                                            strokeDasharray={`${(porcentajeGlobal / 100) * 326.7} 326.7`}
                                            transform="rotate(-90 60 60)"
                                        />
                                    </svg>
                                    <span style={s.progressRingText}>{porcentajeGlobal}%</span>
                                </div>
                                <div style={s.heroProgressMeta}>
                                    <strong>{totalVistas}/{totalLecciones}</strong>
                                    <span>lecciones completadas</span>
                                </div>
                            </div>
                        </section>

                        {liberadas.length > 0 && (
                            <section style={s.toolbar}>
                                <div style={s.searchBox}>
                                    <VaultIcon name="search" size={14} color="#777" />
                                    <input
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        placeholder="Buscar una ruta..."
                                        style={s.searchInput}
                                    />
                                    {busqueda && (
                                        <button type="button" onClick={() => setBusqueda('')} style={s.clearBtn} aria-label="Limpiar búsqueda">
                                            <VaultIcon name="close" size={12} />
                                        </button>
                                    )}
                                </div>
                                <div style={s.chips}>
                                    {[
                                        { id: 'todas', label: 'Todas' },
                                        { id: 'pendientes', label: 'Sin empezar' },
                                        { id: 'en-curso', label: 'En curso' },
                                        { id: 'completadas', label: 'Completadas' }
                                    ].map((opcion) => (
                                        <button
                                            key={opcion.id}
                                            type="button"
                                            onClick={() => setFiltro(opcion.id)}
                                            style={filtro === opcion.id ? s.chipActive : s.chip}
                                        >
                                            {opcion.label}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {liberadas.length === 0 ? (
                            <div style={s.empty}>
                                <span style={s.emptyIcon}><VaultIcon name="route" size={30} color="#d4af37" /></span>
                                <h3 style={s.emptyTitle}>Tu camino empieza con una ruta</h3>
                                <p style={s.emptyText}>
                                    Las rutas combinan lecciones del Vault con seminarios y videos propios de tu academia.
                                    Pide a tu profesor que libere una para tu cuenta o para tu dojo.
                                </p>
                                {onOpenMapa && (
                                    <button type="button" onClick={onOpenMapa} style={s.ghostBtn}>
                                        <VaultIcon name="map" size={14} /> EXPLORAR EL MAPA
                                    </button>
                                )}
                            </div>
                        ) : visibles.length === 0 ? (
                            <div style={s.empty}>
                                <span style={s.emptyIcon}><VaultIcon name="filter" size={28} color="#d4af37" /></span>
                                <h3 style={s.emptyTitle}>No hay rutas con este filtro</h3>
                                <p style={s.emptyText}>Prueba con otra búsqueda o vuelve a ver todas tus rutas.</p>
                                <button type="button" onClick={() => { setFiltro('todas'); setBusqueda(''); }} style={s.ghostBtn}>
                                    <VaultIcon name="undo" size={14} /> LIMPIAR FILTROS
                                </button>
                            </div>
                        ) : (
                            <section style={s.grid}>
                                {visibles.map((ruta) => (
                                    <TarjetaRuta
                                        key={ruta.id}
                                        ruta={ruta}
                                        videosPorId={videosPorId}
                                        vistos={vistos}
                                        onAbrir={() => setRutaAbiertaId(ruta.id)}
                                        onContinuar={() => continuarRuta(ruta)}
                                    />
                                ))}
                            </section>
                        )}
                    </>
                )}

                {rutaAbierta && (
                    <DetalleRuta
                        ruta={rutaAbierta}
                        videosPorId={videosPorId}
                        vistos={vistos}
                        esMovil={esMovil}
                        onVolver={() => setRutaAbiertaId(null)}
                        onAbrirLeccion={(leccion) => abrirLeccion(rutaAbierta, leccion)}
                        onContinuar={() => continuarRuta(rutaAbierta)}
                        onOpenMapa={onOpenMapa}
                    />
                )}

                <footer style={s.footerNote}>
                    <VaultIcon name="shield" size={13} color="#666" />
                    <span>Las rutas solo muestran contenido liberado para tu cuenta, tu dojo o tu rol.</span>
                </footer>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* TARJETA DE RUTA                                                     */
/* ------------------------------------------------------------------ */
const TarjetaRuta = ({ ruta, videosPorId, vistos, onAbrir, onContinuar }) => {
    const lecciones = leccionesDeRuta(ruta);
    const secciones = (ruta.secciones || []).length;
    const progreso = progresoRuta(ruta, vistos, videosPorId);
    const completa = progreso.total > 0 && progreso.porcentaje === 100;

    return (
        <article className="rutas-card" style={s.card}>
            <div style={s.cardTop}>
                <span style={s.cardIcon}>
                    <VaultIcon name={ruta.icono || 'route'} size={20} color="#d4af37" />
                </span>
                <div style={s.cardIdentity}>
                    <div style={s.cardNameRow}>
                        <h3 style={s.cardName}>{ruta.nombre || 'Ruta sin nombre'}</h3>
                        {ruta.estado !== 'publicada' && <span style={s.draftBadge}>BORRADOR</span>}
                    </div>
                    <div style={s.cardMeta}>
                        <span style={s.typeBadge}>{ruta.tipo === 'completa' ? 'MAPA COMPLETO' : 'RAMA'}</span>
                        <span style={s.metaDot} />
                        <span>{secciones} {secciones === 1 ? 'sección' : 'secciones'}</span>
                        <span style={s.metaDot} />
                        <span>{progreso.total} {progreso.total === 1 ? 'lección' : 'lecciones'}</span>
                    </div>
                </div>
                <span style={{ ...s.progressPill, color: completa ? '#4CAF50' : '#d4af37', borderColor: completa ? 'rgba(76,175,80,0.45)' : 'rgba(212,175,55,0.4)' }}>
                    {completa ? <VaultIcon name="checkCircle" size={11} /> : `${progreso.porcentaje}%`}
                </span>
            </div>

            {ruta.descripcion && <p style={s.cardDescription}>{ruta.descripcion}</p>}

            <LienzoRuta ruta={ruta} videosPorId={videosPorId} vistos={vistos} />

            <div style={s.cardFooter}>
                <div style={s.cardProgress}>
                    <div style={s.progressTrack}>
                        <div style={{ ...s.progressFill, width: `${progreso.porcentaje}%`, background: completa ? '#4CAF50' : '#d4af37' }} />
                    </div>
                    <span style={s.progressLabel}>{progreso.completadas} de {progreso.total} completadas</span>
                </div>
                <div style={s.cardActions}>
                    <button type="button" onClick={onContinuar} style={s.primaryBtn} disabled={lecciones.length === 0}>
                        <VaultIcon name={progreso.completadas > 0 ? 'play' : 'route'} size={13} />
                        {progreso.completadas > 0 ? 'CONTINUAR' : 'EMPEZAR'}
                    </button>
                    <button type="button" onClick={onAbrir} style={s.ghostIconBtn} title="Ver ruta" aria-label="Ver ruta">
                        <VaultIcon name="chevronRight" size={15} />
                    </button>
                </div>
            </div>
        </article>
    );
};

/* ------------------------------------------------------------------ */
/* LIENZO: MINI MAPA DE SECCIONES                                      */
/* ------------------------------------------------------------------ */
const LienzoRuta = ({ ruta, videosPorId, vistos, grande = false }) => {
    const secciones = (ruta.secciones || []).filter((sec) => (sec.lecciones || []).length > 0).slice(0, 7);
    if (secciones.length === 0) {
        return (
            <div style={s.lienzoEmpty}>
                <VaultIcon name="layers" size={16} color="#555" />
                <span>Esta ruta aún no tiene lecciones.</span>
            </div>
        );
    }

    const ancho = grande ? 620 : 320;
    const alto = grande ? 150 : 96;
    const margen = grande ? 44 : 26;
    const paso = secciones.length > 1 ? (ancho - margen * 2) / (secciones.length - 1) : 0;
    const puntos = secciones.map((seccion, i) => {
        const x = margen + paso * i;
        const y = alto / 2 + (i % 2 === 0 ? -1 : 1) * (grande ? 30 : 18);
        const lecciones = seccion.lecciones || [];
        const ids = lecciones.map((l) => resolverLeccion(l, videosPorId)?.id).filter(Boolean);
        const completadas = ids.filter((id) => vistos.includes(id)).length;
        return { x, y, completadas, total: ids.length, titulo: seccion.titulo, i };
    });

    const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div style={{ ...s.lienzo, height: alto }} className="rutas-lienzo">
            <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                <path d={path} fill="none" stroke="#242424" strokeWidth={grande ? 4 : 3} strokeLinecap="round" />
                {puntos.map((p, i) => {
                    const anterior = puntos[i - 1];
                    if (!anterior || p.completadas === 0) return null;
                    return <line key={`linea-${i}`} x1={anterior.x} y1={anterior.y} x2={p.x} y2={p.y} stroke="#d4af37" strokeWidth={grande ? 4 : 3} strokeLinecap="round" />;
                })}
            </svg>
            {puntos.map((p) => {
                const completo = p.total > 0 && p.completadas === p.total;
                const enCurso = p.completadas > 0 && !completo;
                const borde = completo ? '#4CAF50' : enCurso ? '#d4af37' : '#333';
                return (
                    <div
                        key={`punto-${p.i}`}
                        className="rutas-punto"
                        style={{
                            left: `${(p.x / ancho) * 100}%`,
                            top: `${(p.y / alto) * 100}%`,
                            width: grande ? 26 : 20,
                            height: grande ? 26 : 20,
                            borderColor: borde,
                            background: completo ? 'rgba(76,175,80,0.14)' : '#0a0a0a',
                            color: completo ? '#4CAF50' : '#d4af37'
                        }}
                        title={p.titulo}
                    >
                        {completo ? <VaultIcon name="check" size={grande ? 13 : 10} color="#4CAF50" /> : <span style={{ fontSize: grande ? '0.58rem' : '0.48rem', fontWeight: 800 }}>{p.i + 1}</span>}
                    </div>
                );
            })}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* DETALLE DE RUTA                                                     */
/* ------------------------------------------------------------------ */
const DetalleRuta = ({ ruta, videosPorId, vistos, esMovil, onVolver, onAbrirLeccion, onContinuar, onOpenMapa }) => {
    const progreso = progresoRuta(ruta, vistos, videosPorId);
    const completa = progreso.total > 0 && progreso.porcentaje === 100;

    return (
        <div style={s.detail}>
            <button type="button" onClick={onVolver} style={s.detailBack}>
                <VaultIcon name="chevronLeft" size={13} /> TODAS LAS RUTAS
            </button>

            <section style={s.detailHero}>
                <span style={s.detailIcon}>
                    <VaultIcon name={ruta.icono || 'route'} size={26} color="#d4af37" />
                </span>
                <div style={s.detailIdentity}>
                    <div style={s.cardNameRow}>
                        <h2 style={s.detailName}>{ruta.nombre || 'Ruta sin nombre'}</h2>
                        {ruta.estado !== 'publicada' && <span style={s.draftBadge}>BORRADOR</span>}
                    </div>
                    <div style={s.cardMeta}>
                        <span style={s.typeBadge}>{ruta.tipo === 'completa' ? 'MAPA COMPLETO' : 'RAMA'}</span>
                        {ruta.nivel && <><span style={s.metaDot} /><span>{ruta.nivel}</span></>}
                        <span style={s.metaDot} />
                        <span>{progreso.total} lecciones</span>
                    </div>
                    {ruta.descripcion && <p style={s.detailDescription}>{ruta.descripcion}</p>}
                </div>
                <div style={{
                    ...s.detailProgress,
                    ...(esMovil ? { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } : {})
                }}>
                    <strong style={{ color: completa ? '#4CAF50' : '#d4af37' }}>{progreso.porcentaje}%</strong>
                    <span>{progreso.completadas}/{progreso.total}</span>
                    <button type="button" onClick={onContinuar} style={s.primaryBtn} disabled={progreso.total === 0}>
                        <VaultIcon name={progreso.completadas ? 'play' : 'route'} size={13} />
                        {completa ? 'REPASAR' : progreso.completadas ? 'CONTINUAR' : 'EMPEZAR'}
                    </button>
                </div>
            </section>

            <div style={s.detailLienzo}>
                <LienzoRuta ruta={ruta} videosPorId={videosPorId} vistos={vistos} grande={!esMovil} />
            </div>

            {(ruta.cursosLiberados || []).length > 0 && (
                <section style={s.mapCourses}>
                    <div style={s.mapCoursesHead}>
                        <h3 style={s.sectionTitle}><VaultIcon name="layers" size={15} /> Cursos liberados con esta ruta</h3>
                        {onOpenMapa && (
                            <button type="button" onClick={onOpenMapa} style={s.linkBtn}>
                                ABRIR MAPA <VaultIcon name="external" size={10} />
                            </button>
                        )}
                    </div>
                    <div style={s.mapCourseChips}>
                        {(ruta.cursosLiberados || []).map((cursoId) => {
                            const curso = obtenerCurso(cursoId);
                            return (
                                <span key={cursoId} style={s.mapCourseChip}>
                                    <VaultIcon name="bookOpen" size={11} />
                                    {curso?.titulo || cursoId}
                                </span>
                            );
                        })}
                    </div>
                </section>
            )}

            <div style={s.sections}>
                {(ruta.secciones || []).map((seccion, sIndice) => {
                    const lecciones = seccion.lecciones || [];
                    if (lecciones.length === 0) return null;
                    return (
                        <section key={seccion.id || sIndice} style={s.sectionBlock}>
                            <div style={s.sectionHead}>
                                <span style={s.sectionNumber}>{String(sIndice + 1).padStart(2, '0')}</span>
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={s.sectionTitle}>{seccion.titulo || `Sección ${sIndice + 1}`}</h3>
                                    {seccion.descripcion && <p style={s.sectionDescription}>{seccion.descripcion}</p>}
                                </div>
                                <span style={s.sectionCount}>{lecciones.length} {lecciones.length === 1 ? 'lección' : 'lecciones'}</span>
                            </div>
                            <div style={s.lessons}>
                                {lecciones.map((leccion, lIndice) => {
                                    const playable = resolverLeccion({ ...leccion, seccionId: seccion.id }, videosPorId);
                                    if (!playable) return null;
                                    const visto = vistos.includes(playable.id);
                                    const fuente = leccion.tipo === 'video' ? leccion.fuente : 'drive';
                                    return (
                                        <button
                                            key={`${leccion.ref}-${lIndice}`}
                                            type="button"
                                            onClick={() => onAbrirLeccion({ ...leccion, seccionId: seccion.id })}
                                            style={s.lesson}
                                            className="rutas-lesson"
                                        >
                                            <span style={{ ...s.lessonIndex, borderColor: visto ? 'rgba(76,175,80,0.5)' : 'rgba(212,175,55,0.35)', color: visto ? '#4CAF50' : '#d4af37' }}>
                                                {visto ? <VaultIcon name="check" size={12} /> : String(lIndice + 1).padStart(2, '0')}
                                            </span>
                                            <span style={s.lessonBody}>
                                                <span style={s.lessonTitle}>{playable.titulo}</span>
                                                <span style={s.lessonMeta}>
                                                    <VaultIcon name={iconoFuente(fuente)} size={10} />
                                                    {fuente === 'youtube' ? 'YouTube' : fuente === 'drive' ? 'Drive' : 'Vault'}
                                                    {playable.cursoTitulo ? <> <span style={s.metaDot} /> {playable.cursoTitulo}</> : null}
                                                    {playable.duracion ? <> <span style={s.metaDot} /> {playable.duracion}</> : null}
                                                </span>
                                            </span>
                                            <span style={s.lessonPlay}>
                                                <VaultIcon name="play" size={13} />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
                {(ruta.secciones || []).length === 0 && (
                    <div style={s.empty}>
                        <span style={s.emptyIcon}><VaultIcon name="layers" size={28} color="#d4af37" /></span>
                        <h3 style={s.emptyTitle}>Ruta en preparación</h3>
                        <p style={s.emptyText}>El profesor aún no agregó secciones a esta ruta.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* ESTILOS                                                             */
/* ------------------------------------------------------------------ */
const s = {
    root: {
        minHeight: 'var(--app-vh)', width: '100%', backgroundColor: '#000', color: '#fff', boxSizing: 'border-box',
        overflowX: 'hidden',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
    },
    shell: { width: '100%', maxWidth: '1180px', margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 },
    headerActions: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    backBtn: {
        width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: '10px', cursor: 'pointer'
    },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    titleIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '1px solid #d4af37', color: '#d4af37', background: 'rgba(212,175,55,0.06)'
    },
    title: { margin: 0, color: '#d4af37', fontSize: 'clamp(1rem, 2.6vw, 1.35rem)', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 },
    subtitle: { margin: '2px 0 0', color: '#777', fontSize: '0.64rem', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70vw' },
    goldBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#d4af37',
        color: '#000', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '0.64rem',
        fontWeight: 800, cursor: 'pointer', letterSpacing: '0.3px', whiteSpace: 'nowrap'
    },
    ghostBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent',
        color: '#ccc', border: '1px solid #333', borderRadius: '8px', padding: '9px 12px', fontSize: '0.62rem',
        fontWeight: 800, cursor: 'pointer'
    },
    linkBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#d4af37', fontSize: '0.56rem', fontWeight: 800, cursor: 'pointer' },

    hero: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.1), #080808 55%)',
        border: '1px solid rgba(212,175,55,0.25)', borderRadius: '14px', padding: '16px', marginBottom: '12px'
    },
    heroCopy: { flex: 1, minWidth: '220px' },
    eyebrow: { display: 'block', color: '#d4af37', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '1.4px', marginBottom: '4px' },
    heroTitle: { margin: 0, color: '#fff', fontSize: 'clamp(1.15rem, 3vw, 1.55rem)', lineHeight: 1.15, fontWeight: 800 },
    heroText: { margin: '6px 0 0', color: '#8a8a8a', fontSize: '0.7rem', lineHeight: 1.5, maxWidth: '560px' },
    heroProgress: { display: 'flex', alignItems: 'center', gap: '12px' },
    progressRing: { position: 'relative', width: '92px', height: '92px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    progressRingText: { position: 'absolute', color: '#d4af37', fontSize: '1.05rem', fontWeight: 800 },
    heroProgressMeta: { display: 'flex', flexDirection: 'column', gap: '2px' },
    toolbar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
    searchBox: {
        display: 'flex', alignItems: 'center', gap: '7px', background: '#050505', border: '1px solid #262626',
        borderRadius: '8px', padding: '0 10px', height: '38px', flex: '1 1 220px', minWidth: 0
    },
    searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.7rem' },
    clearBtn: { width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' },
    chips: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    chip: {
        background: '#111', border: '1px solid #2a2a2a', color: '#999', borderRadius: '999px', padding: '6px 11px',
        fontSize: '0.56rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    chipActive: {
        background: '#d4af37', border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '6px 11px',
        fontSize: '0.56rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: '12px' },
    card: {
        display: 'flex', flexDirection: 'column', gap: '10px', background: '#0a0a0a', border: '1px solid #202020',
        borderRadius: '13px', padding: '13px'
    },
    cardTop: { display: 'flex', alignItems: 'flex-start', gap: '9px', minWidth: 0 },
    cardIcon: {
        width: '40px', height: '40px', flexShrink: 0, borderRadius: '10px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.28)'
    },
    cardIdentity: { flex: 1, minWidth: 0 },
    cardNameRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    cardName: { margin: 0, color: '#fff', fontSize: '0.86rem', fontWeight: 800, lineHeight: 1.2 },
    draftBadge: {
        display: 'inline-flex', alignItems: 'center', color: '#ffbb33', border: '1px solid rgba(255,187,51,0.4)',
        background: 'rgba(255,187,51,0.07)', borderRadius: '999px', padding: '1px 6px', fontSize: '0.44rem', fontWeight: 800
    },
    cardMeta: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', color: '#777', fontSize: '0.54rem', marginTop: '3px' },
    typeBadge: {
        display: 'inline-flex', alignItems: 'center', color: '#d4af37', border: '1px solid rgba(212,175,55,0.32)',
        background: 'rgba(212,175,55,0.06)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.44rem', fontWeight: 800
    },
    metaDot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#3a3a3a', flexShrink: 0 },
    progressPill: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid', borderRadius: '999px',
        padding: '2px 7px', fontSize: '0.48rem', fontWeight: 800, flexShrink: 0
    },
    cardDescription: { margin: 0, color: '#8a8a8a', fontSize: '0.62rem', lineHeight: 1.45 },
    lienzo: { position: 'relative', width: '100%', background: '#060606', border: '1px solid #1a1a1a', borderRadius: '9px', overflow: 'hidden' },
    lienzoEmpty: {
        display: 'flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '0.6rem',
        background: '#060606', border: '1px dashed #242424', borderRadius: '9px', padding: '14px'
    },
    cardFooter: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
    cardProgress: { flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' },
    progressTrack: { height: '5px', background: '#161616', borderRadius: '999px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '999px', transition: 'width .25s ease' },
    progressLabel: { color: '#777', fontSize: '0.5rem' },
    cardActions: { display: 'flex', alignItems: 'center', gap: '5px' },
    primaryBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#d4af37',
        color: '#000', border: 'none', borderRadius: '7px', padding: '8px 12px', fontSize: '0.56rem',
        fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    ghostIconBtn: {
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '7px', cursor: 'pointer'
    },

    detail: { display: 'flex', flexDirection: 'column', gap: '12px' },
    detailBack: {
        alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent',
        border: 'none', color: '#d4af37', fontSize: '0.56rem', fontWeight: 800, cursor: 'pointer', padding: '2px 0'
    },
    detailHero: {
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.09), #080808 60%)',
        border: '1px solid rgba(212,175,55,0.28)', borderRadius: '14px', padding: '16px'
    },
    detailIcon: {
        width: '58px', height: '58px', flexShrink: 0, borderRadius: '14px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.35)'
    },
    detailIdentity: { flex: 1, minWidth: '200px' },
    detailName: { margin: 0, color: '#fff', fontSize: 'clamp(1.15rem, 3vw, 1.5rem)', fontWeight: 800, lineHeight: 1.15 },
    detailDescription: { margin: '6px 0 0', color: '#8a8a8a', fontSize: '0.66rem', lineHeight: 1.5, maxWidth: '620px' },
    detailProgress: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', minWidth: '110px' },
    detailLienzo: { background: '#050505', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '6px' },
    mapCourses: { background: '#090909', border: '1px solid #1e1e1e', borderRadius: '11px', padding: '12px' },
    mapCoursesHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' },
    mapCourseChips: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    mapCourseChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(212,175,55,0.06)',
        border: '1px solid rgba(212,175,55,0.24)', color: '#d4af37', borderRadius: '999px', padding: '4px 8px', fontSize: '0.54rem'
    },
    sections: { display: 'flex', flexDirection: 'column', gap: '12px' },
    sectionBlock: { background: '#090909', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '12px' },
    sectionHead: { display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '9px' },
    sectionNumber: {
        width: '32px', height: '32px', flexShrink: 0, borderRadius: '9px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)',
        color: '#d4af37', fontSize: '0.62rem', fontWeight: 800
    },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#e5e5e5', fontSize: '0.78rem', fontWeight: 800 },
    sectionDescription: { margin: '3px 0 0', color: '#777', fontSize: '0.6rem', lineHeight: 1.4 },
    sectionCount: { marginLeft: 'auto', color: '#666', fontSize: '0.52rem', whiteSpace: 'nowrap' },
    lessons: { display: 'flex', flexDirection: 'column', gap: '5px' },
    lesson: {
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: '#0c0c0c',
        border: '1px solid #1d1d1d', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#fff'
    },
    lessonIndex: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '7px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '1px solid', background: '#070707', fontSize: '0.54rem', fontWeight: 800
    },
    lessonBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
    lessonTitle: { color: '#ddd', fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    lessonMeta: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', color: '#666', fontSize: '0.5rem' },
    lessonPlay: {
        width: '28px', height: '28px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#d4af37', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.24)'
    },

    empty: { textAlign: 'center', padding: '40px 18px', background: '#080808', border: '1px dashed #2a2a2a', borderRadius: '14px' },
    emptyIcon: {
        width: '62px', height: '62px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '12px'
    },
    emptyTitle: { margin: '0 0 6px', color: '#d4af37', fontSize: '1rem' },
    emptyText: { margin: '0 auto 14px', maxWidth: '480px', color: '#777', fontSize: '0.68rem', lineHeight: 1.55 },
    footerNote: {
        display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.56rem',
        padding: '14px 4px 0', borderTop: '1px solid #1a1a1a', lineHeight: 1.4, marginTop: '18px'
    }
};

const cssRutas = `
    .rutas-root *, .rutas-root *::before, .rutas-root *::after { box-sizing: border-box; }
    .rutas-root button { transition: transform .12s ease, border-color .18s ease, background .18s ease, color .18s ease; }
    .rutas-root button:active { transform: translateY(1px); }
    .rutas-root button:focus-visible, .rutas-root input:focus-visible { outline: 2px solid rgba(212,175,55,0.7); outline-offset: 2px; }
    .rutas-card { transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
    .rutas-card:hover { border-color: rgba(212,175,55,0.45); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.45); }
    .rutas-lesson:hover { border-color: rgba(212,175,55,0.45) !important; background: rgba(212,175,55,0.045) !important; }
    .rutas-punto { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid; display: flex; align-items: center; justify-content: center; background: #0a0a0a; }
    @media (max-width: 767px) {
        .rutas-root { padding-left: calc(env(safe-area-inset-left, 0px) + 8px) !important; padding-right: calc(env(safe-area-inset-right, 0px) + 8px) !important; }
        .rutas-root h1 { font-size: 0.95rem !important; letter-spacing: 0.4px !important; }
        .rutas-root .rutas-title-icon { display: none !important; }
    }
    @media (prefers-reduced-motion: reduce) {
        .rutas-root *, .rutas-root *::before, .rutas-root *::after {
            animation-duration: 0.001ms !important; transition-duration: 0.001ms !important;
        }
    }
`;

export default RutasAprendizajePage;
