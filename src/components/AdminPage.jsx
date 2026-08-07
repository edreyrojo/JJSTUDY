import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, doc, deleteDoc, addDoc, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';

// Iconos rápidos
const Icons = {
    User: "👤", Ticket: "🎫", Key: "🔑", Trash: "🗑️", Check: "✅",
    Search: "🔍", Mail: "✉️", Shield: "🛡️", Megaphone: "📢", Send: "🚀",
    Down: "🔻", Up: "🔺", Building: "🏢", MapPin: "📍"
};

const AdminPage = ({ onBack }) => {
    // --- ESTADOS ORIGINALES Y LÓGICA (INTACTOS) ---
    const [usuarios, setUsuarios] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState('usuarios');
    const [filtroUser, setFiltroUser] = useState("");

    const [tituloAnuncio, setTituloAnuncio] = useState("");
    const [mensajeAnuncio, setMensajeAnuncio] = useState("");
    const [enviandoAnuncio, setEnviandoAnuncio] = useState(false);

    const [academias, setAcademias] = useState([]);
    const [sedes, setSedes] = useState([]);

    const [nombreAcademia, setNombreAcademia] = useState("");
    const [creandoAcademia, setCreandoAcademia] = useState(false);

    const [nombreSede, setNombreSede] = useState("");
    const [academiaSeleccionada, setAcademiaSeleccionada] = useState("");
    const [teamIdProfesor, setTeamIdProfesor] = useState("");
    const [creandoSede, setCreandoSede] = useState(false);

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

    const [academiasAbiertas, setAcademiasAbiertas] = useState({});
    const toggleAcademia = (id) => setAcademiasAbiertas(prev => ({ ...prev, [id]: !prev[id] }));

    const notify = (mensaje, tipo = 'success') => {
        Swal.fire({
            text: mensaje, icon: tipo, background: '#121212', color: '#fff',
            confirmButtonColor: '#d4af37', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
        });
    };

    // --- FUNCIONES Y BACKEND (INTACTOS) ---
    const handleAsignarPersonal = async (uidUsuario, nuevoRol, idSede, idAcademia) => {
        if (!uidUsuario) return;
        try {
            const userRef = doc(db, "usuarios", uidUsuario);
            await setDoc(userRef, { rol: nuevoRol, sedeId: idSede || idAcademia, teamId: idSede || idAcademia, academiaId: idAcademia }, { merge: true });
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `¡Asignado como ${nuevoRol.toUpperCase()} con éxito!`, showConfirmButton: false, timer: 2000 });
        } catch (error) { Swal.fire("Error", "No se pudo asignar el personal: " + error.message, "error"); }
    };

    const generarCodigoSedeMadre = async (idSede, nombreAca) => {
        try {
            const prefijo = (nombreAca || "DOJO").slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "X");
            const rand = Math.floor(100 + Math.random() * 900);
            const nuevoCodigo = `${prefijo}-MADRE${rand}`;
            const sedeRef = doc(db, "sedes", idSede);
            await setDoc(sedeRef, { codigoAcceso: nuevoCodigo, nombreSede: nombreAca || "Sede Madre Principal", ciudad: "Sede Central" }, { merge: true });
            Swal.fire('¡Listo!', `Código generado: ${nuevoCodigo}`, 'success');
        } catch (err) { Swal.fire('Error', err.message, 'error'); }
    };

    useEffect(() => {
        const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snap) => setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubTickets = onSnapshot(collection(db, "soporte"), (snap) => {
            const listaT = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTickets(listaT.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        });
        const unsubAcademias = onSnapshot(collection(db, "academias"), (snap) => setAcademias(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSedes = onSnapshot(collection(db, "sedes"), (snap) => {
            setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setCargando(false);
        });
        return () => { unsubUsuarios(); unsubTickets(); unsubAcademias(); unsubSedes(); };
    }, []);

    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter(u => u.nombre?.toLowerCase().includes(filtroUser.toLowerCase()) || u.email?.toLowerCase().includes(filtroUser.toLowerCase()));
    }, [usuarios, filtroUser]);

    const [logoAcademiaBase64, setLogoAcademiaBase64] = useState('');
    const handleLogoAcademiaChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1048487) { Swal.fire('Error', 'La imagen es demasiado pesada. Máximo 1MB.', 'error'); return; }
            const reader = new FileReader();
            reader.onloadend = () => setLogoAcademiaBase64(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleAction = async (id, collectionName, action, data = null) => {
        try {
            if (action === 'delete') {
                const res = await Swal.fire({ title: '¿Confirmar eliminación?', text: "Se eliminará permanentemente de la base de datos", icon: 'warning', showCancelButton: true, background: '#1a1a1a', color: '#fff', confirmButtonColor: '#ff4444', cancelButtonColor: '#333', confirmButtonText: 'Sí, eliminar' });
                if (!res.isConfirmed) return;
                await deleteDoc(doc(db, collectionName, id));
                notify("Registro eliminado con éxito");
            } else {
                await updateDoc(doc(db, collectionName, id), data);
                notify("Actualizado con éxito");
            }
        } catch (error) { notify(error.message, "error"); }
    };

    const handleCrearAcademia = async (e) => {
        e.preventDefault();
        if (!nombreAcademia.trim()) return notify("Ingresa un nombre válido", "error");
        setCreandoAcademia(true);
        try {
            const nombreLimpio = nombreAcademia.trim().toUpperCase();
            await addDoc(collection(db, "academias"), { nombre: nombreLimpio, nombreAcademia: nombreLimpio, horarios: [], logoBase64: logoAcademiaBase64, programas: ["BJJ Adultos", "BJJ Kids", "No-Gi"], sede: "", fechaCreacion: new Date().toLocaleString(), ultimaActualizacion: new Date().toISOString(), timestamp: Date.now() });
            notify(`Academia "${nombreLimpio}" registrada con éxito 🏢`);
            setNombreAcademia('');
        } catch (error) { notify("Error al crear la academia", "error"); } finally { setCreandoAcademia(false); }
    };

    const handleCrearSede = async (e) => {
        e.preventDefault();
        if (!nombreSede.trim() || !academiaSeleccionada || !teamIdProfesor.trim()) return notify("Completa todos los campos", "error");
        const academiaMadre = academias.find(a => a.id === academiaSeleccionada);
        setCreandoSede(true);
        try {
            const sedeRef = doc(collection(db, "sedes"));
            await setDoc(sedeRef, { id: sedeRef.id, nombre: nombreSede.trim(), nombreSede: nombreSede.trim(), academiaId: academiaSeleccionada, academiaNombre: academiaMadre?.nombre || "Desconocida", teamId: teamIdProfesor.trim(), fechaCreacion: new Date().toISOString(), activa: true, tipo: 'sede_afiliada' });
            notify("Sede vinculada exitosamente 📍", "success");
            setNombreSede(""); setTeamIdProfesor("");
        } catch (e) { notify(`Error al vincular: ${e.message}`, "error"); } finally { setCreandoSede(false); }
    };

    // Funciones de mantenimiento originales conservadas
    const corregirIdsAlumnos = async () => {
        const ID_ERRONEO = "0xwL28fPsjcij3AVltJVEImPrO72";
        const ID_CORRECTO = "0xwL28fPsjcij3AVltJVElmPr072";
        const confirm = await Swal.fire({ title: '¿Corregir IDs?', text: `Se cambiará al ID correcto. Asegúrate de tener backup.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, corregir', background: '#1a1a1a', color: '#fff' });
        if (!confirm.isConfirmed) return;
        try {
            const snapshot = await getDocs(collection(db, "alumnos"));
            const batch = writeBatch(db);
            let count = 0;
            snapshot.forEach((docSnap) => {
                if (docSnap.data().teamId === ID_ERRONEO) { batch.update(docSnap.ref, { teamId: ID_CORRECTO }); count++; }
            });
            if (count > 0) { await batch.commit(); notify(`Se corrigieron ${count} alumnos.`, 'success'); } 
            else { notify("No se encontraron errores.", "info"); }
        } catch (error) { notify("Error: " + error.message, "error"); }
    };

    const vincularUsuarioASede = async (usuarioId, nuevaSedeId, nuevoRol) => {
        try {
            await updateDoc(doc(db, "usuarios", usuarioId), { sedeId: nuevaSedeId, rol: nuevoRol });
            notify("Personal vinculado correctamente", "success");
        } catch (error) { notify("Error: " + error.message, "error"); }
    };

    const handlePublicarAnuncio = async () => {
        if (!tituloAnuncio.trim() || !mensajeAnuncio.trim()) return notify("Completa título y mensaje.", "error");
        setEnviandoAnuncio(true);
        try {
            await addDoc(collection(db, "anuncios"), { titulo: tituloAnuncio.trim(), mensaje: mensajeAnuncio.trim(), fecha: new Date().toLocaleString(), timestamp: Date.now() });
            notify("¡Anuncio publicado! 📢");
            setTituloAnuncio(""); setMensajeAnuncio("");
        } catch (error) { notify("Error al publicar.", "error"); } finally { setEnviandoAnuncio(false); }
    };

    return (
        <div style={s.container}>
            {/* Header Optimizado */}
            <header style={s.header}>
                <div>
                    <h1 style={s.title}>{Icons.Shield} CONTROL MAESTRO</h1>
                    <p style={s.subtitle}>Gestión Global y Accesos</p>
                </div>
                <button onClick={onBack} style={s.btnBack}>←</button>
            </header>

            {/* Estadísticas Compactas */}
            <section style={s.statsGrid}>
                <StatCard label="Usuarios" value={usuarios.length} icon={Icons.User} color="#d4af37" />
                <StatCard label="Academias" value={academias.length} icon={Icons.Building} color="#2196F3" />
                <StatCard label="Sedes" value={sedes.length} icon={Icons.MapPin} color="#4CAF50" />
            </section>

            {/* Pestañas Reducidas y Compactas */}
            <div style={s.tabContainer}>
                <button onClick={() => setTabActiva('usuarios')} style={tabActiva === 'usuarios' ? s.tabActive : s.tabInactive}>{Icons.User} Usuarios</button>
                <button onClick={() => setTabActiva('estructuras')} style={tabActiva === 'estructuras' ? s.tabActive : s.tabInactive}>{Icons.Building} Estructuras</button>
                <button onClick={() => setTabActiva('anuncios')} style={tabActiva === 'anuncios' ? s.tabActive : s.tabInactive}>{Icons.Megaphone} Anuncios</button>
                <button onClick={() => setTabActiva('tickets')} style={tabActiva === 'tickets' ? s.tabActiveInfo : s.tabInactive}>
                    {Icons.Ticket} Soporte {tickets.length > 0 && <span style={s.badge}>{tickets.length}</span>}
                </button>
                <button onClick={() => setTabActiva('mantenimiento')} style={tabActiva === 'mantenimiento' ? s.tabActive : s.tabInactive}>⚙️ Mantenimiento</button>
            </div>

            {cargando ? (
                <div style={s.loader}>Sincronizando datos...</div>
            ) : (
                <main style={s.main}>
                    {/* VISTA 1: USUARIOS */}
                    {tabActiva === 'usuarios' && (
                        <div style={s.viewSection}>
                            <div style={s.searchBar}>
                                <span style={{ marginRight: '10px' }}>{Icons.Search}</span>
                                <input placeholder="Buscar usuario..." style={s.searchInput} onChange={(e) => setFiltroUser(e.target.value)} />
                            </div>
                            <div style={s.userList}>
                                {usuariosFiltrados.map(u => (
                                    <UserRow key={u.id} user={u} autores={instruccionalesPorAutor} onUpdate={(data) => handleAction(u.id, 'usuarios', 'update', data)} />
                                ))}
                                {usuariosFiltrados.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>Sin resultados.</p>}
                            </div>
                        </div>
                    )}

                    {/* VISTA 2: ESTRUCTURAS */}
                    {tabActiva === 'estructuras' && (
                        <div style={s.viewSection}>
                            {/* ÁRBOL ORGANIZACIONAL MAESTRO */}
                            <div style={{ ...s.panelBox, marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
                                    <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>🌳 Árbol Organizacional</h2>
                                </div>
                                {academias.map(aca => {
                                    const logoAca = aca.logoBase64 || aca.logobase64;
                                    const nombreAca = aca.nombreAcademia || aca.nombre || 'Academia';
                                    const estaAbierto = !!academiasAbiertas[aca.id];
                                    const profesMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'profesor' && u.sedeId === aca.id);
                                    const instsMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'instructor' && u.sedeId === aca.id);
                                    const sedesAfiliadas = sedes.filter(se => se.academiaId === aca.id && se.id !== aca.id);

                                    return (
                                        <div key={aca.id} style={{ marginBottom: '10px', borderLeft: '3px solid #d4af37', background: '#0a0a0a', borderRadius: '0 6px 6px 0', overflow: 'hidden' }}>
                                            <div onClick={() => toggleAcademia(aca.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', background: estaAbierto ? '#141414' : '#0e0e0e' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {logoAca ? <img src={logoAca} alt="logo" style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '4px' }} /> : <span style={{ fontSize: '1.2rem' }}>🏢</span>}
                                                    <h3 style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>{nombreAca}</h3>
                                                </div>
                                                <div style={{ color: '#d4af37', fontSize: '0.8rem' }}>{estaAbierto ? '▼' : '►'}</div>
                                            </div>
                                            {estaAbierto && (
                                                <div style={{ padding: '15px' }}>
                                                    <div style={{ background: '#141414', padding: '12px', borderRadius: '6px', borderLeft: '2px solid #fff', marginBottom: '15px' }}>
                                                        <h4 style={{ color: '#d4af37', margin: '0 0 10px 0', fontSize: '0.85rem' }}>🏠 SEDE MADRE</h4>
                                                        <p style={{ color: '#aaa', fontSize: '0.7rem', margin: '5px 0' }}>PROFESORES:</p>
                                                        {profesMadre.map(p => (
                                                            <div key={p.uid} style={s.itemPersonal}>
                                                                <span style={{ fontSize: '0.8rem' }}>{p.nombre}</span>
                                                                <button onClick={() => handleAsignarPersonal(p.uid, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                            </div>
                                                        ))}
                                                        <select style={s.formInputSmall} onChange={(e) => { if (e.target.value) handleAsignarPersonal(e.target.value, 'profesor', aca.id, aca.id); e.target.value = ''; }}>
                                                            <option value="">+ Asignar Profesor...</option>
                                                            {usuarios.map(u => <option key={u.uid} value={u.uid}>{u.nombre || u.email}</option>)}
                                                        </select>

                                                        <p style={{ color: '#aaa', fontSize: '0.7rem', margin: '10px 0 5px 0' }}>INSTRUCTORES:</p>
                                                        {instsMadre.map(i => (
                                                            <div key={i.uid} style={s.itemPersonal}>
                                                                <span style={{ fontSize: '0.8rem' }}>{i.nombre}</span>
                                                                <button onClick={() => handleAsignarPersonal(i.uid, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                            </div>
                                                        ))}
                                                        <select style={s.formInputSmall} onChange={(e) => { if (e.target.value) handleAsignarPersonal(e.target.value, 'instructor', aca.id, aca.id); e.target.value = ''; }}>
                                                            <option value="">+ Asignar Instructor...</option>
                                                            {usuarios.map(u => <option key={u.uid} value={u.uid}>{u.nombre || u.email}</option>)}
                                                        </select>
                                                    </div>

                                                    <div style={{ color: '#d4af37', fontSize: '0.8rem', marginBottom: '10px', borderBottom: '1px solid #d4af3744', paddingBottom: '5px' }}>📍 SEDES AFILIADAS ({sedesAfiliadas.length}):</div>
                                                    {sedesAfiliadas.length > 0 ? sedesAfiliadas.map(se => {
                                                        const personalSede = usuarios.filter(u => u.sedeId === se.id && (u.rol === 'instructor' || u.rol === 'profesor'));
                                                        return (
                                                            <div key={se.id} style={{ background: '#111', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #222' }}>
                                                                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px' }}>{se.nombreSede || se.nombre}</div>
                                                                {personalSede.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                                                        {personalSede.map(u => (
                                                                            <div key={u.uid} style={s.itemPersonal}>
                                                                                <span style={{ fontSize: '0.75rem', color: '#fff' }}>{u.nombre || u.email} <small style={{ color: '#888' }}>({u.rol})</small></span>
                                                                                <button onClick={() => handleAsignarPersonal(u.uid, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : <div style={{ fontSize: '0.7rem', color: '#555', fontStyle: 'italic', marginBottom: '10px' }}>Sin personal asignado</div>}
                                                                <select style={s.formInputSmall} onChange={(e) => { if (e.target.value) { const usr = usuarios.find(u => u.uid === e.target.value); handleAsignarPersonal(e.target.value, usr.rol, se.id, aca.id); e.target.value = ''; } }}>
                                                                    <option value="">+ Asignar Rol...</option>
                                                                    {usuarios.filter(u => u.rol === 'instructor' || u.rol === 'profesor').map(u => (
                                                                        <option key={u.uid} value={u.uid}>{u.nombre || u.email} ({u.rol})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        );
                                                    }) : <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.75rem' }}>No hay sedes registradas.</div>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* FORMULARIOS DE REGISTRO */}
                            <div style={s.structureGrid}>
                                <div style={s.panelBox}>
                                    <h3 style={{ color: '#d4af37', margin: '0 0 15px 0', fontSize: '1rem' }}>{Icons.Building} Nueva Academia</h3>
                                    <form onSubmit={handleCrearAcademia} style={{ marginBottom: '20px' }}>
                                        <input style={s.formInput} value={nombreAcademia} onChange={(e) => setNombreAcademia(e.target.value)} placeholder="Nombre Academia" />
                                        <label style={s.fileUploadBtn}>
                                            <span>📁 Subir Logo</span>
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoAcademiaChange} />
                                        </label>
                                        <button type="submit" disabled={creandoAcademia} style={s.btnGoldAction}>{creandoAcademia ? "REGISTRANDO..." : "REGISTRAR"}</button>
                                    </form>
                                    <h4 style={{ color: '#aaa', fontSize: '0.8rem', borderBottom: '1px solid #222', paddingBottom: '5px' }}>Academias ({academias.length})</h4>
                                    <div style={s.listContainer}>
                                        {academias.map(ac => (
                                            <div key={ac.id} style={s.listItem}>
                                                <span style={{ fontSize: '0.85rem' }}>🏢 {ac.nombreAcademia || ac.nombre}</span>
                                                <button onClick={() => handleAction(ac.id, 'academias', 'delete')} style={s.btnTextDelete}>Eliminar</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={s.panelBox}>
                                    <h3 style={{ color: '#4CAF50', margin: '0 0 15px 0', fontSize: '1rem' }}>{Icons.MapPin} Vincular Sede</h3>
                                    <form onSubmit={handleCrearSede} style={{ marginBottom: '20px' }}>
                                        <input style={s.formInput} value={nombreSede} onChange={(e) => setNombreSede(e.target.value)} placeholder="Nombre Sede" />
                                        <select style={s.formInput} value={academiaSeleccionada} onChange={(e) => setAcademiaSeleccionada(e.target.value)}>
                                            <option value="">-- ACADEMIA MADRE --</option>
                                            {academias.map(ac => (<option key={ac.id} value={ac.id}>{ac.nombreAcademia || ac.nombre}</option>))}
                                        </select>
                                        <select style={s.formInput} value={teamIdProfesor} onChange={(e) => setTeamIdProfesor(e.target.value)}>
                                            <option value="">-- PROFESOR ASIGNADO --</option>
                                            {usuarios.filter(u => u.rol === 'profesor' || u.rol === 'admin').map(u => (
                                                <option key={u.id} value={u.uid || u.id}>{u.nombre || u.email}</option>
                                            ))}
                                        </select>
                                        <button type="submit" disabled={creandoSede} style={s.btnGreenAction}>{creandoSede ? "ENLAZANDO..." : "VINCULAR SEDE"}</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA 3: PUBLICAR ANUNCIO */}
                    {tabActiva === 'anuncios' && (
                        <div style={s.viewSection}>
                            <div style={s.anuncioCard}>
                                <h2 style={{ color: '#d4af37', margin: '0 0 10px 0', fontSize: '1.2rem' }}>{Icons.Megaphone} Notificación Global</h2>
                                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '20px' }}>Activa la alerta en el Hub de todos los usuarios.</p>
                                
                                <input style={s.formInput} value={tituloAnuncio} onChange={(e) => setTituloAnuncio(e.target.value)} placeholder="Título del anuncio..." maxLength={50} />
                                <textarea style={s.formTextarea} value={mensajeAnuncio} onChange={(e) => setMensajeAnuncio(e.target.value)} placeholder="Escribe el mensaje o novedades..." />

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    <button onClick={handlePublicarAnuncio} disabled={enviandoAnuncio || !tituloAnuncio.trim() || !mensajeAnuncio.trim()} style={(!tituloAnuncio.trim() || !mensajeAnuncio.trim()) ? s.btnPublishDisabled : s.btnPublish}>
                                        {enviandoAnuncio ? 'PUBLICANDO...' : <>{Icons.Send} PUBLICAR AHORA</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA 4: TICKETS DE SOPORTE */}
                    {tabActiva === 'tickets' && (
                        <div style={s.viewSection}>
                            {tickets.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#4CAF50' }}>
                                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>{Icons.Check}</span>
                                    <h3 style={{ margin: 0 }}>Todo Despejado</h3>
                                    <p style={{ color: '#666', fontSize: '0.85rem' }}>No hay tickets pendientes.</p>
                                </div>
                            ) : (
                                <div style={s.ticketGrid}>
                                    {tickets.map(t => (
                                        <div key={t.id} style={s.ticketCard}>
                                            <div style={s.cardHeader}>
                                                <span style={s.date}>{t.fecha}</span>
                                                <span style={t.tipo === 'video_fail' ? s.tagError : s.tagInfo}>{t.tipo === 'video_fail' ? 'FAIL VIDEO' : 'SOPORTE'}</span>
                                            </div>
                                            <h4 style={s.userName}>{t.nombre?.toUpperCase()}</h4>
                                            <p style={s.message}>{t.mensaje}</p>
                                            <div style={s.cardActions}>
                                                <a href={`mailto:${t.email}`} style={s.btnMail}>{Icons.Mail} Contactar</a>
                                                <button onClick={() => handleAction(t.id, 'soporte', 'delete')} style={s.btnResolve}>Resolver</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* VISTA 5: MANTENIMIENTO */}
                    {tabActiva === 'mantenimiento' && (
                        <div style={s.viewSection}>
                            <div style={s.panelBox}>
                                <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '10px' }}>Herramientas de Base de Datos</h3>
                                <button onClick={corregirIdsAlumnos} style={s.btnGoldAction}>⚠️ Ejecutar Migración de IDs Errados</button>
                                <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '10px' }}>Esta herramienta ejecuta actualizaciones en lote (Batch). Úsala solo si sabes lo que haces.</p>
                            </div>
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
            <div style={{ fontSize: '1.8rem', opacity: 0.8 }}>{icon}</div>
        </div>
    </div>
);

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
        if (!autores || Object.keys(autores).length === 0) return Swal.fire("Error", "No hay catálogo cargado.", "error");
        const todosLosIds = Object.values(autores).flat().map(curso => curso.id);
        const result = await Swal.fire({ title: '¿LIBERAR VAULT?', text: `Acceso a ${todosLosIds.length} cursos para ${user.nombre}.`, icon: 'warning', showCancelButton: true, background: '#1a1a1a', color: '#fff', confirmButtonColor: '#d4af37', cancelButtonColor: '#333' });
        if (result.isConfirmed) onUpdate({ cursos_liberados: todosLosIds });
    };

    const tieneCambiosDeIds = localAcademiaId !== (user.academiaId || "") || localSedeId !== (user.sedeId || "");

    return (
        <div style={s.userCard}>
            <div style={{ ...s.userInfo, cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
                <div style={s.userMainInfo}>
                    <span style={user.validado ? s.statusOnline : s.statusOffline}>●</span>
                    <div>
                        <strong style={{ fontSize: '1rem' }}>{user.nombre?.toUpperCase() || 'ANÓNIMO'}</strong>
                        <span style={s.userEmail}>{user.email}</span>
                    </div>
                </div>
                <div style={s.userControls}>
                    {!isExpanded && user.cursos_liberados?.length > 0 && <span style={s.chipExtras}>{user.cursos_liberados.length} extras</span>}
                    {!user.validado && <button onClick={(e) => { e.stopPropagation(); onUpdate({ validado: true }); }} style={s.btnAccess}>AUTORIZAR</button>}
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>{isExpanded ? Icons.Up : Icons.Down}</span>
                </div>
            </div>

            {isExpanded && (
                <div style={s.courseSection}>
                    <div style={s.gridResponsiveExpanded}>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>ROL:</label>
                            <select value={user.rol || 'alumno'} onChange={(e) => onUpdate({ rol: e.target.value })} style={s.selectInput}>
                                <option value="alumno">Alumno</option>
                                <option value="instructor">Instructor</option>
                                <option value="profesor">Profesor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>ACADEMIA ID:</label>
                            <input type="text" value={localAcademiaId} onChange={(e) => setLocalAcademiaId(e.target.value)} style={s.selectInput} />
                        </div>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>SEDE ID:</label>
                            <input type="text" value={localSedeId} onChange={(e) => setLocalSedeId(e.target.value)} style={s.selectInput} />
                        </div>
                        <div style={{ alignSelf: 'flex-end' }}>
                            <button onClick={() => onUpdate({ academiaId: localAcademiaId.trim() || null, teamId: localAcademiaId.trim() || null, sedeId: localSedeId.trim() || null })} style={tieneCambiosDeIds ? s.btnSaveIds : s.btnSaveIdsDisabled} disabled={!tieneCambiosDeIds}>GUARDAR</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0 10px 0' }}>
                        <label style={s.courseLabel}>CONTENIDO DESBLOQUEADO:</label>
                        <button onClick={handleLiberarTodo} style={s.btnUnlockAll}>+ TODO EL CATÁLOGO</button>
                    </div>

                    <div style={s.courseChips}>
                        {user.cursos_liberados?.length > 0 ? user.cursos_liberados.map(c => (
                            <div key={c} style={s.chip}>
                                {(typeof DB_INSTRUCCIONALES !== 'undefined' && DB_INSTRUCCIONALES[c]?.titulo) || c}
                                <span style={s.chipX} onClick={() => onUpdate({ cursos_liberados: user.cursos_liberados.filter(id => id !== c) })}>×</span>
                            </div>
                        )) : <span style={{ color: '#555', fontSize: '0.75rem', fontStyle: 'italic' }}>Sin accesos extras.</span>}
                    </div>

                    <div style={s.addCourseBox}>
                        <select style={s.selectFull} value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                            <option value="">-- AÑADIR INSTRUCCIONAL --</option>
                            {autores && Object.keys(autores).map(autor => (
                                <optgroup key={autor} label={autor.toUpperCase()}>
                                    {autores[autor].map(curso => <option key={curso.id} value={curso.id}>{curso.titulo}</option>)}
                                </optgroup>
                            ))}
                        </select>
                        <button onClick={() => { if (!selectedCourse) return; onUpdate({ cursos_liberados: [...(user.cursos_liberados || []), selectedCourse] }); setSelectedCourse(""); }} style={s.btnAdd}>AÑADIR</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- ESTILOS COMPACTOS, RESPONSIVE Y SOPORTE NOTCH ---
const s = {
    // 1. Soporte para móviles (Safe Areas)
    container: { 
        backgroundColor: '#050505', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
        padding: 'max(15px, env(safe-area-inset-top)) max(15px, env(safe-area-inset-right)) max(15px, env(safe-area-inset-bottom)) max(15px, env(safe-area-inset-left))'
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '15px', marginBottom: '20px', gap: '10px' },
    title: { color: '#d4af37', margin: 0, fontSize: '1.4rem', letterSpacing: '1px', textTransform: 'uppercase' },
    subtitle: { color: '#888', margin: '2px 0 0 0', fontSize: '0.8rem' },
    btnBack: { background: 'transparent', border: '1px solid #444', color: '#ccc', padding: '6px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' },
    
    // 2. Grids auto-adaptables (Mobile First)
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginBottom: '20px' },
    statCard: { backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222' },
    statValue: { fontSize: '1.6rem', fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', marginTop: '4px' },
    
    // Pestañas optimizadas y corregidas (sin mezclar shorthands y non-shorthands)
    tabContainer: { display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px', borderBottom: '1px solid #222' },
    tabInactive: { 
        background: 'transparent', 
        borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: '2px solid transparent', 
        color: '#666', padding: '10px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' 
    },
    tabActive: { 
        background: '#1a1a1a', 
        borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: '2px solid #d4af37', 
        color: '#d4af37', padding: '10px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap' 
    },
    tabActiveInfo: { 
        background: '#1a1a1a', 
        borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: '2px solid #ff4444', 
        color: '#ff4444', padding: '10px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap' 
    },
    badge: { backgroundColor: '#ff4444', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' },
    
    loader: { color: '#d4af37', textAlign: 'center', padding: '30px', fontSize: '1rem' },
    main: { display: 'flex', flexDirection: 'column', gap: '15px' },
    viewSection: { animation: 'fadeIn 0.2s ease-in-out' },
    
    // Panel de Búsqueda y Listas
    searchBar: { backgroundColor: '#111', padding: '12px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', border: '1px solid #333', marginBottom: '15px' },
    searchInput: { background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: '0.9rem' },
    userList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    
    // Cartas de usuario compactas
    userCard: { backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px' },
    userInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    userMainInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
    userControls: { display: 'flex', alignItems: 'center', gap: '8px' },
    userEmail: { color: '#777', fontSize: '0.75rem', display: 'block' },
    statusOnline: { color: '#4CAF50', fontSize: '0.7rem' },
    statusOffline: { color: '#ff4444', fontSize: '0.7rem' },
    chipExtras: { fontSize: '0.65rem', color: '#d4af37', backgroundColor: 'rgba(212,175,55,0.1)', padding: '3px 6px', borderRadius: '8px', border: '1px solid #d4af37' },
    btnAccess: { backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem' },
    
    // Formularios dentro de los acordeones
    courseSection: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #222' },
    gridResponsiveExpanded: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' },
    colData: { display: 'flex', flexDirection: 'column', gap: '4px' },
    courseLabel: { fontSize: '0.7rem', color: '#888', fontWeight: 'bold' },
    selectInput: { backgroundColor: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', width: '100%', outline: 'none' },
    btnSaveIds: { width: '100%', backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' },
    btnSaveIdsDisabled: { width: '100%', backgroundColor: '#222', border: '1px solid #333', color: '#555', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '0.8rem' },
    btnUnlockAll: { background: 'rgba(76, 175, 80, 0.1)', border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '0.65rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    courseChips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' },
    chip: { backgroundColor: '#111', border: '1px solid #d4af37', color: '#e0c068', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px' },
    chipX: { cursor: 'pointer', color: '#ff4444', fontWeight: 'bold' },
    addCourseBox: { display: 'flex', gap: '8px' },
    selectFull: { backgroundColor: '#111', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '6px', flex: 1, fontSize: '0.85rem', outline: 'none' },
    btnAdd: { backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' },
    
    // Panel Árbol y Estructuras Compacto
    panelBox: { backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '15px' },
    itemPersonal: { display: 'flex', justifyContent: 'space-between', background: '#1f1f1f', padding: '5px 8px', borderRadius: '4px', marginBottom: '4px' },
    formInputSmall: { backgroundColor: '#000', border: '1px solid #333', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '0.75rem', outline: 'none', width: '100%', marginBottom: '8px' },
    
    structureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '10px' },
    formLabel: { display: 'block', color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '6px' },
    formInput: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' },
    fileUploadBtn: { display: 'flex', justifyContent: 'center', background: '#1f1f1f', color: '#d4af37', border: '1px dashed #d4af37', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '12px' },
    btnGoldAction: { width: '100%', backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' },
    btnGreenAction: { width: '100%', backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' },
    listContainer: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '200px', overflowY: 'auto' },
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '8px 10px', borderRadius: '6px' },
    btnTextDelete: { background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' },
    
    // Anuncios
    anuncioCard: { backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', padding: '20px', maxWidth: '600px', margin: '0 auto' },
    formTextarea: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' },
    btnPublish: { backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' },
    btnPublishDisabled: { backgroundColor: '#333', color: '#666', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' },
    
    // Tickets
    ticketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
    ticketCard: { backgroundColor: '#111', border: '1px solid #333', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
    date: { color: '#666', fontSize: '0.7rem' },
    tagError: { backgroundColor: 'rgba(255,68,68,0.1)', color: '#ff4444', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #ff4444' },
    tagInfo: { backgroundColor: 'rgba(212,175,55,0.1)', color: '#d4af37', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #d4af37' },
    userName: { margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' },
    message: { fontSize: '0.85rem', color: '#aaa', flex: 1, marginBottom: '15px' },
    cardActions: { display: 'flex', justifyContent: 'space-between' },
    btnResolve: { backgroundColor: '#ff4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' },
    btnMail: { backgroundColor: '#222', color: '#fff', textDecoration: 'none', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem' }
};

export default AdminPage;