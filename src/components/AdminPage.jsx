import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
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
        border: '1px solid #d4af37',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};
const AdminPage = ({ onBack }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [busquedaCurso, setBusquedaCurso] = useState("");
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState('tickets');

    const obtenerDatos = async () => {
        try {
            setCargando(true);

            // 1. Obtener Usuarios
            const uSnap = await getDocs(collection(db, "usuarios"));
            const listaU = uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(listaU);

            // 2. Obtener Tickets (Soporte + Errores de Video)
            const tSnap = await getDocs(collection(db, "soporte"));
            const listaT = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Orden descendente por fecha
            listaT.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setTickets(listaT);

        } catch (error) {
            console.error("Error al sincronizar Admin:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        obtenerDatos();
    }, []);

    const actualizarUsuario = async (uid, nuevosDatos) => {
        try {
            const userRef = doc(db, "usuarios", uid);
            await updateDoc(userRef, nuevosDatos);
            obtenerDatos(); // Refrescar lista
        } catch (error) {
            notify("Error: " + error.message);
        }
    };

    const resolverTicket = async (id) => {
        if (!window.confirm("¿Marcar este reporte como resuelto? Se eliminará de la lista.")) return;
        try {
            await deleteDoc(doc(db, "soporte", id));
            obtenerDatos(); // Refrescar lista
        } catch (error) {
            notify("Error al eliminar ticket.");
        }
    };

    return (
        <div style={{
            padding: '20px', backgroundColor: '#000', minHeight: '100vh',
            color: '#fff', fontFamily: 'monospace', boxSizing: 'border-box',
            width: '100%', overflowX: 'hidden'
        }}>

            {/* Header con Navegación de Tabs */}
            <div style={{ borderBottom: '2px solid #d4af37', paddingBottom: '20px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ color: '#d4af37', margin: 0, fontSize: '1.2rem' }}>ADMINISTRACIÓN VAULT</h2>
                    <button onClick={onBack} style={{ background: 'none', border: '1px solid #d4af37', color: '#d4af37', padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer' }}>VOLVER</button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setTabActiva('tickets')}
                        style={{
                            flex: 1, padding: '12px', cursor: 'pointer', fontWeight: 'bold',
                            backgroundColor: tabActiva === 'tickets' ? '#ff4444' : '#111',
                            color: tabActiva === 'tickets' ? '#fff' : '#666',
                            border: 'none', borderRadius: '4px', fontSize: '0.8rem'
                        }}
                    >
                        REPORTES ({tickets.length})
                    </button>
                    <button
                        onClick={() => setTabActiva('usuarios')}
                        style={{
                            flex: 1, padding: '12px', cursor: 'pointer', fontWeight: 'bold',
                            backgroundColor: tabActiva === 'usuarios' ? '#d4af37' : '#111',
                            color: tabActiva === 'usuarios' ? '#000' : '#666',
                            border: 'none', borderRadius: '4px', fontSize: '0.8rem'
                        }}
                    >
                        USUARIOS ({usuarios.length})
                    </button>
                </div>
            </div>

            {cargando ? (
                <p style={{ color: '#d4af37' }}>Sincronizando Vault...</p>
            ) : (
                <div style={{ width: '100%' }}>

                    {/* VISTA DE TICKETS (Soporte y Fallos de Video) */}
                    {tabActiva === 'tickets' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {tickets.length === 0 ? (
                                <p style={{ color: '#666', textAlign: 'center' }}>No hay alertas pendientes.</p>
                            ) : (
                                tickets.map(t => {
                                    const esFalloVideo = t.tipo === 'video_fail';
                                    return (
                                        <div key={t.id} style={{
                                            padding: '15px',
                                            backgroundColor: '#0a0a0a',
                                            border: esFalloVideo ? '2px solid #ff4444' : '1px solid #333',
                                            borderRadius: '8px',
                                            position: 'relative'
                                        }}>
                                            {/* Badge de tipo de error */}
                                            {esFalloVideo && (
                                                <div style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: '#ff4444', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                                    ERROR DE VIDEO
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', marginBottom: '8px' }}>
                                                <span>DE: {t.nombre?.toUpperCase()}</span>
                                                <span>{t.fecha}</span>
                                            </div>

                                            <p style={{
                                                margin: '10px 0',
                                                fontSize: '0.85rem',
                                                color: esFalloVideo ? '#ff4444' : '#eee',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.4'
                                            }}>
                                                {t.mensaje}
                                            </p>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #222', paddingTop: '10px' }}>
                                                <a href={`mailto:${t.email}`} style={{ textDecoration: 'none', color: '#d4af37', border: '1px solid #d4af37', padding: '5px 12px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>MAIL</a>
                                                <button
                                                    onClick={() => resolverTicket(t.id)}
                                                    style={{ backgroundColor: esFalloVideo ? '#ff4444' : '#222', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                >
                                                    {esFalloVideo ? 'REPARADO' : 'RESOLVER'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* VISTA DE USUARIOS (Diseño Original Intacto) */}
                    {tabActiva === 'usuarios' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: window.innerWidth < 600 ? 'none' : 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr', padding: '10px', color: '#666', fontSize: '0.8rem', borderBottom: '1px solid #222' }}>
                                <span>USUARIO</span><span>ESTADO</span><span>ROL</span><span>ACCIONES</span>
                            </div>
                            {usuarios.map(u => (
                                <div key={u.id} style={{
                                    display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '2fr 1fr 1.5fr 1fr',
                                    gap: '15px', padding: '15px', backgroundColor: '#0a0a0a', border: '1px solid #111', borderRadius: '8px', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#d4af37', fontSize: '0.9rem' }}>{u.nombre?.toUpperCase() || 'SIN NOMBRE'}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#555' }}>{u.email}</div>
                                    </div>
                                    <div>
                                        {u.validado ?
                                            <span style={{ color: '#4CAF50', fontSize: '0.75rem', fontWeight: 'bold' }}>● ACTIVO</span> :
                                            <span style={{ color: '#FF5252', fontSize: '0.75rem', fontWeight: 'bold' }}>● PENDIENTE</span>
                                        }
                                    </div>
                                    <select
                                        value={u.rol || 'alumno'}
                                        onChange={(e) => actualizarUsuario(u.uid, { rol: e.target.value })}
                                        style={{ backgroundColor: '#111', color: u.rol === 'admin' ? '#d4af37' : '#fff', border: '1px solid #333', padding: '8px', borderRadius: '4px', fontSize: '0.8rem' }}
                                    >
                                        <option value="alumno">Alumno</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="profesor">Profesor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                    {!u.validado && (
                                        <button onClick={() => actualizarUsuario(u.uid, { validado: true })} style={{ backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '10px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>DAR ACCESO</button>
                                    )}
                                    {/* --- GESTIÓN DE CONTENIDO (LIBERAR CURSOS) --- */}
                                    <div style={{
                                        gridColumn: window.innerWidth < 600 ? '1' : '1 / -1',
                                        marginTop: '15px',
                                        paddingTop: '15px',
                                        borderTop: '1px solid #222'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: '#d4af37', marginBottom: '10px', fontWeight: 'bold' }}>CURSOS LIBERADOS:</div>

                                        {/* Lista de etiquetas de cursos ya liberados */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                            {u.cursos_liberados && u.cursos_liberados.length > 0 ? (
                                                u.cursos_liberados.map(cursoId => (
                                                    <div key={cursoId} style={{
                                                        backgroundColor: '#111',
                                                        border: '1px solid #4CAF50',
                                                        color: '#4CAF50',
                                                        padding: '4px 10px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        {cursoId.toUpperCase()}
                                                        <span
                                                            onClick={() => {
                                                                const nuevaLista = u.cursos_liberados.filter(id => id !== cursoId);
                                                                actualizarUsuario(u.id, { cursos_liberados: nuevaLista });
                                                            }}
                                                            style={{ cursor: 'pointer', color: '#ff4444', fontWeight: 'bold', fontSize: '1rem' }}>×</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <span style={{ color: '#444', fontSize: '0.7rem' }}>Sin cursos adicionales (Solo acceso básico)</span>
                                            )}
                                        </div>

                                        {/* Formulario rápido para liberar nuevo curso */}
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                placeholder="ID exacto del instruccional..."
                                                id={`input-curso-${u.id}`}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: '#000',
                                                    border: '1px solid #333',
                                                    color: '#fff',
                                                    padding: '10px',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(`input-curso-${u.id}`);
                                                    const cursoId = el.value.trim();
                                                    if (!cursoId) return;

                                                    const listaActual = u.cursos_liberados || [];
                                                    if (listaActual.includes(cursoId)) return notify("El usuario ya tiene este acceso.");

                                                    actualizarUsuario(u.id, { cursos_liberados: [...listaActual, cursoId] });
                                                    el.value = ""; // Limpiar input
                                                }}
                                                style={{
                                                    backgroundColor: '#4CAF50',
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '0 20px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.75rem'
                                                }}
                                            >
                                                LIBERAR CURSO
                                            </button>
                                        </div>
                                    </div>
                                    {/* --- FIN GESTIÓN DE CONTENIDO --- */}
                                </div>
                            ))}
                        </div>


                    )}
                </div>

            )}
        </div>
    );
};

export default AdminPage;