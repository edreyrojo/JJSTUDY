import React from 'react';
import { DB_INSTRUCCIONALES } from '../data/instruccionales'; // Asegúrate de que la ruta sea correcta
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
    layout: { display: 'flex', height: '100vh', backgroundColor: '#050505', overflow: 'hidden' },
    sidebar: { width: '250px', borderRight: '1px solid #222', padding: '20px', backgroundColor: '#0a0a0a' },
    sideItem: { padding: '12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px' },
    mapArea: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    canvas: { position: 'relative', width: '800px', height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    svgLayer: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' },
    mainNode: { width: '140px', height: '140px', borderRadius: '50%', border: '4px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 5, fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' },
    subNodeFloating: { position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', textAlign: 'center', backgroundColor: '#111', cursor: 'pointer', zIndex: 6, padding: '10px', transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
};
const MapaPage = ({
    onBack, onSelectVideo, onNavigateToNotes, onContinue, hasSession,
    categoriaSel, setCategoriaSel,
    autorSel, setAutorSel,
    instrSel, setInstrSel,
    volSel, setVolSel,
    vistos = [],
    styles
}) => {
    // 1. ESTADOS
    const [terminoBusqueda, setTerminoBusqueda] = React.useState("");
    const [esMovil, setEsMovil] = React.useState(window.innerWidth < 768);
    // 3. EL CAZADOR DE TÉCNICAS (Optimizado para Ejes y Tags)
    const todasLasTecnicas = React.useMemo(() => {
        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey => {
            const curso = DB_INSTRUCCIONALES[cursoKey];
            return curso.volumenes.flatMap(vol =>
                vol.partes.map(parte => {
                    // Mantenemos soporte para subcategoría manual si existe
                    const sub = (parte.subcategoria || "").trim();

                    return {
                        ...parte,
                        subcategoria: sub,
                        curso: cursoKey,
                        tituloCurso: curso.titulo,
                        volNombre: vol.nombre,
                        // --- LOS NUEVOS PILARES ---
                        eje: curso.eje || "OTROS",
                        tags: curso.tags || []
                    };
                })
            );
        });
    }, []);

    // 4. CHEQUEO DE DEPURACIÓN
    React.useEffect(() => {
        console.log("Total Técnicas Indexadas:", todasLasTecnicas.length);
        // Ejemplo: ver cuántos videos hay de un Eje específico
        const checkGuards = todasLasTecnicas.filter(t => t.eje === "GUARDS");
        console.log("Videos en Eje GUARDS:", checkGuards.length);
    }, [todasLasTecnicas]);

    // 5. RESULTADOS DE BÚSQUEDA (Mejorado para buscar en Curso también)
    const resultadosBusqueda = terminoBusqueda
        ? todasLasTecnicas.filter(t =>
            t.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
            t.tituloCurso.toLowerCase().includes(terminoBusqueda.toLowerCase())
        ).slice(0, 10)
        : [];

    // 6. LÓGICA DE NODOS (El cerebro del Mapa)
    let nodosAMostrar = [];
    let tituloCentral = "";

    if (volSel) {
        nodosAMostrar = volSel?.partes?.map(p => ({ nombre: p.nombre, type: 'parte', id: p.id })) || [];
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
    } else if (categoriaSel) {
        tituloCentral = categoriaSel;

        // NIVEL A: EJE (ej. GUARDS)
        if (EJES_MAESTROS.includes(categoriaSel)) {

            if (categoriaSel === 'AUTORES') {
                // Obtenemos autores únicos de la BD
                const autores = [...new Set(Object.values(DB_INSTRUCCIONALES).map(c => c.autor))];
                nodosAMostrar = autores.map(a => ({ nombre: a, type: 'autor' }));
            }
            else if (categoriaSel === 'POSICIÓN') {
                // En lugar de ir a los tags, mostramos las 8 subcategorías fijas
                nodosAMostrar = SUB_POSICIONES.map(p => ({ nombre: p, type: 'sub_posicion' }));
            }
            else {
                // Obtenemos los Tags específicos de este eje (PASES, SWEEPS, etc.)
                // Soporta que t.eje sea un String o un Array
                const tagsDelEje = [...new Set(todasLasTecnicas
                    .filter(t => Array.isArray(t.eje) ? t.eje.includes(categoriaSel) : t.eje === categoriaSel)
                    .flatMap(t => t.tags))];

                nodosAMostrar = tagsDelEje.map(tag => ({ nombre: tag, type: 'tag' }));
            }
        }
        // 2. CASO: NO ES UN EJE (Es un autor específico o un tag específico)
        else {
            // Filtramos la BD una sola vez buscando coincidencia en autor o en tags
            const cursosFiltrados = Object.keys(DB_INSTRUCCIONALES).filter(key => {
                const curso = DB_INSTRUCCIONALES[key];
                return (
                    curso.autor === categoriaSel ||
                    curso.tags?.includes(categoriaSel) ||
                    curso.categorias?.includes(categoriaSel)
                );
            });

            nodosAMostrar = cursosFiltrados.map(key => ({
                id: key,
                nombre: DB_INSTRUCCIONALES[key].titulo,
                type: 'curso'
            }));
        }
    }

    // 7. FUNCIONES DE INTERACCIÓN
    const handleNodeClick = (nodo) => {
    // 1. Nodos que profundizan en el Mapa (Cambian la categoría central)
    if (nodo.type === 'sub_posicion' || nodo.type === 'tag' || nodo.type === 'autor') {
        setCategoriaSel(nodo.nombre);
    }
    
    // 2. Nodos que entran al contenido del Instruccional
    else if (nodo.type === 'curso') {
        setInstrSel(nodo.id || nodo.nombre);
    }
    else if (nodo.type === 'volumen') {
        setVolSel(nodo.raw);
    }
    else if (nodo.type === 'parte') {
        onSelectVideo({ titulo: nodo.nombre, id: nodo.id });
    }
};

    const irAtras = () => {
    // 1. Si estamos viendo un Volumen, regresamos al Curso
    if (volSel) {
        setVolSel(null);
    } 
    // 2. Si estamos viendo un Curso, regresamos al nivel anterior (Autor, Sub-posición o Tag)
    else if (instrSel) {
        setInstrSel(null);
    } 
    // 3. Si estamos viendo un Autor, regresamos a la lista de Autores
    else if (autorSel) {
        setAutorSel(null);
    } 
    // 4. Lógica de Navegación Profunda (Tags y Sub-posiciones)
    else if (categoriaSel) {
        
        // A. Si es una Sub-posición (ej: Guardia), regresamos al eje maestro 'POSICIÓN'
        if (SUB_POSICIONES.includes(categoriaSel)) {
            setCategoriaSel('POSICIÓN');
        } 
        
        // B. Si es un Eje Maestro (ej: POSICIÓN, PASES, AUTORES), volvemos al Home
        else if (EJES_MAESTROS.includes(categoriaSel)) {
            onBack();
        } 
        
        // C. Si es un Tag o un Autor (ej: "Half Guard" o "Craig Jones")
        else {
            // Buscamos a qué eje o sub-posición pertenece para saber a dónde volver
            const tecnica = todasLasTecnicas.find(t => t.tags.includes(categoriaSel));
            
            if (tecnica) {
                // Si el tag es de una sub-posición, volvemos a esa sub-posición
                // Si no, volvemos al eje principal
                const posibleSub = SUB_POSICIONES.find(p => tecnica.tags.includes(p));
                setCategoriaSel(posibleSub || (Array.isArray(tecnica.eje) ? tecnica.eje[0] : tecnica.eje));
            } else {
                setCategoriaSel(null);
                onBack();
            }
        }
    } 
    // 5. Seguridad: Si no hay nada seleccionado, al Home
    else {
        onBack();
    }
};

    // 8. RENDERIZADO
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
                padding: '15px',
                boxSizing: 'border-box'
            }}>
                {/* FILA 1: NAVEGACIÓN */}
                <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                    <button
                        onClick={irAtras}
                        style={{ ...styles.btnOutline, flex: '0 0 40px', padding: '10px 0' }}
                    >
                        ←
                    </button>
                    {/* LÓGICA CONDICIONAL: Solo si hay sesión activa */}
                    {hasSession && (
                        <button
                            onClick={onContinue}
                            style={{
                                ...styles.btnGold,
                                flex: 2, // Toma más espacio si aparece
                                fontSize: '0.65rem'
                            }}
                        >
                            {esMovil ? 'CONTINUAR' : '▶ CONTINUAR'}
                        </button>
                    )}
                    <button
                        onClick={onNavigateToNotes}
                        style={{
                            ...styles.btnOutline,
                            flex: 1, // Se expande automáticamente si 'Continuar' no está
                            fontSize: '0.65rem',
                            borderColor: '#d4af37'
                        }}
                    >
                        BITÁCORA
                    </button>
                </div>

                {/* FILA 2: BÚSQUEDA */}
                <div style={{ width: '100%' }}>
                    <input
                        type="text"
                        placeholder="Buscar técnica..."
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: '#111',
                            border: '1px solid #d4af37',
                            color: '#fff',
                            borderRadius: '5px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* FILA 3: CATEGORÍAS (Híbrido PC/Móvil) */}
                <div style={{ marginTop: esMovil ? '0' : '20px' }}>
                    {!esMovil && <h3 style={{ color: '#d4af37', marginBottom: '15px', fontSize: '0.9rem' }}>FILTRAR POR</h3>}

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: esMovil ? 'auto' : '70vh', // Para que no se desborde el menú
                        overflowY: 'auto', // Permite scroll si hay muchos ejes
                        paddingRight: '5px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d4af37 #000'
                    }}>
                        {['AUTORES', 'POSICIÓN', 'NO GI', 'GI', 'CLA',
                            'SOMETIMIENTOS', 'ESCAPES', 'SWEEPS', 'DERRIBOS',
                            'PASES', 'GUARDIAS', 'SISTEMAS', 'FUNDAMENTOS',
                            'DEFENSA PERSONAL', 'CINTA', 'ORTODOXO', 'NEW SCHOOL'].map(cat => {
                                // Lógica para mantener encendido el botón si estamos en una subcategoría
                                const estaActivo = categoriaSel === cat ||
                                    (cat === 'POSICIÓN' && SUB_POSICIONES.includes(categoriaSel)) ||
                                    (cat === 'D EFENSAS' && SUB_DEFENSAS.includes(categoriaSel));

                                return (
                                    <div
                                        key={cat}
                                        onClick={() => {
                                            setCategoriaSel(cat);
                                            setAutorSel(null);
                                            setInstrSel(null);
                                            setVolSel(null);
                                            setTerminoBusqueda("");
                                        }}
                                        style={{
                                            ...mapStyles.sideItem,
                                            backgroundColor: estaActivo ? '#d4af37' : '#111',
                                            color: estaActivo ? '#000' : '#fff',
                                            border: '1px solid #d4af37',
                                            whiteSpace: 'nowrap',
                                            padding: esMovil ? '8px 15px' : '12px',
                                            borderRadius: esMovil ? '20px' : '5px',
                                            fontSize: esMovil ? '0.65rem' : '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {cat}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </aside>

            <main style={{
                ...mapStyles.mapArea,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: esMovil ? 'flex-start' : 'center', // Alinea arriba en móvil
                alignItems: 'center',
                paddingTop: esMovil ? '0px' : '20px',
                overflow: 'hidden'
            }}>
                <div style={{
                    ...mapStyles.canvas,
                    // Ajustamos el scale y añadimos marginTop negativo para subirlo
                    transform: esMovil ? 'scale(0.7)' : 'scale(1)',
                    marginTop: esMovil ? '0px' : '0px',
                    transformOrigin: 'top center', // Cambiamos el origen para que escale hacia arriba
                    transition: 'all 0.3s ease'
                }}>
                    {terminoBusqueda ? (
                        <div style={{ zIndex: 10, width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '20px' }}>
                            <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '20px' }}>RESULTADOS</h2>
                            {resultadosBusqueda.map((t, i) => (
                                <div key={i} onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })} style={{ padding: '15px', backgroundColor: '#0a0a0a', border: `1px solid ${vistos?.includes(t.id) ? '#4CAF50' : '#222'}`, margin: '8px 0', borderRadius: '8px', cursor: 'pointer' }}>
                                    <div style={{ color: vistos?.includes(t.id) ? '#4CAF50' : '#d4af37', fontWeight: 'bold' }}>{vistos?.includes(t.id) ? '✅ ' : ''}{t.nombre}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#666' }}>{t.curso} • {t.volNombre}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <svg style={mapStyles.svgLayer}>
                                {nodosAMostrar.map((n, i) => {
                                    const total = nodosAMostrar.length;
                                    const angle = (i * (360 / total)) * (Math.PI / 180);
                                    return (
                                        <line key={i} x1="50%" y1="50%" x2={`${50 + (Math.cos(angle) * 35)}%`} y2={`${50 + (Math.sin(angle) * 35)}%`} stroke={vistos?.includes(n.id) ? '#4CAF50' : '#d4af37'} strokeWidth="1" opacity="0.2" className="floating-node" style={{ animationDelay: `${i * -0.8}s`, animationDuration: `${5 + (i % 3)}s` }} />
                                    );
                                })}
                            </svg>

                            <div style={mapStyles.mainNode}>{tituloCentral}</div>

                            {nodosAMostrar.map((n, i) => {
                                const total = nodosAMostrar.length;

                                // --- MEJORA: RADIO DINÁMICO ---
                                // Si hay más de 12 nodos, escalonamos el radio para crear dos "órbitas"
                                // Los nodos pares se quedan en el radio base, los impares se alejan.
                                let radioBase = esMovil ? 210 : 260;
                                let radio = radioBase;

                                if (total > 12) {
                                    // Si es impar, sumamos distancia para crear la segunda órbita
                                    radio = (i % 2 === 0) ? radioBase : radioBase + (esMovil ? 75 : 110);
                                }
                                // ------------------------------

                                const angle = (i * (360 / total)) * (Math.PI / 180);
                                const x = Math.cos(angle) * radio;
                                const y = Math.sin(angle) * radio;

                                const visto = n.type === 'parte' ? vistos?.includes(n.id) : n.raw?.partes?.every(p => vistos?.includes(p.id));

                                return (
                                    <div key={i}
                                        onClick={() => handleNodeClick(n)}
                                        className="floating-node"
                                        style={{
                                            ...mapStyles.subNodeFloating,
                                            // Usamos x e y calculados con el radio dinámico
                                            left: `calc(50% + ${x}px - ${esMovil ? '40px' : '50px'})`,
                                            top: `calc(50% + ${y}px - ${esMovil ? '40px' : '50px'})`,
                                            animationDelay: `${i * -0.8}s`,
                                            animationDuration: `${5 + (i % 3)}s`,
                                            borderColor: visto ? '#4CAF50' : '#d4af37',
                                            color: visto ? '#4CAF50' : '#fff',
                                            cursor: 'pointer',
                                            fontSize: esMovil ? '0.55rem' : '0.75rem',
                                            // Reducimos un poco más el tamaño en móvil si hay saturación
                                            width: esMovil ? (total > 20 ? '70px' : '80px') : '100px',
                                            height: esMovil ? (total > 20 ? '70px' : '80px') : '100px',
                                            zIndex: 10
                                        }}>
                                        {visto ? '✅ ' : ''}{n.nombre}
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