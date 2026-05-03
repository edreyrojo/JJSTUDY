import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, doc,
    updateDoc, query, orderBy, where,
    getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { buildAlumnosQuery, vincularInstructorASede } from '../utils/teamsService';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        border: '1px solid #d4af37',
        customClass: { popup: 'gold-border-alert' }
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS NUEVAS vs v1:
//   usuario.rol        → 'propietario' | 'instructor'
//   usuario.teamId     → ID del team al que pertenece
//   usuario.sedeId     → ID de la sede específica del usuario
//   sedeActual         → Objeto con datos de la sede (puede venir del PanelMaestro)
// ─────────────────────────────────────────────────────────────────────────────
const GestionAlumnosPage = ({ onBack, styles, usuario, sedeActual }) => {

    // --- ESTADOS PRINCIPALES (sin cambios) ---
    const [alumnos, setAlumnos] = useState([]);
    const [verArchivados, setVerArchivados] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
    const [editandoId, setEditandoId] = useState(null);

    // NUEVO: Para vincular instructores — ahora usan código, no uid directo
    const [codigoVinculacion, setCodigoVinculacion] = useState("");
    const [vinculandoInstructor, setVinculandoInstructor] = useState(false);

    // --- CONFIGURACIÓN DE LA SEDE (antes "academia") ---
    // Ahora viene de "sedes/{sedeId}" en lugar de "academias/{id}"
    const [config, setConfig] = useState({
        nombre: sedeActual?.nombre || 'Mi Dojo',
        ciudad: sedeActual?.ciudad || '',
        logoBase64: sedeActual?.logoBase64 || '',
        horarios: sedeActual?.horarios || [],
        programas: sedeActual?.programas || ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        codigoAcceso: sedeActual?.codigoAcceso || ''
    });

    // Estados temporales para constructores de config (sin cambios)
    const [tempHora, setTempHora] = useState("19:00");
    const [tempNombreClase, setTempNombreClase] = useState("");
    const [tempDias, setTempDias] = useState([]);
    const [tempNuevoPrograma, setTempNuevoPrograma] = useState("");

    // --- ESTADO INICIAL DEL ALUMNO (sin cambios en campos) ---
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

    // Determinar la sedeId efectiva:
    // Si el propietario viene desde PanelMaestro con una sede seleccionada, usa esa.
    // Si es instructor, siempre usa la suya.
    const sedeIdEfectiva = sedeActual?.id || usuario.sedeId;
    const teamId = usuario.teamId;
    const rol = usuario.rol;
    const esPropietario = rol === 'propietario';

    // ── 1. CARGA DE CONFIGURACIÓN DE LA SEDE ──
    // ── 1. CARGA DE CONFIGURACIÓN DE LA SEDE (AJUSTADO A MIGRACIÓN) ──
useEffect(() => {
    if (!sedeIdEfectiva) return;

    const docRef = doc(db, "sedes", sedeIdEfectiva);
    const unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setConfig({
                // Ajustamos los nombres de los campos a lo que hay en Firestore
                nombre: data.nombreSede || 'Mi Dojo', 
                ciudad: data.ciudad || '',
                logoBase64: data.logobase64 || '', // Minúscula según el script
                horarios: data.horarios || [],
                programas: data.programas || [],
                codigoAcceso: data.codigoAcceso || ''
            });
        }
    }, (error) => {
        console.error("Error cargando configuración de sede:", error);
    });

    return () => unsub();
}, [sedeIdEfectiva]);
    // ── 2. ESCUCHA DE ALUMNOS (SINCRONIZACIÓN MAESTRA) ──
useEffect(() => {
    // Si no hay teamId, no podemos filtrar por seguridad multi-tenant
    if (!teamId) return;

    // Si el rol es instructor o estamos en vista de sede específica, 
    // necesitamos obligatoriamente la sedeIdEfectiva
    const modoSedeEspecifica = !!sedeActual || rol === 'instructor' || rol === 'profesor';
    if (modoSedeEspecifica && !sedeIdEfectiva) return;

    const q = buildAlumnosQuery({
        rol: sedeActual ? 'instructor' : rol, 
        teamId: teamId,
        sedeId: sedeIdEfectiva,
        soloArchivados: verArchivados
    });

    const unsub = onSnapshot(q, (snap) => {
        setAlumnos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.error("Error en la boveda de alumnos:", error);
    });

    return () => unsub();
}, [verArchivados, teamId, sedeIdEfectiva, rol, sedeActual]);

    // --- HANDLERS DE ARCHIVOS (sin cambios) ---
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

    // ── NUEVO: Vincular instructor con código de sede ──
    const handleVincularInstructor = async () => {
        if (!codigoVinculacion.trim()) return notify("Pega un código válido.", "error");
        setVinculandoInstructor(true);
        try {
            const result = await vincularInstructorASede(usuario.uid, codigoVinculacion);
            notify(`Vinculado a ${result.nombreSede} exitosamente. Recargando...`);
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            notify(e.message || "Error al vincular.", "error");
        } finally {
            setVinculandoInstructor(false);
        }
    };

    // --- LÓGICA DE NEGOCIO (PAGOS) — sin cambios ---
    const calcularEstadoPago = (fechaVencimiento) => {
        if (verArchivados) return { label: 'INACTIVO', color: '#666' };
        if (!fechaVencimiento) return { label: 'SIN FECHA', color: '#666' };
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const vencimiento = new Date(fechaVencimiento); vencimiento.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) return { label: 'AL CORRIENTE', color: '#4CAF50' };
        if (diffDays <= 3 && diffDays > 0) return { label: `VENCE EN ${diffDays}d`, color: '#ffbb33' };
        if (diffDays === 0) return { label: 'PAGA HOY', color: '#d4af37' };
        return { label: `ATRASADO (${Math.abs(diffDays)}d)`, color: '#ff4444' };
    };

    // ── GUARDAR ALUMNO — Ahora incluye teamId + sedeId ──
    const handleGuardarAlumno = async () => {
        if (!nuevo.nombre || !nuevo.fechaPago) return notify("Nombre y fecha de pago requeridos.", "error");
        const dia = nuevo.fechaPago.split('-')[2];
        try {
            const payload = {
                ...nuevo,
                diaPago: dia,
                // ── CAMPOS NUEVOS: identificadores de arquitectura ──
                teamId: teamId,
                sedeId: sedeIdEfectiva,
                // Mantener academiaId por compatibilidad con datos legacy
                academiaId: sedeIdEfectiva,
                ultimaActualizacion: new Date().toISOString()
            };

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
            console.error(e);
            notify("Error al guardar.", "error");
        }
    };

    // --- REGISTRAR PAGO (sin cambios) ---
    const handleRegistrarPago = async (alumno) => {
        if (!window.confirm(`¿Registrar pago para ${alumno.nombre}? La fecha saltará al próximo mes.`)) return;
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

    // --- UI HELPERS (sin cambios) ---
    const toggleSelection = (lista, item, campo) => {
        const actual = nuevo[campo] || [];
        const existe = actual.includes(item);
        setNuevo({ ...nuevo, [campo]: existe ? actual.filter(i => i !== item) : [...actual, item] });
    };

    if (!styles) return null;

    // Nombre para mostrar en el header
    const nombreDisplay = sedeActual?.nombre || config.nombre || 'Mi Dojo';
    const ciudadDisplay = sedeActual?.ciudad || config.ciudad || '';

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>

            {/* ── HEADER ── (sin cambios visuales, datos dinámicos) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {config.logoBase64 && (
                            <img src={config.logoBase64} alt="logo" style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #d4af37' }} />
                        )}
                        <div>
                            <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.4rem' }}>
                                {nombreDisplay.toUpperCase()}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', letterSpacing: '1px' }}>
                                {ciudadDisplay}
                                {/* Badge de rol para el propietario */}
                                {esPropietario && (
                                    <span style={{ marginLeft: '8px', color: '#d4af3788', fontSize: '0.6rem' }}>
                                        👑 PROPIETARIO
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setEditandoConfig(true)}
                        style={{ ...styles.btnOutline, width: '45px', height: '45px', borderRadius: '50%', padding: 0 }}
                    >
                        ⚙️
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setVerArchivados(!verArchivados)}
                        style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                        {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
                    </button>
                    <button
                        onClick={() => { setEditandoId(null); setNuevo(estadoAlumnoInicial); setMostrarForm(true); }}
                        style={{ ...styles.btnGold, width: 'auto', padding: '12px 30px' }}
                    >
                        + REGISTRAR ALUMNO
                    </button>
                </div>
            </div>

            {/* ── GRID DE ALUMNOS ── (sin cambios, + chip de sede para propietario) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {alumnos.length === 0 ? (
                    <div style={{ textAlign: 'center', gridColumn: '1/-1', marginTop: '60px', opacity: 0.5 }}>
                        <div style={{ fontSize: '3rem' }}>🥋</div>
                        <p>No se encontraron guerreros en esta sección.</p>
                        <p style={{ fontSize: '0.8rem', color: '#d4af37' }}>
                            {esPropietario
                                ? "Gestiona tus sedes desde el Panel Maestro ⚙️"
                                : "Si eres instructor, verifica estar vinculado a la ID correcta en ⚙️"
                            }
                        </p>
                    </div>
                ) : (
                    alumnos.map(alumno => {
                        const pago = calcularEstadoPago(alumno.fechaPago);

                        // Nombre de la sede del alumno (solo útil para propietario en vista global)
                        // En vista de sede específica esto no se muestra
                        const mostrarChipSede = esPropietario && !sedeActual && alumno.sedeId !== sedeIdEfectiva;

                        return (
                            <div key={alumno.id} style={{
                                ...styles.card,
                                borderLeft: `6px solid ${pago.color}`,
                                position: 'relative',
                                transition: 'transform 0.2s',
                                padding: '20px'
                            }}>
                                {/* PARTE SUPERIOR: FOTO, NOMBRE Y ESTADO */}
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <div style={{
                                        width: '65px', height: '65px', borderRadius: '50%',
                                        backgroundColor: '#111', overflow: 'hidden',
                                        border: `2px solid ${pago.color}`, flexShrink: 0
                                    }}>
                                        {alumno.fotoBase64
                                            ? <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ textAlign: 'center', lineHeight: '65px', fontSize: '1.5rem' }}>👤</div>
                                        }
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {alumno.nombre.toUpperCase()}
                                        </h3>

                                        {/* CHIPS DE PROGRAMAS (sin cambios) */}
                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            {(alumno.programas || []).map((p, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.55rem', color: '#d4af37',
                                                    backgroundColor: '#d4af3711', padding: '2px 6px',
                                                    borderRadius: '4px', border: '1px solid #d4af3744', fontWeight: 'bold'
                                                }}>{p}</span>
                                            ))}
                                        </div>

                                        <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: pago.color, fontWeight: 'bold' }}>
                                            ● {pago.label}
                                        </p>
                                    </div>

                                    {/* ACCIONES LATERALES (sin cambios) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                                        <button
                                            onClick={() => { setNuevo(alumno); setEditandoId(alumno.id); setMostrarForm(true); }}
                                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                        >
                                            EDITAR
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const msj = alumno.activo ? "¿Mover al VAULT (Inactivos)?" : "¿Reactivar a este guerrero?";
                                                const result = await Swal.fire({
                                                    text: msj, icon: 'question', showCancelButton: true,
                                                    confirmButtonText: 'PROCEDER', cancelButtonText: 'CANCELAR',
                                                    background: '#0a0a0a', color: '#fff',
                                                    confirmButtonColor: '#d4af37', cancelButtonColor: '#222',
                                                    iconColor: '#d4af37'
                                                });
                                                if (result.isConfirmed) {
                                                    try {
                                                        await updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                                                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: alumno.activo ? 'Enviado al Vault' : 'Guerrero reactivado', showConfirmButton: false, timer: 2000, background: '#0a0a0a', color: '#4CAF50' });
                                                    } catch (error) {
                                                        notify("No se pudo actualizar el estado.", "error");
                                                    }
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                        >
                                            {alumno.activo ? 'VAULT' : '♻️ REESTABLECER'}
                                        </button>

                                        {!verArchivados && (
                                            <button
                                                onClick={() => handleRegistrarPago(alumno)}
                                                style={{
                                                    background: '#d4af3722', border: '1px solid #d4af37',
                                                    borderRadius: '5px', color: '#d4af37',
                                                    padding: '4px 8px', fontSize: '0.8rem',
                                                    cursor: 'pointer', fontWeight: 'bold'
                                                }}
                                                title="Registrar mensualidad"
                                            >
                                                $ COBRAR
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* PIE DE TARJETA (sin cambios, + chip de sede) */}
                                <div style={{
                                    marginTop: '15px', paddingTop: '12px',
                                    borderTop: '1px solid #222',
                                    display: 'flex', justifyContent: 'space-between',
                                    fontSize: '0.75rem', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span
                                            onClick={() => setAlumnoSeleccionado(alumno)}
                                            style={{ color: '#d4af37', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            📄 EXPEDIENTE
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', color: '#888', alignItems: 'center' }}>
                                        <span title="WhatsApp">📱 {alumno.telefono || '---'}</span>
                                        <span title="Instagram">📸 {alumno.instagram || '@---'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── MODAL REGISTRO / EDICIÓN ── (sin cambios en UI) */}
            {mostrarForm && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.96)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '15px', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
                        <h2 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '25px' }}>
                            {editandoId ? 'ACTUALIZAR GUERRERO' : 'ALTA DE ALUMNO'}
                        </h2>

                        {/* FOTO */}
                        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                            <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#111', margin: '0 auto 10px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>📷</span>}
                            </div>
                            <input id="fotoInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                            <label style={{ fontSize: '0.7rem', color: '#d4af37', cursor: 'pointer' }}>SUBIR FOTO DE PERFIL</label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* BLOQUE I: DATOS PERSONALES */}
                            <div style={{ borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>I. DATOS PERSONALES</p>
                                <input placeholder="Nombre completo" style={{ ...styles.input, width: '100%' }} value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <input placeholder="Edad" type="number" style={{ ...styles.input, flex: 1 }} value={nuevo.edad} onChange={e => setNuevo({ ...nuevo, edad: e.target.value })} />
                                    <input placeholder="WhatsApp" style={{ ...styles.input, flex: 2 }} value={nuevo.telefono} onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })} />
                                </div>
                                <input placeholder="Instagram (ej: @nombre)" style={{ ...styles.input, width: '100%', marginTop: '10px' }} value={nuevo.instagram} onChange={e => setNuevo({ ...nuevo, instagram: e.target.value })} />
                            </div>

                            {/* BLOQUE II: SALUD */}
                            <div style={{ borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>II. SALUD Y SEGURIDAD</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <input placeholder="Tipo de Sangre" style={styles.input} value={nuevo.tipoSangre} onChange={e => setNuevo({ ...nuevo, tipoSangre: e.target.value })} />
                                    <input placeholder="Alergias" style={styles.input} value={nuevo.alergias} onChange={e => setNuevo({ ...nuevo, alergias: e.target.value })} />
                                </div>
                                <input placeholder="Condiciones médicas / Lesiones" style={{ ...styles.input, width: '100%', marginTop: '10px' }} value={nuevo.condicionEspecial} onChange={e => setNuevo({ ...nuevo, condicionEspecial: e.target.value })} />
                                <input placeholder="Medicamentos actuales" style={{ ...styles.input, width: '100%', marginTop: '10px' }} value={nuevo.medicamentos} onChange={e => setNuevo({ ...nuevo, medicamentos: e.target.value })} />
                                <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', marginTop: '15px' }}>
                                    <label style={{ fontSize: '0.7rem', color: '#666', display: 'block', marginBottom: '8px' }}>EN CASO DE EMERGENCIA:</label>
                                    <input placeholder="Nombre Contacto" style={{ ...styles.input, width: '100%' }} value={nuevo.contactoEmergenciaNombre} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaNombre: e.target.value })} />
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <input placeholder="Teléfono" style={{ ...styles.input, flex: 1 }} value={nuevo.contactoEmergenciaTel} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaTel: e.target.value })} />
                                        <input placeholder="Parentesco" style={{ ...styles.input, flex: 1 }} value={nuevo.parentescoEmergencia} onChange={e => setNuevo({ ...nuevo, parentescoEmergencia: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE III: EXPERIENCIA */}
                            <div style={{ borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>III. EXPERIENCIA PREVIA</p>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.8rem' }}>¿Tiene experiencia?</label>
                                    <select style={{ ...styles.input, flex: 1 }} value={nuevo.tieneExperiencia} onChange={e => setNuevo({ ...nuevo, tieneExperiencia: e.target.value })}>
                                        <option value="no">No</option>
                                        <option value="si">Sí</option>
                                    </select>
                                </div>
                                {nuevo.tieneExperiencia === 'si' && (
                                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <input placeholder="Grado/Cinturón" style={styles.input} value={nuevo.gradoActual} onChange={e => setNuevo({ ...nuevo, gradoActual: e.target.value })} />
                                        <input placeholder="Tiempo" style={styles.input} value={nuevo.tiempoExperiencia} onChange={e => setNuevo({ ...nuevo, tiempoExperiencia: e.target.value })} />
                                        <input placeholder="Academia de origen" style={{ ...styles.input, gridColumn: '1/-1' }} value={nuevo.academiaAnterior} onChange={e => setNuevo({ ...nuevo, academiaAnterior: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            {/* BLOQUE IV: CLASES */}
                            <div style={{ borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>IV. ASIGNACIÓN DE CLASES</p>
                                <label style={{ fontSize: '0.7rem', color: '#666' }}>PROGRAMAS:</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0 20px 0' }}>
                                    {config.programas.map(p => (
                                        <div key={p}
                                            onClick={() => toggleSelection(config.programas, p, 'programas')}
                                            style={{
                                                padding: '8px 15px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
                                                border: `1px solid ${nuevo.programas?.includes(p) ? '#d4af37' : '#333'}`,
                                                backgroundColor: nuevo.programas?.includes(p) ? '#d4af37' : 'transparent',
                                                color: nuevo.programas?.includes(p) ? '#000' : '#fff'
                                            }}>
                                            {p}
                                        </div>
                                    ))}
                                </div>
                                <label style={{ fontSize: '0.7rem', color: '#666' }}>HORARIOS:</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                    {config.horarios.map((h, i) => {
                                        const label = `${h.hora} - ${h.nombre}`;
                                        const isSelected = nuevo.horarios?.includes(label);
                                        return (
                                            <div key={i}
                                                onClick={() => toggleSelection(config.horarios, label, 'horarios')}
                                                style={{
                                                    padding: '8px 15px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
                                                    border: `1px solid ${isSelected ? '#d4af37' : '#333'}`,
                                                    backgroundColor: isSelected ? '#d4af37' : 'transparent',
                                                    color: isSelected ? '#000' : '#fff'
                                                }}>
                                                {label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* BLOQUE V: ADMINISTRATIVO */}
                            <div>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>V. ADMINISTRATIVO</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.6rem', color: '#666' }}>FECHA PRÓXIMO PAGO:</label>
                                        <input type="date" style={{ ...styles.input, width: '100%' }} value={nuevo.fechaPago} onChange={e => setNuevo({ ...nuevo, fechaPago: e.target.value })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.6rem', color: '#666' }}>MONTO MENSUALIDAD:</label>
                                        <input placeholder="$0.00" style={{ ...styles.input, width: '100%' }} value={nuevo.montoMensualidad} onChange={e => setNuevo({ ...nuevo, montoMensualidad: e.target.value })} />
                                    </div>
                                </div>
                                <textarea placeholder="Notas de scouting o seguimiento técnico inicial..." style={{ ...styles.input, width: '100%', height: '100px', marginTop: '15px', resize: 'none' }} value={nuevo.notasTecnicas} onChange={e => setNuevo({ ...nuevo, notasTecnicas: e.target.value })} />
                            </div>

                            {/* ACCIONES */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                <button onClick={handleGuardarAlumno} style={{ ...styles.btnGold, flex: 2 }}>
                                    {editandoId ? 'GUARDAR CAMBIOS' : 'REGISTRAR EN VAULT'}
                                </button>
                                <button onClick={() => setMostrarForm(false)} style={{ ...styles.btnOutline, flex: 1 }}>CANCELAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EXPEDIENTE COMPLETO ── (sin cambios) */}
            {alumnoSeleccionado && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '15px' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '700px', maxHeight: '95vh', overflowY: 'auto', border: '1px solid #d4af37', padding: '40px' }}>
                        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '30px', marginBottom: '30px' }}>
                            <div style={{ width: '150px', height: '150px', borderRadius: '15px', border: '2px solid #d4af37', overflow: 'hidden' }}>
                                {alumnoSeleccionado.fotoBase64 ? <img src={alumnoSeleccionado.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ fontSize: '4rem', textAlign: 'center', lineHeight: '150px' }}>👤</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h1 style={{ ...styles.goldTitle, fontSize: '2rem', marginBottom: '5px' }}>{alumnoSeleccionado.nombre.toUpperCase()}</h1>
                                <p style={{ color: '#4CAF50', fontWeight: 'bold', margin: '0 0 15px 0' }}>ESTADO: {alumnoSeleccionado.activo ? 'ACTIVO' : 'ARCHIVADO'}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                                    <div><span style={{ color: '#666' }}>EDAD:</span> {alumnoSeleccionado.edad} años</div>
                                    <div><span style={{ color: '#666' }}>TEL:</span> {alumnoSeleccionado.telefono}</div>
                                    <div><span style={{ color: '#666' }}>IG:</span> {alumnoSeleccionado.instagram}</div>
                                    <div><span style={{ color: '#666' }}>SANGRE:</span> {alumnoSeleccionado.tipoSangre}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                            <div>
                                <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px' }}>SALUD Y SEGURIDAD</h4>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Alergias:</strong> {alumnoSeleccionado.alergias || 'Ninguna'}</p>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Condiciones:</strong> {alumnoSeleccionado.condicionEspecial || 'Ninguna'}</p>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Medicamentos:</strong> {alumnoSeleccionado.medicamentos || 'Ninguno'}</p>
                                <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', marginTop: '15px' }}>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', color: '#d4af37', fontWeight: 'bold' }}>CONTACTO EMERGENCIA:</p>
                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{alumnoSeleccionado.contactoEmergenciaNombre}</p>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#4CAF50' }}>{alumnoSeleccionado.contactoEmergenciaTel} ({alumnoSeleccionado.parentescoEmergencia})</p>
                                </div>
                            </div>
                            <div>
                                <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px' }}>INFORMACIÓN TÉCNICA</h4>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Programas:</strong> {alumnoSeleccionado.programas?.join(', ')}</p>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Horarios:</strong> {alumnoSeleccionado.horarios?.join(', ')}</p>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Grado/Exp:</strong> {alumnoSeleccionado.gradoActual || 'Blanco'} ({alumnoSeleccionado.tiempoExperiencia || 'Iniciante'})</p>
                                <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Origen:</strong> {alumnoSeleccionado.academiaAnterior || 'N/A'}</p>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px' }}>BITÁCORA TÉCNICA DEL PROFESOR</h4>
                                <textarea id="areaNotas" defaultValue={alumnoSeleccionado.notasTecnicas} style={{ ...styles.input, width: '100%', height: '120px', marginTop: '10px', fontSize: '0.9rem', lineHeight: '1.4' }} />
                                <button
                                    onClick={async () => {
                                        const txt = document.getElementById('areaNotas').value;
                                        await updateDoc(doc(db, "alumnos", alumnoSeleccionado.id), { notasTecnicas: txt });
                                        notify("Notas actualizadas. Oss!");
                                    }}
                                    style={{ ...styles.btnGold, marginTop: '10px' }}
                                >
                                    ACTUALIZAR BITÁCORA
                                </button>
                            </div>
                        </div>
                        <button onClick={() => setAlumnoSeleccionado(null)} style={{ ...styles.btnOutline, width: '100%', marginTop: '30px' }}>CERRAR EXPEDIENTE</button>
                    </div>
                </div>
            )}

            {/* ── MODAL CONFIGURACIÓN DE SEDE ── */}
            {editandoConfig && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '500px', maxHeight: '95vh', overflowY: 'auto', padding: '30px', border: '1px solid #d4af37' }}>
                        <h3 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '25px' }}>CONFIGURACIÓN DE SEDE</h3>

                        {/* LOGO */}
                        <div style={{ marginBottom: '25px', textAlign: 'center' }}>
                            <div onClick={() => document.getElementById('logoInput').click()} style={{ width: '100px', height: '100px', borderRadius: '15px', backgroundColor: '#111', margin: '0 auto 10px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {config.logoBase64 ? <img src={config.logoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" /> : <span style={{ fontSize: '2rem' }}>🏯</span>}
                            </div>
                            <input id="logoInput" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                            <p style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold' }}>LOGO OFICIAL</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                            <input placeholder="Nombre de la Sede" style={{ ...styles.input, width: '100%', margin: 0 }} value={config.nombre} onChange={e => setConfig({ ...config, nombre: e.target.value })} />
                            <input placeholder="Ciudad" style={{ ...styles.input, width: '100%', margin: 0 }} value={config.ciudad} onChange={e => setConfig({ ...config, ciudad: e.target.value })} />
                        </div>

                        {/* CÓDIGO DE ACCESO (solo lectura, para compartir) */}
                        {config.codigoAcceso && (
                            <div style={{ marginBottom: '25px', backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #d4af3733' }}>
                                <p style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                                    CÓDIGO DE ACCESO (comparte con instructores de esta sede):
                                </p>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <code style={{ flex: 1, background: '#000', padding: '10px', borderRadius: '5px', fontSize: '1rem', color: '#fff', border: '1px solid #222', letterSpacing: '3px', textAlign: 'center' }}>
                                        {config.codigoAcceso}
                                    </code>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(config.codigoAcceso); notify("Código copiado."); }}
                                        style={{ ...styles.btnGold, width: 'auto', padding: '10px' }}
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* VINCULACIÓN (solo instructores ven esto completo) */}
                        {!esPropietario && (
                            <div style={{ marginBottom: '25px', borderTop: '1px solid #222', paddingTop: '20px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px' }}>CAMBIAR DE SEDE:</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        placeholder="Pega el nuevo código de sede..."
                                        style={{ ...styles.input, flex: 1, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}
                                        value={codigoVinculacion}
                                        onChange={e => setCodigoVinculacion(e.target.value.toUpperCase())}
                                    />
                                    <button
                                        onClick={handleVincularInstructor}
                                        disabled={vinculandoInstructor}
                                        style={{ ...styles.btnOutline, width: 'auto', padding: '0 15px', fontSize: '0.7rem', opacity: vinculandoInstructor ? 0.6 : 1 }}
                                    >
                                        {vinculandoInstructor ? '...' : 'VINCULAR'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PROGRAMAS */}
                        <div style={{ marginBottom: '25px', padding: '15px', border: '1px solid #222', borderRadius: '12px', backgroundColor: '#050505' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.8rem', marginBottom: '12px', fontWeight: 'bold' }}>PROGRAMAS ACTIVOS:</p>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                                <input placeholder="Ej: No-Gi Adultos" style={{ ...styles.input, flex: 1, margin: 0 }} value={tempNuevoPrograma} onChange={e => setTempNuevoPrograma(e.target.value)} />
                                <button onClick={() => {
                                    if (!tempNuevoPrograma) return;
                                    setConfig({ ...config, programas: [...(config.programas || []), tempNuevoPrograma.trim()] });
                                    setTempNuevoPrograma("");
                                }} style={{ ...styles.btnGold, width: '45px' }}>+</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(config.programas || []).map((p, i) => (
                                    <span key={i} style={{ backgroundColor: '#151515', border: '1px solid #d4af3733', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37' }}>
                                        {p}
                                        <b onClick={() => setConfig({ ...config, programas: config.programas.filter((_, idx) => idx !== i) })} style={{ cursor: 'pointer', color: '#ff4444', fontSize: '1rem' }}>×</b>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* HORARIOS */}
                        <div style={{ marginBottom: '25px', padding: '15px', border: '1px solid #222', borderRadius: '12px', backgroundColor: '#050505' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.8rem', marginBottom: '12px', fontWeight: 'bold' }}>MATRIZ DE HORARIOS:</p>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input type="time" style={{ ...styles.input, width: '110px', margin: 0 }} value={tempHora} onChange={e => setTempHora(e.target.value)} />
                                <input placeholder="Nombre de la clase" style={{ ...styles.input, flex: 1, margin: 0 }} value={tempNombreClase} onChange={e => setTempNombreClase(e.target.value)} />
                            </div>
                            <button onClick={() => {
                                if (!tempNombreClase) return;
                                const nH = { hora: tempHora, nombre: tempNombreClase };
                                setConfig({ ...config, horarios: [...(config.horarios || []), nH].sort((a, b) => a.hora.localeCompare(b.hora)) });
                                setTempNombreClase("");
                            }} style={{ ...styles.btnGold, width: '100%', margin: 0 }}>AÑADIR CLASE AL HORARIO</button>
                            <div style={{ marginTop: '15px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #111', borderRadius: '8px' }}>
                                {(config.horarios || []).map((h, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #111', fontSize: '0.8rem', alignItems: 'center' }}>
                                        <span><b style={{ color: '#d4af37' }}>{h.hora} hrs</b> — {h.nombre}</span>
                                        <b onClick={() => setConfig({ ...config, horarios: config.horarios.filter((_, idx) => idx !== i) })} style={{ cursor: 'pointer', color: '#ff4444', fontSize: '1.1rem', padding: '0 5px' }}>×</b>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* GUARDAR CONFIG */}
                        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                            <button onClick={async () => {
                                // Guardar en "sedes/{sedeId}" en lugar de "academias/{id}"
                                await setDoc(doc(db, "sedes", sedeIdEfectiva), {
                                    ...config,
                                    ultimaActualizacion: new Date().toISOString()
                                }, { merge: true });
                                setEditandoConfig(false);
                                notify("¡Configuración de Sede guardada! OSS.");
                            }} style={{ ...styles.btnGold, flex: 1, fontWeight: 'bold' }}>GUARDAR CAMBIOS</button>
                            <button onClick={() => setEditandoConfig(false)} style={{ ...styles.btnOutline, flex: 1 }}>CERRAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionAlumnosPage;
