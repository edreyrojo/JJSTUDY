import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, where, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles, usuario }) => {
    const [alumnos, setAlumnos] = useState([]);
    const [verArchivados, setVerArchivados] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null); // Para el Panel Personal
    const [editandoId, setEditandoId] = useState(null); // Para saber si estamos editando o creando

    // --- ESTADOS PARA CONFIGURACIÓN (CON LOGO Y HORARIOS OBJETOS) ---
    const [config, setConfig] = useState({
        nombreAcademia: 'Tu Dojo',
        sede: 'Ubicación',
        logoBase64: '',
        horarios: [], // Formato: [{ hora: "07:00", nombre: "Matutino" }]
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "BJJ Woman´s"]
    });

    // Estados para el constructor de horarios intuitivo
    const [tempHora, setTempHora] = useState("19:00");
    const [tempNombreClase, setTempNombreClase] = useState("");
    const [tempDias, setTempDias] = useState([]); // Nuevo: para los días de la clase
    const [tempNuevoPrograma, setTempNuevoPrograma] = useState(""); // Nuevo: para añadir programas uno a uno

    // Busca esta línea y reemplázala por esta estructura completa:
    const estadoAlumnoInicial = {
        nombre: '',
        fotoBase64: '',
        edad: '',
        telefono: '',
        instagram: '',
        contactoEmergenciaNombre: '',
        contactoEmergenciaTel: '',
        condicionEspecial: '',
        tieneExperiencia: 'no', // Valor por defecto
        tiempoExperiencia: '',
        programa: config.programas[0] || '', // Toma el primero disponible
        horario: config.horarios[0] ? `${config.horarios[0].hora} - ${config.horarios[0].nombre}` : '',
        fechaPago: new Date().toISOString().split('T')[0],
        notasTecnicas: '',
        activo: true,
        asistencias: [],
        historialTecnico: []
    };

    // Y el useState quedaría así:
    const [nuevo, setNuevo] = useState(estadoAlumnoInicial);

    // 1. CARGAR CONFIGURACIÓN DE LA ACADEMIA
    useEffect(() => {
        if (!usuario?.uid) return;
        const academiaId = usuario.academiaId || usuario.uid;
        const docRef = doc(db, "academias", academiaId);

        const unsubConfig = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConfig(data);
                // Inicializar valores por defecto en el formulario si hay datos
                if (data.programas?.length > 0 || data.horarios?.length > 0) {
                    setNuevo(prev => ({
                        ...prev,
                        programa: data.programas[0] || '',
                        horario: data.horarios[0] ? `${data.horarios[0].hora} - ${data.horarios[0].nombre}` : ''
                    }));
                }
            }
        });
        return () => unsubConfig();
    }, [usuario]);

    // 2. ESCUCHA DE ALUMNOS (CON FILTRO MULTISEDE)
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
        }, (error) => {
            console.error("Error en la Bóveda:", error);
        });

        return () => unsub();
    }, [verArchivados, usuario]);

    // 3. MANEJO DE FOTO ALUMNO Y LOGO ACADEMIA
    const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
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

    // 4. SEMÁFORO DE PAGOS (ORIGINAL)
    const calcularEstadoPago = (dia) => {
        if (verArchivados) return { label: 'INACTIVO', color: '#666' };
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const diaPagoNum = parseInt(dia);
        if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

        if (diaActual < diaPagoNum) {
            const faltan = diaPagoNum - diaActual;
            if (faltan <= 3) return { label: `PRÓXIMO (${faltan}d)`, color: '#ffbb33' };
            return { label: 'AL CORRIENTE', color: '#4CAF50' };
        }
        if (diaActual === diaPagoNum) return { label: 'PAGA HOY', color: '#d4af37' };
        return { label: `ATRASADO (${diaActual - diaPagoNum}d)`, color: '#ff4444' };
    };

    // 5. GESTIÓN DE HORARIOS INTUITIVA
    const toggleDia = (index) => {
        setTempDias(prev => prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]);
    };

    const agregarHorario = () => {
        if (!tempNombreClase || tempDias.length === 0) return alert("Escribe el nombre y selecciona días");
        const nuevoH = {
            hora: tempHora,
            nombre: tempNombreClase,
            dias: tempDias.sort()
        };
        setConfig(prev => ({ ...prev, horarios: [...prev.horarios, nuevoH].sort((a, b) => a.hora.localeCompare(b.hora)) }));
        setTempNombreClase("");
        setTempDias([]);
    };
    const eliminarHorario = (index) => {
        setConfig(prev => ({
            ...prev,
            horarios: prev.horarios.filter((_, i) => i !== index)
        }));
    };

    const agregarPrograma = () => {
        if (!tempNuevoPrograma.trim()) return;
        if (config.programas.includes(tempNuevoPrograma)) return alert("Este programa ya existe");
        setConfig(prev => ({ ...prev, programas: [...prev.programas, tempNuevoPrograma.trim()] }));
        setTempNuevoPrograma("");
    };

    const eliminarPrograma = (index) => {
        setConfig(prev => ({ ...prev, programas: prev.programas.filter((_, i) => i !== index) }));
    };

    // 6. FUNCIONES DE GUARDADO Y ELIMINACIÓN
    const handleGuardarAlumno = async () => {
        if (!nuevo.nombre || !nuevo.fechaPago) {
            alert("Nombre y fecha de pago son obligatorios.");
            return;
        }

        const diaExtraido = nuevo.fechaPago.split('-')[2];
        const idSede = usuario.academiaId || usuario.uid;

        try {
            if (editandoId) {
                // ACTUALIZAR ALUMNO EXISTENTE
                await setDoc(doc(db, "alumnos", editandoId), {
                    ...nuevo,
                    diaPago: diaExtraido
                }, { merge: true });
                alert("¡Expediente actualizado! 🛡️");
            } else {
                // REGISTRAR NUEVO ALUMNO
                await addDoc(collection(db, "alumnos"), {
                    ...nuevo,
                    diaPago: diaExtraido,
                    academiaId: idSede,
                    registradoPor: usuario.uid,
                    activo: true,
                    fechaRegistro: new Date().toISOString()
                });
                alert("¡Alumno registrado con éxito en el Vault! 🛡️");
            }

            setMostrarForm(false);
            setEditandoId(null);
            setNuevo(estadoAlumnoInicial);
        } catch (e) {
            console.error("Error al guardar:", e);
            alert("Error de acceso al Vault.");
        }
    };

    const eliminarDefinitivo = async (id) => {
        if (window.confirm("¿ELIMINAR DEFINITIVAMENTE? Esta acción no se puede deshacer.")) {
            try {
                await deleteDoc(doc(db, "alumnos", id));
            } catch (e) { alert("Error al eliminar."); }
        }
    };

    const handleUpdateConfig = async () => {
        // 1. VALIDACIÓN DE SEGURIDAD
        if (!usuario?.uid) {
            console.error("No hay usuario activo");
            alert("Error: Sesión no detectada.");
            return;
        }

        try {
            // 2. USO SEGURO DE LA ID
            const academiaId = usuario.academiaId || usuario.uid;
            const academiaRef = doc(db, "academias", academiaId);

            await setDoc(academiaRef, {
                ...config,
                ultimaActualizacion: new Date().toISOString()
            }, { merge: true });

            setEditandoConfig(false);
            alert("Configuración actualizada.");
        } catch (e) {
            console.error("Error en Firebase:", e);
        }
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>

            {/* HEADER CON LOGO DINÁMICO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {config.logoBase64 && <img src={config.logoBase64} alt="logo" style={{ width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' }} />}
                        <div>
                            <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.2rem' }}>{config.nombreAcademia.toUpperCase()}</h2>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>{config.sede}</p>
                        </div>
                    </div>
                    <button onClick={() => setEditandoConfig(true)} style={{ ...styles.btnOutline, width: '45px', height: '45px', borderRadius: '50%' }}>⚙️</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <button onClick={() => setVerArchivados(!verArchivados)} style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.8rem', cursor: 'pointer' }}>
                        {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
                    </button>
                    <button onClick={() => setMostrarForm(true)} style={{ ...styles.btnGold, width: 'auto', padding: '10px 25px' }}>+ NUEVO ALUMNO</button>
                </div>
            </div>

            {/* LISTADO DE ALUMNOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {alumnos.length === 0 ? (
                    <div style={{ textAlign: 'center', gridColumn: '1/-1', marginTop: '50px' }}>
                        <p style={{ color: '#444' }}>No hay registros en esta sección.</p>
                        <p style={{ color: '#d4af37', fontSize: '0.7rem' }}>Configura tu Academia en el icono ⚙️ para empezar.</p>
                    </div>
                ) : (
                    alumnos.map(alumno => {
                        const pago = calcularEstadoPago(alumno.diaPago);
                        return (
                            <div key={alumno.id} style={{ ...styles.card, width: '100%', textAlign: 'left', borderLeft: `5px solid ${pago.color}`, padding: '15px', position: 'relative' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ width: '55px', height: '55px', borderRadius: '50%', backgroundColor: '#111', overflow: 'hidden', border: `1px solid ${pago.color}`, flexShrink: 0 }}>
                                        {alumno.fotoBase64 ? <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center', lineHeight: '55px' }}>🥋</div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alumno.nombre}</h3>
                                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#d4af37' }}>{alumno.horario} | {alumno.programa}</p>
                                        <span style={{ fontSize: '0.7rem', color: pago.color, fontWeight: 'bold' }}>{pago.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button onClick={() => {
                                            setNuevo(alumno);
                                            setEditandoId(alumno.id);
                                            setMostrarForm(true);
                                        }} style={{ background: 'none', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>EDITAR</button>
                                        <button onClick={() => {
                                            const msj = alumno.activo ? "¿Archivar?" : "¿Reactivar?";
                                            if (window.confirm(msj)) updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                                        }} style={{ background: 'none', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>
                                            {alumno.activo ? 'VAULT' : '♻️'}
                                        </button>
                                        {verArchivados && (
                                            <button onClick={() => eliminarDefinitivo(alumno.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', borderTop: '1px solid #222', paddingTop: '8px' }}>
                                    <span onClick={() => setAlumnoSeleccionado(alumno)} style={{ cursor: 'pointer', color: '#d4af37', fontWeight: 'bold' }}>📄 EXPEDIENTE</span>
                                    <span>📱 {alumno.telefono || '-'}</span>
                                    <span>📸 {alumno.instagram || '-'}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODAL REGISTRO ALUMNO */}
            {mostrarForm && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '480px', maxHeight: '95vh', overflowY: 'auto', padding: '25px', boxSizing: 'border-box' }}>
                        <h3 style={{ ...styles.goldTitle, marginBottom: '20px', textAlign: 'center' }}>EXPEDIENTE NUEVO ALUMNO</h3>

                        {/* FOTO DE PERFIL */}
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#222', margin: '0 auto 8px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '1.5rem' }}>📷</span>}
                            </div>
                            <input id="fotoInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                            <p style={{ fontSize: '0.5rem', color: '#d4af37' }}>FOTO DE PERFIL</p>
                        </div>

                        {/* SECCIÓN 1: DATOS PERSONALES */}
                        <input
                            placeholder="Nombre completo"
                            style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                            value={nuevo.nombre}
                            onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
                        />

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>EDAD:</label>
                                <input type="number" placeholder="Edad" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.edad} onChange={e => setNuevo({ ...nuevo, edad: e.target.value })} />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>TELÉFONO:</label>
                                <input type="tel" placeholder="Número de WhatsApp" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.telefono} onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })} />
                            </div>
                        </div>

                        <input
                            placeholder="Usuario de Instagram (ej: @ngasi_jiujitsu)"
                            style={{ ...styles.input, width: '100%', boxSizing: 'border-box', marginBottom: '15px' }}
                            value={nuevo.instagram}
                            onChange={e => setNuevo({ ...nuevo, instagram: e.target.value })}
                        />

                        {/* SECCIÓN 2: CONTACTO DE EMERGENCIA */}
                        <div style={{ border: '1px solid #222', padding: '12px', borderRadius: '10px', marginBottom: '15px', backgroundColor: '#050505' }}>
                            <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>EN CASO DE EMERGENCIA LLAMAR A:</label>
                            <input placeholder="Nombre del contacto" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', marginBottom: '8px' }} value={nuevo.contactoEmergenciaNombre} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaNombre: e.target.value })} />
                            <input placeholder="Teléfono de emergencia" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.contactoEmergenciaTel} onChange={e => setNuevo({ ...nuevo, contactoEmergenciaTel: e.target.value })} />
                        </div>

                        {/* SECCIÓN 3: SALUD Y EXPERIENCIA */}
                        <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                            <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>¿CONDICIÓN ESPECIAL O LESIÓN?</label>
                            <input placeholder="Ninguna / Asma, hernia, etc." style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.condicionEspecial} onChange={e => setNuevo({ ...nuevo, condicionEspecial: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>¿TIENE EXPERIENCIA?</label>
                                <select style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.tieneExperiencia} onChange={e => setNuevo({ ...nuevo, tieneExperiencia: e.target.value })}>
                                    <option value="no">No</option>
                                    <option value="si">Sí</option>
                                </select>
                            </div>
                            {nuevo.tieneExperiencia === 'si' && (
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>¿CUÁNTO TIEMPO?</label>
                                    <input placeholder="Ej: 6 meses" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.tiempoExperiencia} onChange={e => setNuevo({ ...nuevo, tiempoExperiencia: e.target.value })} />
                                </div>
                            )}
                        </div>

                        {/* SECCIÓN 4: ACADÉMICO Y PAGOS */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>PROGRAMA:</label>
                                <select style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.programa} onChange={e => setNuevo({ ...nuevo, programa: e.target.value })}>
                                    {config.programas.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>HORARIO:</label>
                                <select style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.horario} onChange={e => setNuevo({ ...nuevo, horario: e.target.value })}>
                                    {config.horarios.map((h, i) => <option key={i} value={`${h.hora} - ${h.nombre}`}>{h.hora} - {h.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                            <label style={{ fontSize: '0.6rem', color: '#d4af37', display: 'block', marginBottom: '5px' }}>FECHA DE PRÓXIMO PAGO:</label>
                            <input type="date" style={{ ...styles.input, width: '100%', boxSizing: 'border-box', margin: 0 }} value={nuevo.fechaPago} onChange={e => setNuevo({ ...nuevo, fechaPago: e.target.value })} />
                        </div>

                        <textarea
                            placeholder="Scouting técnico inicial (Notas del profesor)"
                            style={{ ...styles.input, width: '100%', height: '80px', boxSizing: 'border-box', margin: 0, resize: 'none' }}
                            value={nuevo.notasTecnicas}
                            onChange={e => setNuevo({ ...nuevo, notasTecnicas: e.target.value })}
                        />

                        {/* BOTONES DE ACCIÓN */}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={handleGuardarAlumno} style={{ ...styles.btnGold, flex: 2 }}>REGISTRAR ALUMNO</button>
                            <button onClick={() => setMostrarForm(false)} style={{ ...styles.btnOutline, flex: 1 }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIGURACIÓN (LOGO + HORARIO INTUITIVO) */}
            {editandoConfig && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '450px', maxHeight: '95vh', overflowY: 'auto', padding: '25px', boxSizing: 'border-box' }}>
                        <h3 style={styles.goldTitle}>CONFIGURACIÓN DE SEDE</h3>

                        {/* LOGO */}
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <div onClick={() => document.getElementById('logoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '10px', backgroundColor: '#222', margin: '0 auto 8px', border: '1px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {config.logoBase64 ? <img src={config.logoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: '1.2rem' }}>🏯</span>}
                            </div>
                            <input id="logoInput" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                            <p style={{ fontSize: '0.5rem', color: '#d4af37' }}>LOGO ACADEMIA</p>
                        </div>

                        <input placeholder="Nombre Academia" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={config.nombreAcademia} onChange={e => setConfig({ ...config, nombreAcademia: e.target.value })} />
                        <input placeholder="Sede / Ciudad" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={config.sede} onChange={e => setConfig({ ...config, sede: e.target.value })} />
                        {/* SECCIÓN DE VINCULACIÓN (Solo para el dueño/Profesor) */}
                        {!usuario.academiaId && (
                            <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #d4af37', marginBottom: '20px' }}>
                                <p style={{ color: '#d4af37', fontSize: '0.7rem', margin: '0 0 5px 0' }}>CÓDIGO DE VINCULACIÓN PARA INSTRUCTORES:</p>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <code style={{ flex: 1, backgroundColor: '#000', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', color: '#fff' }}>
                                        {usuario.uid}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(usuario.uid);
                                            alert("Código copiado. Pásalo a tu instructor para que se vincule a tu equipo.");
                                        }}
                                        style={{ ...styles.btnGold, width: 'auto', padding: '10px' }}
                                    >
                                        📋
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px' }}>
                                    Cualquier instructor con este código podrá ver y gestionar a tus alumnos.
                                </p>
                            </div>
                        )}
                        {/* GESTOR DE HORARIOS */}
                        <div style={{ border: '1px solid #222', padding: '15px', borderRadius: '10px', marginTop: '15px', boxSizing: 'border-box' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.7rem', textAlign: 'left', marginBottom: '10px' }}>GESTIÓN DE CLASES:</p>
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                <input type="time" style={{ ...styles.input, width: '100px', margin: 0, boxSizing: 'border-box' }} value={tempHora} onChange={e => setTempHora(e.target.value)} />
                                <input placeholder="Nombre clase" style={{ ...styles.input, flex: 1, margin: 0, boxSizing: 'border-box' }} value={tempNombreClase} onChange={e => setTempNombreClase(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '4px' }}>
                                {["L", "M", "M", "J", "V", "S", "D"].map((dia, i) => (
                                    <button key={i} onClick={() => toggleDia(i)} style={{
                                        flex: 1, height: '35px', borderRadius: '5px', border: '1px solid #333',
                                        backgroundColor: tempDias.includes(i) ? '#d4af37' : '#000',
                                        color: tempDias.includes(i) ? '#000' : '#fff',
                                        fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer'
                                    }}>{dia}</button>
                                ))}
                            </div>
                            <button onClick={agregarHorario} style={{ ...styles.btnGold, width: '100%', margin: 0 }}>AÑADIR CLASE</button>

                            <div style={{ marginTop: '15px', maxHeight: '150px', overflowY: 'auto' }}>
                                {config.horarios?.map((h, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #111', fontSize: '0.75rem' }}>
                                        <span style={{ textAlign: 'left' }}>
                                            <strong style={{ color: '#d4af37' }}>{h.hora}</strong> - {h.nombre} <br />
                                            <small style={{ color: '#666' }}>{h.dias?.map(d => ["L", "M", "M", "J", "V", "S", "D"][d]).join(', ')}</small>
                                        </span>
                                        <button onClick={() => eliminarHorario(i)} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* GESTOR DE PROGRAMAS */}
                        <div style={{ border: '1px solid #222', padding: '15px', borderRadius: '10px', marginTop: '15px', boxSizing: 'border-box' }}>
                            <p style={{ color: '#d4af37', fontSize: '0.7rem', textAlign: 'left', marginBottom: '10px' }}>PROGRAMAS ACTIVOS:</p>
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                                <input placeholder="Nuevo programa" style={{ ...styles.input, flex: 1, margin: 0, boxSizing: 'border-box' }} value={tempNuevoPrograma} onChange={e => setTempNuevoPrograma(e.target.value)} />
                                <button onClick={agregarPrograma} style={{ ...styles.btnGold, width: '50px', margin: 0 }}>+</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {config.programas?.map((p, i) => (
                                    <div key={i} style={{
                                        backgroundColor: '#d4af3711', border: '1px solid #d4af37', color: '#d4af37',
                                        padding: '5px 12px', borderRadius: '15px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        {p} <span onClick={() => eliminarPrograma(i)} style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff' }}>×</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={handleUpdateConfig} style={{ ...styles.btnGold, flex: 1 }}>GUARDAR TODO</button>
                            <button onClick={() => setEditandoConfig(false)} style={{ ...styles.btnOutline, flex: 1 }}>CERRAR</button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- PEGAR AQUÍ EL PANEL PERSONAL --- */}
            {alumnoSeleccionado && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1300, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#111', margin: '0 auto', overflow: 'hidden', border: '2px solid #d4af37' }}>
                                {alumnoSeleccionado.fotoBase64 ? <img src={alumnoSeleccionado.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{lineHeight:'100px', fontSize:'2rem'}}>🥋</div>}
                            </div>
                            <h2 style={{ ...styles.goldTitle, marginTop: '15px' }}>{alumnoSeleccionado.nombre.toUpperCase()}</h2>
                            <p style={{ color: '#666', fontSize: '0.8rem' }}>{alumnoSeleccionado.programa} | {alumnoSeleccionado.horario}</p>
                        </div>

                        <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #222' }}>
                            <h4 style={{ color: '#d4af37', margin: '0 0 10px 0', fontSize: '0.8rem' }}>NOTAS TÉCNICAS Y SEGUIMIENTO:</h4>
                            <textarea 
                                id="notasTecnicasInput"
                                style={{ ...styles.input, width: '100%', height: '150px', resize: 'none', fontSize: '0.85rem', boxSizing: 'border-box', border: '1px solid #333' }}
                                defaultValue={alumnoSeleccionado.notasTecnicas}
                                placeholder="Escribe aquí el progreso técnico, debilidades o comentarios..."
                            />
                            <button 
                                onClick={async () => {
                                    const nuevasNotas = document.getElementById('notasTecnicasInput').value;
                                    await updateDoc(doc(db, "alumnos", alumnoSeleccionado.id), { notasTecnicas: nuevasNotas });
                                    alert("Notas actualizadas. OSS! 🛡️");
                                }}
                                style={{ ...styles.btnGold, marginTop: '10px', fontSize: '0.7rem', width: '100%' }}
                            >
                                GUARDAR NOTAS DEL PROFESOR
                            </button>
                        </div>

                        <div style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', textAlign: 'left', borderTop: '1px solid #222', paddingTop: '15px' }}>
                            <div><strong style={{color:'#d4af37'}}>Edad:</strong> {alumnoSeleccionado.edad || '-'}</div>
                            <div><strong style={{color:'#d4af37'}}>WhatsApp:</strong> {alumnoSeleccionado.telefono || '-'}</div>
                            <div><strong style={{color:'#d4af37'}}>Instagram:</strong> {alumnoSeleccionado.instagram || '-'}</div>
                            <div><strong style={{color:'#d4af37'}}>Experiencia:</strong> {alumnoSeleccionado.tieneExperiencia === 'si' ? alumnoSeleccionado.tiempoExperiencia : 'No'}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong style={{color:'#d4af37'}}>Emergencia:</strong> {alumnoSeleccionado.contactoEmergenciaNombre} ({alumnoSeleccionado.contactoEmergenciaTel})</div>
                            <div style={{ gridColumn: '1/-1' }}><strong style={{color:'#d4af37'}}>Condición Médica:</strong> {alumnoSeleccionado.condicionEspecial || 'Ninguna'}</div>
                        </div>

                        <button onClick={() => setAlumnoSeleccionado(null)} style={{ ...styles.btnOutline, width: '100%', marginTop: '20px' }}>CERRAR EXPEDIENTE</button>
                    </div>
                </div>
            )}
        </div> // Cierre del contenedor principal del componente
    );
};

export default GestionAlumnosPage;