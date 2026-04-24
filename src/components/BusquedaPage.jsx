import React from 'react';
// Importamos la base de datos desde su nueva ubicación
import { DB_INSTRUCCIONALES } from '../data/instruccionales';
const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo, // 'success', 'error', 'warning', 'info'
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
const BusquedaPage = ({ onBack, onSelectVideo, styles }) => {
    const [termino, setTermino] = React.useState("");

    // Aplanamos la DB para buscar en todos los videos de todos los cursos
    const todasLasTecnicas = React.useMemo(() => {
        return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
            DB_INSTRUCCIONALES[cursoKey].volumenes.flatMap(vol =>
                vol.partes.map(parte => {
                    let sub = parte.subcategoria || "";
                    const n = parte.nombre.toLowerCase();
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

                    return { ...parte, subcategoria: sub, curso: cursoKey, volNombre: vol.nombre };
                })
            )
        );
    }, [DB_INSTRUCCIONALES]);

    const resultados = todasLasTecnicas.filter(t =>
        t.nombre.toLowerCase().includes(termino.toLowerCase())
    );

    return (
        <div style={{ padding: '40px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
            <button onClick={onBack} style={styles.btnOutline}>← VOLVER AL HUB</button>

            <h2 style={{ color: '#d4af37', marginTop: '20px', fontSize: '1.5rem' }}>BUSCADOR DE TÉCNICAS</h2>

            <input
                type="text"
                placeholder="Buscar técnica (ej: Sweep, Guard, Kimur...)"
                autoFocus
                style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: '#111',
                    border: '1px solid #d4af37',
                    color: '#fff',
                    borderRadius: '8px',
                    margin: '20px 0',
                    fontSize: '1rem'
                }}
                onChange={(e) => setTermino(e.target.value)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '70vh' }}>
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
                                transition: 'border-color 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#d4af37'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
                        >
                            <div style={{ color: '#d4af37', fontWeight: 'bold' }}>{t.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                                {t.curso} • {t.volNombre}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                        No se encontraron técnicas con ese nombre.
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusquedaPage;