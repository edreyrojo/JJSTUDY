import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, doc,
    updateDoc, query, orderBy, where,
    getDoc, setDoc, deleteDoc
} from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles, usuario }) => {
    // --- ESTADOS PRINCIPALES ---
    const [alumnos, setAlumnos] = useState([]);
    const [verArchivados, setVerArchivados] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
    const [editandoId, setEditandoId] = useState(null);
    const [codigoVinculacion, setCodigoVinculacion] = useState("");

    // --- CONFIGURACIÓN DE LA ACADEMIA ---
    const [config, setConfig] = useState({
        nombreAcademia: 'Tu Dojo',
        sede: 'Ubicación',
        logoBase64: '',
        horarios: [], // Array de objetos: { hora: "19:00", nombre: "BJJ", dias: [0,1,2] }
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"]
    });

    // Estados temporales para constructores de config
    const [tempHora, setTempHora] = useState("19:00");
    const [tempNombreClase, setTempNombreClase] = useState("");
    const [tempDias, setTempDias] = useState([]);
    const [tempNuevoPrograma, setTempNuevoPrograma] = useState("");

    // --- ESTADO INICIAL DEL ALUMNO (ARQUITECTURA DE ARRAYS) ---
    const estadoAlumnoInicial = {
        nombre: '',
        fotoBase64: '',
        edad: '',
        telefono: '',
        instagram: '',
        // Sección Emergencia
        contactoEmergenciaNombre: '',
        contactoEmergenciaTel: '',
        parentescoEmergencia: '',
        // Sección Salud
        condicionEspecial: '',
        medicamentos: '',
        alergias: '',
        tipoSangre: '',
        // Sección Experiencia
        tieneExperiencia: 'no',
        tiempoExperiencia: '',
        gradoActual: '',
        academiaAnterior: '',
        // Sección Académica (Multiselección)
        programas: [],
        horarios: [],
        fechaPago: new Date().toISOString().split('T')[0],
        diaPago: new Date().getDate().toString(),
        montoMensualidad: '',
        notasTecnicas: '',
        activo: true,
        asistencias: [],
        historialTecnico: []
    };

    const [nuevo, setNuevo] = useState(estadoAlumnoInicial);

    // 1. CARGA DE CONFIGURACIÓN
    useEffect(() => {
        if (!usuario?.uid) return;
        const idSede = usuario.academiaId || usuario.uid;
        const docRef = doc(db, "academias", idSede);

        const unsubConfig = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            }
        });
        return () => unsubConfig();
    }, [usuario.academiaId, usuario.uid]);

    // 2. ESCUCHA DE ALUMNOS
    useEffect(() => {
        if (!usuario?.uid) return;
        const idParaFiltrar = usuario.academiaId || usuario.uid;

        const q = query(
            collection(db, "alumnos"),
            where("activo", "==", !verArchivados),
            where("academiaId", "==", idParaFiltrar),
            orderBy("nombre", "asc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAlumnos(docs);
        });

        return () => unsub();
    }, [verArchivados, usuario.academiaId, usuario.uid]);

    // --- HANDLERS DE ARCHIVOS ---
    const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1048487) return alert("La foto es muy pesada. Máximo 1MB.");
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
    const handleVincularAcademia = async () => {
        if (!codigoVinculacion.trim()) return alert("Pega un código válido.");
        try {
            await updateDoc(doc(db, "usuarios", usuario.uid), { academiaId: codigoVinculacion.trim() });
            alert("Vinculación exitosa. Reiniciando...");
            window.location.reload();
        } catch (e) { alert("Error al vincular."); }
    };

    // --- LÓGICA DE NEGOCIO (PAGOS) ---
    const calcularEstadoPago = (fechaVencimiento) => {
        if (verArchivados) return { label: 'INACTIVO', color: '#666' };
        if (!fechaVencimiento) return { label: 'SIN FECHA', color: '#666' };

        const hoy = new Date();
        const vencimiento = new Date(fechaVencimiento);

        // Normalizamos a medianoche para que el cálculo sea exacto por días
        hoy.setHours(0, 0, 0, 0);
        vencimiento.setHours(0, 0, 0, 0);

        const diffTime = vencimiento - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 3) return { label: 'AL CORRIENTE', color: '#4CAF50' };
        if (diffDays <= 3 && diffDays > 0) return { label: `VENCE EN ${diffDays}d`, color: '#ffbb33' };
        if (diffDays === 0) return { label: 'PAGA HOY', color: '#d4af37' };

        // Si es negativo, está atrasado
        return { label: `ATRASADO (${Math.abs(diffDays)}d)`, color: '#ff4444' };
    };

    // --- GESTIÓN DE GUARDADO ---
    const handleGuardarAlumno = async () => {
        if (!nuevo.nombre || !nuevo.fechaPago) return alert("Nombre y fecha de pago requeridos.");
        const dia = nuevo.fechaPago.split('-')[2];
        const idSede = usuario.academiaId || usuario.uid;
        try {
            const payload = { ...nuevo, diaPago: dia, academiaId: idSede, ultimaActualizacion: new Date().toISOString() };
            if (editandoId) {
                await setDoc(doc(db, "alumnos", editandoId), payload, { merge: true });
            } else {
                await addDoc(collection(db, "alumnos"), { ...payload, fechaRegistro: new Date().toISOString(), registradoPor: usuario.uid });
            }
            setMostrarForm(false); setEditandoId(null); setNuevo(estadoAlumnoInicial);
            alert("Operación exitosa 🛡️");
        } catch (e) { alert("Error al guardar."); }
    };
    const handleRegistrarPago = async (alumno) => {
        if (!window.confirm(`¿Registrar pago para ${alumno.nombre}? La fecha saltará al próximo mes.`)) return;

        try {
            const fechaActual = new Date(alumno.fechaPago);
            // Sumamos exactamente un mes
            fechaActual.setMonth(fechaActual.getMonth() + 1);

            const nuevaFecha = fechaActual.toISOString().split('T')[0];

            await updateDoc(doc(db, "alumnos", alumno.id), {
                fechaPago: nuevaFecha,
                diaPago: nuevaFecha.split('-')[2] // Mantenemos el día actualizado por si acaso
            });

            alert("¡Pago registrado! 🛡️ OSS.");
        } catch (e) {
            console.error("Error al registrar pago:", e);
            alert("Error al actualizar el pago.");
        }
    };
        // --- UI HELPERS: CHIPS ---
        const toggleSelection = (lista, item, campo) => {
            const actual = nuevo[campo] || [];
            const existe = actual.includes(item);
            const nuevoArray = existe
                ? actual.filter(i => i !== item)
                : [...actual, item];
            setNuevo({ ...nuevo, [campo]: nuevoArray });
        }; // <--- PONLE ESTE PUNTO Y COMA AQUÍ

        if (!styles) return null;

        return (
            <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>

                {/* HEADER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
                        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {config.logoBase64 && <img src={config.logoBase64} alt="logo" style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #d4af37' }} />}
                            <div>
                                <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.4rem' }}>{config.nombreAcademia.toUpperCase()}</h2>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', letterSpacing: '1px' }}>{config.sede}</p>
                            </div>
                        </div>
                        <button onClick={() => setEditandoConfig(true)} style={{ ...styles.btnOutline, width: '45px', height: '45px', borderRadius: '50%', padding: 0 }}>⚙️</button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '12px' }}>
                        <button onClick={() => setVerArchivados(!verArchivados)} style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.85rem', cursor: 'pointer' }}>
                            {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
                        </button>
                        <button onClick={() => { setEditandoId(null); setNuevo(estadoAlumnoInicial); setMostrarForm(true); }} style={{ ...styles.btnGold, width: 'auto', padding: '12px 30px' }}>+ REGISTRAR ALUMNO</button>
                    </div>
                </div>

                {/* GRID DE ALUMNOS - VERSIÓN RESTAURADA COMPLETA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                    {alumnos.length === 0 ? (
                        <div style={{ textAlign: 'center', gridColumn: '1/-1', marginTop: '60px', opacity: 0.5 }}>
                            <div style={{ fontSize: '3rem' }}>🥋</div>
                            <p>No se encontraron guerreros en esta sección.</p>
                            <p style={{ fontSize: '0.8rem', color: '#d4af37' }}>Si eres instructor, verifica estar vinculado a la ID correcta en ⚙️</p>
                        </div>
                    ) : (
                        alumnos.map(alumno => {
                            const pago = calcularEstadoPago(alumno.fechaPago);
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
                                            {alumno.fotoBase64 ? (
                                                <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ textAlign: 'center', lineHeight: '65px', fontSize: '1.5rem' }}>👤</div>
                                            )}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {alumno.nombre.toUpperCase()}
                                            </h3>

                                            {/* CHIPS DE PROGRAMAS */}
                                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {(alumno.programas || []).map((p, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.55rem', color: '#d4af37',
                                                        backgroundColor: '#d4af3711', padding: '2px 6px',
                                                        borderRadius: '4px', border: '1px solid #d4af3744',
                                                        fontWeight: 'bold'
                                                    }}>{p}</span>
                                                ))}
                                            </div>

                                            <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: pago.color, fontWeight: 'bold' }}>
                                                ● {pago.label}
                                            </p>
                                        </div>

                                        {/* ACCIONES LATERALES: EDITAR Y VAULT */}
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
                                                    if (window.confirm(msj)) {
                                                        await updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                            >
                                                {alumno.activo ? 'VAULT' : '♻️ REESTABLECER'}
                                            </button>
                                            {/* NUEVO BOTÓN DE PAGO RÁPIDO */}
                                            {!verArchivados && (
                                                <button
                                                    onClick={() => handleRegistrarPago(alumno)}
                                                    style={{
                                                        background: '#d4af3722',
                                                        border: '1px solid #d4af37',
                                                        borderRadius: '5px',
                                                        color: '#d4af37',
                                                        padding: '4px 8px',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                    title="Registrar mensualidad"
                                                >
                                                    $ COBRAR
                                                </button>
                                            )}

                                            <button
                                                onClick={() => { setNuevo(alumno); setEditandoId(alumno.id); setMostrarForm(true); }}
                                                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                            >
                                                EDITAR
                                            </button>
                                        </div>
                                    </div>

                                    {/* PIE DE TARJETA: CONTACTO Y EXPEDIENTE (RESTAURADO) */}
                                    <div style={{
                                        marginTop: '15px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid #222',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '0.75rem',
                                        alignItems: 'center'
                                    }}>
                                        <span
                                            onClick={() => setAlumnoSeleccionado(alumno)}
                                            style={{ color: '#d4af37', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            📄 EXPEDIENTE
                                        </span>

                                        <div style={{ display: 'flex', gap: '12px', color: '#888' }}>
                                            <span title="WhatsApp">📱 {alumno.telefono || '---'}</span>
                                            <span title="Instagram">📸 {alumno.instagram || '@---'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* MODAL: REGISTRO / EDICIÓN (DETALLADO) */}
                {mostrarForm && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.96)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '15px', boxSizing: 'border-box' }}>
                        <div style={{ ...styles.card, width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
                            <h2 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '25px' }}>{editandoId ? 'ACTUALIZAR GUERRERO' : 'ALTA DE ALUMNO'}</h2>

                            {/* FOTO */}
                            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#111', margin: '0 auto 10px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '2rem' }}>📷</span>}
                                </div>
                                <input id="fotoInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                                <label style={{ fontSize: '0.7rem', color: '#d4af37', cursor: 'pointer' }}>SUBIR FOTO DE PERFIL</label>
                            </div>

                            {/* SECCIONES DEL FORMULARIO */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* BLOQUE 1: DATOS PERSONALES */}
                                <div style={{ borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>I. DATOS PERSONALES</p>
                                    <input placeholder="Nombre completo" style={{ ...styles.input, width: '100%' }} value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <input placeholder="Edad" type="number" style={{ ...styles.input, flex: 1 }} value={nuevo.edad} onChange={e => setNuevo({ ...nuevo, edad: e.target.value })} />
                                        <input placeholder="WhatsApp" style={{ ...styles.input, flex: 2 }} value={nuevo.telefono} onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })} />
                                    </div>
                                    <input placeholder="Instagram (ej: @nombre)" style={{ ...styles.input, width: '100%', marginTop: '10px' }} value={nuevo.instagram} onChange={e => setNuevo({ ...nuevo, instagram: e.target.value })} />
                                </div>

                                {/* BLOQUE 2: SALUD (TU DETALLE ORIGINAL) */}
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

                                {/* BLOQUE 3: EXPERIENCIA TÉCNICA */}
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

                                {/* BLOQUE 4: ACADÉMICO (MULTISELECCIÓN) */}
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

                                {/* BLOQUE 5: PAGOS Y NOTAS */}
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

                                {/* ACCIONES FORMULARIO */}
                                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                    <button onClick={handleGuardarAlumno} style={{ ...styles.btnGold, flex: 2 }}>{editandoId ? 'GUARDAR CAMBIOS' : 'REGISTRAR EN VAULT'}</button>
                                    <button onClick={() => setMostrarForm(false)} style={{ ...styles.btnOutline, flex: 1 }}>CANCELAR</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PANEL: EXPEDIENTE COMPLETO (DOSSIER) */}
                {alumnoSeleccionado && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '15px' }}>
                        <div style={{ ...styles.card, width: '100%', maxWidth: '700px', maxHeight: '95vh', overflowY: 'auto', border: '1px solid #d4af37', padding: '40px' }}>

                            {/* CABECERA EXPEDIENTE */}
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

                            {/* CUERPO EXPEDIENTE (3 COLUMNAS/BLOQUES) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

                                {/* COL IZQUIERDA: SALUD Y EMERGENCIA */}
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

                                {/* COL DERECHA: TÉCNICO */}
                                <div>
                                    <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px' }}>INFORMACIÓN TÉCNICA</h4>
                                    <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Programas:</strong> {alumnoSeleccionado.programas?.join(', ')}</p>
                                    <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Horarios:</strong> {alumnoSeleccionado.horarios?.join(', ')}</p>
                                    <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Grado/Exp:</strong> {alumnoSeleccionado.gradoActual || 'Blanco'} ({alumnoSeleccionado.tiempoExperiencia || 'Iniciante'})</p>
                                    <p style={{ fontSize: '0.85rem' }}><strong style={{ color: '#666' }}>Origen:</strong> {alumnoSeleccionado.academiaAnterior || 'N/A'}</p>
                                </div>

                                {/* BLOQUE COMPLETO: NOTAS DEL PROFESOR */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <h4 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '5px' }}>BITÁCORA TÉCNICA DEL PROFESOR</h4>
                                    <textarea
                                        id="areaNotas"
                                        defaultValue={alumnoSeleccionado.notasTecnicas}
                                        style={{ ...styles.input, width: '100%', height: '120px', marginTop: '10px', fontSize: '0.9rem', lineHeight: '1.4' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            const txt = document.getElementById('areaNotas').value;
                                            await updateDoc(doc(db, "alumnos", alumnoSeleccionado.id), { notasTecnicas: txt });
                                            alert("Notas actualizadas. Oss!");
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
                {/* MODAL CONFIGURACIÓN: CENTRAL DE SEDE (VERSIÓN PULL-RESTORED) */}
                {editandoConfig && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000, padding: '20px', boxSizing: 'border-box' }}>
                        <div style={{ ...styles.card, width: '100%', maxWidth: '500px', maxHeight: '95vh', overflowY: 'auto', padding: '30px', border: '1px solid #d4af37' }}>
                            <h3 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '25px' }}>CONFIGURACIÓN DE ACADEMIA</h3>

                            {/* 1. SECCIÓN: IDENTIDAD VISUAL */}
                            <div style={{ marginBottom: '25px', textAlign: 'center' }}>
                                <div onClick={() => document.getElementById('logoInput').click()} style={{ width: '100px', height: '100px', borderRadius: '15px', backgroundColor: '#111', margin: '0 auto 10px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {config.logoBase64 ? <img src={config.logoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" /> : <span style={{ fontSize: '2rem' }}>🏯</span>}
                                </div>
                                <input id="logoInput" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                                <p style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold' }}>LOGO OFICIAL</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                                <input placeholder="Nombre de la Academia" style={{ ...styles.input, width: '100%', margin: 0 }} value={config.nombreAcademia} onChange={e => setConfig({ ...config, nombreAcademia: e.target.value })} />
                                <input placeholder="Sede / Ubicación" style={{ ...styles.input, width: '100%', margin: 0 }} value={config.sede} onChange={e => setConfig({ ...config, sede: e.target.value })} />
                            </div>

                            {/* 2. SECCIÓN: VINCULACIÓN DUAL (ESENCIAL PARA MULTI-INSTRUCTOR) */}
                            <div style={{ marginBottom: '25px', borderTop: '1px solid #222', paddingTop: '20px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px' }}>CONEXIÓN Y VINCULACIÓN:</p>

                                {/* SUBPANEL A: MI ID (Para que otros se unan a mí) */}
                                <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #d4af3744', marginBottom: '15px' }}>
                                    <p style={{ color: '#d4af37', fontSize: '0.65rem', margin: '0 0 8px 0', fontWeight: 'bold' }}>MI CÓDIGO DE SEDE (COMPARTE ESTO CON TUS INSTRUCTORES):</p>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <code style={{ flex: 1, background: '#000', padding: '10px', borderRadius: '5px', fontSize: '0.75rem', color: '#fff', border: '1px solid #222' }}>
                                            {usuario.uid}
                                        </code>
                                        <button onClick={() => { navigator.clipboard.writeText(usuario.uid); alert("Código copiado al portapapeles."); }} style={{ ...styles.btnGold, width: 'auto', padding: '10px' }}>📋</button>
                                    </div>
                                </div>

                                {/* SUBPANEL B: UNIRSE A OTRO (Para ser instructor de otra academia) */}
                                <div style={{ backgroundColor: '#070707', padding: '15px', borderRadius: '10px', border: '1px solid #333' }}>
                                    <p style={{ color: '#888', fontSize: '0.65rem', margin: '0 0 8px 0', fontWeight: 'bold' }}>MODO INSTRUCTOR: VINCULARSE A OTRA ACADEMIA</p>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            placeholder="Pega el código de tu Profesor..."
                                            style={{ ...styles.input, flex: 1, margin: 0, fontSize: '0.8rem' }}
                                            value={codigoVinculacion}
                                            onChange={e => setCodigoVinculacion(e.target.value)}
                                        />
                                        <button onClick={handleVincularAcademia} style={{ ...styles.btnOutline, width: 'auto', padding: '0 15px', fontSize: '0.7rem' }}>VINCULAR</button>
                                    </div>
                                    {usuario.academiaId && (
                                        <p style={{ fontSize: '0.6rem', color: '#4CAF50', marginTop: '8px', fontWeight: 'bold' }}>
                                            ✓ VINCULADO ACTUALMENTE A: <span style={{ color: '#aaa' }}>{usuario.academiaId}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 3. SECCIÓN: GESTIÓN DE PROGRAMAS */}
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
                                            {p} <b onClick={() => setConfig({ ...config, programas: config.programas.filter((_, idx) => idx !== i) })} style={{ cursor: 'pointer', color: '#ff4444', fontSize: '1rem' }}>×</b>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 4. SECCIÓN: GESTIÓN DE HORARIOS */}
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

                            {/* 5. BOTONES DE ACCIÓN FINAL */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                <button onClick={async () => {
                                    const idParaGuardar = usuario.academiaId || usuario.uid;
                                    await setDoc(doc(db, "academias", idParaGuardar), {
                                        ...config,
                                        ultimaActualizacion: new Date().toISOString()
                                    }, { merge: true });
                                    setEditandoConfig(false);
                                    alert("¡Configuración de Sede guardada y sincronizada! OSS.");
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