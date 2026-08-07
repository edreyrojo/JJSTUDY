import React, { useState, useEffect } from 'react';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';
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

const SUB_POSICIONES = [
    'GUARDIA', 'MONTURA', 'TOMA DE ESPALDA', 'CRUZADA',
    '100 KILOS', 'NORTE SUR', 'RODILLA EN EL ESTOMAGO', 'NORTE-SUR'
];

const SUB_DEFENSAS = [
    'ESCAPES MONTADA', 'ESCAPES LATERAL', 'DEFENSA ESPALDA', 'RE-GUARDIA',
    'DEFENSA LEG LOCKS', 'DEFENSA TRIANGULO', 'DEFENSA ARM BAR', 'DEFENSA STRANGLES'
];

const EJES_MAESTROS = ['AUTORES', 'POSICIÓN', 'NO GI', 'GI', 'CLA',
    'SOMETIMIENTOS', 'ESCAPES', 'SWEEPS', 'DERRIBOS',
    'PASES', 'GUARDIAS', 'SISTEMAS', 'FUNDAMENTOS',
    'DEFENSA PERSONAL', 'CINTA', 'ORTODOXO', 'NEW SCHOOL'];

const mapStyles = {
    layout: { display: 'flex', height: '100vh', width: '100%', backgroundColor: '#050505', overflow: 'hidden', boxSizing: 'border-box' },
    sidebar: { width: '250px', borderRight: '1px solid #222', padding: '20px', backgroundColor: '#0a0a0a' },
    sideItem: { padding: '12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px' },
    mapArea: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' },
    canvas: { position: 'relative', width: '800px', height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    svgLayer: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' },
    mainNode: { width: '140px', height: '140px', borderRadius: '50%', border: '4px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 5, fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', boxShadow: '0 0 20px rgba(212,175,55,0.3)' },
    subNodeFloating: { position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', textAlign: 'center', backgroundColor: '#111', cursor: 'pointer', zIndex: 6, padding: '10px', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
};

const MapaPage = ({
    onBack, onSelectVideo, onNavigateToNotes, onContinue, hasSession, usuario,
    categoriaSel, setCategoriaSel,
    autorSel, setAutorSel,
    instrSel, setInstrSel,
    volSel, setVolSel,
    vistos = [],
    styles
}) => {
    // 1. ESTADOS
    const [terminoBusqueda, setTerminoBusqueda] = useState("");
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [nodoExpandidoId, setNodoExpandidoId] = useState(null); // Control de expansión táctil en móvil

    // 2. ASEGURAR ESTADO INICIAL ACTIVO (Evita mapa vacío al entrar)
    useEffect(() => {
        if (!categoriaSel && !autorSel && !instrSel && !volSel) {
            setCategoriaSel('AUTORES');
        }
    }, [categoriaSel, autorSel, instrSel, volSel, setCategoriaSel]);

    // 3. EL CAZADOR DE TÉCNICAS
    const todasLasTecnicas = React.useMemo(() => {
        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey => {
            const curso = DB_INSTRUCCIONALES[cursoKey];
            return curso.volumenes.flatMap(vol =>
                vol.partes.map(parte => {
                    const sub = (parte.subcategoria || "").trim();
                    return {
                        ...parte,
                        subcategoria: sub,
                        curso: cursoKey,
                        tituloCurso: curso.titulo,
                        volNombre: vol.nombre,
                        eje: curso.eje || "OTROS",
                        tags: curso.tags || []
                    };
                })
            );
        });
    }, []);

    // 4. RESULTADOS DE BÚSQUEDA
    const resultadosBusqueda = terminoBusqueda
        ? todasLasTecnicas.filter(t =>
            t.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
            t.tituloCurso.toLowerCase().includes(terminoBusqueda.toLowerCase())
        ).slice(0, 10)
        : [];

    // 5. LÓGICA DE NODOS (El cerebro del Mapa)
    let nodosAMostrar = [];
    let tituloCentral = "";
    const categoriaActiva = categoriaSel || 'AUTORES';

    if (volSel) {
        nodosAMostrar = volSel?.partes?.map((p, index) => ({
            nombre: p.nombre, type: 'parte', id: p.id, cursoId: instrSel,
            indice: index
        })) || [];
        tituloCentral = volSel?.nombre || "";
    } else if (instrSel) {
        const cursoData = DB_INSTRUCCIONALES[instrSel];
        nodosAMostrar = cursoData?.volumenes?.map(v => ({ nombre: v.nombre, type: 'volumen', raw: v })) || [];
        tituloCentral = cursoData?.titulo || instrSel;
    } else if (autorSel) {
        nodosAMostrar = Object.keys(DB_INSTRUCCIONALES)
            .filter(key => DB_INSTRUCCIONALES[key].autor === autorSel)
            .map(key => ({ nombre: DB_INSTRUCCIONALES[key].titulo, id: key, type: 'curso' }));
        tituloCentral = autorSel;
    } else if (categoriaActiva) {
        tituloCentral = categoriaActiva;

        if (EJES_MAESTROS.includes(categoriaActiva)) {
            if (categoriaActiva === 'AUTORES') {
                const autores = [...new Set(Object.values(DB_INSTRUCCIONALES).map(c => c.autor))];
                nodosAMostrar = autores.map(a => ({ nombre: a, type: 'autor' }));
            }
            else if (categoriaActiva === 'POSICIÓN') {
                nodosAMostrar = SUB_POSICIONES.map(p => ({ nombre: p, type: 'sub_posicion' }));
            }
            else {
                const tagsDelEje = [...new Set(todasLasTecnicas
                    .filter(t => Array.isArray(t.eje) ? t.eje.includes(categoriaActiva) : t.eje === categoriaActiva)
                    .flatMap(t => t.tags))];

                nodosAMostrar = tagsDelEje.map(tag => ({ nombre: tag, type: 'tag' }));
            }
        }
        else {
            const cursosFiltrados = Object.keys(DB_INSTRUCCIONALES).filter(key => {
                const curso = DB_INSTRUCCIONALES[key];
                return (
                    curso.autor === categoriaActiva ||
                    curso.tags?.includes(categoriaActiva) ||
                    curso.categorias?.includes(categoriaActiva)
                );
            });

            nodosAMostrar = cursosFiltrados.map(key => ({
                id: key,
                nombre: DB_INSTRUCCIONALES[key].titulo,
                type: 'curso'
            }));
        }
    }

    // 6. FUNCIONES DE INTERACCIÓN Y EXPANSIÓN MÓVIL
    const handleNodeClick = (nodo, index) => {
        // En móvil, si el nodo es largo, permitimos un primer toque para expandir y leer claramente
        if (esMovil && nodoExpandidoId !== index) {
            setNodoExpandidoId(index);
            return;
        }

        setNodoExpandidoId(null);

        if (nodo.type === 'sub_posicion' || nodo.type === 'tag' || nodo.type === 'autor') {
            if (nodo.type === 'autor') {
                setAutorSel(nodo.nombre);
            } else {
                setCategoriaSel(nodo.nombre);
            }
        }
        else if (nodo.type === 'curso') {
            setInstrSel(nodo.id || nodo.nombre);
        }
        else if (nodo.type === 'volumen') {
            setVolSel(nodo.raw);
        }
        else if (nodo.type === 'parte') {
            const cursoId = nodo.cursoId;
            const esPrimerVideo = nodo.indice === 0;
            
            const tieneAcceso = usuario?.rol === 'admin' ||
                esPrimerVideo ||
                usuario?.cursos_liberados?.includes(cursoId);

            if (tieneAcceso) {
                onSelectVideo({ titulo: nodo.nombre, id: nodo.id });
            } else {
                if (window.confirm(
                    `CONTENIDO BLOQUEADO 🔒\n\nEste video requiere autorización. Solo el primer video de cada volumen es gratuito.\n\n¿Deseas enviar un WhatsApp al administrador para solicitar acceso a "${cursoId}"?`
                )) {
                    const mensaje = `Hola! Me gustaría solicitar acceso al instruccional: ${cursoId}. Mi correo es: ${usuario?.email || 'Sin correo'}`;
                    window.open(`https://wa.me/524731632614?text=${encodeURIComponent(mensaje)}`);
                }
            }
        }
    };

    const irAtras = () => {
        setNodoExpandidoId(null);
        if (volSel) {
            setVolSel(null);
        }
        else if (instrSel) {
            setInstrSel(null);
        }
        else if (autorSel) {
            setAutorSel(null);
        }
        else if (categoriaSel) {
            if (SUB_POSICIONES.includes(categoriaSel)) {
                setCategoriaSel('POSICIÓN');
            }
            else if (EJES_MAESTROS.includes(categoriaSel)) {
                setCategoriaSel('AUTORES');
            }
            else {
                const tecnica = todasLasTecnicas.find(t => t.tags.includes(categoriaSel));
                if (tecnica) {
                    const posibleSub = SUB_POSICIONES.find(p => tecnica.tags.includes(p));
                    setCategoriaSel(posibleSub || (Array.isArray(tecnica.eje) ? tecnica.eje[0] : tecnica.eje));
                } else {
                    setCategoriaSel('AUTORES');
                }
            }
        }
        else {
            onBack();
        }
    };

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const totalNodos = nodosAMostrar.length;

    // 7. RENDERIZADO
    return (
        <div style={{ ...mapStyles.layout, flexDirection: esMovil ? 'column' : 'row' }}>
            <aside style={{
                ...mapStyles.sidebar,
                width: esMovil ? '100%' : '250px',
                height: esMovil ? 'auto' : '100vh',
                position: esMovil ? 'relative' : 'fixed',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 100,
                paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 24px) + 12px)' : '20px',
                paddingLeft: '15px',
                paddingRight: '15px',
                paddingBottom: '15px',
                boxSizing: 'border-box',
                borderBottom: esMovil ? '1px solid #222' : 'none',
                borderRight: esMovil ? 'none' : '1px solid #222'
            }}>
                {/* FILA 1: NAVEGACIÓN CON ICONOS DORADOS MONOCROMÁTICOS */}
                <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={irAtras}
                        title="Regresar"
                        style={{ 
                            ...styles.btnOutline, 
                            flex: '0 0 45px', 
                            height: '45px',
                            padding: 0,
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px'
                        }}
                    >
                        ←
                    </button>

                    {hasSession && (
                        <button
                            onClick={onContinue}
                            title="Continuar Estudio"
                            style={{
                                ...styles.btnGold,
                                flex: 1,
                                height: '45px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                padding: 0,
                                borderRadius: '8px',
                                backgroundColor: '#d4af37',
                                color: '#000'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>CONTINUAR</span>
                        </button>
                    )}

                    <button
                        onClick={onNavigateToNotes}
                        title="Bitácora"
                        style={{
                            ...styles.btnOutline,
                            flex: '0 0 45px',
                            height: '45px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderColor: '#d4af37',
                            color: '#d4af37',
                            padding: 0,
                            borderRadius: '8px'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </button>
                </div>

                {/* FILA 2: BÚSQUEDA MEJORADA CON ICONO */}
                <div style={{ width: '100%', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar técnica o autor..."
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 38px',
                            backgroundColor: '#111',
                            border: '1px solid #d4af37',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* FILA 3: CATEGORÍAS */}
                <div style={{ marginTop: esMovil ? '2px' : '15px' }}>
                    {!esMovil && <h3 style={{ color: '#d4af37', marginBottom: '12px', fontSize: '0.85rem', letterSpacing: '1px' }}>EJES MAESTROS</h3>}

                    <div style={{
                        display: 'flex',
                        flexDirection: esMovil ? 'row' : 'column',
                        gap: '8px',
                        maxHeight: esMovil ? 'auto' : '65vh',
                        overflowX: esMovil ? 'auto' : 'hidden',
                        overflowY: esMovil ? 'hidden' : 'auto',
                        paddingBottom: esMovil ? '8px' : '0',
                        paddingRight: '5px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {EJES_MAESTROS.map(cat => {
                            const estaActivo = categoriaSel === cat ||
                                (cat === 'POSICIÓN' && SUB_POSICIONES.includes(categoriaSel)) ||
                                (cat === 'ESCAPES' && SUB_DEFENSAS.includes(categoriaSel));

                            return (
                                <div
                                    key={cat}
                                    onClick={() => {
                                        setCategoriaSel(cat);
                                        setAutorSel(null);
                                        setInstrSel(null);
                                        setVolSel(null);
                                        setTerminoBusqueda("");
                                        setNodoExpandidoId(null);
                                    }}
                                    style={{
                                        ...mapStyles.sideItem,
                                        backgroundColor: estaActivo ? '#d4af37' : '#111',
                                        color: estaActivo ? '#000' : '#fff',
                                        border: '1px solid #d4af37',
                                        whiteSpace: 'nowrap',
                                        padding: esMovil ? '8px 14px' : '10px 12px',
                                        borderRadius: esMovil ? '20px' : '5px',
                                        fontSize: esMovil ? '0.7rem' : '0.8rem',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    {cat}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL DEL MAPA RADIAL */}
            <main style={{
                ...mapStyles.mapArea,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center',
                overflow: 'hidden',
                marginLeft: esMovil ? '0px' : '250px',
                width: '100%'
            }}>
                <div style={{
                    ...mapStyles.canvas,
                    transform: esMovil ? (totalNodos > 12 ? 'scale(0.50)' : 'scale(0.62)') : 'scale(1)',
                    transformOrigin: 'center center',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
                }}>
                    {terminoBusqueda ? (
                        <div style={{ zIndex: 10, width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '20px', backgroundColor: 'rgba(10,10,10,0.95)', border: '1px solid #d4af37', borderRadius: '12px' }}>
                            <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem' }}>RESULTADOS DE BÚSQUEDA</h2>
                            {resultadosBusqueda.length === 0 ? (
                                <p style={{ color: '#aaa', textAlign: 'center' }}>No se encontraron técnicas.</p>
                            ) : (
                                resultadosBusqueda.map((t, i) => (
                                    <div key={i} onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })} style={{ padding: '12px', backgroundColor: '#0a0a0a', border: `1px solid ${vistos?.includes(t.id) ? '#4CAF50' : '#333'}`, margin: '8px 0', borderRadius: '8px', cursor: 'pointer' }}>
                                        <div style={{ color: vistos?.includes(t.id) ? '#4CAF50' : '#d4af37', fontWeight: 'bold', fontSize: '0.85rem' }}>{vistos?.includes(t.id) ? '✅ ' : ''}{t.nombre}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#886' }}>{t.curso} • {t.volNombre}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            <svg style={mapStyles.svgLayer}>
                                {nodosAMostrar.map((n, i) => {
                                    const total = totalNodos;
                                    const angle = (i * (360 / total)) * (Math.PI / 180);
                                    return (
                                        <line key={i} x1="50%" y1="50%" x2={`${50 + (Math.cos(angle) * 35)}%`} y2={`${50 + (Math.sin(angle) * 35)}%`} stroke={vistos?.includes(n.id) ? '#4CAF50' : '#d4af37'} strokeWidth="1.5" opacity="0.3" />
                                    );
                                })}
                            </svg>

                            <div style={mapStyles.mainNode}>{tituloCentral}</div>

                            {nodosAMostrar.map((n, i) => {
                                const total = totalNodos;
                                let radioBase = esMovil ? 210 : 260;
                                let radio = radioBase;

                                if (total > 12) {
                                    radio = (i % 2 === 0) ? radioBase : radioBase + (esMovil ? 75 : 110);
                                }

                                const angle = (i * (360 / total)) * (Math.PI / 180);
                                const x = Math.cos(angle) * radio;
                                const y = Math.sin(angle) * radio;

                                const visto = n.type === 'parte' ? vistos?.includes(n.id) : n.raw?.partes?.every(p => vistos?.includes(p.id));
                                const estaExpandido = nodoExpandidoId === i;

                                return (
                                    <div key={i}
                                        onClick={() => handleNodeClick(n, i)}
                                        className="floating-node"
                                        style={{
                                            ...mapStyles.subNodeFloating,
                                            left: `calc(50% + ${x}px - ${esMovil ? (estaExpandido ? '65px' : '40px') : '50px'})`,
                                            top: `calc(50% + ${y}px - ${esMovil ? (estaExpandido ? '65px' : '40px') : '50px'})`,
                                            borderColor: visto ? '#4CAF50' : '#d4af37',
                                            backgroundColor: estaExpandido ? '#222' : '#111',
                                            color: visto ? '#4CAF50' : '#fff',
                                            fontSize: esMovil ? (estaExpandido ? '0.85rem' : '0.75rem') : '0.80rem',
                                            width: esMovil ? (estaExpandido ? '130px' : (total > 20 ? '70px' : '80px')) : '100px',
                                            height: esMovil ? (estaExpandido ? '130px' : (total > 20 ? '70px' : '80px')) : '100px',
                                            zIndex: estaExpandido ? 30 : 10,
                                            boxShadow: estaExpandido ? '0 0 25px rgba(212,175,55,0.6)' : '0 4px 10px rgba(0,0,0,0.5)'
                                        }}
                                        title={n.nombre}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: estaExpandido ? 5 : 3, WebkitBoxOrient: 'vertical' }}>
                                            {visto ? '✅ ' : ''}{n.nombre}
                                        </span>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MapaPage;