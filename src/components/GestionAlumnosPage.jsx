import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, doc,
    updateDoc, query, setDoc
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { buildAlumnosQuery, vincularInstructorASede } from '../utils/teamsService';

// ── BLINDAJE Z-INDEX: Forzamos zIndex 9999 para alertas sobre capas modales ──
const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        customClass: { popup: 'gold-border-alert' },
        didOpen: (toast) => {
            if (toast.parentElement) {
                toast.parentElement.style.zIndex = '9999';
            }
        }
    });
};

const GestionAlumnosPage = ({ onBack, styles, usuario, sedeActual }) => {

    // --- ESTADOS PRINCIPALES ---
    const [alumnos, setAlumnos] = useState([]);
    const [verArchivados, setVerArchivados] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
    const [editandoId, setEditandoId] = useState(null);

    // NUEVO: Para vincular instructores con código de sede
    const [codigoVinculacion, setCodigoVinculacion] = useState("");
    const [vinculandoInstructor, setVinculandoInstructor] = useState(false);

    // --- CONFIGURACIÓN DE LA SEDE ---
    const [config, setConfig] = useState({
        nombre: sedeActual?.nombre || 'Mi Dojo',
        ciudad: sedeActual?.ciudad || '',
        logoBase64: sedeActual?.logoBase64 || '',
        horarios: sedeActual?.horarios || [],
        programas: sedeActual?.programas || ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        codigoAcceso: sedeActual?.codigoAcceso || ''
    });

    // Estados temporales para Horarios Pro
    const [tempHora, setTempHora] = useState("19:00");
    const [tempNombreClase, setTempNombreClase] = useState("");
    const [tempProgramaClase, setTempProgramaClase] = useState("BJJ Adultos");
    const [tempDiasClase, setTempDiasClase] = useState(["Lunes", "Miércoles", "Viernes"]);
    const [tempNuevoPrograma, setTempNuevoPrograma] = useState("");

    const diasSemanaDisponibles = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const toggleDiaTemp = (dia) => {
        setTempDiasClase(prev =>
            prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
        );
    };

    // --- ESTADO INICIAL DEL ALUMNO ---
    const estadoAlumnoInicial = {
        nombre: '', fotoBase64: '', edad: '', telefono: '', instagram: '',
        contactoEmergenciaNombre: '', contactoEmergenciaTel: '', parentescoEmergencia: '',
        condicionEspecial: '', medicamentos: '', alergias: '', tipoSangre: '',
        tieneExperiencia: 'no', tiempoExperiencia: '', gradoActual: '', academiaAnterior: '',
        programas: [], horarios: [],
        fechaPago: new Date().toISOString().split('T')[0],
        diaPago: new Date().getDate().toString(),
        montoMensualidad: '', notasTecnicas: '',
        activo: true, asistencias: [], historialTecnico: []
    };

    const [nuevo, setNuevo] = useState(estadoAlumnoInicial);

    // ── BLINDAJE DE IDs ──
    const teamId = usuario?.teamId || usuario?.academiaId || usuario?.uid;
    const rol = usuario?.rol || 'instructor';
    const esPropietario = rol === 'propietario' || rol === 'admin';
    const sedeIdEfectiva = sedeActual?.id || usuario?.sedeId || teamId;

    // ── 1. CARGA DE CONFIGURACIÓN DE LA SEDE ──
    useEffect(() => {
        if (!sedeIdEfectiva) return;

        const docRef = doc(db, "sedes", sedeIdEfectiva);
        const unsub = onSnapshot(docRef, async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig({
                    nombre: data.nombreSede || data.nombre || 'Mi Dojo',
                    ciudad: data.ciudad || '',
                    logoBase64: data.logoBase64 || data.logobase64 || '',
                    horarios: data.horarios || [],
                    programas: data.programas || ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
                    codigoAcceso: data.codigoAcceso || ''
                });
            }
        }, (error) => {
            console.error("Error cargando configuración de sede:", error);
        });

        return () => unsub();
    }, [sedeIdEfectiva]);

    // ── 2. ESCUCHA DE ALUMNOS ──
    useEffect(() => {
        if (!usuario || !teamId) return;

        const q = buildAlumnosQuery({
            rol: rol,
            teamId: teamId,
            sedeId: sedeIdEfectiva,
            soloArchivados: verArchivados
        });

        const unsub = onSnapshot(q,
            (snap) => {
                setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            },
            (error) => {
                console.error("Error en la bóveda de alumnos:", error);
                if (error.code === 'permission-denied') {
                    notify("No tienes permiso para ver estos alumnos.", 'error');
                }
            }
        );

        return () => unsub();
    }, [verArchivados, teamId, sedeIdEfectiva, usuario?.uid, rol]);

    // --- HANDLERS DE ARCHIVOS ---
    const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1048487) return notify("La foto es muy pesada. Máximo 1MB.", "error");
        const reader = new FileReader();
        reader.onloadend = () => setNuevo(prev => ({ ...prev, fotoBase64: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setConfig(prev => ({ ...prev, logoBase64: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleVincularInstructor = async () => {
        if (!codigoVinculacion.trim()) return notify("Pega un código válido.", "error");
        setVinculandoInstructor(true);
        try {
            const result = await vincularInstructorASede(usuario.uid, codigoVinculacion);
            notify(`Vinculado a ${result.nombreSede} exitosamente.`);
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            notify(e.message || "Error al vincular.", "error");
        } finally {
            setVinculandoInstructor(false);
        }
    };

    const calcularEstadoPago = (fechaVencimiento) => {
        if (verArchivados) return { label: 'INACTIVO', color: '#666' };
        if (!fechaVencimiento) return { label: 'SIN FECHA', color: '#666' };
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const vencimiento = new Date(fechaVencimiento); vencimiento.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) return { label: 'AL DÍA', color: '#4CAF50' };
        if (diffDays <= 3 && diffDays > 0) return { label: `VENCE ${diffDays}D`, color: '#ffbb33' };
        if (diffDays === 0) return { label: 'PAGA HOY', color: '#d4af37' };
        return { label: `ATRASADO (${Math.abs(diffDays)}d)`, color: '#ff4444' };
    };

    const handleGuardarAlumno = async () => {
        if (!nuevo.nombre || !nuevo.fechaPago) {
            return notify("Nombre y fecha de pago requeridos.", "error");
        }

        const dia = nuevo.fechaPago.split('-')[2];
        const idSede = sedeIdEfectiva || teamId;

        const payload = {
            ...nuevo,
            diaPago: dia,
            teamId: teamId,
            sedeId: idSede,
            academiaId: teamId,
            ultimaActualizacion: new Date().toISOString()
        };

        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

        try {
            if (editandoId) {
                await setDoc(doc(db, "alumnos", editandoId), payload, { merge: true });
            } else {
                await addDoc(collection(db, "alumnos"), {
                    ...payload,
                    fechaRegistro: new Date().toISOString(),
                    registradoPor: usuario.uid
                });
            }

            setMostrarForm(false);
            setEditandoId(null);
            setNuevo(estadoAlumnoInicial);
            notify("Operación exitosa 🛡️");
        } catch (e) {
            console.error("Error al guardar alumno:", e);
            notify(`Error al guardar: ${e.message}`, "error");
        }
    };

    const handleRegistrarPago = async (alumno) => {
        if (!window.confirm(`¿Registrar pago para ${alumno.nombre}?`)) return;
        try {
            const fechaActual = new Date(alumno.fechaPago);
            fechaActual.setMonth(fechaActual.getMonth() + 1);
            const nuevaFecha = fechaActual.toISOString().split('T')[0];
            await updateDoc(doc(db, "alumnos", alumno.id), {
                fechaPago: nuevaFecha,
                diaPago: nuevaFecha.split('-')[2]
            });
            notify("¡Pago registrado! 🛡️ OSS.");
        } catch (e) {
            notify("Error al actualizar el pago.", "error");
        }
    };

    const toggleSelection = (lista, item, campo) => {
        const actual = nuevo[campo] || [];
        const existe = actual.includes(item);
        setNuevo({ ...nuevo, [campo]: existe ? actual.filter(i => i !== item) : [...actual, item] });
    };

    if (!styles) return null;

    const nombreDisplay = sedeActual?.nombre || config.nombre || 'Mi Dojo';
    const ciudadDisplay = sedeActual?.ciudad || config.ciudad || '';

    return (
        <div style={{
            padding: '20px',
            paddingTop: 'calc(env(safe-area-inset-top, 20px) + 20px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 15px) + 15px)',
            paddingRight: 'calc(env(safe-area-inset-right, 15px) + 15px)',
            backgroundColor: '#000',
            minHeight: '100vh',
            color: '#fff',
            boxSizing: 'border-box'
        }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}>←</button>
                    
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {config.logoBase64 && (
                            <img src={config.logoBase64} alt="logo" style={{
                                width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover',
                                border: '1px solid #d4af37', filter: 'sepia(100%) hue-rotate(5deg) saturate(200%)'
                            }} />
                        )}
                        <div>
                            <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.2rem', letterSpacing: '1px' }}>
                                {nombreDisplay.toUpperCase()}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#888', letterSpacing: '1px' }}>
                                {ciudadDisplay}
                                {esPropietario && <span style={{ marginLeft: '6px', color: '#d4af37' }}>👑 PROPIETARIO</span>}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setEditandoConfig(true)}
                        style={{ ...styles.btnOutline, width: '40px', height: '40px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Configuración"
                    >
                        ⚙️
                    </button>
                </div>

                {/* BARRA DE ACCIONES RÁPIDAS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '10px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                    <button
                        onClick={() => setVerArchivados(!verArchivados)}
                        style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {verArchivados ? "VER ACTIVOS" : "VER ARCHIVO"}
                    </button>
                    <button
                        onClick={() => { setEditandoId(null); setNuevo(estadoAlumnoInicial); setMostrarForm(true); }}
                        style={{ ...styles.btnGold, width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                    >
                        + NUEVO
                    </button>
                </div>
            </div>

            {/* ── GRID DE ALUMNOS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {alumnos.length === 0 ? (
                    <div style={{ textAlign: 'center', gridColumn: '1/-1', marginTop: '50px', opacity: 0.6 }}>
                        <div style={{ fontSize: '2.5rem' }}>🥋</div>
                        <p style={{ fontSize: '0.9rem' }}>No se encontraron alumnos en esta sección.</p>
                        <p style={{ fontSize: '0.75rem', color: '#d4af37' }}>
                            {esPropietario ? "Gestiona tus sedes desde el Panel Maestro ⚙️" : "Verifica estar vinculado con el código correcto en ⚙️"}
                        </p>
                    </div>
                ) : (
                    alumnos.map(alumno => {
                        const pago = calcularEstadoPago(alumno.fechaPago);
                        return (
                            <div key={alumno.id} style={{
                                ...styles.card,
                                borderLeft: `5px solid ${pago.color}`,
                                position: 'relative',
                                padding: '15px',
                                borderRadius: '10px',
                                backgroundColor: '#0d0d0d'
                            }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{
                                        width: '55px', height: '55px', borderRadius: '50%',
                                        backgroundColor: '#111', overflow: 'hidden',
                                        border: `2px solid ${pago.color}`, flexShrink: 0
                                    }}>
                                        {alumno.fotoBase64
                                            ? <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ textAlign: 'center', lineHeight: '55px', fontSize: '1.2rem' }}>👤</div>
                                        }
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ margin: '0 0 3px 0', fontSize: '1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alumno.nombre.toUpperCase()}
                                        </h3>

                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                            {(alumno.programas || []).map((p, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.5rem', color: '#d4af37',
                                                    backgroundColor: '#d4af3711', padding: '1px 5px',
                                                    borderRadius: '3px', border: '1px solid #d4af3744', fontWeight: 'bold'
                                                }}>{p}</span>
                                            ))}
                                        </div>

                                        <span style={{ fontSize: '0.7rem', color: pago.color, fontWeight: 'bold' }}>
                                            ● {pago.label}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                        <button
                                            onClick={() => { setNuevo(alumno); setEditandoId(alumno.id); setMostrarForm(true); }}
                                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                                        >
                                            EDITAR
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const msj = alumno.activo ? "¿Mover al Archivo (Inactivos)?" : "¿Reactivar guerrero?";
                                                const result = await Swal.fire({
                                                    text: msj, icon: 'question', showCancelButton: true,
                                                    confirmButtonText: 'SÍ', cancelButtonText: 'NO',
                                                    background: '#0a0a0a', color: '#fff',
                                                    confirmButtonColor: '#d4af37', cancelButtonColor: '#222'
                                                });
                                                if (result.isConfirmed) {
                                                    try {
                                                        await updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                                                        notify(alumno.activo ? 'Enviado al Archivo' : 'Reactivado');
                                                    } catch (error) {
                                                        notify("Error al actualizar estado.", "error");
                                                    }
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                                        >
                                            {alumno.activo ? 'ARCHIVAR' : 'RESTAURAR'}
                                        </button>

                                        {!verArchivados && (
                                            <button
                                                onClick={() => handleRegistrarPago(alumno)}
                                                style={{
                                                    background: '#d4af3722', border: '1px solid #d4af37',
                                                    borderRadius: '4px', color: '#d4af37',
                                                    padding: '3px 6px', fontSize: '0.65rem',
                                                    cursor: 'pointer', fontWeight: 'bold'
                                                }}
                                            >
                                                $ COBRAR
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{
                                    marginTop: '12px', paddingTop: '10px',
                                    borderTop: '1px solid #1a1a1a',
                                    display: 'flex', justifyContent: 'space-between',
                                    fontSize: '0.7rem', alignItems: 'center'
                                }}>
                                    <span
                                        onClick={() => setAlumnoSeleccionado(alumno)}
                                        style={{ color: '#d4af37', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        📄 EXPEDIENTE
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', color: '#777' }}>
                                        <span>📱 {alumno.telefono || '---'}</span>
                                        <span>📸 {alumno.instagram || '@---'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── MODAL REGISTRO / EDICIÓN ALUMNO ── */}
            {mostrarForm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.92)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', // Alineado arriba
                    zIndex: 2000, padding: '20px 12px', boxSizing: 'border-box' // Margen de 20px superior
                }}>
                    <div style={{
                        ...styles.card,
                        width: '100%', maxWidth: '550px', 
                        maxHeight: 'calc(100vh - 40px)', // Restringe la altura máxima
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', padding: 0,
                        boxSizing: 'border-box', border: '1px solid #d4af37'
                    }}>
                        {/* Header Fijo */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', backgroundColor: '#0a0a0a', flexShrink: 0 }}>
                            <h2 style={{ ...styles.goldTitle, textAlign: 'center', margin: 0, fontSize: '1.1rem' }}>
                                {editandoId ? 'ACTUALIZAR GUERRERO' : 'REGISTRAR ALUMNO'}
                            </h2>
                        </div>

                        {/* Cuerpo con Scroll Corregido */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', boxSizing: 'border-box', minHeight: 0 }}>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#111', margin: '0 auto 8px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '1.5rem' }}>📷</span>}
                                </div>
                                <input id="fotoInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                                <label style={{ fontSize: '0.65rem', color: '#d4af37', cursor: 'pointer' }}>FOTO DE PERFIL</label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px' }}>I. DATOS PERSONALES</p>
                                    <input placeholder="Nombre completo" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <input placeholder="Edad" type="number" style={{ ...styles.input, flex: 1, boxSizing: 'border-box' }} value={nuevo.edad} onChange={e => setNuevo({ ...nuevo, edad: e.target.value })} />
                                        <input placeholder="WhatsApp" style={{ ...styles.input, flex: 2, boxSizing: 'border-box' }} value={nuevo.telefono} onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })} />
                                    </div>
                                    <input placeholder="Instagram (@usuario)" style={{ ...styles.input, width: '100%', marginTop: '8px', boxSizing: 'border-box' }} value={nuevo.instagram} onChange={e => setNuevo({ ...nuevo, instagram: e.target.value })} />
                                </div>

                                <div>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px' }}>II. SALUD Y EMERGENCIA</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input placeholder="Tipo de Sangre" style={{ ...styles.input, boxSizing: 'border-box' }} value={nuevo.tipoSangre} onChange={e => setNuevo({ ...nuevo, tipoSangre: e.target.value })} />
                                        <input placeholder="Alergias" style={{ ...styles.input, boxSizing: 'border-box' }} value={nuevo.alergias} onChange={e => setNuevo({ ...nuevo, alergias: e.target.value })} />
                                    </div>
                                    <input placeholder="Condiciones médicas / Lesiones" style={{ ...styles.input, width: '100%', marginTop: '8px', boxSizing: 'border-box' }} value={nuevo.condicionEspecial} onChange={e => setNuevo({ ...nuevo, condicionEspecial: e.target.value })} />
                                    <div style={{ backgroundColor: '#111', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
                                        <label style={{ fontSize: '0.65rem', color: '#888', display: 'block', marginBottom: '6px' }}>CONTACTO DE EMERGENCIA:</label>
                                        <input placeholder="Nombre" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={nuevo.contactoEmergenciaNombre} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaNombre: e.target.value })} />
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <input placeholder="Teléfono" style={{ ...styles.input, flex: 1, boxSizing: 'border-box' }} value={nuevo.contactoEmergenciaTel} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaTel: e.target.value })} />
                                            <input placeholder="Parentesco" style={{ ...styles.input, flex: 1, boxSizing: 'border-box' }} value={nuevo.parentescoEmergencia} onChange={e => setNuevo({ ...nuevo, parentescoEmergencia: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px' }}>III. EXPERIENCIA PREVIA</p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.75rem' }}>¿Tiene experiencia?</label>
                                        <select style={{ ...styles.input, flex: 1, boxSizing: 'border-box' }} value={nuevo.tieneExperiencia} onChange={e => setNuevo({ ...nuevo, tieneExperiencia: e.target.value })}>
                                            <option value="no">No</option>
                                            <option value="si">Sí</option>
                                        </select>
                                    </div>
                                    {nuevo.tieneExperiencia === 'si' && (
                                        <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <input placeholder="Grado / Cinturón" style={{ ...styles.input, boxSizing: 'border-box' }} value={nuevo.gradoActual} onChange={e => setNuevo({ ...nuevo, gradoActual: e.target.value })} />
                                            <input placeholder="Tiempo" style={{ ...styles.input, boxSizing: 'border-box' }} value={nuevo.tiempoExperiencia} onChange={e => setNuevo({ ...nuevo, tiempoExperiencia: e.target.value })} />
                                            <input placeholder="Academia anterior" style={{ ...styles.input, gridColumn: '1/-1', boxSizing: 'border-box' }} value={nuevo.academiaAnterior} onChange={e => setNuevo({ ...nuevo, academiaAnterior: e.target.value })} />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '6px' }}>IV. PROGRAMAS</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {(config.programas || []).map(p => (
                                            <div key={p}
                                                onClick={() => toggleSelection(config.programas, p, 'programas')}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '15px', fontSize: '0.7rem', cursor: 'pointer',
                                                    border: `1px solid ${nuevo.programas?.includes(p) ? '#d4af37' : '#333'}`,
                                                    backgroundColor: nuevo.programas?.includes(p) ? '#d4af37' : 'transparent',
                                                    color: nuevo.programas?.includes(p) ? '#000' : '#fff'
                                                }}>
                                                {p}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px' }}>V. ADMINISTRATIVO</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.6rem', color: '#888' }}>PRÓXIMO PAGO:</label>
                                            <input type="date" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={nuevo.fechaPago} onChange={e => setNuevo({ ...nuevo, fechaPago: e.target.value })} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.6rem', color: '#888' }}>MONTO ($):</label>
                                            <input placeholder="0.00" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={nuevo.montoMensualidad} onChange={e => setNuevo({ ...nuevo, montoMensualidad: e.target.value })} />
                                        </div>
                                    </div>
                                    <textarea placeholder="Notas de scouting o seguimiento técnico..." style={{ ...styles.input, width: '100%', height: '80px', marginTop: '10px', resize: 'none', boxSizing: 'border-box' }} value={nuevo.notasTecnicas} onChange={e => setNuevo({ ...nuevo, notasTecnicas: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Footer Fijo con Botones Contenidos */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #222', backgroundColor: '#0a0a0a', display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={handleGuardarAlumno} style={{ ...styles.btnGold, flex: 2, padding: '12px' }}>
                                {editandoId ? 'GUARDAR' : 'REGISTRAR'}
                            </button>
                            <button onClick={() => setMostrarForm(false)} style={{ ...styles.btnOutline, flex: 1, padding: '12px' }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EXPEDIENTE COMPLETO ── */}
            {alumnoSeleccionado && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.95)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    zIndex: 3000, padding: '20px 12px', boxSizing: 'border-box'
                }}>
                    <div style={{
                        ...styles.card,
                        width: '100%', maxWidth: '650px', 
                        maxHeight: 'calc(100vh - 40px)',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', border: '1px solid #d4af37',
                        padding: 0, boxSizing: 'border-box'
                    }}>
                        {/* Cuerpo con Scroll Corregido */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', boxSizing: 'border-box', minHeight: 0 }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '20px' }}>
                                <div style={{ width: '100px', height: '100px', borderRadius: '12px', border: '2px solid #d4af37', overflow: 'hidden', flexShrink: 0 }}>
                                    {alumnoSeleccionado.fotoBase64 ? <img src={alumnoSeleccionado.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ fontSize: '3rem', textAlign: 'center', lineHeight: '100px' }}>👤</div>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h1 style={{ ...styles.goldTitle, fontSize: '1.4rem', margin: '0 0 5px 0' }}>{alumnoSeleccionado.nombre.toUpperCase()}</h1>
                                    <p style={{ color: '#4CAF50', fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '0.75rem' }}>ESTADO: {alumnoSeleccionado.activo ? 'ACTIVO' : 'ARCHIVADO'}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.8rem' }}>
                                        <div><span style={{ color: '#777' }}>EDAD:</span> {alumnoSeleccionado.edad || '---'}</div>
                                        <div><span style={{ color: '#777' }}>TEL:</span> {alumnoSeleccionado.telefono || '---'}</div>
                                        <div><span style={{ color: '#777' }}>IG:</span> {alumnoSeleccionado.instagram || '---'}</div>
                                        <div><span style={{ color: '#777' }}>SANGRE:</span> {alumnoSeleccionado.tipoSangre || '---'}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                <div>
                                    <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px', fontSize: '0.85rem' }}>SALUD Y SEGURIDAD</h4>
                                    <p style={{ fontSize: '0.8rem' }}><strong style={{ color: '#777' }}>Alergias:</strong> {alumnoSeleccionado.alergias || 'Ninguna'}</p>
                                    <p style={{ fontSize: '0.8rem' }}><strong style={{ color: '#777' }}>Condiciones:</strong> {alumnoSeleccionado.condicionEspecial || 'Ninguna'}</p>
                                    <div style={{ backgroundColor: '#111', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.7rem', color: '#d4af37', fontWeight: 'bold' }}>CONTACTO DE EMERGENCIA:</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem' }}>{alumnoSeleccionado.contactoEmergenciaNombre || '---'}</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#4CAF50' }}>{alumnoSeleccionado.contactoEmergenciaTel} ({alumnoSeleccionado.parentescoEmergencia})</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px', fontSize: '0.85rem' }}>INFORMACIÓN TÉCNICA</h4>
                                    <p style={{ fontSize: '0.8rem' }}><strong style={{ color: '#777' }}>Programas:</strong> {alumnoSeleccionado.programas?.join(', ') || 'Ninguno'}</p>
                                    <p style={{ fontSize: '0.8rem' }}><strong style={{ color: '#777' }}>Grado/Exp:</strong> {alumnoSeleccionado.gradoActual || 'Blanco'} ({alumnoSeleccionado.tiempoExperiencia || 'Iniciante'})</p>
                                </div>

                                <div>
                                    <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px', fontSize: '0.85rem' }}>BITÁCORA TÉCNICA</h4>
                                    <textarea id="areaNotas" defaultValue={alumnoSeleccionado.notasTecnicas} style={{ ...styles.input, width: '100%', height: '100px', marginTop: '8px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                    <button
                                        onClick={async () => {
                                            const txt = document.getElementById('areaNotas').value;
                                            await updateDoc(doc(db, "alumnos", alumnoSeleccionado.id), { notasTecnicas: txt });
                                            notify("Bitácora actualizada. Oss!");
                                        }}
                                        style={{ ...styles.btnGold, marginTop: '8px', width: '100%', padding: '10px', boxSizing: 'border-box' }}
                                    >
                                        GUARDAR BITÁCORA
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer Fijo */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #222', backgroundColor: '#0a0a0a', flexShrink: 0 }}>
                            <button onClick={() => setAlumnoSeleccionado(null)} style={{ ...styles.btnOutline, width: '100%', padding: '12px', boxSizing: 'border-box' }}>CERRAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL CONFIGURACIÓN DE SEDE (PROFESIONAL Y CENTRADO) ── */}
            {editandoConfig && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.92)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    zIndex: 4000, padding: '20px 12px', boxSizing: 'border-box'
                }}>
                    <div style={{
                        ...styles.card,
                        width: '100%', maxWidth: '520px',
                        maxHeight: 'calc(100vh - 40px)',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', padding: 0,
                        border: '1px solid #d4af37',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
                        boxSizing: 'border-box'
                    }}>
                        {/* Header Fijo */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', backgroundColor: '#0a0a0a', flexShrink: 0 }}>
                            <h3 style={{ ...styles.goldTitle, textAlign: 'center', margin: 0, fontSize: '1.1rem' }}>CONFIGURACIÓN DE SEDE</h3>
                        </div>

                        {/* Cuerpo con Scroll Corregido */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', boxSizing: 'border-box', minHeight: 0 }}>
                            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                                <div onClick={() => document.getElementById('logoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '12px', backgroundColor: '#111', margin: '0 auto 8px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {config.logoBase64 ? <img src={config.logoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(100%) hue-rotate(5deg) saturate(200%)' }} alt="Logo" /> : <span style={{ fontSize: '1.8rem' }}>🏯</span>}
                                </div>
                                <input id="logoInput" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                                <p style={{ fontSize: '0.6rem', color: '#d4af37', fontWeight: 'bold' }}>LOGO OFICIAL (MONOCROMÁTICO ORO)</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: '#888', display: 'block', marginBottom: '4px' }}>NOMBRE DE LA SEDE:</label>
                                    <input placeholder="Nombre de la Sede" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={config.nombre} onChange={e => setConfig({ ...config, nombre: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: '#888', display: 'block', marginBottom: '4px' }}>CIUDAD / UBICACIÓN:</label>
                                    <input placeholder="Ciudad" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={config.ciudad} onChange={e => setConfig({ ...config, ciudad: e.target.value })} />
                                </div>
                            </div>

                            {config.codigoAcceso && (
                                <div style={{ marginBottom: '20px', backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '8px', border: '1px solid #d4af3733' }}>
                                    <p style={{ fontSize: '0.6rem', color: '#d4af37', fontWeight: 'bold', margin: '0 0 6px 0' }}>CÓDIGO DE ACCESO (INSTRUCTORES):</p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <code style={{ flex: 1, background: '#000', padding: '8px', borderRadius: '4px', fontSize: '0.9rem', color: '#fff', border: '1px solid #222', letterSpacing: '2px', textAlign: 'center' }}>
                                            {config.codigoAcceso}
                                        </code>
                                        <button onClick={() => { navigator.clipboard.writeText(config.codigoAcceso); notify("Código copiado."); }} style={{ ...styles.btnGold, width: 'auto', padding: '8px 12px' }}>📋</button>
                                    </div>
                                </div>
                            )}

                            {!esPropietario && (
                                <div style={{ marginBottom: '20px', borderTop: '1px solid #222', paddingTop: '15px' }}>
                                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '10px' }}>VINCULAR OTRA SEDE:</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input placeholder="Código..." style={{ ...styles.input, flex: 1, boxSizing: 'border-box', textTransform: 'uppercase' }} value={codigoVinculacion} onChange={e => setCodigoVinculacion(e.target.value.toUpperCase())} />
                                        <button onClick={handleVincularInstructor} disabled={vinculandoInstructor} style={{ ...styles.btnOutline, width: 'auto', padding: '0 12px', fontSize: '0.65rem' }}>
                                            {vinculandoInstructor ? '...' : 'VINCULAR'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PROGRAMAS */}
                            <div style={{ marginBottom: '20px', padding: '12px', border: '1px solid #222', borderRadius: '10px', backgroundColor: '#050505', boxSizing: 'border-box' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.75rem', marginBottom: '10px', fontWeight: 'bold' }}>PROGRAMAS / DISCIPLINAS:</p>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                    <input placeholder="Ej. Luta Livre, Competencia..." style={{ ...styles.input, flex: 1, boxSizing: 'border-box' }} value={tempNuevoPrograma} onChange={e => setTempNuevoPrograma(e.target.value)} />
                                    <button onClick={() => {
                                        if (!tempNuevoPrograma.trim()) return;
                                        setConfig({ ...config, programas: [...(config.programas || []), tempNuevoPrograma.trim()] });
                                        setTempNuevoPrograma("");
                                    }} style={{ ...styles.btnGold, width: '40px' }}>+</button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {(config.programas || []).map((p, i) => (
                                        <span key={i} style={{ backgroundColor: '#151515', border: '1px solid #d4af3733', padding: '4px 10px', borderRadius: '15px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#d4af37' }}>
                                            {p}
                                            <b onClick={() => setConfig({ ...config, programas: config.programas.filter((_, idx) => idx !== i) })} style={{ cursor: 'pointer', color: '#ff4444' }}>×</b>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* HORARIOS PROFESIONALES */}
                            <div style={{ padding: '12px', border: '1px solid #222', borderRadius: '10px', backgroundColor: '#050505', boxSizing: 'border-box' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.75rem', marginBottom: '10px', fontWeight: 'bold' }}>HORARIOS DE CLASE:</p>
                                
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ width: '110px' }}>
                                        <label style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginBottom: '2px' }}>HORA:</label>
                                        <input type="time" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={tempHora} onChange={e => setTempHora(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginBottom: '2px' }}>TIPO / PROGRAMA:</label>
                                        <select style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={tempProgramaClase} onChange={e => setTempProgramaClase(e.target.value)}>
                                            {(config.programas || []).map(prog => (
                                                <option key={prog} value={prog}>{prog}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginBottom: '2px' }}>NOMBRE DE LA CLASE:</label>
                                    <input placeholder="Ej. Técnica, Fundamentos, Sparring" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={tempNombreClase} onChange={e => setTempNombreClase(e.target.value)} />
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginBottom: '4px' }}>DÍAS QUE SE IMPARTE:</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {diasSemanaDisponibles.map(dia => {
                                            const activo = tempDiasClase.includes(dia);
                                            return (
                                                <span
                                                    key={dia}
                                                    onClick={() => toggleDiaTemp(dia)}
                                                    style={{
                                                        fontSize: '0.6rem', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                                                        backgroundColor: activo ? '#d4af37' : '#151515',
                                                        color: activo ? '#000' : '#aaa',
                                                        border: `1px solid ${activo ? '#d4af37' : '#333'}`,
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {dia.substring(0, 3)}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button onClick={() => {
                                    if (!tempNombreClase.trim()) return notify("Ingresa el nombre de la clase.", "error");
                                    if (tempDiasClase.length === 0) return notify("Selecciona al menos un día.", "error");
                                    
                                    const nH = {
                                        hora: tempHora,
                                        programa: tempProgramaClase,
                                        nombre: tempNombreClase.trim(),
                                        dias: tempDiasClase
                                    };
                                    setConfig({ ...config, horarios: [...(config.horarios || []), nH].sort((a, b) => a.hora.localeCompare(b.hora)) });
                                    setTempNombreClase("");
                                }} style={{ ...styles.btnGold, width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.75rem' }}>+ AÑADIR HORARIO</button>

                                <div style={{ marginTop: '12px', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {(config.horarios || []).map((h, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#111', borderRadius: '6px', fontSize: '0.7rem', alignItems: 'center', border: '1px solid #222' }}>
                                            <div>
                                                <b style={{ color: '#d4af37' }}>{h.hora}</b> — <span style={{ color: '#4CAF50' }}>[{h.programa}]</span> {h.nombre}
                                                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>Días: {h.dias?.join(', ') || 'No especificados'}</div>
                                            </div>
                                            <b onClick={() => setConfig({ ...config, horarios: config.horarios.filter((_, idx) => idx !== i) })} style={{ cursor: 'pointer', color: '#ff4444', fontSize: '1rem', padding: '0 6px' }}>×</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Fijo con Botones Contenidos */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #222', backgroundColor: '#0a0a0a', display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button onClick={async () => {
                                const idSedeParaGuardar = sedeIdEfectiva || teamId;
                                try {
                                    await setDoc(doc(db, "sedes", idSedeParaGuardar), {
                                        ...config,
                                        ultimaActualizacion: new Date().toISOString()
                                    }, { merge: true });
                                    setEditandoConfig(false);
                                    notify("¡Configuración guardada! OSS.");
                                } catch (error) {
                                    notify("Error al guardar.", "error");
                                }
                            }} style={{ ...styles.btnGold, flex: 1, padding: '12px' }}>
                                GUARDAR
                            </button>
                            <button onClick={() => setEditandoConfig(false)} style={{ ...styles.btnOutline, flex: 1, padding: '12px' }}>CERRAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionAlumnosPage;