import React, { useState, useEffect } from 'react';
// IMPORTANTE: Ajuste de ruta para Firebase
import { db } from '../firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
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
        icon: tipo, // 'success', 'error', 'warning', 'info'
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
                text: "¡Atención! Tienes una sesión de entrenamiento activa. Si sales ahora, el cronómetro se detendrá y perderás el progreso actual.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'SÍ, ABANDONAR',
                cancelButtonText: 'MANTENER SESIÓN',
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#ff4444', // Rojo para advertencia de pérdida de datos
                cancelButtonColor: '#d4af37', // Dorado para quedarse
                iconColor: '#ff4444'
            });

            if (!result.isConfirmed) return;
        }

        setTimerActive(false);
        onBack();
    };

    // 1. Necesitamos referencias persistentes para el audio y el bloqueo de pantalla
    const audioCtxRef = React.useRef(null);
    const wakeLockRef = React.useRef(null);

    // Función para asegurar que el audio esté "despierto" en móviles
    const initAudio = async () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
        }
    };

    // Función para evitar que el celular se apague (Wake Lock)
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
            // Usamos la referencia persistente
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

            // VIBRACIÓN: Si el audio falla o está en silencio, el alumno siente el round
            if (forceVibrate && "vibrate" in navigator) {
                navigator.vibrate(duration * 200); // Vibra proporcional a la duración
            }
        } catch (e) { console.error("Audio error", e); }
    };

    const playTripleCampana = () => {
        playBeep(1200, 1, true); // Añadimos vibración al final
        setTimeout(() => playBeep(1200, 1, false), 300);
        setTimeout(() => playBeep(1200, 2, true), 600);
    };

    // --- CAMBIO CLAVE EN EL INICIO DEL TIMER ---
    const startTimerWithPrep = async (minutos) => {
        // ESTO DESBLOQUEA EL CELULAR: Debe ser gatillado por el click del usuario
        await initAudio();
        await requestWakeLock();
        setCurrentTargetTime(minutos * 60);
        setTimeLeft(10);
        setIsPrepTime(true);
        setTimerActive(true);
        playBeep(500, 2, true);
    };

    // --- LÓGICA DE FIREBASE (Se queda exactamente como está en tu código) ---
    useEffect(() => {
        if (!usuario || !usuario.uid) return;

        const teamIdEfectivo = usuario.teamId || usuario.academiaId;
        if (!teamIdEfectivo) return;

        let unsubClases = null;
        let unsubAlumnos = null;

        const cargarDatos = () => {
            try {
                // 1. CARGAR CLASES (Cumpliendo reglas de seguridad)
                const qClases = query(
                    collection(db, "clases"),
                    where("teamId", "==", teamIdEfectivo)
                );
                unsubClases = onSnapshot(qClases, (snap) => {
                    setClases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.error("Error cargando clases:", err));

                // 2. CARGAR ALUMNOS (Para el Scouting)
                const qAlumnos = query(
                    collection(db, "alumnos"),
                    where("teamId", "==", teamIdEfectivo)
                );
                unsubAlumnos = onSnapshot(qAlumnos, (snap) => {
                    setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.error("Error cargando alumnos:", err));

            } catch (err) {
                console.error("Error al iniciar suscripciones:", err);
            }
        };

        cargarDatos();

        return () => {
            if (unsubClases) unsubClases();
            if (unsubAlumnos) unsubAlumnos();
        };
    }, [usuario]);


    // =================================================================
    // 👇 NUEVO BLOQUE EXCLUSIVO PARA EL TIMER (Añádelo aquí abajo) 👇
    // =================================================================
    useEffect(() => {
        let intervalo = null;

        if (timerActive && timeLeft > 0) {
            intervalo = setInterval(() => {
                setTimeLeft((prevTiempo) => prevTiempo - 1);
            }, 1000);
        } else if (timerActive && timeLeft === 0) {
            // El tiempo llegó a cero, evaluamos si era preparación o el round activo
            if (isPrepTime) {
                // Terminaron los 10 segundos de preparación, suena la triple campana e inicia el round real
                playTripleCampana();
                setIsPrepTime(false);
                setTimeLeft(currentTargetTime);
            } else {
                // Terminó el round de la clase, suena pitido largo y paramos el timer
                playBeep(800, 3, true);
                setTimerActive(false);
            }
        }

        // Limpieza fundamental para que el reloj no se vuelva loco si pausas o sales
        return () => {
            if (intervalo) clearInterval(intervalo);
        };
    }, [timerActive, timeLeft, isPrepTime, currentTargetTime]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // --- DATOS ---
    const estadoInicial = {
        titulo: '',
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
            modalidad: '',   // NUEVO
            limitantes: '',  // NUEVO
            atacante: '',
            defensor: '',
            rondas: ['', '', ''],
            intensidad: 1,
            minutos: 3
        };
        nuevosBloques.splice(nuevosBloques.length - 1, 0, bloqueCLA);
        setNuevaClase({ ...nuevaClase, bloques: nuevosBloques });
    };

    const guardarClase = async () => {
        if (!nuevaClase.titulo) return notify("Falta título", "error");

        try {
            const teamIdEfectivo = usuario.teamId || usuario.academiaId;

            await addDoc(collection(db, "clases"), {
                ...nuevaClase,
                teamId: teamIdEfectivo, // Vital para la regla de seguridad
                creadoPor: usuario.uid,
                fechaRegistro: new Date().toISOString()
            });

            notify("Clase forjada con éxito", "success");
            setModo('lista');
            setNuevaClase(estadoInicial);
        } catch (e) {
            console.error(e);
            notify("Error al guardar la clase. Revisa permisos.", "error");
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
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>

            {/* TIMER STICKY RESPONSIVE */}
            {modo === 'clase_activa' && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    backgroundColor: isPrepTime ? '#ff4444' : '#d4af37',
                    color: '#000', padding: '10px 15px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', boxSizing: 'border-box'
                }}>
                    <div>
                        <span style={{ fontSize: '1.8rem', fontWeight: '900', fontFamily: 'monospace' }}>{formatTime(timeLeft)}</span>
                        <div style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '-5px' }}>
                            {isPrepTime ? 'PREPARACIÓN' : 'TIEMPO ACTIVO'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setTimerActive(!timerActive)} style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}>
                            {timerActive ? 'PAUSA' : 'RESUME'}
                        </button>
                        <button onClick={() => { setTimerActive(false); setTimeLeft(0); }} style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid #000', borderRadius: '8px', width: '40px' }}>⏹</button>
                    </div>
                </div>
            )}

            <div style={{ padding: '15px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <button onClick={intentarVolver} style={{ ...styles.btnOutline, width: '40px', height: '40px' }}>←</button>
                    <div style={{ textAlign: 'right' }}>
                        <h2 style={{ color: '#d4af37', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>LA FORTUNA</h2>
                        <span style={{ fontSize: '0.6rem', color: '#666' }}>CLA PLANNER</span>
                    </div>
                </div>

                {/* VISTA: LISTA (GRID ADAPTABLE) */}
                {modo === 'lista' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax( 300 px, 1fr))', gap: '12px' }}>
                        <button onClick={() => setModo('crear')} style={{ ...styles.btnGold, padding: '15px', gridColumn: '1 / -1' }}>+ NUEVA SESIÓN</button>
                        {clases.map(c => (
                            <div key={c.id} style={{ display: 'flex', gap: '8px', boxSizing: 'border-box' }}>
                                <div onClick={() => { setClaseSeleccionada(c); setModo('clase_activa'); }}
                                    style={{ ...styles.card, flex: 1, textAlign: 'left', padding: '12px', boxSizing: 'border-box' }}>
                                    <h3 style={{ margin: 0, color: '#d4af37', fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.titulo.toUpperCase()}</h3>
                                    <span style={{ fontSize: '0.6rem', color: '#666' }}>{c.fecha}</span>
                                </div>
                                <button onClick={() => { if (window.confirm("¿Borrar?")) deleteDoc(doc(db, "clases", c.id)) }} style={{ background: '#111', border: '1px solid #333', color: '#555', padding: '10px', borderRadius: '8px' }}>🗑</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* VISTA: CREAR (BOX-SIZING CORREGIDO) */}
                {modo === 'crear' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px', paddingBottom: '100px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <input placeholder="TÍTULO DE LA SESIÓN" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', textAlign: 'center', borderBottom: '2px solid #d4af37' }} onChange={e => setNuevaClase({ ...nuevaClase, titulo: e.target.value })} />
                        </div>

                        {nuevaClase.bloques.map((bloque, index) => (
                            <div key={bloque.id} style={{ ...styles.card, padding: '15px', border: '1px solid #222', textAlign: 'left', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.8rem' }}>{bloque.tipo}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#111', padding: '4px 10px', borderRadius: '20px', border: '1px solid #333' }}>
                                        <input type="number" value={bloque.minutos} style={{ background: 'none', border: 'none', color: '#fff', width: '35px', fontSize: '0.9rem', textAlign: 'center' }}
                                            onChange={e => { const b = [...nuevaClase.bloques]; b[index].minutos = parseInt(e.target.value) || 0; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        <span style={{ fontSize: '0.6rem', color: '#d4af37', fontWeight: 'bold' }}>MIN</span>
                                    </div>
                                </div>

                                {bloque.tipo === 'Calentamiento' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                        <textarea placeholder="Movilidad / Ligero" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '60px', fontSize: '0.8rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].ligero = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                        <textarea placeholder="Drills / Intenso" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '60px', fontSize: '0.8rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].intenso = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                    </div>
                                ) : bloque.tipo === 'CLA' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                        <input placeholder="Modalidad (Ej. Media Guardia)" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.8rem', borderBottom: '1px solid #d4af37' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].modalidad = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.modalidad || ''} />
                                        <input placeholder="Limitantes (Ej. Solo pases por arriba)" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.8rem', borderBottom: '1px solid #ff4444' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].limitantes = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.limitantes || ''} />
                                        <input placeholder="Objetivo Atacante" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].atacante = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.atacante || ''} />
                                        <input placeholder="Objetivo Defensor" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].defensor = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} value={bloque.defensor || ''} />
                                    </div>
                                ) : (
                                    <textarea placeholder="Detalles de Sparring" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', height: '60px', fontSize: '0.8rem', resize: 'none' }} onChange={e => { const b = [...nuevaClase.bloques]; b[index].contenido = e.target.value; setNuevaClase({ ...nuevaClase, bloques: b }); }} />
                                )}
                            </div>
                        ))}
                        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={agregarBloqueCLA} style={{ ...styles.btnOutline, padding: '12px' }}>+ BLOQUE</button>
                            <button onClick={guardarClase} style={{ ...styles.btnGold, padding: '15px' }}>GUARDAR CLASE</button>
                        </div>
                    </div>
                )}

                {/* VISTA: CLASE ACTIVA (GRID ADAPTABLE) */}
                {modo === 'clase_activa' && claseSeleccionada && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px', paddingBottom: '100px' }}>
                        {claseSeleccionada.bloques.map((b, i) => (
                            <div key={i} style={{ ...styles.card, borderLeft: '4px solid #d4af37', padding: '15px', textAlign: 'left', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h4 style={{ color: '#d4af37', margin: 0, fontSize: '0.9rem' }}>{b.tipo}</h4>
                                    <button onClick={() => startTimerWithPrep(b.minutos)}
                                        style={{ background: '#d4af37', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', fontSize: '0.7rem' }}>
                                        INICIAR {b.minutos}M
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.5' }}>
                                    {b.tipo === 'Calentamiento' ? (
                                        <>
                                            <div style={{ marginBottom: '5px' }}><strong>LIGERO:</strong> {b.ligero}</div>
                                            <div><strong>INTENSO:</strong> {b.intenso}</div>
                                        </>
                                    ) : b.tipo === 'CLA' ? (
                                        <>
                                            {b.modalidad && <div style={{ marginBottom: '5px', color: '#fff' }}><strong>MODALIDAD:</strong> {b.modalidad}</div>}
                                            {b.limitantes && <div style={{ marginBottom: '8px', color: '#ff4444' }}><strong>LIMITANTES:</strong> {b.limitantes}</div>}
                                            <div style={{ marginBottom: '5px' }}><strong>ATK:</strong> {b.atacante}</div>
                                            <div><strong>DEF:</strong> {b.defensor}</div>
                                        </>
                                    ) : <div>{b.contenido}</div>}
                                </div>
                            </div>
                        ))}

                        {/* Scouting section responsiva */}
                        <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '15px', gridColumn: '1 / -1' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px' }}>SCOUTING RÁPIDO</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                                {alumnos.map(a => (
                                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#000', padding: '10px', borderRadius: '8px', border: '1px solid #222' }}>
                                        <span style={{ flex: 1, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</span>
                                        <input placeholder="Nota" style={{ ...styles.input, width: '70px', marginBottom: 0, padding: '5px', fontSize: '0.7rem' }} onBlur={(e) => e.target.value && registrarAsistenciaConNota(a.id, e.target.value)} />
                                        <button onClick={() => registrarAsistenciaConNota(a.id, "Asistió")} style={{ backgroundColor: '#d4af37', border: 'none', padding: '8px 12px', borderRadius: '4px' }}>✓</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => { setModo('lista'); setTimerActive(false); }} style={{ ...styles.btnOutline, padding: '15px', gridColumn: '1 / -1' }}>TERMINAR SESIÓN</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaneadorClasesPage;