import React from 'react';
import { DB_INSTRUCCIONALES } from '../data/instruccionales'; // Asegúrate de que la ruta sea correcta
const SUB_POSICIONES = [
    'GUARDIA CERRADA', 'MEDIA GUARDIA', 'GUARDIA ABIERTA', 'PASES',
    'CONTROL LATERAL', 'MONTADA', 'ESPALDA', 'NORTE-SUR'
];

const SUB_DEFENSAS = [
    'ESCAPES MONTADA', 'ESCAPES LATERAL', 'DEFENSA ESPALDA', 'RE-GUARDIA',
    'DEFENSA LEG LOCKS', 'DEFENSA TRIANGULO', 'DEFENSA ARM BAR', 'DEFENSA STRANGLES'
];
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
    // 3. EL CAZADOR DE TÉCNICAS (Primero declaramos la variable)
    const todasLasTecnicas = React.useMemo(() => {
        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
            DB_INSTRUCCIONALES[cursoKey].volumenes.flatMap(vol =>
                vol.partes.map(parte => {
                    let sub = parte.subcategoria || "";
                    const n = parte.nombre.toLowerCase();
                    const cursoNom = cursoKey.toLowerCase();

                    if (!sub) {
                        const esCursoDefensa = cursoNom.includes('pillars') || cursoNom.includes('escapes') || cursoNom.includes('retention');

                        // --- FILTRO DE DEFENSAS ---
                        if (n.includes('escape') || n.includes('defensa') || n.includes('defense') || n.includes('counter') || esCursoDefensa) {
                            if (n.includes('mount') || n.includes('montada')) sub = "ESCAPES MONTADA";
                            else if (n.includes('side') || n.includes('lateral')) sub = "ESCAPES LATERAL";
                            else if (n.includes('back') || n.includes('espalda')) sub = "DEFENSA ESPALDA";
                            else if (n.includes('leg lock') || n.includes('heel hook')) sub = "DEFENSA LEG LOCKS";
                            else if (n.includes('triang')) sub = "DEFENSA TRIANGULO";
                            else if (n.includes('arm bar') || n.includes('armbar') || n.includes('joint lock') || n.includes('armlock')) sub = "DEFENSA ARM BAR";
                            else if (n.includes('darce') || n.includes('guillotine') || n.includes('choke')) sub = "DEFENSA STRANGLES";
                            else sub = "RE-GUARDIA";
                        }
                        // --- FILTRO DE DERRIBOS ---
                        else if (n.includes('takedown') || n.includes('take down') || n.includes('standing') || n.includes('derribo') || cursoNom.includes('feet to floor')) {
                            sub = "DERRIBOS";
                        }
                        // --- POSICIONES ---
                        else if (n.includes('side control') || n.includes('lateral') || n.includes('100 kilos')) sub = "CONTROL LATERAL";
                        else if (n.includes('half guard') || n.includes('media guardia')) sub = "MEDIA GUARDIA";
                        else if (n.includes('closed guard') || n.includes('guardia cerrada')) sub = "GUARDIA CERRADA";
                        else if (n.includes('mount') || n.includes('montada')) sub = "MONTADA";
                        else if (n.includes('back') || n.includes('espalda')) sub = "ESPALDA";
                        else if (n.includes('north south') || n.includes('norte sur')) sub = "NORTE-SUR";
                    }

                    return { ...parte, subcategoria: sub, curso: cursoKey, volNombre: vol.nombre };
                })
            )
        );
    }, []);

    // 4. CHEQUEO DE CONSOLA (Ahora sí, después de definir la variable)
    const chequeoArmBar = todasLasTecnicas.filter(t => t.subcategoria === "DEFENSA ARM BAR");
    console.log("Videos en DEFENSA ARM BAR encontrados:", chequeoArmBar.length);

    // 5. RESULTADOS DE BÚSQUEDA
    const resultadosBusqueda = terminoBusqueda
        ? todasLasTecnicas.filter(t => t.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase())).slice(0, 10)
        : [];

    // 6. LÓGICA DE NODOS
    let nodosAMostrar = [];
    let tituloCentral = "";

    if (volSel) {
        nodosAMostrar = volSel?.partes?.map(p => ({ nombre: p.nombre, type: 'parte', id: p.id })) || [];
        tituloCentral = volSel?.nombre || "";
    } else if (instrSel) {
        const cursoData = DB_INSTRUCCIONALES[instrSel];
        nodosAMostrar = cursoData?.volumenes?.map(v => ({ nombre: v.nombre, type: 'volumen', raw: v })) || [];
        tituloCentral = instrSel;
    } else if (autorSel) {
        nodosAMostrar = Object.keys(DB_INSTRUCCIONALES).filter(key => DB_INSTRUCCIONALES[key].autor === autorSel).map(key => ({ nombre: key, id: key, type: 'curso' }));
        tituloCentral = autorSel;
    } else if (categoriaSel) {
        tituloCentral = categoriaSel;

        if (categoriaSel === 'POSICIÓN' || categoriaSel === 'DEFENSAS') {
            const lista = categoriaSel === 'POSICIÓN' ? SUB_POSICIONES : SUB_DEFENSAS;
            nodosAMostrar = lista.map(item => ({ nombre: item, type: 'subcategoria' }));
        }
        else if (SUB_POSICIONES.includes(categoriaSel) || SUB_DEFENSAS.includes(categoriaSel)) {
            // FILTRO CRÍTICO: Usamos trim() para limpiar espacios
            nodosAMostrar = todasLasTecnicas
                .filter(t => t.subcategoria.trim() === categoriaSel.trim())
                .map(t => ({ nombre: t.nombre, id: t.id, type: 'parte' }));
        }
        else if (categoriaSel === 'DERRIBOS') {
            nodosAMostrar = todasLasTecnicas.filter(t => t.subcategoria === "DERRIBOS").map(t => ({ nombre: t.nombre, id: t.id, type: 'parte' }));
        }
        else if (categoriaSel === 'AUTORES') {
            const autores = ['Craig Jones', 'Eddie Bravo', 'John Danaher', 'Levi Jones-Leary', 'Bernardo Faria', 'Bruno Malfacine', 'Josef Chen', 'Paulo Marmund', 'Gordon Ryan'];
            nodosAMostrar = autores.map(a => ({ nombre: a, type: 'autor' }));
        } else {
            const cursosFiltrados = Object.keys(DB_INSTRUCCIONALES).filter(key => DB_INSTRUCCIONALES[key].categorias?.includes(categoriaSel));
            nodosAMostrar = cursosFiltrados.map(key => ({ id: key, nombre: DB_INSTRUCCIONALES[key].titulo, type: 'curso' }));
        }
    }

    // ... (Siguen handleNodeClick, irAtras y el return del Aside/Main igual que antes)
    // 7. FUNCIONES DE INTERACCIÓN
    const handleNodeClick = (nodo) => {
        if (nodo.type === 'subcategoria') setCategoriaSel(nodo.nombre);
        else if (nodo.type === 'autor') setAutorSel(nodo.nombre);
        else if (nodo.type === 'curso') setInstrSel(nodo.id || nodo.nombre);
        else if (nodo.type === 'volumen') setVolSel(nodo.raw);
        else if (nodo.type === 'parte') onSelectVideo({ titulo: nodo.nombre, id: nodo.id });
    };

    const irAtras = () => {
        if (SUB_POSICIONES.includes(categoriaSel)) setCategoriaSel('POSICIÓN');
        else if (SUB_DEFENSAS.includes(categoriaSel)) setCategoriaSel('DEFENSAS');
        else if (volSel) setVolSel(null);
        else if (instrSel) setInstrSel(null);
        else if (autorSel) setAutorSel(null);
        else onBack();
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
                        flexDirection: esMovil ? 'row' : 'column',
                        overflowX: esMovil ? 'auto' : 'visible',
                        gap: '8px',
                        scrollbarWidth: 'none'
                    }}>
                        {['DEFENSAS', 'POSICIÓN', 'DERRIBOS', 'AUTORES', 'JUEGOS'].map(cat => {
                            // Lógica para mantener encendido el botón si estamos en una subcategoría
                            const estaActivo = categoriaSel === cat ||
                                (cat === 'POSICIÓN' && SUB_POSICIONES.includes(categoriaSel)) ||
                                (cat === 'DEFENSAS' && SUB_DEFENSAS.includes(categoriaSel));

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