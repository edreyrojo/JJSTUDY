import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';
// Iconos rápidos (puedes reemplazarlos por Lucide o FontAwesome)
const Icons = {
    User: "👤",
    Ticket: "🎫",
    Key: "🔑",
    Trash: "🗑️",
    Check: "✅",
    Search: "🔍",
    Mail: "✉️",
    Shield: "🛡️"
};

const AdminPage = ({ onBack }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState('tickets');
    const [filtroUser, setFiltroUser] = useState("");
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

    return (
        <div style={s.container}>
            {/* Sidebar / Topbar */}
            <header style={s.header}>
                <div>
                    <h1 style={s.title}>{Icons.Shield}CONTROL</h1>
                    <p style={s.subtitle}>Gestión de Instructores y Soporte Técnico</p>
                </div>
                <button onClick={onBack} style={s.btnBack}>SALIR</button>
            </header>

            {/* Estadísticas Rápidas */}
            <section style={s.statsGrid}>
                <StatCard label="Usuarios Totales" value={usuarios.length} icon={Icons.User} color="#d4af37" />
                <StatCard label="Tickets Pendientes" value={tickets.length} icon={Icons.Ticket} color="#ff4444" />
                <StatCard label="Usuarios Pendientes" value={usuarios.filter(u => !u.validado).length} icon={Icons.Key} color="#4CAF50" />
            </section>

            {/* Navegación Principal */}
            <div style={s.tabBar}>
                <button
                    onClick={() => setTabActiva('tickets')}
                    style={{ ...s.tab, borderBottom: tabActiva === 'tickets' ? '3px solid #ff4444' : 'none' }}
                >
                    ALERTA DE SOPORTE {tickets.length > 0 && <span style={s.badge}>{tickets.length}</span>}
                </button>
                <button
                    onClick={() => setTabActiva('usuarios')}
                    style={{ ...s.tab, borderBottom: tabActiva === 'usuarios' ? '3px solid #d4af37' : 'none' }}
                >
                    BASE DE USUARIOS
                </button>
            </div>

            {cargando ? (
                <div style={s.loader}>Sincronizando con el servidor...</div>
            ) : (
                <main style={s.main}>
                    {tabActiva === 'tickets' ? (
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
                    ) : (
                        <div style={s.userSection}>
                            <div style={s.searchBar}>
                                <span style={{ marginRight: '10px' }}>{Icons.Search}</span>
                                <input
                                    placeholder="Buscar por nombre o email..."
                                    style={s.searchInput}
                                    onChange={(e) => setFiltroUser(e.target.value)}
                                />
                            </div>

                            <div style={s.userList}>
                                {usuariosFiltrados.map(u => (
                                    <UserRow
                                        key={u.id}
                                        user={u}
                                        autores={instruccionalesPorAutor} // <--- ASEGÚRATE DE QUE ESTO ESTÉ AQUÍ
                                        onUpdate={(data) => handleAction(u.id, 'usuarios', 'update', data)}
                                    />
                                ))}
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
    <div style={{ ...s.statCard, borderLeft: `4px solid ${color}` }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <div>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
        </div>
    </div>
);

const UserRow = ({ user, autores = {}, onUpdate }) => { // autores = {} por seguridad
    const [selectedCourse, setSelectedCourse] = useState("");

    const handleLiberarTodo = async () => {
        // Validación de seguridad para autores
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
            background: '#0a0a0a',
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
            <div style={s.userInfo}>
                <div style={s.userMainInfo}>
                    <span style={user.validado ? s.statusOnline : s.statusOffline}>●</span>
                    <strong style={{ fontSize: '1.1rem' }}>{user.nombre?.toUpperCase() || 'ANÓNIMO'}</strong>
                    <span style={s.userEmail}>{user.email}</span>
                </div>
                <div style={s.userControls}>
                    <select value={user.rol || 'alumno'} onChange={(e) => onUpdate({ rol: e.target.value })} style={s.select}>
                        <option value="alumno">Alumno</option>
                        <option value="instructor">Instructor</option>
                        <option value="profesor">Profesor</option>
                        <option value="admin">Admin</option>
                    </select>
                    {!user.validado && <button onClick={() => onUpdate({ validado: true })} style={s.btnAccess}>AUTORIZAR</button>}
                </div>
            </div>

            <div style={s.courseSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={s.courseLabel}>CONTENIDO DESBLOQUEADO:</label>
                    <button onClick={handleLiberarTodo} style={{ background: 'none', border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '0.6rem', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        + LIBERAR TODO EL CATÁLOGO
                    </button>
                </div>

                <div style={s.courseChips}>
                    {user.cursos_liberados?.length > 0 ? user.cursos_liberados.map(c => (
                        <div key={c} style={s.chip}>
                            {/* PROTECCIÓN: Si DB_INSTRUCCIONALES no existe, mostramos el ID 'c' */}
                            {(typeof DB_INSTRUCCIONALES !== 'undefined' && DB_INSTRUCCIONALES[c]?.titulo) || c}
                            <span style={s.chipX} onClick={() => onUpdate({ cursos_liberados: user.cursos_liberados.filter(id => id !== c) })}>×</span>
                        </div>
                    )) : <span style={{ color: '#333', fontSize: '0.8rem' }}>Sin cursos extra</span>}
                </div>

                <div style={s.addCourseBox}>
                    <select
                        style={s.selectFull}
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                    >
                        <option value="">-- SELECCIONAR INSTRUCCIONAL --</option>
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
                        LIBERAR
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- ESTILOS (S) ---
const s = {
    container: {
        backgroundColor: '#000', minHeight: '100vh', color: '#fff',
        fontFamily: "'Inter', sans-serif", padding: '20px'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px'
    },
    title: { color: '#d4af37', margin: 0, fontSize: '1.5rem', letterSpacing: '2px' },
    subtitle: { color: '#666', margin: 0, fontSize: '0.8rem' },
    btnBack: {
        background: 'none', border: '1px solid #d4af37', color: '#888',
        padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem'
    },
    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px', marginBottom: '30px'
    },
    statCard: {
        backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '8px',
        display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #1a1a1a'
    },
    statValue: { fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' },
    tabBar: { display: 'flex', gap: '30px', marginBottom: '20px', borderBottom: '1px solid #1a1a1a' },
    tab: {
        background: 'none', border: 'none', color: '#fff', padding: '10px 0',
        cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', position: 'relative',
        display: 'flex', alignItems: 'center', gap: '8px'
    },
    badge: {
        backgroundColor: '#ff4444', color: '#fff', fontSize: '0.6rem',
        padding: '2px 6px', borderRadius: '10px'
    },
    loader: { color: '#d4af37', textAlign: 'center', padding: '50px' },
    ticketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
    ticketCard: {
        backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '20px', borderRadius: '12px'
    },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
    tagError: { backgroundColor: '#ff444422', color: '#ff4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' },
    tagInfo: { backgroundColor: '#d4af3722', color: '#d4af37', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' },
    userName: { margin: '0 0 10px 0', fontSize: '1rem', color: '#d4af37' },
    message: { fontSize: '0.85rem', color: '#aaa', lineHeight: '1.5' },
    btnResolve: {
        backgroundColor: '#d4af37', color: '#000', border: 'none',
        padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
    },
    btnMail: {
        border: '1px solid #333', color: '#fff', textDecoration: 'none',
        padding: '8px 15px', borderRadius: '4px', fontSize: '0.75rem'
    },
    cardActions: { display: 'flex', justifyContent: 'space-between', marginTop: '15px' },
    searchBar: {
        backgroundColor: '#0a0a0a', padding: '12px 20px', borderRadius: '8px',
        display: 'flex', alignItems: 'center', border: '1px solid #222', marginBottom: '20px'
    },
    searchInput: {
        background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none'
    },
    userCard: {
        backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '10px',
        padding: '20px', marginBottom: '15px'
    },
    userInfo: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px'
    },
    userMainInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
    userEmail: { color: '#555', fontSize: '0.8rem' },
    statusOnline: { color: '#4CAF50' },
    statusOffline: { color: '#ff4444' },
    select: {
        backgroundColor: '#111', color: '#d4af37', border: '1px solid #333',
        padding: '5px 10px', borderRadius: '4px'
    },
    btnAccess: {
        backgroundColor: '#4CAF50', color: '#fff', border: 'none',
        padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
    },
    courseSection: { marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #1a1a1a' },
    courseLabel: { fontSize: '0.65rem', color: '#666', display: 'block', marginBottom: '10px' },
    courseChips: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' },
    chip: {
        backgroundColor: '#000', border: '1px solid #d4af37', color: '#d4af37',
        padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px'
    },
    chipX: { cursor: 'pointer', color: '#ff4444' },
    addCourseBox: { display: 'flex', gap: '10px', maxWidth: '400px' },
    inputSmall: {
        backgroundColor: '#000', border: '1px solid #333', color: '#fff',
        padding: '8px', borderRadius: '4px', flex: 1, fontSize: '0.8rem'
    },
    btnAdd: {
        backgroundColor: '#d4af37', border: 'none', color: '#000',
        padding: '0 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
    }
};

export default AdminPage;