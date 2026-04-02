import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';

const PlaneadorClasesPage = ({ onBack, styles }) => {
    const [clases, setClases] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [modo, setModo] = useState('lista'); // 'lista', 'crear', 'clase_activa'
    const [claseSeleccionada, setClaseSeleccionada] = useState(null);

    // Estado para construir la clase
    const [nuevaClase, setNuevaClase] = useState({
        titulo: '',
        fecha: new Date().toISOString().split('T')[0],
        bloques: [
            { tipo: 'Calentamiento', contenido: '' },
            { tipo: 'CLA', titulo: 'Dinámica 1', atacante: '', defensor: '', rondas: ['', '', ''], intensidad: 1 }
        ]
    });

    // 1. Cargar Datos
    useEffect(() => {
        const qClases = query(collection(db, "clases"), orderBy("fecha", "desc"));
        const unsubClases = onSnapshot(qClases, (snap) => {
            setClases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const qAlumnos = query(collection(db, "alumnos"), orderBy("nombre", "asc"));
        const unsubAlumnos = onSnapshot(qAlumnos, (snap) => {
            setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo));
        });

        return () => { unsubClases(); unsubAlumnos(); };
    }, []);

    // 2. Funciones de Construcción
    const agregarBloque = () => {
        setNuevaClase({
            ...nuevaClase,
            bloques: [...nuevaClase.bloques, { tipo: 'CLA', titulo: `Dinámica ${nuevaClase.bloques.length}`, atacante: '', defensor: '', rondas: ['', '', ''], intensidad: 1 }]
        });
    };

    const guardarClase = async () => {
        if (!nuevaClase.titulo) return alert("Ponle un título a la clase");
        await addDoc(collection(db, "clases"), nuevaClase);
        setModo('lista');
    };

    // 3. Pase de Lista con Notas Técnicas
    const registrarAsistenciaConNota = async (alumnoId, nota) => {
        const alumnoRef = doc(db, "alumnos", alumnoId);
        await updateDoc(alumnoRef, {
            asistencias: arrayUnion(nuevaClase.fecha),
            historialTecnico: arrayUnion({
                fecha: nuevaClase.fecha,
                clase: nuevaClase.titulo,
                nota: nota || "Asistió a clase"
            })
        });
        alert(`Nota guardada para el alumno`);
    };

    return (
        <div style={{
            padding: '20px',
            backgroundColor: '#000',
            minHeight: '100vh',
            color: '#fff',
            boxSizing: 'border-box', // Crucial para que el padding no empuje el ancho
            maxWidth: '100vw',
            overflowX: 'hidden' // Evita el scroll horizontal molesto
        }}>

            {/* HEADER FIJO O UNIFORME */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
                width: '100%',
                maxWidth: '600px', // Alineado al centro como tu grid
                margin: '0 auto 30px auto'
            }}>
                <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '8px 15px', fontSize: '0.8rem' }}>←</button>
                <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1rem' }}>PLANEADOR CLA</h2>
                {modo === 'lista' && (
                    <button onClick={() => setModo('crear')} style={{ ...styles.btnGold, width: 'auto', padding: '8px 15px', fontSize: '0.8rem' }}>+ NUEVA</button>
                )}
            </div>

            {/* CONTENEDOR CENTRALIZADO */}
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>

                {/* VISTA: LISTA DE CLASES */}
                {modo === 'lista' && (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {clases.map(c => (
                            <div key={c.id} onClick={() => { setClaseSeleccionada(c); setModo('clase_activa'); }}
                                style={{ ...styles.card, width: '100%', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '1rem' }}>{c.titulo}</h3>
                                <p style={{ margin: '5px 0 0 0', fontSize: '0.7rem', color: '#666' }}>{c.fecha}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* VISTA: CREAR CLASE (FORMULARIO CONTROLADO) */}
                {modo === 'crear' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '50px' }}>
                        <input
                            placeholder="Título de la clase"
                            style={{ ...styles.input, boxSizing: 'border-box' }}
                            onChange={e => setNuevaClase({ ...nuevaClase, titulo: e.target.value })}
                        />

                        {nuevaClase.bloques.map((bloque, index) => (
                            <div key={index} style={{
                                ...styles.card,
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid #d4af37',
                                padding: '20px',
                                textAlign: 'left'
                            }}>
                                <h4 style={{ color: '#d4af37', marginTop: 0, fontSize: '0.9rem' }}>Bloque {index + 1}: {bloque.tipo}</h4>

                                {bloque.tipo === 'Calentamiento' ? (
                                    <textarea
                                        placeholder="Ejercicios de movilidad..."
                                        style={{ ...styles.input, height: '80px', resize: 'none', boxSizing: 'border-box' }}
                                        onChange={e => {
                                            const b = [...nuevaClase.bloques]; b[index].contenido = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b });
                                        }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input placeholder="Objetivo Atacante" style={{ ...styles.input, boxSizing: 'border-box', marginBottom: 0 }} onChange={e => {
                                            const b = [...nuevaClase.bloques]; b[index].atacante = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b });
                                        }} />
                                        <input placeholder="Objetivo Defensor" style={{ ...styles.input, boxSizing: 'border-box', marginBottom: 0 }} onChange={e => {
                                            const b = [...nuevaClase.bloques]; b[index].defensor = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b });
                                        }} />
                                        <p style={{ fontSize: '0.65rem', color: '#d4af37', margin: '5px 0' }}>RONDAS (VENTAJA → NEUTRO):</p>
                                        {bloque.rondas.map((r, ri) => (
                                            <input key={ri} placeholder={`Escenario R${ri + 1}`} style={{ ...styles.input, marginBottom: 0, padding: '8px', boxSizing: 'border-box' }} onChange={e => {
                                                const b = [...nuevaClase.bloques]; b[index].rondas[ri] = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b });
                                            }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        <button onClick={agregarBloque} style={styles.btnOutline}>+ AÑADIR DINÁMICA</button>
                        <button onClick={guardarClase} style={styles.btnGold}>GUARDAR PLANEACIÓN</button>
                    </div>
                )}

                {/* VISTA: CLASE ACTIVA (PASE DE LISTA) */}
                {modo === 'clase_activa' && claseSeleccionada && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ ...styles.card, width: '100%', boxSizing: 'border-box', border: '1px solid #d4af37' }}>
                            <h3 style={{ ...styles.goldTitle, fontSize: '1.1rem', marginBottom: '10px' }}>{claseSeleccionada.titulo}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#888' }}>{claseSeleccionada.fecha}</p>
                        </div>

                        <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.8rem', color: '#d4af37' }}>PASE DE LISTA Y NOTAS TÉCNICAS</h4>
                            {alumnos.map(a => (
                                <div key={a.id} style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                                    <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 'bold' }}>{a.nombre}</span>
                                    <input
                                        placeholder="Nota técnica..."
                                        style={{ ...styles.input, width: '120px', marginBottom: 0, padding: '5px', fontSize: '0.7rem' }}
                                        onBlur={(e) => e.target.value && registrarAsistenciaConNota(a.id, e.target.value)}
                                    />
                                    <button
                                        onClick={() => registrarAsistenciaConNota(a.id, "Asistió")}
                                        style={{ backgroundColor: '#d4af37', color: '#000', border: 'none', width: '25px', height: '25px', borderRadius: '4px', fontWeight: 'bold' }}
                                    >
                                        ✓
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* GUÍA DE LA CLASE */}
                        {claseSeleccionada.bloques.map((b, i) => (
                            <div key={i} style={{ ...styles.card, width: '100%', textAlign: 'left', boxSizing: 'border-box', marginBottom: '10px' }}>
                                <h5 style={{ color: '#d4af37', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>{b.tipo}</h5>
                                {b.tipo === 'CLA' ? (
                                    <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                                        <p><strong>ATACANTE:</strong> {b.atacante}</p>
                                        <p><strong>DEFENSOR:</strong> {b.defensor}</p>
                                        <p style={{ color: '#888', fontSize: '0.7rem' }}>RONDAS: {b.rondas.join(' → ')}</p>
                                    </div>
                                ) : <p style={{ fontSize: '0.8rem' }}>{b.contenido}</p>}
                            </div>
                        ))}

                        <button onClick={() => setModo('lista')} style={{ ...styles.btnOutline, marginBottom: '40px' }}>CERRAR SESIÓN</button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PlaneadorClasesPage;