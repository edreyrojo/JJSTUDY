import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    doc,
    updateDoc,
    arrayUnion,
    deleteDoc,
    where
} from 'firebase/firestore';
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};

const PlaneadorClasesPage = ({ onBack, styles, usuario }) => {
    const [clases, setClases] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    const [modo, setModo] = useState('lista');
    const [claseSeleccionada, setClaseSeleccionada] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [isPrepTime, setIsPrepTime] = useState(false);
    const [currentTargetTime, setCurrentTargetTime] = useState(0);

    const intentarVolver = async () => {
        if (modo === 'clase_activa') {
            const result = await Swal.fire({
                title: '¿ABANDONAR SESIÓN?',
                text: "Tienes una sesión activa. Si sales ahora, el cronómetro se detendrá.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'SÍ, ABANDONAR',
                cancelButtonText: 'MANTENER SESIÓN',
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#ff4444',
                cancelButtonColor: '#d4af37',
                iconColor: '#ff4444'
            });

            if (!result.isConfirmed) return;
        }

        setTimerActive(false);
        onBack();
    };

    // Referencias persistentes
    const audioCtxRef = useRef(null);
    const wakeLockRef = useRef(null);

    const initAudio = async () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
        }
    };

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error("WakeLock Error:", err);
        }
    };

    const playBeep = (freq = 440, duration = 2, forceVibrate = false) => {
        try {
            if (!audioCtxRef.current) return;
            const oscillator = audioCtxRef.current.createOscillator();
            const gainNode = audioCtxRef.current.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtxRef.current.destination);

            oscillator.type = 'triangle';
            oscillator.frequency.value = freq;

            const now = audioCtxRef.current.currentTime;
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            oscillator.start(now);
            oscillator.stop(now + duration);

            if (forceVibrate && "vibrate" in navigator) {
                navigator.vibrate(duration * 200);
            }
        } catch (e) { console.error("Audio error", e); }
    };

    const playTripleCampana = () => {
        playBeep(1200, 1, true);
        setTimeout(() => playBeep(1200, 1, false), 300);
        setTimeout(() => playBeep(1200, 2, true), 600);
    };

    const startTimerWithPrep = async (minutos) => {
        await initAudio();
        await requestWakeLock();
        setCurrentTargetTime(minutos * 60);
        setTimeLeft(10);
        setIsPrepTime(true);
        setTimerActive(true);
        playBeep(500, 2, true);
    };

    // --- FIREBASE ---
    useEffect(() => {
        if (!usuario || !usuario.uid) return;
        const teamIdEfectivo = usuario.teamId || usuario.academiaId;
        if (!teamIdEfectivo) return;

        let unsubClases = null;
        let unsubAlumnos = null;

        const cargarDatos = () => {
            try {
                const qClases = query(collection(db, "clases"), where("teamId", "==", teamIdEfectivo));
                unsubClases = onSnapshot(qClases, (snap) => {
                    setClases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.error("Error clases:", err));

                const qAlumnos = query(collection(db, "alumnos"), where("teamId", "==", teamIdEfectivo));
                unsubAlumnos = onSnapshot(qAlumnos, (snap) => {
                    setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.error("Error alumnos:", err));
            } catch (err) {
                console.error("Error suscripciones:", err);
            }
        };

        cargarDatos();

        return () => {
            if (unsubClases) unsubClases();
            if (unsubAlumnos) unsubAlumnos();
        };
    }, [usuario]);

    // --- TIMER ---
    useEffect(() => {
        let intervalo = null;
        if (timerActive && timeLeft > 0) {
            intervalo = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timerActive && timeLeft === 0) {
            if (isPrepTime) {
                playTripleCampana();
                setIsPrepTime(false);
                setTimeLeft(currentTargetTime);
            } else {
                playBeep(800, 3, true);
                setTimerActive(false);
            }
        }
        return () => { if (intervalo) clearInterval(intervalo); };
    }, [timerActive, timeLeft, isPrepTime, currentTargetTime]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const estadoInicial = {
        titulo: '',
        esPublica: true,
        fecha: new Date().toISOString().split('T')[0],
        bloques: [
            { id: 'b1', tipo: 'Calentamiento', ligero: '', intenso: '', minutos: 5 },
            { id: 'b_final', tipo: 'Sparring', contenido: '', minutos: 5 }
        ]
    };
    const [nuevaClase, setNuevaClase] = useState(estadoInicial);

    const agregarBloqueCLA = () => {
        const nuevosBloques = [...nuevaClase.bloques];
        const bloqueCLA = {
            id: Date.now().toString(),
            tipo: 'CLA',
            modalidad: '',
            limitantes: '',
            atacante: '',
            defensor: '',
            minutos: 3
        };
        nuevosBloques.splice(nuevosBloques.length - 1, 0, bloqueCLA);
        setNuevaClase({ ...nuevaClase, bloques: nuevosBloques });
    };

    const guardarClase = async () => {
        if (!nuevaClase.titulo) return notify("Falta título de la sesión", "error");
        try {
            const teamIdEfectivo = usuario.teamId || usuario.academiaId;
            await addDoc(collection(db, "clases"), {
                ...nuevaClase,
                teamId: teamIdEfectivo,
                creadoPor: usuario.uid,
                fechaRegistro: new Date().toISOString()
            });
            notify("Clase forjada con éxito 🥋");
            setModo('lista');
            setNuevaClase(estadoInicial);
        } catch (e) {
            console.error(e);
            notify("Error al guardar la clase.", "error");
        }
    };

    const registrarAsistenciaConNota = async (alumnoId, nota) => {
        if (!claseSeleccionada) return;
        try {
            const alumnoRef = doc(db, "alumnos", alumnoId);
            await updateDoc(alumnoRef, {
                asistencias: arrayUnion(claseSeleccionada.fecha),
                historialTecnico: arrayUnion({ fecha: claseSeleccionada.fecha, clase: claseSeleccionada.titulo, nota: nota || "Asistió" })
            });
            notify("Progreso registrado");
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{
            backgroundColor: '#000',
            minHeight: '100vh',
            color: '#fff',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
            paddingBottom: 'env(safe-area-inset-bottom)'
        }}>
            {/* CRONÓMETRO STICKY SUPERIOR */}
            {modo === 'clase_activa' && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 9999,
                    backgroundColor: isPrepTime ? '#ff4444' : '#d4af37',
                    color: '#000',
                    padding: 'calc(12px + env(safe-area-inset-top)) 20px 12px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    boxSizing: 'border-box'
                }}>
                    <div>
                        <span style={{ fontSize: '1.6rem', fontWeight: '900', fontFamily: 'monospace' }}>{formatTime(timeLeft)}</span>
                        <div style={{ fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                            {isPrepTime ? 'PREPARACIÓN' : 'TIEMPO ACTIVO'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setTimerActive(!timerActive)} style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
                            {timerActive ? 'PAUSA' : 'RESUME'}
                        </button>
                        <button onClick={() => { setTimerActive(false); setTimeLeft(0); }} style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid #000', borderRadius: '6px', width: '38px', height: '38px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>⏹</button>
                    </div>
                </div>
            )}

            <div style={{
                padding: '20px',
                paddingTop: modo !== 'clase_activa' ? 'calc(20px + env(safe-area-inset-top))' : '20px',
                maxWidth: '1000px',
                margin: '0 auto',
                boxSizing: 'border-box'
            }}>
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <button onClick={intentarVolver} style={{ ...styles.btnOutline, width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>←</button>
                    <div style={{ textAlign: 'right' }}>
                        <h2 style={{ color: '#d4af37', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>PLANNER DE CLASES</h2>
                        <span style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '1px' }}>LA FORTUNA VAULT</span>
                    </div>
                </div>

                {/* VISTA: LISTA DE CLASES */}
                {modo === 'lista' && (
                    <div>
                        <button onClick={() => setModo('crear')} style={{ ...styles.btnGold, padding: '14px', width: '100%', marginBottom: '20px', fontWeight: 'bold', cursor: 'pointer' }}>+ NUEVA SESIÓN</button>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {clases.map(c => (
                                <div key={c.id} style={{ display: 'flex', gap: '8px', boxSizing: 'border-box' }}>
                                    <div onClick={() => { setClaseSeleccionada(c); setModo('clase_activa'); }}
                                        style={{ ...styles.card, flex: 1, textAlign: 'left', padding: '15px', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '10px' }}>
                                        <span style={{ position: 'absolute', top: '12px', right: '15px', fontSize: '1rem' }}>
                                            {c.esPublica ? '🌍' : '🔒'}
                                        </span>
                                        <h3 style={{ margin: '0 0 4px 0', color: '#d4af37', fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: '25px' }}>
                                            {c.titulo.toUpperCase()}
                                        </h3>
                                        <span style={{ fontSize: '0.65rem', color: '#777' }}>{c.fecha}</span>
                                    </div>
                                    <button onClick={() => { if (window.confirm("¿Deseas eliminar esta clase?")) deleteDoc(doc(db, "clases", c.id)) }} style={{ background: '#111', border: '1px solid #222', color: '#ff4444', borderRadius: '8px', width: '45px', cursor: 'pointer', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>🗑</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VISTA: CREAR CLASE */}
                {modo === 'crear' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
                        <div>
                            <input placeholder="TÍTULO DE LA SESIÓN" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', textAlign: 'center', borderBottom: '2px solid #d4af37', fontSize: '1rem', padding: '12px' }} onChange={e => setNuevaClase({ ...nuevaClase, titulo: e.target.value })} />
                            
                            {/* TOGGLE VISIBILIDAD */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '15px', backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '10px', border: '1px solid #222' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: nuevaClase.esPublica ? '#555' : '#d4af37' }}>🔒 Privada</span>
                                <div 
                                    onClick={() => setNuevaClase({...nuevaClase, esPublica: !nuevaClase.esPublica})}
                                    style={{ width: '45px', height: '24px', backgroundColor: nuevaClase.esPublica ? '#d4af37' : '#333', borderRadius: '24px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                >
                                    <div style={{ width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: nuevaClase.esPublica ? '24px' : '3px', transition: '0.3s' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: nuevaClase.esPublica ? '#d4af37' : '#555' }}>🌍 Pública</span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                            {nuevaClase.bloques.map((bloque, index) => (
                                <div key={bloque.id} style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', textAlign: 'left', boxSizing: 'border-box' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.8rem' }}>{bloque.tipo}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#111', padding: '3px 8px', borderRadius: '15px', border: '1px solid #333' }}>
                                            <input type="number" value={bloque.minutos} style={{ background: 'none', border: 'none', color: '#fff', width: '35px', fontSize: '0.9rem', textAlign: 'center' }}
                                                onChange={e => { const b = [...nuevaClase.bloques]; b[index].minutos = parseInt(e.target.value) || 0; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                            <span style={{ fontSize: '0.55rem', color: '#d4af37', fontWeight: 'bold' }}>MIN</span>
                                        </div>
                                    </div>

                                    {bloque.tipo === 'Calentamiento' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <textarea placeholder="Movilidad / Ligero" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '55px', fontSize: '0.85rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].ligero = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                            <textarea placeholder="Drills / Intenso" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '55px', fontSize: '0.85rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].intenso = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        </div>
                                    ) : bloque.tipo === 'CLA' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input placeholder="Modalidad (Ej. Media Guardia)" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.85rem', borderBottom: '1px solid #d4af37', padding: '6px' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].modalidad = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.modalidad || ''} />
                                            <input placeholder="Limitantes (Ej. Sin cierres de manos)" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.85rem', borderBottom: '1px solid #ff4444', padding: '6px' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].limitantes = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.limitantes || ''} />
                                            <input placeholder="Objetivo Atacante" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.85rem', padding: '6px' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].atacante = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.atacante || ''} />
                                            <input placeholder="Objetivo Defensor" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.85rem', padding: '6px' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].defensor = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.defensor || ''} />
                                        </div>
                                    ) : (
                                        <textarea placeholder="Detalles de Sparring" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '60px', fontSize: '0.85rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].contenido = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={agregarBloqueCLA} style={{ ...styles.btnOutline, padding: '12px', cursor: 'pointer', fontSize: '0.8rem' }}>+ AGREGAR BLOQUE CLA</button>
                            <button onClick={guardarClase} style={{ ...styles.btnGold, padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>GUARDAR CLASE</button>
                        </div>
                    </div>
                )}

                {/* VISTA: CLASE ACTIVA Y SCOUTING */}
                {modo === 'clase_activa' && claseSeleccionada && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '60px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                            {claseSeleccionada.bloques.map((b, i) => (
                                <div key={i} style={{ backgroundColor: '#0a0a0a', borderLeft: '4px solid #d4af37', padding: '15px', borderRadius: '8px', textAlign: 'left', boxSizing: 'border-box', border: '1px solid #222' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h4 style={{ color: '#d4af37', margin: 0, fontSize: '0.85rem' }}>{b.tipo}</h4>
                                        <button onClick={() => startTimerWithPrep(b.minutos)}
                                            style={{ background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 10px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' }}>
                                            INICIAR {b.minutos}M
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.5' }}>
                                        {b.tipo === 'Calentamiento' ? (
                                            <>
                                                <div style={{ marginBottom: '4px' }}><strong style={{ color: '#fff' }}>LIGERO:</strong> {b.ligero}</div>
                                                <div><strong style={{ color: '#fff' }}>INTENSO:</strong> {b.intenso}</div>
                                            </>
                                        ) : b.tipo === 'CLA' ? (
                                            <>
                                                {b.modalidad && <div style={{ marginBottom: '4px', color: '#fff' }}><strong>MOD:</strong> {b.modalidad}</div>}
                                                {b.limitantes && <div style={{ marginBottom: '6px', color: '#ff4444' }}><strong>LIMITANTE:</strong> {b.limitantes}</div>}
                                                <div style={{ marginBottom: '4px' }}><strong style={{ color: '#fff' }}>ATK:</strong> {b.atacante}</div>
                                                <div><strong style={{ color: '#fff' }}>DEF:</strong> {b.defensor}</div>
                                            </>
                                        ) : <div>{b.contenido}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* SECCIÓN SCOUTING RÁPIDO */}
                        <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #222', marginTop: '10px' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '12px' }}>SCOUTING & ASISTENCIA</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                {alumnos.map(a => (
                                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#000', padding: '10px', borderRadius: '8px', border: '1px solid #222' }}>
                                        <span style={{ flex: 1, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</span>
                                        <input placeholder="Nota..." style={{ ...styles.input, width: '75px', marginBottom: 0, padding: '6px', fontSize: '0.8rem' }} onBlur={(e) => e.target.value && registrarAsistenciaConNota(a.id, e.target.value)} />
                                        <button onClick={() => registrarAsistenciaConNota(a.id, "Asistió")} style={{ backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => { setModo('lista'); setTimerActive(false); }} style={{ ...styles.btnOutline, padding: '12px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '10px' }}>TERMINAR SESIÓN</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaneadorClasesPage;