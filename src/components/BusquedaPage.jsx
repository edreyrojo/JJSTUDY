import React, { useState, useEffect, useMemo } from 'react';
// Importamos la base de datos desde su ubicación
import { DB_INSTRUCCIONALES } from '../data/instruccionales';

const BusquedaPage = ({ onBack, onSelectVideo, styles }) => {
    const [termino, setTermino] = useState("");
    const [filtroActivo, setFiltroActivo] = useState("TODOS");
    
    // 📱 Detección móvil
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Aplanamos la DB para buscar en todos los videos de todos los cursos (Optimizado con useMemo)
    const todasLasTecnicas = useMemo(() => {
        if (!DB_INSTRUCCIONALES) return [];

        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
            (DB_INSTRUCCIONALES[cursoKey]?.volumenes || []).flatMap(vol =>
                (vol.partes || []).map(parte => {
                    let sub = parte.subcategoria || "";
                    const nombreOriginal = parte.nombre || "Técnica sin nombre";
                    const n = nombreOriginal.toLowerCase();
                    const cursoNom = cursoKey.toLowerCase();

                    if (!sub) {
                        const esCursoDefensa = cursoNom.includes('pillars of defense') || cursoNom.includes('escapes');

                        if (n.includes('escape') || n.includes('defensa') || n.includes('defense') || n.includes('counter') || esCursoDefensa) {
                            if (n.includes('mount') || n.includes('montada')) sub = "ESCAPES MONTADA";
                            else if (n.includes('side') || n.includes('lateral')) sub = "ESCAPES LATERAL";
                            else if (n.includes('back') || n.includes('espalda')) sub = "DEFENSA ESPALDA";
                            else if (n.includes('leg lock') || n.includes('heel hook')) sub = "DEFENSA LEG LOCKS";
                            else if (n.includes('triang')) sub = "DEFENSA TRIANGULO";
                            else if (n.includes('arm bar') || n.includes('armbar') || n.includes('joint lock') || n.includes('armlock')) sub = "DEFENSA ARM BAR";
                            else if (n.includes('darce') || n.includes('guillotine') || n.includes('choke') || n.includes('strangle')) sub = "DEFENSA STRANGLES";
                            else sub = "RE-GUARDIA";
                        }
                        else if (n.includes('takedown') || n.includes('take down') || n.includes('standing') || n.includes('derribo') || cursoNom.includes('feet to floor')) {
                            sub = "DERRIBOS";
                        }
                        else if (n.includes('side control') || n.includes('lateral') || n.includes('100 kilos')) sub = "CONTROL LATERAL";
                        else if (n.includes('half guard') || n.includes('media guardia') || n.includes('z-guard')) sub = "MEDIA GUARDIA";
                        else if (n.includes('closed guard') || n.includes('guardia cerrada')) sub = "GUARDIA CERRADA";
                        else if (n.includes('mount') || n.includes('montada')) sub = "MONTADA";
                        else if (n.includes('back') || n.includes('espalda') || n.includes('rear mount')) sub = "ESPALDA";
                        else if (n.includes('turtle') || n.includes('tortuga')) sub = "TORTUGA";
                        else if (n.includes('berimbolo') || n.includes('bolo')) sub = "BERIMBOLO";
                        else if (n.includes('buggy')) sub = "BUGGY CHOKE";
                        else if (n.includes('crucifix') || n.includes('crucifijo')) sub = "CRUCIFIX";
                        else if (n.includes('octopus')) sub = "OCTOPUS GUARD";
                    }

                    return { ...parte, nombre: nombreOriginal, subcategoria: sub, curso: cursoKey, volNombre: vol.nombre };
                })
            )
        );
    }, []);

    // Categorías rápidas disponibles
    const categoriasRapidas = ["TODOS", "ESCAPES MONTADA", "DERRIBOS", "GUARDIA CERRADA", "MONTADA", "ESPALDA", "DEFENSA LEG LOCKS"];

    // Filtrado inteligente optimizado
    const resultados = useMemo(() => {
        // Si no hay término de búsqueda ni filtro activo, limitamos la carga inicial a 40 elementos para cero lag
        const filtradas = todasLasTecnicas.filter(t => {
            const cumpleTexto = !termino || 
                                t.nombre.toLowerCase().includes(termino.toLowerCase()) ||
                                t.curso.toLowerCase().includes(termino.toLowerCase()) ||
                                t.volNombre.toLowerCase().includes(termino.toLowerCase());
            
            const cumpleFiltro = filtroActivo === "TODOS" || t.subcategoria === filtroActivo;

            return cumpleTexto && cumpleFiltro;
        });

        return filtradas;
    }, [todasLasTecnicas, termino, filtroActivo]);

    // Resultados renderizables limitados para proteger el DOM de sobrecarga (máximo 60 en pantalla a la vez)
    const resultadosVisibles = useMemo(() => {
        return resultados.slice(0, 60);
    }, [resultados]);

    return (
        <div style={{
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 15px)' : '30px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 15px)' : '30px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 15px)' : '30px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 15px)' : '30px',
            backgroundColor: '#000',
            color: '#fff',
            height: '100vh',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflow: 'hidden'
        }}>
            
            {/* Header Adaptable */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
                width: '100%',
                gap: '10px',
                flexShrink: 0
            }}>
                <button 
                    onClick={onBack} 
                    style={{ 
                        ...(styles?.btnOutline || {}), 
                        width: 'auto', 
                        padding: esMovil ? '10px 15px' : '8px 15px', 
                        fontSize: esMovil ? '0.9rem' : '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        margin: 0,
                        borderColor: '#d4af37',
                        color: '#d4af37',
                        backgroundColor: '#111',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    ← {esMovil ? '' : ' VOLVER AL HUB'}
                </button>
                <h2 style={{ 
                    color: '#d4af37', 
                    margin: 0, 
                    fontSize: esMovil ? '1.1rem' : '1.4rem', 
                    textTransform: 'uppercase',
                    textAlign: 'right',
                    letterSpacing: '1px'
                }}>
                    BÚSQUEDA VAULT ({todasLasTecnicas.length})
                </h2>
            </div>

            {/* Input de Búsqueda con Botón Clear (X) */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '12px', flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#d4af37', pointerEvents: 'none' }}>
                    🔍
                </span>
                <input
                    type="text"
                    placeholder="Escribe para buscar entre más de 1,000 técnicas..."
                    autoFocus={!esMovil} 
                    style={{
                        width: '100%',
                        padding: esMovil ? '14px 40px 14px 40px' : '14px 40px 14px 40px',
                        backgroundColor: '#111',
                        border: '1px solid #d4af37',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        boxSizing: 'border-box',
                        outline: 'none'
                    }}
                    value={termino}
                    onChange={(e) => setTermino(e.target.value)}
                />
                {termino && (
                    <button
                        onClick={() => setTermino("")}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Barra de Chips de Categorías Rápidas */}
            <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '10px',
                marginBottom: '10px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                flexShrink: '0'
            }}>
                {categoriasRapidas.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setFiltroActivo(cat)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: `1px solid ${filtroActivo === cat ? '#d4af37' : '#333'}`,
                            backgroundColor: filtroActivo === cat ? '#d4af37' : '#0a0a0a',
                            color: filtroActivo === cat ? '#000' : '#ccc',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Contador de resultados */}
            <div style={{ fontSize: '0.75rem', color: '#886', marginBottom: '8px', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
                <span>{resultados.length} {resultados.length === 1 ? 'técnica encontrada' : 'técnicas encontradas'}</span>
                {resultados.length > 60 && <span style={{ color: '#d4af37' }}>Mostrando las primeras 60 para optimizar velocidad</span>}
            </div>

            {/* Contenedor de Resultados Independiente (Scroll Local) */}
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px', 
                overflowY: 'auto', 
                paddingBottom: '20px', 
                width: '100%',
                minWidth: 0,
                scrollBehavior: 'smooth'
            }}>
                {resultadosVisibles.length > 0 ? (
                    resultadosVisibles.map((t, i) => (
                        <div
                            key={i}
                            onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })}
                            style={{
                                padding: '14px',
                                backgroundColor: '#0a0a0a',
                                border: '1px solid #222',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s, background-color 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: 'min-content'
                            }}
                            onMouseEnter={(e) => {
                                if (!esMovil) {
                                    e.currentTarget.style.borderColor = '#d4af37';
                                    e.currentTarget.style.backgroundColor = '#151515';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!esMovil) {
                                    e.currentTarget.style.borderColor = '#222';
                                    e.currentTarget.style.backgroundColor = '#0a0a0a';
                                }
                            }}
                            onTouchStart={(e) => e.currentTarget.style.borderColor = '#d4af37'}
                            onTouchEnd={(e) => e.currentTarget.style.borderColor = '#222'}
                        >
                            <div style={{ 
                                color: '#d4af37', 
                                fontWeight: 'bold',
                                fontSize: esMovil ? '0.9rem' : '1rem',
                                lineHeight: '1.3'
                            }}>
                                {t.nombre}
                            </div>
                            
                            {/* Chips informativos */}
                            <div style={{ 
                                fontSize: esMovil ? '0.7rem' : '0.75rem', 
                                color: '#888',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '6px'
                            }}>
                                <span style={{ color: '#ccc' }}>{t.curso}</span> 
                                <span style={{ opacity: 0.5 }}>•</span> 
                                <span>{t.volNombre}</span>
                                {t.subcategoria && (
                                    <>
                                        <span style={{ opacity: 0.5 }}>•</span>
                                        <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{t.subcategoria}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '40px', padding: '0 20px' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🥋</div>
                        <p style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#888' }}>No se encontraron técnicas</p>
                        <p style={{ fontSize: '0.85rem', color: '#555' }}>Intenta cambiando el filtro superior o buscando con otro término.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusquedaPage;