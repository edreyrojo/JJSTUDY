import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc,} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';

// Iconos rápidos (puedes reemplazarlos por Lucide o FontAwesome si lo prefieres)
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
    Down: "🔻", // Nuevo icono
    Up: "🔺"    // Nuevo icono
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

    const notify = (mensaje, tipo = 'success') => {
        Swal.fire({
            text: mensaje, icon: tipo,
            background: '#121212', color: '#fff',
            confirmButtonColor: '#d4af37',
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
        });
    };

    const obtenerDatos = async () => {
        try {
            setCargando(true);
            const [uSnap, tSnap] = await Promise.all([
                getDocs(collection(db, "usuarios")),
                getDocs(collection(db, "soporte"))
            ]);

            setUsuarios(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            const listaT = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTickets(listaT.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        } catch (error) {
            notify("Fallo en sincronización", "error");
        } finally { setCargando(false); }
    };

    useEffect(() => { obtenerDatos(); }, []);

    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter(u =>
            u.nombre?.toLowerCase().includes(filtroUser.toLowerCase()) ||
            u.email?.toLowerCase().includes(filtroUser.toLowerCase())
        );
    }, [usuarios, filtroUser]);

    const handleAction = async (id, collectionName, action, data = null) => {
        try {
            if (action === 'delete') {
                const res = await Swal.fire({
                    title: '¿Confirmar resolución?',
                    text: "Se eliminará permanentemente",
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#1a1a1a', color: '#fff',
                    confirmButtonColor: '#d4af37',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Sí, resolver'
                });
                if (!res.isConfirmed) return;
                await deleteDoc(doc(db, collectionName, id));
            } else {
                await updateDoc(doc(db, collectionName, id), data);
            }
            obtenerDatos();
            notify("Vault actualizado");
        } catch (error) { notify(error.message, "error"); }
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
                <StatCard label="Tickets Pendientes" value={tickets.length} icon={Icons.Ticket} color={tickets.length > 0 ? "#ff4444" : "#4CAF50"} />
                <StatCard label="Usuarios Pendientes" value={usuarios.filter(u => !u.validado).length} icon={Icons.Key} color="#2196F3" />
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
            </div>

            {cargando ? (
                <div style={s.loader}>Sincronizando la base de datos...</div>
            ) : (
                <main style={s.main}>
                    
                    {/* VISTA 1: USUARIOS */}
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

                    {/* VISTA 2: PUBLICAR ANUNCIOS */}
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

                    {/* VISTA 3: TICKETS DE SOPORTE */}
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

// --- USER ROW CON ACORDEÓN ---
const UserRow = ({ user, autores = {}, onUpdate }) => { 
    // NUEVO: Estado para expandir/contraer
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState("");

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

    return (
        <div style={s.userCard}>
            {/* CABECERA (Siempre visible y clicable para expandir) */}
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
                
                {/* Controles de la Cabecera */}
                <div style={s.userControls}>
                    {/* Badge informativo de cursos si está cerrado */}
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
                    
                    {/* Icono de Expandir/Contraer */}
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>
                        {isExpanded ? Icons.Up : Icons.Down}
                    </span>
                </div>
            </div>

            {/* SECCIÓN EXPANDIBLE (Cursos y Roles) */}
            {isExpanded && (
                <div style={{ ...s.courseSection, animation: 'fadeIn 0.3s ease' }}>
                    
                    {/* Fila de Rol */}
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

// --- ESTILOS MEJORADOS (S) ---
const s = {
    container: {
        backgroundColor: '#050505', minHeight: '100vh', color: '#fff',
        fontFamily: "'Inter', sans-serif", padding: '20px', boxSizing: 'border-box'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px', flexWrap: 'wrap', gap: '15px'
    },
    title: { color: '#d4af37', margin: 0, fontSize: '1.8rem', letterSpacing: '2px', textTransform: 'uppercase' },
    subtitle: { color: '#888', margin: '5px 0 0 0', fontSize: '0.9rem' },
    btnBack: {
        background: 'transparent', border: '1px solid #555', color: '#ccc',
        padding: '8px 16px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', transition: '0.2s'
    },
    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px', marginBottom: '30px'
    },
    statCard: {
        backgroundColor: '#111', padding: '20px', borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', border: '1px solid #222'
    },
    statValue: { fontSize: '2rem', fontWeight: '900', color: '#fff', lineHeight: '1' },
    statLabel: { fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginTop: '8px', letterSpacing: '1px' },
    
    tabContainer: {
        display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px',
        borderBottom: '1px solid #222'
    },
    tabInactive: {
        background: 'transparent', border: 'none', color: '#666', padding: '12px 20px',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', whiteSpace: 'nowrap'
    },
    tabActive: {
        background: '#1a1a1a', border: 'none', color: '#d4af37', padding: '12px 20px',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '3px solid #d4af37', whiteSpace: 'nowrap'
    },
    tabActiveInfo: {
        background: '#1a1a1a', border: 'none', color: '#ff4444', padding: '12px 20px',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '3px solid #ff4444', whiteSpace: 'nowrap'
    },
    badge: {
        backgroundColor: '#ff4444', color: '#fff', fontSize: '0.65rem',
        padding: '2px 8px', borderRadius: '12px', marginLeft: '5px'
    },
    loader: { color: '#d4af37', textAlign: 'center', padding: '50px', fontSize: '1.2rem', letterSpacing: '2px', animation: 'pulse 1.5s infinite' },
    main: {
        display: 'flex', flexDirection: 'column', gap: '20px'
    },
    viewSection: {
        animation: 'fadeIn 0.3s ease-in-out'
    },
    
    // ESTILOS DE USUARIOS
    searchBar: {
        backgroundColor: '#111', padding: '15px 20px', borderRadius: '10px',
        display: 'flex', alignItems: 'center', border: '1px solid #333', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
    },
    searchInput: {
        background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: '1rem'
    },
    userList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    userCard: {
        backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '12px',
        padding: '15px 20px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', transition: 'transform 0.2s',
        overflow: 'hidden' // Evita desbordes al animar el acordeón
    },
    userInfo: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px',
        userSelect: 'none' // Evita que se seleccione el texto al hacer clic repetidamente
    },
    userMainInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
    userControls: { display: 'flex', alignItems: 'center', gap: '10px' },
    userEmail: { color: '#777', fontSize: '0.85rem' },
    statusOnline: { color: '#4CAF50', textShadow: '0 0 8px rgba(76, 175, 80, 0.5)' },
    statusOffline: { color: '#ff4444' },
    select: {
        backgroundColor: '#1a1a1a', color: '#d4af37', border: '1px solid #444',
        padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
    },
    btnAccess: {
        backgroundColor: '#4CAF50', color: '#fff', border: 'none',
        padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(76,175,80,0.3)'
    },
    courseSection: { marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #222' },
    courseLabel: { fontSize: '0.75rem', color: '#888', fontWeight: 'bold', letterSpacing: '1px', margin: 0 },
    btnUnlockAll: {
        background: 'rgba(76, 175, 80, 0.1)', border: '1px solid #4CAF50', color: '#4CAF50', 
        fontSize: '0.7rem', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
    },
    courseChips: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' },
    chip: {
        backgroundColor: '#111', border: '1px solid #d4af37', color: '#e0c068',
        padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    },
    chipX: { cursor: 'pointer', color: '#ff4444', fontWeight: 'bold', padding: '0 5px' },
    addCourseBox: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    selectFull: {
        backgroundColor: '#111', border: '1px solid #444', color: '#fff',
        padding: '10px 15px', borderRadius: '6px', flex: 1, minWidth: '200px', fontSize: '0.9rem', outline: 'none'
    },
    btnAdd: {
        backgroundColor: '#d4af37', border: 'none', color: '#000',
        padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
    },

    // ESTILOS DE TICKETS
    ticketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
    ticketCard: {
        backgroundColor: '#111', border: '1px solid #333', padding: '20px', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    date: { color: '#666', fontSize: '0.75rem' },
    tagError: { backgroundColor: 'rgba(255,68,68,0.1)', color: '#ff4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #ff4444' },
    tagInfo: { backgroundColor: 'rgba(212,175,55,0.1)', color: '#d4af37', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #d4af37' },
    userName: { margin: '0 0 10px 0', fontSize: '1.1rem', color: '#fff' },
    message: { fontSize: '0.9rem', color: '#aaa', lineHeight: '1.6', flex: 1 },
    btnResolve: {
        backgroundColor: '#ff4444', color: '#fff', border: 'none',
        padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
    },
    btnMail: {
        backgroundColor: '#222', color: '#fff', textDecoration: 'none', border: '1px solid #444',
        padding: '10px 15px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px'
    },
    cardActions: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '10px' },

    // ESTILOS DE ANUNCIOS
    anuncioCard: {
        backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px',
        padding: '30px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    },
    formLabel: { display: 'block', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' },
    formInput: {
        width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff',
        padding: '15px', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '20px', boxSizing: 'border-box'
    },
    formTextarea: {
        width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff',
        padding: '15px', borderRadius: '8px', fontSize: '1rem', outline: 'none', minHeight: '150px', resize: 'vertical', boxSizing: 'border-box'
    },
    btnPublish: {
        backgroundColor: '#d4af37', color: '#000', border: 'none',
        padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
        fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(212,175,55,0.3)'
    },
    btnPublishDisabled: {
        backgroundColor: '#333', color: '#666', border: 'none',
        padding: '15px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'not-allowed',
        fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px'
    }
};

export default AdminPage;