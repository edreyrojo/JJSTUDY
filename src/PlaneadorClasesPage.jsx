import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';

const PlaneadorClasesPage = ({ onBack, styles }) => {
    const [clases, setClases] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [modo, setModo] = useState('lista'); 
    const [claseSeleccionada, setClaseSeleccionada] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);

    // --- LÓGICA DEL TIMER ---
    useEffect(() => {
        let interval = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
            if (interval) clearInterval(interval);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [timerActive, timeLeft]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // --- ESTADO INICIAL ---
    const estadoInicial = {
        titulo: '',
        fecha: new Date().toISOString().split('T')[0],
        bloques: [
            { id: 'b1', tipo: 'Calentamiento', ligero: '', intenso: '', minutos: 5 },
            { id: 'b_final', tipo: 'Sparring', contenido: '', minutos: 5 }
        ]
    };
    const [nuevaClase, setNuevaClase] = useState(estadoInicial);

    // --- CARGA DE DATOS (CON PARCHE DE ERROR) ---
    useEffect(() => {
        let isMounted = true;

        const qClases = query(collection(db, "clases"), orderBy("fecha", "desc"));
        const unsubClases = onSnapshot(qClases, (snap) => {
            if (isMounted) setClases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.error("Error Clases:", err));

        const qAlumnos = query(collection(db, "alumnos"), orderBy("nombre", "asc"));
        const unsubAlumnos = onSnapshot(qAlumnos, (snap) => {
            if (isMounted) setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo));
        }, (err) => console.error("Error Alumnos:", err));

        return () => {
            isMounted = false;
            unsubClases();
            unsubAlumnos();
        };
    }, []);

    // --- FUNCIONES DE EDICIÓN ---
    const agregarBloqueCLA = () => {
        const nuevosBloques = [...nuevaClase.bloques];
        const bloqueCLA = { 
            id: Date.now().toString(), 
            tipo: 'CLA', 
            atacante: '', defensor: '', rondas: ['', '', ''], intensidad: 1, minutos: 3 
        };
        nuevosBloques.splice(nuevosBloques.length - 1, 0, bloqueCLA);
        setNuevaClase({ ...nuevaClase, bloques: nuevosBloques });
    };

    const eliminarBloqueProvisional = (id) => {
        if (id === 'b1' || id === 'b_final') return;
        setNuevaClase({ ...nuevaClase, bloques: nuevaClase.bloques.filter(b => b.id !== id) });
    };

    const moverBloque = (index, direccion) => {
        const nuevos = [...nuevaClase.bloques];
        const destino = index + direccion;
        if (destino <= 0 || destino >= nuevos.length - 1) return;
        [nuevos[index], nuevos[destino]] = [nuevos[destino], nuevos[index]];
        setNuevaClase({ ...nuevaClase, bloques: nuevos });
    };

    const guardarClase = async () => {
        if (!nuevaClase.titulo) return alert("Falta título");
        try {
            await addDoc(collection(db, "clases"), nuevaClase);
            setModo('lista');
            setNuevaClase(estadoInicial);
        } catch (e) { alert("Error al guardar clase"); }
    };

    const eliminarClaseDB = async (id) => {
        if (window.confirm("¿Borrar permanentemente?")) await deleteDoc(doc(db, "clases", id));
    };

    const registrarAsistenciaConNota = async (alumnoId, nota) => {
        try {
            const alumnoRef = doc(db, "alumnos", alumnoId);
            await updateDoc(alumnoRef, {
                asistencias: arrayUnion(claseSeleccionada.fecha),
                historialTecnico: arrayUnion({ fecha: claseSeleccionada.fecha, clase: claseSeleccionada.titulo, nota: nota || "Asistió" })
            });
            alert("Nota guardada");
        } catch (e) { alert("Error de permisos en Firestore"); }
    };

    return (
        <div style={{ 
            backgroundColor: '#000', minHeight: '100vh', color: '#fff', 
            width: '100%', margin: 0, padding: 0, boxSizing: 'border-box', overflowX: 'hidden' 
        }}>
            
            {/* TIMER STICKY */}
            {modo === 'clase_activa' && (
                <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#d4af37', color: '#000', padding: '15px', borderRadius: '0 0 15px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{formatTime(timeLeft)}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setTimerActive(!timerActive)} style={{ backgroundColor: '#000', color: '#d4af37', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold' }}>
                            {timerActive ? 'PAUSA' : 'START'}
                        </button>
                        <button onClick={() => { setTimerActive(false); setTimeLeft(0); }} style={{ backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #000', borderRadius: '8px', padding: '10px' }}>⏹</button>
                    </div>
                </div>
            )}

            <div style={{ padding: '15px', boxSizing: 'border-box', width: '100%' }}>
                
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <button onClick={onBack} style={{ ...styles.btnOutline, width: '45px', height: '45px' }}>←</button>
                    <div style={{ textAlign: 'right' }}>
                        <h2 style={{ color: '#d4af37', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>LA FORTUNA</h2>
                        <span style={{ fontSize: '0.6rem', color: '#666' }}>CLA PLANNER</span>
                    </div>
                </div>

                {/* VISTA: LISTA */}
                {modo === 'lista' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button onClick={() => setModo('crear')} style={{ ...styles.btnGold, padding: '18px' }}>+ NUEVA CLASE</button>
                        {clases.map(c => (
                            <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div onClick={() => { setClaseSeleccionada(c); setModo('clase_activa'); }}
                                    style={{ ...styles.card, flex: 1, width: 'auto', maxWidth: 'none', textAlign: 'left', cursor: 'pointer', padding: '15px' }}>
                                    <h3 style={{ margin: 0, color: '#d4af37', fontSize: '1rem' }}>{c.titulo.toUpperCase()}</h3>
                                    <span style={{ fontSize: '0.7rem', color: '#555' }}>{c.fecha}</span>
                                </div>
                                <button onClick={() => eliminarClaseDB(c.id)} style={{ backgroundColor: '#111', border: '1px solid #300', color: '#ff4444', padding: '15px', borderRadius: '10px' }}>🗑</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* VISTA: CREAR */}
                {modo === 'crear' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '100px' }}>
                        <input placeholder="TÍTULO DE LA SESIÓN" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', textAlign: 'center', borderBottom: '2px solid #d4af37' }} onChange={e => setNuevaClase({ ...nuevaClase, titulo: e.target.value })} />
                        
                        {nuevaClase.bloques.map((bloque, index) => (
                            <div key={bloque.id} style={{ ...styles.card, width: '100%', maxWidth: 'none', boxSizing: 'border-box', border: '1px solid #333', padding: '15px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.8rem' }}>{bloque.tipo.toUpperCase()}</span>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        {bloque.id !== 'b1' && bloque.id !== 'b_final' && (
                                            <>
                                                <button onClick={() => moverBloque(index, -1)} style={{ background: '#222', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>↑</button>
                                                <button onClick={() => moverBloque(index, 1)} style={{ background: '#222', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>↓</button>
                                                <button onClick={() => eliminarBloqueProvisional(bloque.id)} style={{ background: '#300', color: 'red', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>×</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {bloque.tipo === 'Calentamiento' ? (
                                    <>
                                        <textarea placeholder="Calentamiento Ligero (Movilidad)..." style={{...styles.input, width: '100%', height: '60px', marginBottom: '10px'}} onChange={e => { const b = [...nuevaClase.bloques]; b[index].ligero = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        <textarea placeholder="Drills Intensos..." style={{...styles.input, width: '100%', height: '60px'}} onChange={e => { const b = [...nuevaClase.bloques]; b[index].intenso = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                    </>
                                ) : bloque.tipo === 'CLA' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input placeholder="Objetivo Atacante" style={styles.input} onChange={e => { const b = [...nuevaClase.bloques]; b[index].atacante = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        <input placeholder="Objetivo Defensor" style={styles.input} onChange={e => { const b = [...nuevaClase.bloques]; b[index].defensor = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                                            {bloque.rondas.map((r, ri) => (
                                                <input key={ri} placeholder={`R${ri+1}`} style={{...styles.input, fontSize: '0.7rem', padding: '8px'}} onChange={e => { const b = [...nuevaClase.bloques]; b[index].rondas[ri] = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <textarea placeholder="Detalles Sparring..." style={{...styles.input, height: '80px'}} onChange={e => { const b = [...nuevaClase.bloques]; b[index].contenido = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                )}
                                <div style={{marginTop: '10px', display:'flex', alignItems:'center', gap:'10px'}}>
                                    <span style={{fontSize:'0.7rem', color:'#666'}}>DURACIÓN (MIN):</span>
                                    <input type="number" style={{...styles.input, width:'60px', marginBottom:0}} onChange={e => { const b = [...nuevaClase.bloques]; b[index].minutos = parseInt(e.target.value); setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                </div>
                            </div>
                        ))}
                        <button onClick={agregarBloqueCLA} style={styles.btnOutline}>+ AÑADIR DINÁMICA CLA</button>
                        <button onClick={guardarClase} style={styles.btnGold}>GUARDAR SESIÓN</button>
                    </div>
                )}

                {/* VISTA: CLASE ACTIVA */}
                {modo === 'clase_activa' && claseSeleccionada && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '100px' }}>
                        {claseSeleccionada.bloques.map((b, i) => (
                            <div key={i} style={{ ...styles.card, width: '100%', maxWidth: '100%', textAlign: 'left', borderLeft: '4px solid #d4af37', padding: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <h4 style={{ color: '#d4af37', margin: 0, fontSize: '0.9rem' }}>{b.tipo}</h4>
                                    <button onClick={() => { setTimeLeft(b.minutos * 60); setTimerActive(true); }} style={{ background: '#d4af37', color: '#000', border: 'none', borderRadius: '4px', padding: '5px 10px', fontWeight: 'bold', fontSize: '0.7rem' }}>
                                        START {b.minutos}M
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.9rem' }}>
                                    {b.tipo === 'Calentamiento' ? (
                                        <>
                                            <p style={{ margin: '0 0 5px 0' }}><strong style={{color:'#888'}}>LIGERO:</strong> {b.ligero}</p>
                                            <p style={{ margin: 0 }}><strong style={{color:'#888'}}>INTENSO:</strong> {b.intenso}</p>
                                        </>
                                    ) : b.tipo === 'CLA' ? (
                                        <>
                                            <p style={{ margin: '0 0 5px 0' }}><strong style={{color:'#888'}}>ATACANTE:</strong> {b.atacante}</p>
                                            <p style={{ margin: '0 0 10px 0' }}><strong style={{color:'#888'}}>DEFENSOR:</strong> {b.defensor}</p>
                                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {b.rondas.map((r, ri) => (
                                                    <span key={ri} style={{ background: '#111', padding: '4px 8px', borderRadius: '4px', color: '#d4af37', border: '1px solid #333', fontSize: '0.7rem' }}>R{ri+1}: {r}</span>
                                                ))}
                                            </div>
                                        </>
                                    ) : <p style={{ margin: 0 }}>{b.contenido}</p>}
                                </div>
                            </div>
                        ))}

                        <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px' }}>ASISTENCIA Y SCOUTING</p>
                            {alumnos.map(a => (
                                <div key={a.id} style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                                    <span style={{ flex: 1, fontSize: '0.8rem' }}>{a.nombre}</span>
                                    <input placeholder="Nota..." style={{ ...styles.input, width: '100px', marginBottom: 0, padding: '5px', fontSize:'0.7rem' }} onBlur={(e) => e.target.value && registrarAsistenciaConNota(a.id, e.target.value)} />
                                    <button onClick={() => registrarAsistenciaConNota(a.id, "Asistió")} style={{ backgroundColor: '#d4af37', border: 'none', padding: '5px 12px', borderRadius: '4px' }}>✓</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => { setModo('lista'); setTimerActive(false); }} style={{...styles.btnOutline, padding: '15px'}}>TERMINAR SESIÓN</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaneadorClasesPage;