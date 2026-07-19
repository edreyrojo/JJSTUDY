import React, { useState, useEffect, useMemo } from 'react';
// Importamos la base de datos desde su nueva ubicación
import { DB_INSTRUCCIONALES } from '../data/instruccionales';

const BusquedaPage = ({ onBack, onSelectVideo, styles }) => {
    const [termino, setTermino] = useState("");
    
    // 📱 Detección móvil
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Aplanamos la DB para buscar en todos los videos de todos los cursos
    const todasLasTecnicas = useMemo(() => {
        if (!DB_INSTRUCCIONALES) return []; // Seguro contra DB no cargada

        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
            (DB_INSTRUCCIONALES[cursoKey]?.volumenes || []).flatMap(vol =>
                (vol.partes || []).map(parte => {
                    let sub = parte.subcategoria || "";
                    // 🛡️ Seguro contra variables nulas que rompen el .toLowerCase()
                    const nombreOriginal = parte.nombre || "Técnica sin nombre";
                    const n = nombreOriginal.toLowerCase();
                    const cursoNom = cursoKey.toLowerCase();

                    if (!sub) {
                        const esCursoDefensa = cursoNom.includes('pillars of defense') || cursoNom.includes('escapes');

                        // 1. FILTRO DE DEFENSAS
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
                        // 2. FILTRO DE DERRIBOS
                        else if (n.includes('takedown') || n.includes('take down') || n.includes('standing') || n.includes('derribo') || cursoNom.includes('feet to floor')) {
                            sub = "DERRIBOS";
                        }
                        // 3. POSICIONES DE CONTROL
                        else if (n.includes('side control') || n.includes('lateral') || n.includes('100 kilos')) sub = "CONTROL LATERAL";
                        else if (n.includes('half guard') || n.includes('media guardia') || n.includes('z-guard')) sub = "MEDIA GUARDIA";
                        else if (n.includes('closed guard') || n.includes('guardia cerrada')) sub = "GUARDIA CERRADA";
                        else if (n.includes('mount') || n.includes('montada')) sub = "MONTADA";
                        else if (n.includes('back') || n.includes('espalda') || n.includes('rear mount')) sub = "ESPALDA";
                        else if (n.includes('turtle') || n.includes('tortuga')) sub = "TORTUGA";
                        // 4. SISTEMAS ESPECÍFICOS
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

    const resultados = todasLasTecnicas.filter(t =>
        t.nombre.toLowerCase().includes(termino.toLowerCase())
    );

    return (
        <div style={{
            // 🛡️ Soporte Notch Integral (Safe Area)
            paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 0px) + 15px)' : '40px',
            paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 0px) + 15px)' : '40px',
            paddingLeft: esMovil ? 'calc(env(safe-area-inset-left, 0px) + 15px)' : '40px',
            paddingRight: esMovil ? 'calc(env(safe-area-inset-right, 0px) + 15px)' : '40px',
            backgroundColor: '#000',
            color: '#fff',
            // 🛠️ FIX DE SCROLL: Fijamos la altura al viewport y usamos flexbox
            height: '100vh',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflow: 'hidden' // Corta cualquier desborde global
        }}>
            
            {/* Header Adaptable */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                width: '100%',
                gap: '10px',
                flexShrink: 0 // Evita que se encoja
            }}>
                <button 
                    onClick={onBack} 
                    style={{ 
                        ...(styles?.btnOutline || {}), 
                        width: 'auto', 
                        padding: esMovil ? '10px 15px' : '8px 15px', 
                        fontSize: esMovil ? '1rem' : '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        margin: 0
                    }}
                >
                    ← {esMovil ? '' : ' VOLVER AL HUB'}
                </button>
                <h2 style={{ 
                    color: '#d4af37', 
                    margin: 0, 
                    fontSize: esMovil ? '1.1rem' : '1.5rem', 
                    textTransform: 'uppercase',
                    textAlign: 'right'
                }}>
                    BÚSQUEDA
                </h2>
            </div>

            {/* Input de Búsqueda Mejorado */}
            <input
                type="text"
                placeholder="Buscar técnica (ej: Sweep, Guard...)"
                // 🛠️ FIX: Solo auto-foco en PC. En móvil obliga al usuario a tocar para no tapar la pantalla
                autoFocus={!esMovil} 
                style={{
                    width: '100%',
                    padding: esMovil ? '16px 15px' : '15px',
                    backgroundColor: '#111',
                    border: '1px solid #d4af37',
                    color: '#fff',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    flexShrink: 0
                }}
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
            />

            {/* Contenedor de Resultados Independiente (Scroll Local) */}
            <div style={{ 
                flex: 1,  // Toma todo el espacio restante dinámicamente
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px', 
                overflowY: 'auto', 
                paddingBottom: '20px', // Extra padding al final para separar del borde inferior
                width: '100%',
                minWidth: 0,
                scrollBehavior: 'smooth'
            }}>
                {resultados.length > 0 ? (
                    resultados.map((t, i) => (
                        <div
                            key={i}
                            onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })}
                            style={{
                                padding: '15px',
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
                                // Truco para evitar que la tarjeta se encoja de forma rara
                                minHeight: 'min-content'
                            }}
                            // Efecto Hover solo si no es movil (evita que se queden pegados los clicks)
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
                            // Efecto Táctil activo para celulares
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
                            
                            {/* Layout de Etiquetas de Curso (Chips visuales) */}
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
                    termino !== "" && (
                        <div style={{ color: '#666', textAlign: 'center', marginTop: '40px', padding: '0 20px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🥋</div>
                            <p style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#888' }}>No se encontraron técnicas para "{termino}"</p>
                            <p style={{ fontSize: '0.85rem' }}>Intenta con términos más generales en inglés o español.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default BusquedaPage;