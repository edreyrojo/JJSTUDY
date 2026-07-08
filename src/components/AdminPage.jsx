import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, doc, deleteDoc, addDoc, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';

// Iconos rápidos
const Icons = {
    User: "👤",
    Ticket: "🎫",
    Key: "🔑",
    Trash: "🗑️",
    Check: "✅",
    Search: "🔍",
    Mail: "✉️",
    Shield: "🛡️",
    Megaphone: "📢",
    Send: "🚀",
    Down: "🔻",
    Up: "🔺",
    Building: "🏢", // Nuevo para Academias
    MapPin: "📍"    // Nuevo para Sedes
};

const AdminPage = ({ onBack }) => {
    // Estados Originales
    const [usuarios, setUsuarios] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState('usuarios');
    const [filtroUser, setFiltroUser] = useState("");

    // Estados para crear anuncios
    const [tituloAnuncio, setTituloAnuncio] = useState("");
    const [mensajeAnuncio, setMensajeAnuncio] = useState("");
    const [enviandoAnuncio, setEnviandoAnuncio] = useState(false);

    // --- NUEVOS ESTADOS PARA GESTIÓN DE ACADEMIAS Y SEDES ---
    const [academias, setAcademias] = useState([]);
    const [sedes, setSedes] = useState([]);

    // Formulario Academia
    const [nombreAcademia, setNombreAcademia] = useState("");
    const [creandoAcademia, setCreandoAcademia] = useState(false);

    // Formulario Sede
    const [nombreSede, setNombreSede] = useState("");
    const [academiaSeleccionada, setAcademiaSeleccionada] = useState("");
    const [teamIdProfesor, setTeamIdProfesor] = useState("");
    const [creandoSede, setCreandoSede] = useState(false);

    // Memos Originales
    const listaTitulosDisponibles = useMemo(() => Object.keys(DB_INSTRUCCIONALES).sort(), []);
    const instruccionalesPorAutor = useMemo(() => {
        const autores = {};
        Object.keys(DB_INSTRUCCIONALES).forEach(id => {
            const curso = DB_INSTRUCCIONALES[id];
            if (!autores[curso.autor]) autores[curso.autor] = [];
            autores[curso.autor].push({ id, titulo: curso.titulo });
        });
        return autores;
    }, []);
    // Estado para controlar qué Academias Madre están desplegadas en el Árbol (Acordeón)
    const [academiasAbiertas, setAcademiasAbiertas] = useState({});

    // Función rápida para alternar (abrir/cerrar) el acordeón de una academia
    const toggleAcademia = (id) => {
        setAcademiasAbiertas(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const notify = (mensaje, tipo = 'success') => {
        Swal.fire({
            text: mensaje, icon: tipo,
            background: '#121212', color: '#fff',
            confirmButtonColor: '#d4af37',
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
        });
    };
    // 1. ASIGNACIÓN RÁPIDA DE PERSONAL DESDE SELECTOR (Profesor o Instructor)
    const handleAsignarPersonal = async (uidUsuario, nuevoRol, idSede, idAcademia) => {
        if (!uidUsuario) return;
        try {
            const userRef = doc(db, "usuarios", uidUsuario);
            await setDoc(userRef, {
                rol: nuevoRol,
                sedeId: idSede || idAcademia,
                teamId: idSede || idAcademia,
                academiaId: idAcademia
            }, { merge: true });
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `¡Asignado como ${nuevoRol.toUpperCase()} con éxito!`,
                showConfirmButton: false,
                timer: 2000
            });
        } catch (error) {
            Swal.fire("Error", "No se pudo asignar el personal: " + error.message, "error");
        }
    };

    const generarCodigoSedeMadre = async (idSede, nombreAca) => {
        try {
            const prefijo = (nombreAca || "DOJO").slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "X");
            const rand = Math.floor(100 + Math.random() * 900);
            const nuevoCodigo = `${prefijo}-MADRE${rand}`;

            // 1. Crear la referencia al documento
            const sedeRef = doc(db, "sedes", idSede);

            // 2. Ejecutar setDoc (ahora sí lo reconocerá)
            await setDoc(sedeRef, {
                codigoAcceso: nuevoCodigo,
                nombreSede: nombreAca || "Sede Madre Principal",
                ciudad: "Sede Central"
            }, { merge: true });

            Swal.fire('¡Listo!', `Código generado: ${nuevoCodigo}`, 'success');
        } catch (err) {
            console.error("Error al generar código:", err);
            Swal.fire('Error', err.message, 'error');
        }
    };

    useEffect(() => {
        // 1. Definimos las escuchas (listeners)
        const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snap) => {
            setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubTickets = onSnapshot(collection(db, "soporte"), (snap) => {
            const listaT = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTickets(listaT.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        });

        const unsubAcademias = onSnapshot(collection(db, "academias"), (snap) => {
            setAcademias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubSedes = onSnapshot(collection(db, "sedes"), (snap) => {
            setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setCargando(false); // Una vez cargan las sedes, quitamos el loader
        });

        // 2. Limpieza (Muy importante para no duplicar escuchas)
        return () => {
            unsubUsuarios();
            unsubTickets();
            unsubAcademias();
            unsubSedes();
        };
    }, []);

    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter(u =>
            u.nombre?.toLowerCase().includes(filtroUser.toLowerCase()) ||
            u.email?.toLowerCase().includes(filtroUser.toLowerCase())
        );
    }, [usuarios, filtroUser]);
    const [logoAcademiaBase64, setLogoAcademiaBase64] = useState('');
    const handleLogoAcademiaChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1048487) { // Límite de seguridad: 1MB
                Swal.fire('Error', 'La imagen es demasiado pesada. Máximo 1MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setLogoAcademiaBase64(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleAction = async (id, collectionName, action, data = null) => {
        try {
            if (action === 'delete') {
                const res = await Swal.fire({
                    title: '¿Confirmar eliminación?',
                    text: "Se eliminará permanentemente de la base de datos",
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#1a1a1a', color: '#fff',
                    confirmButtonColor: '#ff4444',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Sí, eliminar'
                });
                if (!res.isConfirmed) return;
                await deleteDoc(doc(db, collectionName, id));
                notify("Registro eliminado con éxito");
            } else {
                await updateDoc(doc(db, collectionName, id), data);
                notify("Vault actualizado");
            }
        } catch (error) { notify(error.message, "error"); }
    };

    // --- CONTROLADOR UNIFICADO DE CREACIÓN PARA ACADEMIA / FRANQUICIA ---
    const handleCrearAcademia = async (e) => {
        e.preventDefault();
        if (!nombreAcademia.trim()) {
            return notify("Ingresa un nombre de academia válido", "error");
        }
        setCreandoAcademia(true);
        try {
            const nombreLimpio = nombreAcademia.trim().toUpperCase();
            await addDoc(collection(db, "academias"), {
                nombre: nombreLimpio,
                nombreAcademia: nombreLimpio,
                horarios: [],
                logoBase64: "",
                programas: ["BJJ Adultos", "BJJ Kids", "No-Gi"],
                sede: "",
                fechaCreacion: new Date().toLocaleString(),
                ultimaActualizacion: new Date().toISOString(),
                timestamp: Date.now()
            });
            notify(`Academia "${nombreLimpio}" registrada con éxito 🏢`);
            setNombreAcademia('');
        } catch (error) {
            console.error("Error al crear academia:", error);
            notify("Error al crear la academia en la base de datos", "error");
        } finally {
            setCreandoAcademia(false);
        }
    };

    // --- CONTROLADOR UNIFICADO PARA VINCULAR NUEVA SEDE ---
    const handleCrearSede = async (e) => {
        e.preventDefault();
        if (!nombreSede.trim() || !academiaSeleccionada || !teamIdProfesor.trim()) {
            return notify("Por favor completa todos los campos de la sede", "error");
        }
        setCreandoSede(true);
        try {
            const academiaObj = academias.find(a => a.id === academiaSeleccionada);
            const nombreAlianza = academiaObj
                ? (academiaObj.nombreAcademia || academiaObj.nombre || "SIN ALIANZA")
                : "SIN ALIANZA";

            // Generamos un código de acceso automático (Ej: HOL-SED-1234)
            const prefijo = nombreAlianza.substring(0, 3).toUpperCase();
            const codigoGenerado = `${prefijo}-SED-${Date.now().toString().slice(-4)}`;
            const nombreSedeLimpia = nombreSede.trim().toUpperCase();

            await addDoc(collection(db, "sedes"), {
                nombre: nombreSedeLimpia,
                nombreSede: nombreSedeLimpia,
                academiaId: academiaSeleccionada,
                academiaNombre: nombreAlianza,
                teamId: teamIdProfesor.trim(), // UID del profesor responsable
                ciudad: "Xalapa",
                codigoAcceso: codigoGenerado,
                horarios: [],
                programas: ["BJJ Adultos", "BJJ Kids", "No-Gi"],
                fechaCreacion: new Date().toLocaleString(),
                ultimaActualizacion: new Date().toISOString(),
                timestamp: Date.now()
            });

            notify(`Sede "${nombreSedeLimpia}" vinculada y configurada 📍`);
            setNombreSede('');
            setTeamIdProfesor('');
            setAcademiaSeleccionada('');
        } catch (error) {
            console.error("Error al crear sede:", error);
            notify("Error al vincular la sede", "error");
        } finally {
            setCreandoSede(false);
        }
    };

    // --- FUNCIONES DE MANTENIMIENTO ORIGINALES ---
    const corregirIdsAlumnos = async () => {
        const ID_ERRONEO = "0xwL28fPsjcij3AVltJVEImPrO72";
        const ID_CORRECTO = "0xwL28fPsjcij3AVltJVElmPr072";

        const confirm = await Swal.fire({
            title: '¿Corregir IDs de Alumnos?',
            text: `Esto cambiará todos los alumnos que tengan el ID erróneo por el correcto. ¡Asegúrate de haber hecho un backup en Firebase!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, corregir datos',
            background: '#1a1a1a',
            color: '#fff'
        });

        if (!confirm.isConfirmed) return;

        try {
            const alumnosRef = collection(db, "alumnos");
            const snapshot = await getDocs(alumnosRef);
            const batch = writeBatch(db);
            let count = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.teamId === ID_ERRONEO) {
                    batch.update(docSnap.ref, { teamId: ID_CORRECTO });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                notify(`¡Éxito! Se corrigieron ${count} alumnos.`, 'success');
            } else {
                notify("No se encontraron alumnos con el ID erróneo.", "info");
            }
        } catch (error) {
            console.error("Error en migración:", error);
            notify("Hubo un error al migrar: " + error.message, "error");
        }
    };

    const vincularUsuarioASede = async (usuarioId, nuevaSedeId, nuevoRol) => {
        try {
            // 1. Actualizamos el usuario (sedeId y rol)
            await updateDoc(doc(db, "usuarios", usuarioId), {
                sedeId: nuevaSedeId,
                rol: nuevoRol
            });

            notify("Personal vinculado correctamente", "success");
        } catch (error) {
            notify("Error al vincular: " + error.message, "error");
        }
    };

    const handlePublicarAnuncio = async () => {
        if (!tituloAnuncio.trim() || !mensajeAnuncio.trim()) {
            return notify("Por favor completa el título y el mensaje.", "error");
        }

        setEnviandoAnuncio(true);
        try {
            await addDoc(collection(db, "anuncios"), {
                titulo: tituloAnuncio.trim(),
                mensaje: mensajeAnuncio.trim(),
                fecha: new Date().toLocaleString(),
                timestamp: Date.now()
            });
            notify("¡Anuncio publicado globalmente! 📢");
            setTituloAnuncio("");
            setMensajeAnuncio("");
        } catch (error) {
            console.error("Error al publicar:", error);
            notify("Hubo un error al publicar el anuncio.", "error");
        } finally {
            setEnviandoAnuncio(false);
        }
    };

    return (
        <div style={s.container}>
            {/* Sidebar / Topbar */}
            <header style={s.header}>
                <div>
                    <h1 style={s.title}>{Icons.Shield} CONTROL MAESTRO</h1>
                    <p style={s.subtitle}>Gestión de Usuarios, Accesos y Comunicados</p>
                </div>
                <button onClick={onBack} style={s.btnBack}>←</button>
            </header>

            {/* Estadísticas Rápidas */}
            <section style={s.statsGrid}>
                <StatCard label="Usuarios Totales" value={usuarios.length} icon={Icons.User} color="#d4af37" />
                <StatCard label="Academias Registradas" value={academias.length} icon={Icons.Building} color="#2196F3" />
                <StatCard label="Sedes Activas" value={sedes.length} icon={Icons.MapPin} color="#4CAF50" />
            </section>

            {/* Navegación Principal */}
            <div style={s.tabContainer}>
                <button
                    onClick={() => setTabActiva('usuarios')}
                    style={tabActiva === 'usuarios' ? s.tabActive : s.tabInactive}
                >
                    {Icons.User} BASE DE USUARIOS
                </button>
                <button
                    onClick={() => setTabActiva('estructuras')}
                    style={tabActiva === 'estructuras' ? s.tabActive : s.tabInactive}
                >
                    {Icons.Building} ESTRUCTURAS (NUEVO)
                </button>
                <button
                    onClick={() => setTabActiva('anuncios')}
                    style={tabActiva === 'anuncios' ? s.tabActive : s.tabInactive}
                >
                    {Icons.Megaphone} PUBLICAR ANUNCIO
                </button>
                <button
                    onClick={() => setTabActiva('tickets')}
                    style={tabActiva === 'tickets' ? s.tabActiveInfo : s.tabInactive}
                >
                    {Icons.Ticket} TICKETS SOPORTE
                    {tickets.length > 0 && <span style={s.badge}>{tickets.length}</span>}
                </button>
                <button
                    onClick={() => setTabActiva('mantenimiento')}
                    style={tabActiva === 'mantenimiento' ? s.tabActive : s.tabInactive}
                >
                    ⚙️ MANTENIMIENTO
                </button>
            </div>


            {cargando ? (
                <div style={s.loader}>Sincronizando la base de datos...</div>
            ) : (
                <main style={s.main}>
                    {/* ───────────────────────────────────────────── */}
                    {/* VISTA 1: USUARIOS                             */}
                    {/* ───────────────────────────────────────────── */}
                    {tabActiva === 'usuarios' && (
                        <div style={s.viewSection}>
                            <div style={s.searchBar}>
                                <span style={{ marginRight: '10px' }}>{Icons.Search}</span>
                                <input
                                    placeholder="Buscar guerrero por nombre o email..."
                                    style={s.searchInput}
                                    onChange={(e) => setFiltroUser(e.target.value)}
                                />
                            </div>

                            <div style={s.userList}>
                                {usuariosFiltrados.map(u => (
                                    <UserRow
                                        key={u.id}
                                        user={u}
                                        autores={instruccionalesPorAutor}
                                        onUpdate={(data) => handleAction(u.id, 'usuarios', 'update', data)}
                                    />
                                ))}
                                {usuariosFiltrados.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>No se encontraron usuarios.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {tabActiva === 'estructuras' && (
                        <div style={s.viewSection}>

                                {/* 🌳 1. ÁRBOL ORGANIZACIONAL MAESTRO */}
                                <div style={{ ...s.panelBox, marginBottom: '30px', border: '1px solid #d4af3744', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
                                        <h2 style={{ color: '#fff', margin: 0 }}>🌳 Árbol Organizacional Maestro</h2>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Haz clic en una academia para gestionar</span>
                                    </div>

                                    {academias.map(aca => {
                                        const logoAca = aca.logoBase64 || aca.logobase64;
                                        const nombreAca = aca.nombreAcademia || aca.nombre || 'Academia Principal';
                                        const estaAbierto = !!academiasAbiertas[aca.id];

                                        // Filtros optimizados
                                        const profesMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'profesor' && u.sedeId === aca.id);
                                        const instsMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'instructor' && u.sedeId === aca.id);
                                        const sedesAfiliadas = sedes.filter(se => se.academiaId === aca.id && se.id !== aca.id);

                                        return (
                                            <div key={aca.id} style={{ marginBottom: '15px', borderLeft: '4px solid #d4af37', background: '#0a0a0a', borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
                                                {/* CABECERA ACORDEÓN */}
                                                <div onClick={() => toggleAcademia(aca.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer', background: estaAbierto ? '#141414' : '#0e0e0e' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        {logoAca ? <img src={logoAca} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px' }} /> : <span style={{ fontSize: '1.8rem' }}>🏢</span>}
                                                        <h3 style={{ color: '#fff', margin: 0 }}>{nombreAca}</h3>
                                                    </div>
                                                    <div style={{ color: '#d4af37' }}>{estaAbierto ? '▼' : '►'}</div>
                                                </div>

                                                {/* CONTENIDO */}
                                                {estaAbierto && (
                                                    <div style={{ padding: '20px' }}>
                                                        {/* --- SECCIÓN MADRE --- */}
                                                        <div style={{ background: '#141414', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #fff', marginBottom: '20px' }}>
                                                            <h4 style={{ color: '#d4af37', margin: '0 0 10px 0' }}>🏠 SEDE MADRE</h4>

                                                            {/* Profesores Madre */}
                                                            <p style={{ color: '#aaa', fontSize: '0.75rem', margin: '5px 0' }}>PROFESORES:</p>
                                                            {profesMadre.map(p => (
                                                                <div key={p.uid} style={{ display: 'flex', justifyContent: 'space-between', background: '#1f1f1f', padding: '5px 10px', borderRadius: '4px', marginBottom: '5px' }}>
                                                                    <span style={{ fontSize: '0.8rem' }}>{p.nombre}</span>
                                                                    <button onClick={() => handleAsignarPersonal(p.uid, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                </div>
                                                            ))}
                                                            <select style={{ ...s.formInput, marginBottom: '10px' }} onChange={(e) => { if (e.target.value) handleAsignarPersonal(e.target.value, 'profesor', aca.id, aca.id); e.target.value = ''; }}>
                                                                <option value="">+ Asignar Profesor...</option>
                                                                {usuarios.map(u => <option key={u.uid} value={u.uid}>{u.nombre || u.email}</option>)}
                                                            </select>

                                                            {/* Instructores Madre */}
                                                            <p style={{ color: '#aaa', fontSize: '0.75rem', margin: '5px 0' }}>INSTRUCTORES:</p>
                                                            {instsMadre.map(i => (
                                                                <div key={i.uid} style={{ display: 'flex', justifyContent: 'space-between', background: '#1f1f1f', padding: '5px 10px', borderRadius: '4px', marginBottom: '5px' }}>
                                                                    <span style={{ fontSize: '0.8rem' }}>{i.nombre}</span>
                                                                    <button onClick={() => handleAsignarPersonal(i.uid, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                </div>
                                                            ))}
                                                            <select style={s.formInput} onChange={(e) => { if (e.target.value) handleAsignarPersonal(e.target.value, 'instructor', aca.id, aca.id); e.target.value = ''; }}>
                                                                <option value="">+ Asignar Instructor...</option>
                                                                {usuarios.map(u => <option key={u.uid} value={u.uid}>{u.nombre || u.email}</option>)}
                                                            </select>
                                                        </div>

                                                        {/* --- 2. SECCIÓN: SEDES AFILIADAS (CORREGIDA) --- */}
<div style={{ marginTop: '20px' }}>
    <div style={{ color: '#d4af37', fontSize: '0.85rem', marginBottom: '10px', borderBottom: '1px solid #d4af3744', paddingBottom: '5px' }}>
        📍 SEDES AFILIADAS ({sedesAfiliadas.length}):
    </div>
    
    {sedesAfiliadas.length > 0 ? (
        sedesAfiliadas.map(se => {
            // CORRECCIÓN: Filtramos ambos roles
            const personalSede = usuarios.filter(u => u.sedeId === se.id && (u.rol === 'instructor' || u.rol === 'profesor'));
            
            return (
                <div key={se.id} style={{ background: '#111', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #222' }}>
                    <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
                        {se.nombreSede || se.nombre}
                    </div>
                    
                    {/* Lista de Personal actual */}
                    {personalSede.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                            {personalSede.map(u => (
                                <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '4px 8px', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#fff' }}>
                                        {u.nombre || u.email} <small style={{ color: '#888' }}>({u.rol})</small>
                                    </span>
                                    <button 
                                        onClick={() => handleAsignarPersonal(u.uid, 'alumno', '', aca.id)} 
                                        style={{ ...s.btnTextDelete, fontSize: '0.7rem', color: '#ff4444' }}
                                    >
                                        Remover
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', marginBottom: '10px' }}>Sin personal asignado</div>
                    )}

                    {/* SELECTOR: Mantenemos el rol original del usuario al asignar */}
                    <select 
                        style={{ ...s.formInput, width: '100%', padding: '6px', fontSize: '0.75rem', borderColor: '#333' }} 
                        onChange={(e) => { 
                            if (e.target.value) {
                                const usuarioSeleccionado = usuarios.find(u => u.uid === e.target.value);
                                // Pasamos el rol que ya tiene (instructor o profesor)
                                handleAsignarPersonal(e.target.value, usuarioSeleccionado.rol, se.id, aca.id); 
                                e.target.value = ''; 
                            }
                        }}
                    >
                        <option value="">+ Asignar Profesor/Instructor...</option>
                        {usuarios.filter(u => u.rol === 'instructor' || u.rol === 'profesor').map(u => (
                            <option key={u.uid} value={u.uid}>{u.nombre || u.email} ({u.rol})</option>
                        ))}
                    </select>
                </div>
            );
        })
    ) : (
        <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.85rem' }}>No hay sedes afiliadas registradas.</div>
    )}
</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                            {/* 🏛️ 2. FORMULARIOS DE REGISTRO */}
                            <div style={s.structureGrid}>
                                <div style={s.panelBox}>
                                    <h2 style={{ color: '#d4af37', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>{Icons.Building} Registrar Academia</h2>
                                    <form onSubmit={handleCrearAcademia} style={{ marginBottom: '30px' }}>
                                        <label style={s.formLabel}>NOMBRE DE LA ACADEMIA</label>
                                        <input style={s.formInput} value={nombreAcademia} onChange={(e) => setNombreAcademia(e.target.value)} placeholder="Ej. HOLKAN HAKAGURE" />
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#1f1f1f', color: '#d4af37', border: '1px dashed #d4af37', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px' }}>
                                            <span>📁 LOGOTIPO</span>
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoAcademiaChange} />
                                        </label>
                                        <button type="submit" disabled={creandoAcademia} style={s.btnGoldAction}>{creandoAcademia ? "REGISTRANDO..." : "REGISTRAR"}</button>
                                    </form>

                                    <h3 style={{ color: '#fff', borderBottom: '1px solid #222', paddingBottom: '8px' }}>Academias Registradas ({academias.length})</h3>
                                    <div style={s.listContainer}>
                                        {academias.map(ac => (
                                            <div key={ac.id} style={s.listItem}>
                                                <span>🏢 {ac.nombreAcademia || ac.nombre || ac.id}</span>
                                                <button onClick={() => handleAction(ac.id, 'academias', 'delete')} style={s.btnTextDelete}>Eliminar</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* BLOQUE VINCULAR SEDE Y LISTA */}
                                <div style={s.panelBox}>
                                    <h2 style={{ color: '#4CAF50', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>{Icons.MapPin} Vincular Nueva Sede</h2>
                                    <form onSubmit={handleCrearSede} style={{ marginBottom: '30px' }}>
                                        <label style={s.formLabel}>NOMBRE DE LA SEDE</label>
                                        <input style={s.formInput} value={nombreSede} onChange={(e) => setNombreSede(e.target.value)} placeholder="Ej. BUJUTSU VERACRUZ" />
                                        <label style={s.formLabel}>ACADEMIA MADRE</label>
                                        <select style={s.selectFullStyle} value={academiaSeleccionada} onChange={(e) => setAcademiaSeleccionada(e.target.value)}>
                                            <option value="">-- SELECCIONAR ACADEMIA --</option>
                                            {academias.map(ac => (<option key={ac.id} value={ac.id}>{ac.nombreAcademia || ac.nombre || ac.id}</option>))}
                                        </select>
                                        <label style={s.formLabel}>SELECCIONAR PROFESOR (TEAM ID)</label>
<select 
    style={s.selectFullStyle} 
    value={teamIdProfesor} 
    onChange={(e) => setTeamIdProfesor(e.target.value)}
>
    <option value="">-- SELECCIONAR PROFESOR --</option>
    {usuarios
        // Filtramos para que solo aparezcan profesores o admins
        .filter(u => u.rol === 'profesor' || u.rol === 'admin') 
        .map(u => (
            <option key={u.id} value={u.uid || u.id}>
                {u.nombre || u.email || "Usuario sin nombre"} ({u.rol})
            </option>
        ))
    }
</select>
                                        <input style={s.formInput} value={teamIdProfesor} onChange={(e) => setTeamIdProfesor(e.target.value)} placeholder="UID del Profesor" />
                                        <button type="submit" disabled={creandoSede} style={s.btnGreenAction}>{creandoSede ? "ENLAZANDO..." : "VINCULAR SEDE"}</button>
                                    </form>

                                    <h3 style={{ color: '#fff', borderBottom: '1px solid #222', paddingBottom: '8px' }}>Sedes Vinculadas</h3>
                                    <div style={s.listContainer}>
                                        {academias.map(ac => {
                                            const sedesDeAcademia = sedes.filter(se => se.academiaId === ac.id || se.id === ac.id);
                                            if (sedesDeAcademia.length === 0) return null;
                                            const estaAbierto = !!academiasAbiertas[`sedes_${ac.id}`];

                                            return (
                                                <div key={ac.id} style={{ marginBottom: '10px', background: '#141414', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <div onClick={() => toggleAcademia(`sedes_${ac.id}`)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', cursor: 'pointer', background: '#1a1a1a', color: '#d4af37', fontSize: '0.9rem' }}>
                                                        <strong>{ac.nombreAcademia || ac.nombre || ac.id} ({sedesDeAcademia.length})</strong>
                                                        <span>{estaAbierto ? '▼' : '►'}</span>
                                                    </div>
                                                    {estaAbierto && (
                                                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {sedesDeAcademia.map((se) => (
                                                                <div key={se.id} style={{ ...s.listItemSede, background: '#1f1f1f', padding: '8px', borderRadius: '4px' }}>
                                                                    <span>📍 {se.nombreSede || 'Sede'}</span>
                                                                    <button onClick={() => handleAction(se.id, 'sedes', 'delete')} style={s.btnTextDelete}>Eliminar</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ───────────────────────────────────────────── */}
                    {/* VISTA 3: PUBLICAR ANUNCIO                     */}
                    {/* ───────────────────────────────────────────── */}
                    {tabActiva === 'anuncios' && (
                        <div style={s.viewSection}>
                            <div style={s.anuncioCard}>
                                <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>
                                    <h2 style={{ color: '#d4af37', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {Icons.Megaphone} Enviar Notificación Global
                                    </h2>
                                    <p style={{ color: '#888', fontSize: '0.85rem', margin: '5px 0 0 0' }}>
                                        Este mensaje activará la campanita roja en el Hub de todos los alumnos registrados.
                                    </p>
                                </div>

                                <label style={s.formLabel}>TÍTULO DEL ANUNCIO (Ej. Nueva Actualización v2.0)</label>
                                <input
                                    style={s.formInput}
                                    value={tituloAnuncio}
                                    onChange={(e) => setTituloAnuncio(e.target.value)}
                                    placeholder="Escribe el título aquí..."
                                    maxLength={50}
                                />

                                <label style={s.formLabel}>MENSAJE / DESCRIPCIÓN DETALLADA</label>
                                <textarea
                                    style={s.formTextarea}
                                    value={mensajeAnuncio}
                                    onChange={(e) => setMensajeAnuncio(e.target.value)}
                                    placeholder="Explica qué hay de nuevo, qué se arregló, etc..."
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                                    <button
                                        onClick={handlePublicarAnuncio}
                                        disabled={enviandoAnuncio || !tituloAnuncio.trim() || !mensajeAnuncio.trim()}
                                        style={(!tituloAnuncio.trim() || !mensajeAnuncio.trim()) ? s.btnPublishDisabled : s.btnPublish}
                                    >
                                        {enviandoAnuncio ? 'PUBLICANDO...' : <>{Icons.Send} PUBLICAR AHORA</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ───────────────────────────────────────────── */}
                    {/* VISTA 4: TICKETS DE SOPORTE                   */}
                    {/* ───────────────────────────────────────────── */}
                    {tabActiva === 'tickets' && (
                        <div style={s.viewSection}>
                            {tickets.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '50px', color: '#4CAF50' }}>
                                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>{Icons.Check}</span>
                                    <h2>TODO DESPEJADO</h2>
                                    <p style={{ color: '#666' }}>No hay tickets de soporte pendientes.</p>
                                </div>
                            ) : (
                                <div style={s.ticketGrid}>
                                    {tickets.map(t => (
                                        <div key={t.id} style={s.ticketCard}>
                                            <div style={s.cardHeader}>
                                                <span style={s.date}>{t.fecha}</span>
                                                <span style={t.tipo === 'video_fail' ? s.tagError : s.tagInfo}>
                                                    {t.tipo === 'video_fail' ? 'FALLO VIDEO' : 'SOPORTE'}
                                                </span>
                                            </div>
                                            <h4 style={s.userName}>{t.nombre?.toUpperCase()}</h4>
                                            <p style={s.message}>{t.mensaje}</p>
                                            <div style={s.cardActions}>
                                                <a href={`mailto:${t.email}`} style={s.btnMail}>{Icons.Mail} CONTACTAR</a>
                                                <button onClick={() => handleAction(t.id, 'soporte', 'delete')} style={s.btnResolve}>RESOLVER</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            )}
        </div>
    );
};

// --- SUBCOMPONENTES ---
const StatCard = ({ label, value, icon, color }) => (
    <div style={{ ...s.statCard, borderBottom: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <div style={s.statValue}>{value}</div>
                <div style={s.statLabel}>{label}</div>
            </div>
            <div style={{ fontSize: '2rem', opacity: 0.8 }}>{icon}</div>
        </div>
    </div>
);

// --- USER ROW CON ACORDEÓN REFORZADO ---
const UserRow = ({ user, autores = {}, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState("");

    const [localAcademiaId, setLocalAcademiaId] = useState(user.academiaId || "");
    const [localSedeId, setLocalSedeId] = useState(user.sedeId || "");

    useEffect(() => {
        setLocalAcademiaId(user.academiaId || "");
        setLocalSedeId(user.sedeId || "");
    }, [user.academiaId, user.sedeId]);

    const handleLiberarTodo = async () => {
        if (!autores || Object.keys(autores).length === 0) {
            return Swal.fire("Error", "No hay catálogo cargado para liberar.", "error");
        }
        const todosLosIds = Object.values(autores).flat().map(curso => curso.id);
        const result = await Swal.fire({
            title: '¿LIBERAR TODO EL VAULT?',
            text: `Se le dará acceso a ${todosLosIds.length} instruccionales a ${user.nombre?.toUpperCase()}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'SÍ, ACCESO TOTAL',
            cancelButtonText: 'CANCELAR',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333'
        });
        if (result.isConfirmed) {
            onUpdate({ cursos_liberados: todosLosIds });
        }
    };

    const tieneCambiosDeIds = localAcademiaId !== (user.academiaId || "") || localSedeId !== (user.sedeId || "");

    return (
        <div style={s.userCard}>
            <div
                style={{ ...s.userInfo, cursor: 'pointer' }}
                onClick={() => setIsExpanded(!isExpanded)}
                title="Clic para expandir/contraer gestión"
            >
                <div style={s.userMainInfo}>
                    <span style={user.validado ? s.statusOnline : s.statusOffline}>●</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>{user.nombre?.toUpperCase() || 'ANÓNIMO'}</strong>
                        <span style={s.userEmail}>{user.email}</span>
                    </div>
                </div>
                <div style={s.userControls}>
                    {!isExpanded && user.cursos_liberados?.length > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#d4af37', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: '4px 8px', borderRadius: '12px', border: '1px solid #d4af37' }}>
                            {user.cursos_liberados.length} extras
                        </span>
                    )}
                    {!user.validado && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdate({ validado: true }); }}
                            style={s.btnAccess}
                        >
                            AUTORIZAR
                        </button>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>
                        {isExpanded ? Icons.Up : Icons.Down}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <div style={{ ...s.courseSection, animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #333' }}>
                        <label style={s.courseLabel}>ROL DEL SISTEMA:</label>
                        <select
                            value={user.rol || 'alumno'}
                            onChange={(e) => onUpdate({ rol: e.target.value })}
                            style={s.select}
                        >
                            <option value="alumno">Alumno</option>
                            <option value="instructor">Instructor</option>
                            <option value="profesor">Profesor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #333' }}>
                        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={s.courseLabel}>ACADEMIA ID / TEAM ID:</label>
                            <input
                                type="text"
                                value={localAcademiaId}
                                onChange={(e) => setLocalAcademiaId(e.target.value)}
                                placeholder="UID del Profesor / Academia"
                                style={s.formInputInline}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={s.courseLabel}>SEDE ID:</label>
                            <input
                                type="text"
                                value={localSedeId}
                                onChange={(e) => setLocalSedeId(e.target.value)}
                                placeholder="Código de Acceso de Sede"
                                style={s.formInputInline}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                onClick={() => onUpdate({
                                    academiaId: localAcademiaId.trim() || null,
                                    teamId: localAcademiaId.trim() || null,
                                    sedeId: localSedeId.trim() || null
                                })}
                                style={tieneCambiosDeIds ? s.btnSaveIds : s.btnSaveIdsDisabled}
                                disabled={!tieneCambiosDeIds}
                            >
                                ACTUALIZAR NEXO
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <label style={s.courseLabel}>CONTENIDO DESBLOQUEADO:</label>
                        <button onClick={handleLiberarTodo} style={s.btnUnlockAll}>
                            + LIBERAR TODO EL CATÁLOGO
                        </button>
                    </div>

                    <div style={s.courseChips}>
                        {user.cursos_liberados?.length > 0 ? user.cursos_liberados.map(c => (
                            <div key={c} style={s.chip}>
                                {(typeof DB_INSTRUCCIONALES !== 'undefined' && DB_INSTRUCCIONALES[c]?.titulo) || c}
                                <span style={s.chipX} onClick={() => onUpdate({ cursos_liberados: user.cursos_liberados.filter(id => id !== c) })}>×</span>
                            </div>
                        )) : <span style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>El usuario no tiene accesos extra.</span>}
                    </div>

                    <div style={s.addCourseBox}>
                        <select
                            style={s.selectFull}
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                        >
                            <option value="">-- AÑADIR INSTRUCCIONAL ESPECÍFICO --</option>
                            {autores && Object.keys(autores).map(autor => (
                                <optgroup key={autor} label={autor.toUpperCase()}>
                                    {autores[autor].map(curso => (
                                        <option key={curso.id} value={curso.id}>{curso.titulo}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                if (!selectedCourse) return;
                                onUpdate({ cursos_liberados: [...(user.cursos_liberados || []), selectedCourse] });
                                setSelectedCourse("");
                            }}
                            style={s.btnAdd}
                        >
                            OTORGAR ACCESO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- ESTILOS COMPLETO CON LOS DE ESTRUCTURA INTEGRADOS ---
const s = {
    container: { backgroundColor: '#050505', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '20px', boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' },
    title: { color: '#d4af37', margin: 0, fontSize: '1.8rem', letterSpacing: '2px', textTransform: 'uppercase' },
    subtitle: { color: '#888', margin: '5px 0 0 0', fontSize: '0.9rem' },
    btnBack: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '8px 16px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', transition: '0.2s' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' },
    statCard: { backgroundColor: '#111', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', border: '1px solid #222' },
    statValue: { fontSize: '2rem', fontWeight: '900', color: '#fff', lineHeight: '1' },
    statLabel: { fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginTop: '8px', letterSpacing: '1px' },
    tabContainer: { display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px', borderBottom: '1px solid #222' },
    tabInactive: { background: 'transparent', border: 'none', color: '#666', padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', whiteSpace: 'nowrap' },
    tabActive: { background: '#1a1a1a', border: 'none', color: '#d4af37', padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '3px solid #d4af37', whiteSpace: 'nowrap' },
    tabActiveInfo: { background: '#1a1a1a', border: 'none', color: '#ff4444', padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '3px solid #ff4444', whiteSpace: 'nowrap' },
    badge: { backgroundColor: '#ff4444', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', marginLeft: '5px' },
    loader: { color: '#d4af37', textAlign: 'center', padding: '50px', fontSize: '1.2rem', letterSpacing: '2px' },
    main: { display: 'flex', flexDirection: 'column', gap: '20px' },
    viewSection: { animation: 'fadeIn 0.3s ease-in-out' },
    searchBar: { backgroundColor: '#111', padding: '15px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', border: '1px solid #333', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' },
    searchInput: { background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: '1rem' },
    userList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    userCard: { backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '12px', padding: '15px 20px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', transition: 'transform 0.2s', overflow: 'hidden' },
    userInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', userSelect: 'none' },
    userMainInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
    userControls: { display: 'flex', alignItems: 'center', gap: '10px' },
    userEmail: { color: '#777', fontSize: '0.85rem' },
    statusOnline: { color: '#4CAF50', textShadow: '0 0 8px rgba(76, 175, 80, 0.5)' },
    statusOffline: { color: '#ff4444' },
    select: { backgroundColor: '#1a1a1a', color: '#d4af37', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' },
    btnAccess: { backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(76,175,80,0.3)' },
    courseSection: { marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #222' },
    courseLabel: { fontSize: '0.75rem', color: '#888', fontWeight: 'bold', letterSpacing: '1px', margin: 0 },
    btnUnlockAll: { background: 'rgba(76, 175, 80, 0.1)', border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '0.7rem', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' },
    courseChips: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' },
    chip: { backgroundColor: '#111', border: '1px solid #d4af37', color: '#e0c068', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' },
    chipX: { cursor: 'pointer', color: '#ff4444', fontWeight: 'bold', padding: '0 5px' },
    addCourseBox: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    selectFull: { backgroundColor: '#111', border: '1px solid #444', color: '#fff', padding: '10px 15px', borderRadius: '6px', flex: 1, minWidth: '200px', fontSize: '0.9rem', outline: 'none' },
    btnAdd: { backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
    formInputInline: { backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', width: '100%' },
    btnSaveIds: { backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '11px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(212,175,55,0.2)', transition: '0.2s' },
    btnSaveIdsDisabled: { backgroundColor: '#222', border: '1px solid #333', color: '#555', padding: '11px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '0.85rem', whiteSpace: 'nowrap' },
    ticketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
    ticketCard: { backgroundColor: '#111', border: '1px solid #333', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    date: { color: '#666', fontSize: '0.75rem' },
    tagError: { backgroundColor: 'rgba(255,68,68,0.1)', color: '#ff4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #ff4444' },
    tagInfo: { backgroundColor: 'rgba(212,175,55,0.1)', color: '#d4af37', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #d4af37' },
    userName: { margin: '0 0 10px 0', fontSize: '1.1rem', color: '#fff' },
    message: { fontSize: '0.9rem', color: '#aaa', lineHeight: '1.6', flex: 1 },
    btnResolve: { backgroundColor: '#ff4444', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
    btnMail: { backgroundColor: '#222', color: '#fff', textDecoration: 'none', border: '1px solid #444', padding: '10px 15px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' },
    cardActions: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '10px' },
    anuncioCard: { backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', padding: '30px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
    formLabel: { display: 'block', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' },
    formInput: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '15px', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' },
    formTextarea: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '15px', borderRadius: '8px', fontSize: '1rem', outline: 'none', minHeight: '150px', resize: 'vertical', boxSizing: 'border-box' },
    btnPublish: { backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(212,175,55,0.3)' },
    btnPublishDisabled: { backgroundColor: '#333', color: '#666', border: 'none', padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' },

    // NUEVOS ESTILOS INTERNOS DE GESTIÓN DE ESTRUCTURAS
    structureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px', marginTop: '10px' },
    panelBox: { backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' },
    selectFullStyle: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' },
    btnGoldAction: { width: '100%', backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 10px rgba(212,175,55,0.2)' },
    btnGreenAction: { width: '100%', backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 10px rgba(76,175,80,0.2)' },
    listContainer: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', maxHeight: '300px', overflowY: 'auto' },
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '12px 15px', borderRadius: '8px' },
    listItemSede: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '12px 15px', borderRadius: '8px', gap: '10px' },
    subTextList: { display: 'block', color: '#888', fontSize: '0.8rem', marginTop: '3px' },
    subTextListCode: { display: 'block', color: '#555', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' },
    btnTextDelete: { background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }
};

export default AdminPage;