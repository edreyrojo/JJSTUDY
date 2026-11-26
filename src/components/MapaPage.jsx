import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FACETAS,
    ESTADISTICAS,
    buscarTecnicas,
    cursosParaFiltro,
    tecnicasParaFiltro,
    obtenerCurso,
    esVideoGratis,
} from '../data/vaultIndex';
import { DIMENSIONES } from '../data/taxonomia';
import { tieneAccesoVideo, pedirAcceso } from '../utils/accesoVault';
import { mensajeContenidoBloqueado } from '../i18n/translate';
import VaultIcon from './VaultIcon';

const MAX_NODOS_MAPA = 18;
const mapStyles = {
    layout: { display: 'flex', height: 'var(--app-vh)', width: '100%', backgroundColor: '#050505', overflow: 'hidden', boxSizing: 'border-box' },
    sidebar: { borderRight: '1px solid #222', padding: '20px', backgroundColor: '#0a0a0a', boxSizing: 'border-box' },
    sideItem: { padding: '10px 12px', cursor: 'pointer', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #d4af37' },
    mapArea: { position: 'relative', flex: 1, overflow: 'hidden', touchAction: 'none', cursor: 'grab', boxSizing: 'border-box' },
    canvas: { position: 'absolute', top: '50%', left: '50%', width: '800px', height: '800px', marginLeft: '-400px', marginTop: '-400px', userSelect: 'none', boxSizing: 'border-box' },
    svgLayer: { position: 'absolute', width: '800px', height: '800px', pointerEvents: 'none', overflow: 'visible', left: 0, top: 0 },
    mainNode: { position: 'absolute', left: '330px', top: '330px', width: '140px', height: '140px', borderRadius: '50%', border: '4px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 5, fontSize: '0.82rem', textAlign: 'center', fontWeight: 'bold', boxShadow: '0 0 20px rgba(212,175,55,0.3)', boxSizing: 'border-box', padding: '10px' },
    subNodeFloating: { position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', textAlign: 'center', backgroundColor: '#111', cursor: 'pointer', zIndex: 6, padding: '10px', boxSizing: 'border-box', transition: 'width 0.25s ease, height 0.25s ease, font-size 0.25s ease, background-color 0.25s ease, left 0.25s ease, top 0.25s ease' },
};

const coincideConFiltro = (tecnica, dimension, valor) => {
    if (!valor) return true;
    if (dimension === 'AUTORES') return tecnica.autor === valor;
    if (dimension === 'POSICION') return tecnica.posicion === valor;
    if (dimension === 'TIPO') return tecnica.tipo === valor;
    if (dimension === 'MODALIDAD') return tecnica.modalidad === valor;
    if (dimension === 'ETIQUETAS') return tecnica.etiquetas.includes(valor);
    return true;
};

const progresoVolumen = (volumen, vistos) => {
    const total = volumen?.partes?.length || 0;
    if (!total) return { total: 0, vistos: 0, completo: false, texto: '0 videos' };
    const vistosN = volumen.partes.filter(p => vistos.includes(p.id)).length;
    return {
        total,
        vistos: vistosN,
        completo: vistosN === total,
        texto: vistosN > 0 ? `${vistosN}/${total} vistos` : `${total} videos`,
    };
};

const MapaPage = ({
    onBack, onSelectVideo, onNavigateToNotes, onContinue, hasSession, usuario,
    categoriaSel, setCategoriaSel,
    autorSel, setAutorSel,
    instrSel, setInstrSel,
    volSel, setVolSel,
    vistos = [],
    rutasLiberadas = [],
    accesoRutas,
    onOpenRutas,
    styles = {},
}) => {
    const [terminoBusqueda, setTerminoBusqueda] = useState('');
    const [esMovil, setEsMovil] = useState(window.innerWidth < 900);
    const [nodoExpandidoId, setNodoExpandidoId] = useState(null);
    const [vistaTecnicas, setVistaTecnicas] = useState(false);
    const [limiteLista, setLimiteLista] = useState(60);
    const [arrastrando, setArrastrando] = useState(false);

    // Zoom y pan
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const touchStartDistRef = useRef(null);
    const initialScaleRef = useRef(1);
    const mapAreaRef = useRef(null);

    useEffect(() => {
        if (!categoriaSel || !DIMENSIONES.some(d => d.id === categoriaSel)) {
            setCategoriaSel('AUTORES');
        }
    }, [categoriaSel, setCategoriaSel]);

    useEffect(() => {
        const onResize = () => setEsMovil(window.innerWidth < 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const dimension = DIMENSIONES.find(d => d.id === categoriaSel) || DIMENSIONES[0];
    const valor = autorSel;
    const curso = instrSel ? obtenerCurso(instrSel) : null;
    const tieneAcceso = (tecnica) => tieneAccesoVideo(usuario, tecnica, accesoRutas);

    // ---------------------------------------------------------------------
    // Construcción de nodos (memorizada para que el pan/zoom no recalcule)
    // ---------------------------------------------------------------------
    const nav = useMemo(() => {
        let nodos = [];
        let titulo = dimension.nombre;
        let subtitulo = '';
        let nivel = 'dimension';
        let listaTecnicas = null;

        if (volSel) {
            nivel = 'volumen';
            const partes = volSel.partes.filter(t => coincideConFiltro(t, dimension.id, valor));
            nodos = partes.map(t => ({ type: 'parte', nombre: t.nombre, tecnica: t }));
            titulo = volSel.nombre;
            subtitulo = `${partes.length} video${partes.length === 1 ? '' : 's'}${valor ? ` · filtrado por ${valor}` : ''}`;
        } else if (curso) {
            nivel = 'curso';
            nodos = curso.volumenes
                .map(v => {
                    const coincidencias = v.partes.filter(t => coincideConFiltro(t, dimension.id, valor)).length;
                    const prog = progresoVolumen(v, vistos);
                    return { type: 'volumen', nombre: v.nombre, raw: v, count: coincidencias, total: v.total, progreso: prog };
                })
                .filter(n => !valor || n.count > 0);
            const tecnicasCurso = curso.volumenes.flatMap(v => v.partes);
            const coincidentes = tecnicasCurso.filter(t => coincideConFiltro(t, dimension.id, valor)).length;
            titulo = curso.titulo;
            subtitulo = `${curso.autor} · ${coincidentes} de ${curso.total} videos${valor ? ` · filtro: ${valor}` : ''}`;
        } else if (valor) {
            nivel = 'valor';
            const tecnicas = tecnicasParaFiltro(dimension.id, valor);
            const cursos = cursosParaFiltro(dimension.id, valor);
            listaTecnicas = tecnicas;
            nodos = cursos.map(c => ({
                type: 'curso',
                id: c.id,
                nombre: c.titulo,
                autor: c.autor,
                count: c.coincidencias,
                total: c.total,
            }));
            titulo = valor;
            subtitulo = `${tecnicas.length} videos · ${cursos.length} cursos`;
        } else {
            nivel = 'dimension';
            const valores = FACETAS[dimension.id] || [];
            nodos = valores.map(f => ({
                type: 'valor',
                nombre: f.valor,
                valor: f.valor,
                count: f.videos,
                cursos: f.cursos,
            }));
            titulo = dimension.nombre;
            subtitulo = dimension.ayuda;
        }

        return { nodos, titulo, subtitulo, nivel, listaTecnicas };
    }, [dimension, valor, curso, volSel, vistos]);

    const mostrarTecnicas = nav.nivel === 'valor' && vistaTecnicas;
    const usarMapa = !mostrarTecnicas && nav.nodos.length > 0 && nav.nodos.length <= MAX_NODOS_MAPA;
    const hayFiltro = Boolean(valor);
    const mostrarToggle = nav.nivel === 'valor';

    // Rueda del mouse solo cuando el mapa radial está montado
    useEffect(() => {
        const mapArea = mapAreaRef.current;
        if (!mapArea) return;
        const handleWheel = (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
            setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.4), 3.5));
        };
        mapArea.addEventListener('wheel', handleWheel, { passive: false });
        return () => mapArea.removeEventListener('wheel', handleWheel);
    }, [usarMapa]);

    // ---------------------------------------------------------------------
    // Búsqueda
    // ---------------------------------------------------------------------
    const resultadosBusqueda = useMemo(() => {
        if (!terminoBusqueda.trim()) return [];
        return buscarTecnicas(terminoBusqueda).slice(0, 15);
    }, [terminoBusqueda]);

    // ---------------------------------------------------------------------
    // Acciones
    // ---------------------------------------------------------------------
    const resetNavegacion = () => {
        setPosition({ x: 0, y: 0 });
        setScale(1);
        setNodoExpandidoId(null);
        setVistaTecnicas(false);
        setLimiteLista(60);
        setArrastrando(false);
    };

    const abrirTecnica = (t) => {
        if (!t) return;
        if (tieneAcceso(t)) {
            onSelectVideo({ titulo: t.nombre, id: t.id });
            return;
        }
        if (window.confirm(mensajeContenidoBloqueado(t))) {
            pedirAcceso(usuario, t.cursoTitulo);
        }
    };

    const activarNodo = (nodo) => {
        resetNavegacion();
        if (nodo.type === 'valor') {
            setAutorSel(nodo.valor);
            setInstrSel(null);
            setVolSel(null);
        } else if (nodo.type === 'curso') {
            setInstrSel(nodo.id);
            setVolSel(null);
        } else if (nodo.type === 'volumen') {
            setVolSel(nodo.raw);
        } else if (nodo.type === 'parte') {
            abrirTecnica(nodo.tecnica);
        }
    };

    const irAtras = () => {
        resetNavegacion();
        if (volSel) setVolSel(null);
        else if (instrSel) setInstrSel(null);
        else if (autorSel) setAutorSel(null);
        else if (onBack) onBack();
    };

    const irADimension = (id) => {
        resetNavegacion();
        setCategoriaSel(id);
        setAutorSel(null);
        setInstrSel(null);
        setVolSel(null);
        setTerminoBusqueda('');
    };

    // Gestos del mapa
    const handlePointerDown = (e) => {
        if (e.pointerType === 'touch') return;
        if (e.target.closest('.floating-node') || e.target.closest('button')) return;
        isDraggingRef.current = true;
        setArrastrando(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };
    const handlePointerMove = (e) => {
        if (e.pointerType === 'touch' || !isDraggingRef.current) return;
        setPosition({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
    };
    const handlePointerUp = (e) => {
        if (e.pointerType === 'touch') return;
        isDraggingRef.current = false;
        setArrastrando(false);
    };
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            isDraggingRef.current = false;
            setArrastrando(false);
            touchStartDistRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialScaleRef.current = scale;
        } else if (e.touches.length === 1) {
            if (e.target.closest('.floating-node') || e.target.closest('button')) return;
            isDraggingRef.current = true;
            setArrastrando(true);
            dragStartRef.current = { x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y };
        }
    };
    const handleTouchMove = (e) => {
        if (e.touches.length === 2) {
            isDraggingRef.current = false;
            if (touchStartDistRef.current !== null) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                setScale(Math.min(Math.max(initialScaleRef.current * (dist / touchStartDistRef.current), 0.4), 3.5));
            }
        } else if (e.touches.length === 1 && isDraggingRef.current) {
            setPosition({ x: e.touches[0].clientX - dragStartRef.current.x, y: e.touches[0].clientY - dragStartRef.current.y });
        }
    };
    const handleTouchEnd = (e) => {
        if (e.touches.length < 2) touchStartDistRef.current = null;
        if (e.touches.length === 0) {
            isDraggingRef.current = false;
            setArrastrando(false);
        }
    };

    const handleNodeClick = (nodo, index, e) => {
        e.stopPropagation();
        if (esMovil && nodoExpandidoId !== index) {
            setNodoExpandidoId(index);
            return;
        }
        setNodoExpandidoId(null);
        activarNodo(nodo);
    };

    // ---------------------------------------------------------------------
    // Piezas de UI
    // ---------------------------------------------------------------------
    const subtituloNodo = (n) => {
        if (n.type === 'valor') return `${n.count} videos · ${n.cursos} cursos`;
        if (n.type === 'curso') return `${n.autor} · ${n.total} videos${n.count !== n.total ? ` · ${n.count} coinciden` : ''}`;
        if (n.type === 'volumen') return n.progreso.texto;
        if (n.type === 'parte') return esVideoGratis(n.tecnica) ? 'GRATIS' : n.tecnica.tipo;
        return '';
    };

    const colorNodo = (n) => {
        if (n.type === 'parte') {
            if (vistos.includes(n.tecnica.id)) return '#4CAF50';
            return tieneAcceso(n.tecnica) ? '#d4af37' : '#777';
        }
        if (n.type === 'volumen' && n.progreso?.completo) return '#4CAF50';
        return '#d4af37';
    };

    const NodoRadial = ({ nodo, i, total }) => {
        let radioBase = 260;
        let radio = radioBase;
        if (total > 8) radio = (i % 2 === 0) ? 230 : 340;
        const angle = (i * (360 / Math.max(total, 1))) * (Math.PI / 180);
        const x = Math.cos(angle) * radio;
        const y = Math.sin(angle) * radio;
        const expandido = nodoExpandidoId === i;
        const size = expandido ? 165 : 108;
        const color = colorNodo(nodo);
        const bloqueado = nodo.type === 'parte' && !tieneAcceso(nodo.tecnica);

        return (
            <div
                className="floating-node"
                onClick={(e) => handleNodeClick(nodo, i, e)}
                style={{
                    ...mapStyles.subNodeFloating,
                    left: `${400 + x - size / 2}px`,
                    top: `${400 + y - size / 2}px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    borderColor: color,
                    backgroundColor: expandido ? '#181818' : '#111',
                    color: vistos.includes(nodo.tecnica?.id) ? '#4CAF50' : '#fff',
                    fontSize: expandido ? '0.9rem' : '0.7rem',
                    zIndex: expandido ? 50 : 10,
                    boxShadow: expandido ? '0 0 30px rgba(212,175,55,0.8)' : '0 4px 15px rgba(0,0,0,0.6)',
                }}
                title={nodo.nombre}
            >
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', overflow: 'hidden' }}>
                    {(vistos.includes(nodo.tecnica?.id) || bloqueado) && (
                        <span style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                            {vistos.includes(nodo.tecnica?.id) && <VaultIcon name="check" size={11} color="#4CAF50" />}
                            {bloqueado && <VaultIcon name="lock" size={11} color="#d4af37" />}
                        </span>
                    )}
                    <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: expandido ? 6 : 3,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.25,
                    }}>
                        {nodo.nombre}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: '#8a8a8a', lineHeight: 1.2 }}>{subtituloNodo(nodo)}</span>
                </span>
            </div>
        );
    };

    const TarjetaNodo = ({ nodo }) => {
        const color = colorNodo(nodo);
        const bloqueado = nodo.type === 'parte' && !tieneAcceso(nodo.tecnica);
        const visto = nodo.type === 'parte' && vistos.includes(nodo.tecnica.id);
        return (
            <button
                type="button"
                onClick={() => activarNodo(nodo)}
                style={{
                    textAlign: 'left',
                    background: '#0a0a0a',
                    border: `1px solid ${visto ? '#2e5c2e' : '#232323'}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    minHeight: '74px',
                }}
            >
                <span style={{ color: visto ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: '0.88rem', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {visto && <VaultIcon name="check" size={12} color="#4CAF50" />}
                    {bloqueado && <VaultIcon name="lock" size={12} color="#d4af37" />}
                    <span>{nodo.nombre}</span>
                </span>
                <span style={{ color: '#777', fontSize: '0.7rem', lineHeight: 1.3 }}>{subtituloNodo(nodo)}</span>
                {nodo.type === 'parte' && (
                    <span style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {esVideoGratis(nodo.tecnica) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', color: '#000', backgroundColor: '#d4af37', borderRadius: '3px', padding: '2px 5px', fontWeight: 'bold' }}>
                                <VaultIcon name="gift" size={10} color="#000" /> GRATIS
                            </span>
                        )}
                        {nodo.tecnica.etiquetas.slice(0, 3).map(e => (
                            <span key={e} style={{ fontSize: '0.56rem', color: '#8a8a8a', border: '1px solid #262626', borderRadius: '3px', padding: '1px 5px' }}>{e}</span>
                        ))}
                    </span>
                )}
            </button>
        );
    };

    const listaTecnicasVisibles = mostrarTecnicas ? (nav.listaTecnicas || []).slice(0, limiteLista) : [];

    return (
        <div style={{ ...mapStyles.layout, flexDirection: esMovil ? 'column' : 'row' }}>
            {/* SIDEBAR */}
            <aside style={{
                ...mapStyles.sidebar,
                width: esMovil ? '100%' : '240px',
                height: esMovil ? 'auto' : 'var(--app-vh)',
                position: esMovil ? 'relative' : 'fixed',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 100,
                paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 10px)' : '20px',
                paddingLeft: '14px',
                paddingRight: '14px',
                paddingBottom: '12px',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button onClick={irAtras} title="Regresar" style={{ ...styles.btnOutline, flex: '0 0 42px', height: '42px', padding: 0, fontSize: '1rem', borderRadius: '8px' }}>←</button>
                    {hasSession && (
                        <button onClick={onContinue} title="Continuar Estudio" style={{ ...styles.btnGold, flex: 1, height: '42px', fontSize: '0.7rem', padding: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <VaultIcon name="play" size={12} color="#000" /> CONTINUAR
                        </button>
                    )}
                    <button onClick={onNavigateToNotes} title="Bitácora" style={{ ...styles.btnOutline, flex: '0 0 42px', height: '42px', padding: 0, borderRadius: '8px', borderColor: '#d4af37', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <VaultIcon name="notes" size={16} />
                    </button>
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', display: 'flex', alignItems: 'center' }}>
                        <VaultIcon name="search" size={15} />
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar técnica o autor..."
                        aria-label="Buscar técnica o autor"
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 32px', backgroundColor: '#111', border: '1px solid #d4af37', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ marginTop: esMovil ? 0 : '4px' }}>
                    {!esMovil && <h3 style={{ color: '#d4af37', margin: '0 0 8px', fontSize: '0.72rem', letterSpacing: '1.5px' }}>DIMENSIONES</h3>}
                    <div style={{
                        display: 'flex',
                        flexDirection: esMovil ? 'row' : 'column',
                        gap: '7px',
                        overflowX: esMovil ? 'auto' : 'hidden',
                        overflowY: esMovil ? 'hidden' : 'auto',
                        maxHeight: esMovil ? 'auto' : '52vh',
                        paddingBottom: esMovil ? '4px' : '0',
                        scrollbarWidth: 'none',
                    }}>
                        {DIMENSIONES.map(d => {
                            const activa = dimension.id === d.id;
                            const total = (FACETAS[d.id] || []).length;
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => irADimension(d.id)}
                                    style={{
                                        ...mapStyles.sideItem,
                                        backgroundColor: activa ? '#d4af37' : '#111',
                                        color: activa ? '#000' : '#fff',
                                        whiteSpace: 'nowrap',
                                        padding: esMovil ? '7px 12px' : '9px 11px',
                                        fontSize: esMovil ? '0.68rem' : '0.75rem',
                                        flexShrink: 0,
                                        textAlign: 'left',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <VaultIcon name={d.icono} size={14} />
                                        <span>{d.nombre}</span>
                                    </span>
                                    <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>{total}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {!esMovil && (
                    <div style={{ marginTop: 'auto', borderTop: '1px solid #1e1e1e', paddingTop: '10px', color: '#555', fontSize: '0.65rem', lineHeight: 1.5 }}>
                        <div>{ESTADISTICAS.videos} videos · {ESTADISTICAS.cursos} cursos</div>
                        <div>{ESTADISTICAS.posiciones} posiciones · {ESTADISTICAS.etiquetas} etiquetas</div>
                        <div style={{ color: '#3f3f3f', marginTop: '4px' }}>Rueda: zoom · Arrastra: mover</div>
                    </div>
                )}
            </aside>

            {/* ÁREA PRINCIPAL */}
            <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', marginLeft: esMovil ? 0 : '240px' }}>
                {rutasLiberadas.length > 0 && (
                    <button
                        type="button"
                        onClick={onOpenRutas}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left',
                            background: 'linear-gradient(135deg, rgba(212,175,55,0.12), #070707 70%)',
                            border: 'none', borderBottom: '1px solid rgba(212,175,55,0.3)', padding: esMovil ? '9px 12px' : '10px 16px',
                            cursor: 'pointer', color: '#fff', flexShrink: 0
                        }}
                    >
                        <span style={{
                            width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.12)',
                            border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37'
                        }}>
                            <VaultIcon name="route" size={15} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ color: '#d4af37', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.8px' }}>
                                RUTAS LIBERADAS · {rutasLiberadas.length}
                            </span>
                            <span style={{
                                color: '#8a8a8a', fontSize: '0.56rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {rutasLiberadas.map((r) => r.nombre).filter(Boolean).slice(0, 3).join(' · ')}
                            </span>
                        </span>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d4af37',
                            fontSize: '0.54rem', fontWeight: 800, flexShrink: 0
                        }}>
                            ABRIR <VaultIcon name="chevronRight" size={12} />
                        </span>
                    </button>
                )}

                {/* Toolbar / breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: esMovil ? '8px 10px' : '12px 16px', borderBottom: '1px solid #171717', backgroundColor: '#070707', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, flexWrap: 'wrap', fontSize: '0.72rem' }}>
                        <button onClick={() => irADimension(dimension.id)} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 0, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <VaultIcon name={dimension.icono} size={13} />
                            {dimension.nombre}
                        </button>
                        {valor && (
                            <>
                                <span style={{ color: '#444' }}>›</span>
                                <button onClick={() => { resetNavegacion(); setInstrSel(null); setVolSel(null); }} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 0 }}>
                                    {valor}
                                </button>
                            </>
                        )}
                        {curso && (
                            <>
                                <span style={{ color: '#444' }}>›</span>
                                <button onClick={() => { resetNavegacion(); setVolSel(null); }} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 0, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {curso.titulo}
                                </button>
                            </>
                        )}
                        {volSel && (
                            <>
                                <span style={{ color: '#444' }}>›</span>
                                <span style={{ color: '#aaa' }}>{volSel.nombre}</span>
                            </>
                        )}
                    </div>

                    <span style={{ color: '#666', fontSize: '0.68rem' }}>{nav.subtitulo}</span>

                    {hayFiltro && (instrSel || volSel) && (
                        <button onClick={() => { resetNavegacion(); setAutorSel(null); }} style={{ background: '#1a1508', border: '1px solid #4a3c12', color: '#d4af37', borderRadius: '999px', padding: '4px 9px', fontSize: '0.62rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <VaultIcon name="close" size={10} /> quitar filtro
                        </button>
                    )}

                    {mostrarToggle && (
                        <div style={{ display: 'flex', border: '1px solid #2a2a2a', borderRadius: '7px', overflow: 'hidden' }}>
                            <button onClick={() => setVistaTecnicas(false)} style={{ background: !vistaTecnicas ? '#d4af37' : '#0d0d0d', color: !vistaTecnicas ? '#000' : '#999', border: 'none', padding: '6px 10px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}>
                                CURSOS ({nav.nodos.length})
                            </button>
                            <button onClick={() => setVistaTecnicas(true)} style={{ background: vistaTecnicas ? '#d4af37' : '#0d0d0d', color: vistaTecnicas ? '#000' : '#999', border: 'none', padding: '6px 10px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}>
                                TÉCNICAS ({(nav.listaTecnicas || []).length})
                            </button>
                        </div>
                    )}
                </div>

                {/* CONTENIDO */}
                {terminoBusqueda.trim() ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                        <div style={{ color: '#d4af37', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '10px' }}>
                            RESULTADOS ({resultadosBusqueda.length}{resultadosBusqueda.length === 15 ? '+' : ''})
                        </div>
                        {resultadosBusqueda.length === 0 && (
                            <p style={{ color: '#777', textAlign: 'center', marginTop: '50px' }}>No se encontraron técnicas.</p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '8px' }}>
                            {resultadosBusqueda.map((t, i) => (
                                <button
                                    key={`${t.id}-${i}`}
                                    type="button"
                                    onClick={() => abrirTecnica(t)}
                                    style={{ textAlign: 'left', background: '#0a0a0a', border: `1px solid ${vistos.includes(t.id) ? '#2e5c2e' : '#222'}`, borderRadius: '8px', padding: '11px 13px', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px' }}
                                >
                                    <span style={{ color: vistos.includes(t.id) ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {vistos.includes(t.id) && <VaultIcon name="check" size={12} color="#4CAF50" />}
                                        {!tieneAcceso(t) && <VaultIcon name="lock" size={12} color="#d4af37" />}
                                        <span>{t.nombre}</span>
                                    </span>
                                    <span style={{ color: '#777', fontSize: '0.68rem' }}>{t.cursoTitulo} • {t.volumenNombre}</span>
                                    <span style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {esVideoGratis(t) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', background: '#d4af37', color: '#000', borderRadius: '3px', padding: '1px 5px', fontWeight: 'bold' }}>
                                                <VaultIcon name="gift" size={10} color="#000" /> GRATIS
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.58rem', background: '#d4af37', color: '#000', borderRadius: '3px', padding: '1px 5px', fontWeight: 'bold' }}>{t.posicion}</span>
                                        <span style={{ fontSize: '0.58rem', color: '#d4af37', border: '1px solid #3a3320', borderRadius: '3px', padding: '1px 5px' }}>{t.tipo}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : mostrarTecnicas ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                        <div style={{ color: '#666', fontSize: '0.7rem', marginBottom: '10px' }}>
                            {nav.listaTecnicas.length} técnicas en {valor} · ordenadas por curso y volumen
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '8px' }}>
                            {listaTecnicasVisibles.map((t, i) => (
                                <button
                                    key={`${t.id}-${i}`}
                                    type="button"
                                    onClick={() => abrirTecnica(t)}
                                    style={{ textAlign: 'left', background: '#0a0a0a', border: `1px solid ${vistos.includes(t.id) ? '#2e5c2e' : '#222'}`, borderRadius: '8px', padding: '11px 13px', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px' }}
                                >
                                    <span style={{ color: vistos.includes(t.id) ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: '0.84rem', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {vistos.includes(t.id) && <VaultIcon name="check" size={12} color="#4CAF50" />}
                                        {!tieneAcceso(t) && <VaultIcon name="lock" size={12} color="#d4af37" />}
                                        <span>{t.nombre}</span>
                                    </span>
                                    <span style={{ color: '#777', fontSize: '0.66rem' }}>{t.cursoTitulo} • {t.volumenNombre}</span>
                                    <span style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {esVideoGratis(t) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', background: '#d4af37', color: '#000', borderRadius: '3px', padding: '1px 5px', fontWeight: 'bold' }}>
                                                <VaultIcon name="gift" size={10} color="#000" /> GRATIS
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.58rem', background: '#d4af37', color: '#000', borderRadius: '3px', padding: '1px 5px', fontWeight: 'bold' }}>{t.posicion}</span>
                                        <span style={{ fontSize: '0.58rem', color: '#d4af37', border: '1px solid #3a3320', borderRadius: '3px', padding: '1px 5px' }}>{t.tipo}</span>
                                        {t.etiquetas.slice(0, 3).map(e => (
                                            <span key={e} style={{ fontSize: '0.56rem', color: '#8a8a8a', border: '1px solid #262626', borderRadius: '3px', padding: '1px 5px' }}>{e}</span>
                                        ))}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {nav.listaTecnicas.length > listaTecnicasVisibles.length && (
                            <button onClick={() => setLimiteLista(l => l + 60)} style={{ ...styles.btnOutline, width: '100%', marginTop: '10px', padding: '11px', borderColor: '#d4af37', color: '#d4af37', borderRadius: '8px', cursor: 'pointer' }}>
                                CARGAR 60 MÁS ({nav.listaTecnicas.length - listaTecnicasVisibles.length} restantes)
                            </button>
                        )}
                    </div>
                ) : usarMapa ? (
                    <div
                        ref={mapAreaRef}
                        style={mapStyles.mapArea}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div style={{
                            ...mapStyles.canvas,
                            transform: `translate(${position.x}px, ${position.y}px) scale(${esMovil ? scale * 0.48 : scale})`,
                            transformOrigin: 'center center',
                            transition: arrastrando ? 'none' : 'transform 0.1s ease-out',
                        }}>
                            <svg style={mapStyles.svgLayer}>
                                {nav.nodos.map((n, i) => {
                                    const total = nav.nodos.length;
                                    const radio = total > 8 ? (i % 2 === 0 ? 230 : 340) : 260;
                                    const angle = (i * (360 / total)) * (Math.PI / 180);
                                    return (
                                        <line
                                            key={i}
                                            x1="400" y1="400"
                                            x2={400 + Math.cos(angle) * radio}
                                            y2={400 + Math.sin(angle) * radio}
                                            stroke={colorNodo(n)}
                                            strokeWidth="2"
                                            opacity="0.3"
                                        />
                                    );
                                })}
                            </svg>
                            <div style={mapStyles.mainNode}>
                                <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.2 }}>{nav.titulo}</span>
                            </div>
                            {nav.nodos.map((n, i) => <NodoRadial key={i} nodo={n} i={i} total={nav.nodos.length} />)}
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                        {nav.nodos.length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '50px', color: '#777' }}>
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><VaultIcon name="bookOpen" size={40} color="#d4af37" /></div>
                                <p>No hay videos con este filtro.</p>
                                {hayFiltro && <button onClick={() => { resetNavegacion(); setAutorSel(null); }} style={{ ...styles.btnOutline, width: 'auto', padding: '8px 14px', borderColor: '#d4af37', color: '#d4af37', borderRadius: '6px', cursor: 'pointer' }}>Quitar filtro</button>}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '8px' }}>
                                {nav.nodos.map((n, i) => <TarjetaNodo key={i} nodo={n} />)}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MapaPage;
