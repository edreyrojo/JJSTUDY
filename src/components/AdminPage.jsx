import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, getDoc, doc, deleteDoc, deleteField, addDoc, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { DB_INSTRUCCIONALES } from '../data/instruccionales';
import VaultIcon from './VaultIcon';
import { sincronizarCodigosAcceso } from '../utils/teamsService';
import { comprimirImagen, comprimirDataUrl } from '../utils/imageUtils';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#121212',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: '#d4af37',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
};

const AdminPage = ({ onBack }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [academias, setAcademias] = useState([]);
    const [sedes, setSedes] = useState([]);
    const [anuncios, setAnuncios] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [tabActiva, setTabActiva] = useState('usuarios');
    const [filtroUser, setFiltroUser] = useState('');
    const [estadoFiltroUsuarios, setEstadoFiltroUsuarios] = useState('todos');

    const [filtroTicket, setFiltroTicket] = useState('todos');
    const [busquedaTicket, setBusquedaTicket] = useState('');

    const [tituloAnuncio, setTituloAnuncio] = useState('');
    const [mensajeAnuncio, setMensajeAnuncio] = useState('');
    const [enviandoAnuncio, setEnviandoAnuncio] = useState(false);

    const [nombreAcademia, setNombreAcademia] = useState('');
    const [creandoAcademia, setCreandoAcademia] = useState(false);
    const [logoAcademiaBase64, setLogoAcademiaBase64] = useState('');

    const [nombreSede, setNombreSede] = useState('');
    const [academiaSeleccionada, setAcademiaSeleccionada] = useState('');
    const [teamIdProfesor, setTeamIdProfesor] = useState('');
    const [creandoSede, setCreandoSede] = useState(false);
    const [comprimiendoLogos, setComprimiendoLogos] = useState(false);

    const [academiasAbiertas, setAcademiasAbiertas] = useState({});
    const toggleAcademia = (id) => setAcademiasAbiertas(prev => ({ ...prev, [id]: !prev[id] }));

    const instruccionalesPorAutor = useMemo(() => {
        const autores = {};
        Object.keys(DB_INSTRUCCIONALES).forEach(id => {
            const curso = DB_INSTRUCCIONALES[id];
            if (!autores[curso.autor]) autores[curso.autor] = [];
            autores[curso.autor].push({ id, titulo: curso.titulo });
        });
        return autores;
    }, []);

    useEffect(() => {
        const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snap) => {
            setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
            console.error('Error usuarios:', error);
            setCargando(false);
        });

        const unsubTickets = onSnapshot(collection(db, 'soporte'), (snap) => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTickets(lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        }, (error) => console.error('Error soporte:', error));

        const unsubAcademias = onSnapshot(collection(db, 'academias'), (snap) => {
            setAcademias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => console.error('Error academias:', error));

        const unsubSedes = onSnapshot(collection(db, 'sedes'), (snap) => {
            setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setCargando(false);
        }, (error) => {
            console.error('Error sedes:', error);
            setCargando(false);
        });

        const unsubAnuncios = onSnapshot(collection(db, 'anuncios'), (snap) => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAnuncios(lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        }, (error) => console.error('Error anuncios:', error));

        return () => {
            unsubUsuarios();
            unsubTickets();
            unsubAcademias();
            unsubSedes();
            unsubAnuncios();
        };
    }, []);

    const usuariosPendientes = useMemo(() => usuarios.filter(u => !u.validado).length, [usuarios]);
    const usuariosValidados = usuarios.length - usuariosPendientes;

    const usuariosFiltrados = useMemo(() => {
        const termino = filtroUser.trim().toLowerCase();
        return usuarios
            .filter(u => {
                if (estadoFiltroUsuarios === 'pendientes' && u.validado) return false;
                if (estadoFiltroUsuarios === 'validados' && !u.validado) return false;
                if (!termino) return true;
                return [
                    u.nombre, u.email, u.rol, u.academiaNombre, u.academiaId, u.sedeId, u.teamId
                ].some(valor => String(valor || '').toLowerCase().includes(termino));
            })
            .sort((a, b) => Number(!!a.validado) - Number(!!b.validado) || String(a.nombre || '').localeCompare(String(b.nombre || '')));
    }, [usuarios, filtroUser, estadoFiltroUsuarios]);

    const ticketsFiltrados = useMemo(() => {
        const termino = busquedaTicket.trim().toLowerCase();
        return tickets.filter(t => {
            if (filtroTicket === 'video' && t.tipo !== 'video_fail') return false;
            if (filtroTicket === 'soporte' && t.tipo === 'video_fail') return false;
            if (!termino) return true;
            return [t.nombre, t.email, t.mensaje, t.tipo].some(valor => String(valor || '').toLowerCase().includes(termino));
        });
    }, [tickets, filtroTicket, busquedaTicket]);

    const diagnostico = useMemo(() => {
        const sinRol = usuarios.filter(u => !u.rol).length;
        const sinAcademia = usuarios.filter(u => !u.academiaId && !u.teamId).length;
        const sinSede = usuarios.filter(u => !u.sedeId).length;
        const academiasSinSedes = academias.filter(a => !sedes.some(se => se.academiaId === a.id)).length;
        const sedesSinAcademia = sedes.filter(se => !se.academiaId).length;

        return [
            { label: 'Usuarios sin rol asignado', value: sinRol, ok: sinRol === 0 },
            { label: 'Usuarios sin academia o team', value: sinAcademia, ok: sinAcademia === 0 },
            { label: 'Usuarios sin sede asignada', value: sinSede, ok: sinSede === 0 },
            { label: 'Academias sin sedes afiliadas', value: academiasSinSedes, ok: academiasSinSedes === 0 },
            { label: 'Sedes sin academia asociada', value: sedesSinAcademia, ok: sedesSinAcademia === 0 },
            { label: 'Tickets de soporte abiertos', value: tickets.length, ok: tickets.length === 0 },
            { label: 'Cursos en el catálogo', value: Object.keys(DB_INSTRUCCIONALES).length, ok: true }
        ];
    }, [usuarios, academias, sedes, tickets]);

    const handleAsignarPersonal = async (uidUsuario, nuevoRol, idSede, idAcademia) => {
        if (!uidUsuario) return;
        try {
            const userRef = doc(db, 'usuarios', uidUsuario);
            await setDoc(userRef, {
                rol: nuevoRol,
                sedeId: idSede || idAcademia,
                teamId: idSede || idAcademia,
                academiaId: idAcademia
            }, { merge: true });
            notify(`Asignado como ${nuevoRol.toUpperCase()}`);
        } catch (error) {
            notify('No se pudo asignar el personal: ' + error.message, 'error');
        }
    };

    const generarCodigoSedeMadre = async (idSede, nombreAca) => {
        try {
            const prefijo = (nombreAca || 'DOJO').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
            const rand = Math.floor(100000 + Math.random() * 900000);
            const nuevoCodigo = `${prefijo}-MADRE${rand}`;
            const sedeRef = doc(db, 'sedes', idSede);
            const sedeSnap = await getDoc(sedeRef);
            const teamIdSede = sedeSnap.exists()
                ? (sedeSnap.data().teamId || sedeSnap.data().academiaId || idSede)
                : idSede;

            await setDoc(sedeRef, {
                codigoAcceso: nuevoCodigo,
                nombreSede: nombreAca || 'Sede Madre Principal',
                ciudad: 'Sede Central'
            }, { merge: true });

            // Mapeo privado código → sede para que las reglas validen la vinculación.
            await setDoc(doc(db, 'codigosAcceso', nuevoCodigo), {
                sedeId: idSede,
                teamId: teamIdSede,
                nombreSede: nombreAca || 'Sede Madre Principal',
                actualizadoEn: new Date().toISOString()
            }, { merge: true });

            Swal.fire({
                title: 'Código generado',
                html: `<strong style="color:#d4af37;font-size:1.2rem">${nuevoCodigo}</strong>`,
                icon: 'success',
                iconColor: '#d4af37',
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37'
            });
        } catch (err) {
            notify(err.message, 'error');
        }
    };

    const copiarTexto = async (texto, mensajeExito = 'Copiado al portapapeles') => {
        try {
            await navigator.clipboard.writeText(texto);
            notify(mensajeExito);
        } catch (error) {
            console.error('No se pudo copiar:', error);
            notify('No se pudo copiar. Revisa los permisos del navegador.', 'error');
        }
    };

    const handleLogoAcademiaChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            // Comprimimos el logo: el base64 sin comprimir rebasa el límite
            // de 1 MB del documento de Firestore.
            const base64 = await comprimirImagen(file, {
                maxDimension: 600,
                quality: 0.76,
                maxBytes: 380000
            });
            setLogoAcademiaBase64(base64);
        } catch (error) {
            Swal.fire('Error', error?.message || 'No se pudo procesar el logo.', 'error');
        }
    };

    const handleAction = async (id, collectionName, action, data = null) => {
        try {
            if (action === 'delete') {
                const res = await Swal.fire({
                    title: '¿Confirmar eliminación?',
                    text: 'Se eliminará permanentemente de la base de datos.',
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#1a1a1a',
                    color: '#fff',
                    confirmButtonColor: '#ff4444',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Sí, eliminar'
                });
                if (!res.isConfirmed) return;
                await deleteDoc(doc(db, collectionName, id));
                notify('Registro eliminado');
            } else {
                await updateDoc(doc(db, collectionName, id), data);
                notify('Actualizado');
            }
        } catch (error) {
            notify(error.message, 'error');
        }
    };

    const handleEliminarUsuario = async (user) => {
        const res = await Swal.fire({
            title: '¿Eliminar perfil?',
            html: `Se eliminará el perfil de <b>${user.email || user.nombre || 'este usuario'}</b>.<br><small>La cuenta de acceso seguirá existiendo en Firebase Authentication.</small>`,
            icon: 'warning',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#ff4444',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, eliminar perfil'
        });
        if (!res.isConfirmed) return;
        try {
            await deleteDoc(doc(db, 'usuarios', user.id));
            notify('Perfil eliminado');
        } catch (error) {
            notify('No se pudo eliminar: ' + error.message, 'error');
        }
    };

    const resolverTicket = async (ticket) => {
        const res = await Swal.fire({
            title: '¿Marcar como resuelto?',
            text: 'El ticket saldrá de la bandeja de soporte.',
            icon: 'question',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, resolver'
        });
        if (!res.isConfirmed) return;
        try {
            await deleteDoc(doc(db, 'soporte', ticket.id));
            notify('Ticket resuelto');
        } catch (error) {
            notify('No se pudo resolver: ' + error.message, 'error');
        }
    };

    const handleCrearAcademia = async (e) => {
        e.preventDefault();
        if (!nombreAcademia.trim()) return notify('Ingresa un nombre válido', 'error');
        setCreandoAcademia(true);
        try {
            const nombreLimpio = nombreAcademia.trim().toUpperCase();
            await addDoc(collection(db, 'academias'), {
                nombre: nombreLimpio,
                nombreAcademia: nombreLimpio,
                horarios: [],
                logoBase64: logoAcademiaBase64,
                programas: ['BJJ Adultos', 'BJJ Kids', 'No-Gi'],
                sede: '',
                fechaCreacion: new Date().toLocaleString(),
                ultimaActualizacion: new Date().toISOString(),
                timestamp: Date.now()
            });
            notify(`Academia "${nombreLimpio}" registrada`);
            setNombreAcademia('');
            setLogoAcademiaBase64('');
        } catch {
            notify('Error al crear la academia', 'error');
        } finally {
            setCreandoAcademia(false);
        }
    };

    const handleCrearSede = async (e) => {
        e.preventDefault();
        if (!nombreSede.trim() || !academiaSeleccionada || !teamIdProfesor.trim()) {
            return notify('Completa todos los campos', 'error');
        }
        const academiaMadre = academias.find(a => a.id === academiaSeleccionada);
        setCreandoSede(true);
        try {
            const sedeRef = doc(collection(db, 'sedes'));
            await setDoc(sedeRef, {
                id: sedeRef.id,
                nombre: nombreSede.trim(),
                nombreSede: nombreSede.trim(),
                academiaId: academiaSeleccionada,
                academiaNombre: academiaMadre?.nombreAcademia || academiaMadre?.nombre || 'Desconocida',
                teamId: teamIdProfesor.trim(),
                fechaCreacion: new Date().toISOString(),
                activa: true,
                tipo: 'sede_afiliada'
            });
            notify('Sede vinculada correctamente');
            setNombreSede('');
            setTeamIdProfesor('');
        } catch (error) {
            notify(`Error al vincular: ${error.message}`, 'error');
        } finally {
            setCreandoSede(false);
        }
    };

    const corregirIdsAlumnos = async () => {
        const ID_ERRONEO = '0xwL28fPsjcij3AVltJVEImPrO72';
        const ID_CORRECTO = '0xwL28fPsjcij3AVltJVElmPr072';
        const confirm = await Swal.fire({
            title: '¿Corregir IDs?',
            text: 'Se cambiará el ID erróneo en los alumnos. Asegúrate de tener un respaldo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, corregir',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333'
        });
        if (!confirm.isConfirmed) return;
        try {
            const snapshot = await getDocs(collection(db, 'alumnos'));
            const batch = writeBatch(db);
            let count = 0;
            snapshot.forEach((docSnap) => {
                if (docSnap.data().teamId === ID_ERRONEO) {
                    batch.update(docSnap.ref, { teamId: ID_CORRECTO });
                    count++;
                }
            });
            if (count > 0) {
                await batch.commit();
                notify(`Se corrigieron ${count} alumnos.`);
            } else {
                notify('No se encontraron errores.', 'info');
            }
        } catch (error) {
            notify('Error: ' + error.message, 'error');
        }
    };

    const handleSincronizarCodigos = async () => {
        const res = await Swal.fire({
            title: '¿Sincronizar códigos?',
            text: 'Copia los códigos de acceso existentes a la colección privada para que los instructores puedan vincularse. Es seguro ejecutarlo varias veces.',
            icon: 'question',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, sincronizar'
        });
        if (!res.isConfirmed) return;
        try {
            const total = await sincronizarCodigosAcceso();
            notify(total > 0 ? `Códigos sincronizados: ${total}` : 'No hay sedes con código.');
        } catch (error) {
            notify('No se pudieron sincronizar: ' + error.message, 'error');
        }
    };

    const handleComprimirLogos = async () => {
        const pesados = (sedes || []).filter((sede) => {
            const logo = sede.logoBase64 || sede.logobase64 || '';
            return typeof logo === 'string' && /^data:image\//i.test(logo) && logo.length > 400000;
        });
        if (!pesados.length) {
            notify('No hay logos pesados en las sedes.', 'info');
            return;
        }
        const res = await Swal.fire({
            title: '¿Comprimir logos?',
            text: `${pesados.length} sede(s) tienen un logo muy pesado. Se comprimirán a ~380 KB para proteger el límite de Firestore.`,
            icon: 'question',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, comprimir'
        });
        if (!res.isConfirmed) return;

        setComprimiendoLogos(true);
        let ok = 0;
        let fallos = 0;
        for (const sede of pesados) {
            try {
                const logo = sede.logoBase64 || sede.logobase64;
                const base64 = await comprimirDataUrl(logo, {
                    maxDimension: 600,
                    quality: 0.76,
                    maxBytes: 380000
                });
                await updateDoc(doc(db, 'sedes', sede.id), {
                    logoBase64: base64,
                    logobase64: deleteField(),
                    ultimaActualizacion: new Date().toISOString()
                });
                ok += 1;
            } catch (error) {
                console.error('No se pudo comprimir el logo de la sede', sede.id, error);
                fallos += 1;
            }
        }
        setComprimiendoLogos(false);
        notify(
            `Logos comprimidos: ${ok}${fallos ? ` · fallos: ${fallos}` : ''}`,
            fallos ? 'error' : 'success'
        );
    };

    const handlePublicarAnuncio = async () => {
        if (!tituloAnuncio.trim() || !mensajeAnuncio.trim()) return notify('Completa título y mensaje.', 'error');
        setEnviandoAnuncio(true);
        try {
            await addDoc(collection(db, 'anuncios'), {
                titulo: tituloAnuncio.trim(),
                mensaje: mensajeAnuncio.trim(),
                fecha: new Date().toLocaleString(),
                timestamp: Date.now()
            });
            notify('Anuncio publicado');
            setTituloAnuncio('');
            setMensajeAnuncio('');
        } catch {
            notify('Error al publicar.', 'error');
        } finally {
            setEnviandoAnuncio(false);
        }
    };

    const exportarUsuariosCSV = () => {
        try {
            const cabecera = ['Nombre', 'Email', 'Rol', 'Validado', 'Academia', 'Sede', 'Cursos liberados', 'Fecha de registro'];
            const filas = usuarios.map(u => [
                u.nombre || '',
                u.email || '',
                u.rol || '',
                u.validado ? 'Sí' : 'No',
                u.academiaId || u.teamId || '',
                u.sedeId || '',
                Array.isArray(u.cursos_liberados) ? u.cursos_liberados.length : 0,
                u.fechaRegistro || ''
            ]);
            const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
            const csv = [cabecera, ...filas].map(fila => fila.map(escapar).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = `usuarios-la-fortuna-${new Date().toISOString().slice(0, 10)}.csv`;
            enlace.click();
            URL.revokeObjectURL(url);
            notify('CSV exportado');
        } catch {
            notify('No se pudo exportar el CSV.', 'error');
        }
    };

    const copiarReporte = () => {
        const lineas = [
            'REPORTE LA FORTUNA VAULT',
            `Fecha: ${new Date().toLocaleString()}`,
            '',
            `Usuarios: ${usuarios.length}`,
            `Pendientes: ${usuariosPendientes}`,
            `Validados: ${usuariosValidados}`,
            `Academias: ${academias.length}`,
            `Sedes: ${sedes.length}`,
            `Tickets abiertos: ${tickets.length}`,
            `Anuncios publicados: ${anuncios.length}`,
            '',
            'DIAGNÓSTICO:',
            ...diagnostico.map(d => `- ${d.label}: ${d.value}`)
        ];
        copiarTexto(lineas.join('\n'), 'Reporte copiado');
    };

    const tabs = [
        { id: 'usuarios', label: 'USUARIOS', icon: 'user', badge: usuariosPendientes },
        { id: 'estructuras', label: 'ESTRUCTURAS', icon: 'building', badge: 0 },
        { id: 'anuncios', label: 'ANUNCIOS', icon: 'megaphone', badge: anuncios.length },
        { id: 'tickets', label: 'SOPORTE', icon: 'flag', badge: tickets.length },
        { id: 'mantenimiento', label: 'MANTENIMIENTO', icon: 'settings', badge: 0 }
    ];

    return (
        <div style={s.container}>
            <style>{`
                @keyframes fadeInAdmin {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .admin-stat { transition: transform 0.2s ease, border-color 0.2s ease; }
                .admin-stat.is-clickable { cursor: pointer; }
                .admin-stat.is-clickable:hover { transform: translateY(-2px); border-color: #d4af37; }
                .admin-tab { transition: color 0.2s ease, background 0.2s ease; }
                .admin-tab:hover { color: #d4af37; }
                .admin-user-card { transition: border-color 0.2s ease; }
                .admin-user-card:hover { border-color: #333; }
                .admin-btn { transition: background 0.2s ease, border-color 0.2s ease, transform 0.12s ease; }
                .admin-btn:hover { border-color: #d4af37 !important; }
                .admin-btn:active { transform: scale(0.98); }
                .admin-announcement { transition: border-color 0.2s ease; }
                .admin-announcement:hover { border-color: #d4af37 !important; }
            `}</style>

            <div style={s.page}>
                <header style={s.header}>
                    <div style={s.headerTitleGroup}>
                        <div style={s.titleIcon}>
                            <VaultIcon name="shield" size={22} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={s.title}>CONTROL MAESTRO</h1>
                            <p style={s.subtitle}>Gestión global, accesos y contenido</p>
                        </div>
                    </div>
                    <button type="button" onClick={onBack} style={s.btnBack}>
                        <VaultIcon name="chevronLeft" size={14} /> VOLVER
                    </button>
                </header>

                <section style={s.statsGrid}>
                    <StatCard
                        label="Usuarios"
                        value={usuarios.length}
                        icon={<VaultIcon name="user" size={20} />}
                        color="#d4af37"
                        onClick={() => { setTabActiva('usuarios'); setEstadoFiltroUsuarios('todos'); }}
                    />
                    <StatCard
                        label="Pendientes"
                        value={usuariosPendientes}
                        icon={<VaultIcon name="clock" size={20} />}
                        color={usuariosPendientes > 0 ? '#ff9800' : '#4CAF50'}
                        onClick={() => { setTabActiva('usuarios'); setEstadoFiltroUsuarios('pendientes'); }}
                    />
                    <StatCard
                        label="Academias"
                        value={academias.length}
                        icon={<VaultIcon name="building" size={20} />}
                        color="#d4af37"
                        onClick={() => setTabActiva('estructuras')}
                    />
                    <StatCard
                        label="Sedes"
                        value={sedes.length}
                        icon={<VaultIcon name="pin" size={20} />}
                        color="#d4af37"
                        onClick={() => setTabActiva('estructuras')}
                    />
                    <StatCard
                        label="Soporte"
                        value={tickets.length}
                        icon={<VaultIcon name="flag" size={20} />}
                        color={tickets.length > 0 ? '#ff9800' : '#4CAF50'}
                        onClick={() => setTabActiva('tickets')}
                    />
                </section>

                <div style={s.tabContainer}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTabActiva(tab.id)}
                            className="admin-tab"
                            style={tabActiva === tab.id ? s.tabActive : s.tabInactive}
                        >
                            <VaultIcon name={tab.icon} size={14} />
                            {tab.label}
                            {tab.badge > 0 && <span style={s.badge}>{tab.badge}</span>}
                        </button>
                    ))}
                </div>

                {cargando ? (
                    <div style={s.loader}>Sincronizando datos...</div>
                ) : (
                    <main style={s.main}>
                        {/* USUARIOS */}
                        {tabActiva === 'usuarios' && (
                            <div style={s.viewSection}>
                                <div style={s.toolbarRow}>
                                    <div style={s.searchBar}>
                                        <VaultIcon name="search" size={16} />
                                        <input
                                            placeholder="Buscar por nombre, correo, rol o academia..."
                                            style={s.searchInput}
                                            value={filtroUser}
                                            onChange={(e) => setFiltroUser(e.target.value)}
                                        />
                                        {filtroUser && (
                                            <button type="button" onClick={() => setFiltroUser('')} style={s.clearButton} aria-label="Limpiar búsqueda">
                                                <VaultIcon name="close" size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={s.filterChips}>
                                        {[
                                            { id: 'todos', label: 'TODOS', count: usuarios.length },
                                            { id: 'pendientes', label: 'PENDIENTES', count: usuariosPendientes },
                                            { id: 'validados', label: 'VALIDADOS', count: usuariosValidados }
                                        ].map(filtro => (
                                            <button
                                                key={filtro.id}
                                                type="button"
                                                onClick={() => setEstadoFiltroUsuarios(filtro.id)}
                                                style={estadoFiltroUsuarios === filtro.id ? s.filterChipActive : s.filterChip}
                                            >
                                                {filtro.label} <span style={s.filterChipCount}>{filtro.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={s.listMeta}>
                                    {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuario' : 'usuarios'} en esta vista
                                </div>

                                <div style={s.userList}>
                                    {usuariosFiltrados.map(u => (
                                        <UserRow
                                            key={`${u.id}-${u.academiaId || ''}-${u.sedeId || ''}`}
                                            user={u}
                                            autores={instruccionalesPorAutor}
                                            academias={academias}
                                            sedes={sedes}
                                            onUpdate={(data) => handleAction(u.id, 'usuarios', 'update', data)}
                                            onDelete={() => handleEliminarUsuario(u)}
                                        />
                                    ))}
                                    {usuariosFiltrados.length === 0 && (
                                        <div style={s.emptyState}>
                                            <VaultIcon name="user" size={34} color="#d4af37" />
                                            <p style={s.emptyTitle}>Sin usuarios para mostrar</p>
                                            <p style={s.emptyText}>Cambia la búsqueda o el filtro de estado.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ESTRUCTURAS */}
                        {tabActiva === 'estructuras' && (
                            <div style={s.viewSection}>
                                <div style={s.panelBox}>
                                    <div style={s.panelHeader}>
                                        <h2 style={s.panelTitle}><VaultIcon name="tree" size={18} /> Árbol organizacional</h2>
                                        <span style={s.panelMeta}>{academias.length} academias · {sedes.length} sedes</span>
                                    </div>

                                    {academias.length === 0 && (
                                        <div style={s.emptyState}>
                                            <VaultIcon name="building" size={34} color="#d4af37" />
                                            <p style={s.emptyTitle}>Aún no hay academias</p>
                                            <p style={s.emptyText}>Crea la primera academia con el formulario de abajo.</p>
                                        </div>
                                    )}

                                    {academias.map(aca => {
                                        const logoAca = aca.logoBase64 || aca.logobase64;
                                        const nombreAca = aca.nombreAcademia || aca.nombre || 'Academia';
                                        const estaAbierto = !!academiasAbiertas[aca.id];
                                        const profesMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'profesor' && u.sedeId === aca.id);
                                        const instsMadre = usuarios.filter(u => u.academiaId === aca.id && u.rol === 'instructor' && u.sedeId === aca.id);
                                        const sedesAfiliadas = sedes.filter(se => se.academiaId === aca.id && se.id !== aca.id);

                                        return (
                                            <div key={aca.id} style={s.treeCard}>
                                                <button type="button" onClick={() => toggleAcademia(aca.id)} style={s.treeHeader}>
                                                    <span style={s.treeIdentity}>
                                                        {logoAca ? (
                                                            <img src={logoAca} alt="logo" style={s.treeLogo} />
                                                        ) : (
                                                            <span style={s.treeIcon}><VaultIcon name="building" size={18} /></span>
                                                        )}
                                                        <span>
                                                            <span style={s.treeName}>{nombreAca}</span>
                                                            <span style={s.treeMeta}>{sedesAfiliadas.length} {sedesAfiliadas.length === 1 ? 'sede' : 'sedes'} · {profesMadre.length + instsMadre.length} staff</span>
                                                        </span>
                                                    </span>
                                                    <span style={s.treeChevron}>
                                                        <VaultIcon name={estaAbierto ? 'chevronUp' : 'chevronDown'} size={16} />
                                                    </span>
                                                </button>

                                                {estaAbierto && (
                                                    <div style={s.treeBody}>
                                                        <div style={s.sedeMadreCard}>
                                                            <div style={s.sedeMadreHeader}>
                                                                <h4 style={s.sedeTitle}><VaultIcon name="home" size={14} /> Sede madre</h4>
                                                                <button type="button" onClick={() => generarCodigoSedeMadre(aca.id, nombreAca)} style={s.btnGhostSmall}>
                                                                    <VaultIcon name="lock" size={12} /> Generar código
                                                                </button>
                                                            </div>

                                                            <p style={s.miniLabel}>PROFESORES</p>
                                                            {profesMadre.map(p => (
                                                                <div key={p.id} style={s.itemPersonal}>
                                                                    <span style={s.itemName}>{p.nombre || p.email}</span>
                                                                    <button type="button" onClick={() => handleAsignarPersonal(p.id, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                </div>
                                                            ))}
                                                            <select
                                                                style={s.formInputSmall}
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleAsignarPersonal(e.target.value, 'profesor', aca.id, aca.id);
                                                                    e.target.value = '';
                                                                }}
                                                            >
                                                                <option value="">+ Asignar profesor...</option>
                                                                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
                                                            </select>

                                                            <p style={s.miniLabel}>INSTRUCTORES</p>
                                                            {instsMadre.map(i => (
                                                                <div key={i.id} style={s.itemPersonal}>
                                                                    <span style={s.itemName}>{i.nombre || i.email}</span>
                                                                    <button type="button" onClick={() => handleAsignarPersonal(i.id, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                </div>
                                                            ))}
                                                            <select
                                                                style={s.formInputSmall}
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleAsignarPersonal(e.target.value, 'instructor', aca.id, aca.id);
                                                                    e.target.value = '';
                                                                }}
                                                            >
                                                                <option value="">+ Asignar instructor...</option>
                                                                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
                                                            </select>
                                                        </div>

                                                        <div style={s.sedesHeader}>
                                                            <span><VaultIcon name="pin" size={13} /> Sedes afiliadas ({sedesAfiliadas.length})</span>
                                                        </div>

                                                        {sedesAfiliadas.length === 0 && (
                                                            <p style={s.emptyInline}>Esta academia aún no tiene sedes afiliadas.</p>
                                                        )}

                                                        {sedesAfiliadas.map(se => {
                                                            const personalSede = usuarios.filter(u => u.sedeId === se.id && (u.rol === 'instructor' || u.rol === 'profesor'));
                                                            return (
                                                                <div key={se.id} style={s.affiliatedSedeCard}>
                                                                    <div style={s.affiliatedSedeHeader}>
                                                                        <div>
                                                                            <div style={s.sedeName}>{se.nombreSede || se.nombre}</div>
                                                                            <div style={s.sedeMeta}>{se.ciudad || 'Sin ciudad'} {se.codigoAcceso ? `· ${se.codigoAcceso}` : ''}</div>
                                                                        </div>
                                                                        {se.codigoAcceso && (
                                                                            <button type="button" onClick={() => copiarTexto(se.codigoAcceso, 'Código copiado')} style={s.btnGhostSmall} title="Copiar código">
                                                                                <VaultIcon name="copy" size={12} /> Copiar código
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {personalSede.length > 0 ? (
                                                                        <div style={s.staffList}>
                                                                            {personalSede.map(u => (
                                                                                <div key={u.id} style={s.itemPersonal}>
                                                                                    <span style={s.itemName}>{u.nombre || u.email} <small style={s.itemRole}>({u.rol})</small></span>
                                                                                    <button type="button" onClick={() => handleAsignarPersonal(u.id, 'alumno', '', aca.id)} style={s.btnTextDelete}>Remover</button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p style={s.emptyInline}>Sin personal asignado.</p>
                                                                    )}

                                                                    <select
                                                                        style={s.formInputSmall}
                                                                        onChange={(e) => {
                                                                            const usr = usuarios.find(u => u.id === e.target.value);
                                                                            if (e.target.value) handleAsignarPersonal(e.target.value, usr?.rol || 'instructor', se.id, aca.id);
                                                                            e.target.value = '';
                                                                        }}
                                                                    >
                                                                        <option value="">+ Asignar rol a esta sede...</option>
                                                                        {usuarios.filter(u => u.rol === 'instructor' || u.rol === 'profesor').map(u => (
                                                                            <option key={u.id} value={u.id}>{u.nombre || u.email} ({u.rol})</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={s.structureGrid}>
                                    <div style={s.panelBox}>
                                        <h3 style={s.panelTitleSmall}><VaultIcon name="building" size={16} /> Nueva academia</h3>
                                        <form onSubmit={handleCrearAcademia}>
                                            <input style={s.formInput} value={nombreAcademia} onChange={(e) => setNombreAcademia(e.target.value)} placeholder="Nombre de la academia" />
                                            {logoAcademiaBase64 && (
                                                <div style={s.logoPreview}>
                                                    <img src={logoAcademiaBase64} alt="Logo de academia" style={s.logoPreviewImg} />
                                                    <button type="button" onClick={() => setLogoAcademiaBase64('')} style={s.btnTextDelete}>Quitar</button>
                                                </div>
                                            )}
                                            <label style={s.fileUploadBtn}>
                                                <VaultIcon name="folder" size={14} /> Subir logo
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoAcademiaChange} />
                                            </label>
                                            <button type="submit" disabled={creandoAcademia} className="admin-btn" style={s.btnGoldAction}>
                                                {creandoAcademia ? 'REGISTRANDO...' : 'REGISTRAR ACADEMIA'}
                                            </button>
                                        </form>

                                        <h4 style={s.listTitle}>Academias ({academias.length})</h4>
                                        <div style={s.listContainer}>
                                            {academias.map(ac => (
                                                <div key={ac.id} style={s.listItem}>
                                                    <span style={s.listItemName}><VaultIcon name="building" size={14} /> {ac.nombreAcademia || ac.nombre}</span>
                                                    <button type="button" onClick={() => handleAction(ac.id, 'academias', 'delete')} style={s.btnTextDelete}>Eliminar</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={s.panelBox}>
                                        <h3 style={s.panelTitleSmall}><VaultIcon name="pin" size={16} /> Vincular sede</h3>
                                        <form onSubmit={handleCrearSede}>
                                            <input style={s.formInput} value={nombreSede} onChange={(e) => setNombreSede(e.target.value)} placeholder="Nombre de la sede" />
                                            <select style={s.formInput} value={academiaSeleccionada} onChange={(e) => setAcademiaSeleccionada(e.target.value)}>
                                                <option value="">Academia madre</option>
                                                {academias.map(ac => <option key={ac.id} value={ac.id}>{ac.nombreAcademia || ac.nombre}</option>)}
                                            </select>
                                            <select style={s.formInput} value={teamIdProfesor} onChange={(e) => setTeamIdProfesor(e.target.value)}>
                                                <option value="">Profesor asignado</option>
                                                {usuarios.filter(u => u.rol === 'profesor' || u.rol === 'admin').map(u => (
                                                    <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
                                                ))}
                                            </select>
                                            <button type="submit" disabled={creandoSede} className="admin-btn" style={s.btnGoldAction}>
                                                {creandoSede ? 'ENLAZANDO...' : 'VINCULAR SEDE'}
                                            </button>
                                        </form>
                                        <p style={s.helperText}>El profesor seleccionado será el contacto de la sede para el onboarding.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ANUNCIOS */}
                        {tabActiva === 'anuncios' && (
                            <div style={s.viewSection}>
                                <div style={s.twoColumnGrid}>
                                    <div style={s.anuncioCard}>
                                        <h2 style={s.panelTitleSmall}><VaultIcon name="megaphone" size={18} /> Notificación global</h2>
                                        <p style={s.helperText}>Activa la alerta en el Hub de todos los usuarios.</p>
                                        <input
                                            style={s.formInput}
                                            value={tituloAnuncio}
                                            onChange={(e) => setTituloAnuncio(e.target.value)}
                                            placeholder="Título del anuncio..."
                                            maxLength={50}
                                        />
                                        <div style={s.charCount}>{tituloAnuncio.length}/50</div>
                                        <textarea
                                            style={s.formTextarea}
                                            value={mensajeAnuncio}
                                            onChange={(e) => setMensajeAnuncio(e.target.value)}
                                            placeholder="Escribe el mensaje o las novedades..."
                                        />
                                        <div style={s.formActions}>
                                            <button
                                                type="button"
                                                onClick={handlePublicarAnuncio}
                                                disabled={enviandoAnuncio || !tituloAnuncio.trim() || !mensajeAnuncio.trim()}
                                                className="admin-btn"
                                                style={(enviandoAnuncio || !tituloAnuncio.trim() || !mensajeAnuncio.trim()) ? s.btnPublishDisabled : s.btnPublish}
                                            >
                                                <VaultIcon name="send" size={14} /> {enviandoAnuncio ? 'PUBLICANDO...' : 'PUBLICAR AHORA'}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={s.panelBox}>
                                        <h2 style={s.panelTitleSmall}><VaultIcon name="megaphone" size={16} /> Anuncios publicados ({anuncios.length})</h2>
                                        {anuncios.length === 0 ? (
                                            <p style={s.emptyInline}>Todavía no hay anuncios publicados.</p>
                                        ) : (
                                            <div style={s.announcementList}>
                                                {anuncios.map(a => (
                                                    <div key={a.id} className="admin-announcement" style={s.announcementItem}>
                                                        <div style={s.announcementHeader}>
                                                            <strong style={s.announcementTitle}>{a.titulo || 'Anuncio'}</strong>
                                                            <button type="button" onClick={() => handleAction(a.id, 'anuncios', 'delete')} style={s.iconButton} title="Eliminar anuncio">
                                                                <VaultIcon name="trash" size={13} />
                                                            </button>
                                                        </div>
                                                        <span style={s.announcementDate}>{a.fecha}</span>
                                                        <p style={s.announcementMessage}>{a.mensaje}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SOPORTE */}
                        {tabActiva === 'tickets' && (
                            <div style={s.viewSection}>
                                <div style={s.toolbarRow}>
                                    <div style={s.searchBar}>
                                        <VaultIcon name="search" size={16} />
                                        <input
                                            placeholder="Buscar por nombre, correo o mensaje..."
                                            style={s.searchInput}
                                            value={busquedaTicket}
                                            onChange={(e) => setBusquedaTicket(e.target.value)}
                                        />
                                        {busquedaTicket && (
                                            <button type="button" onClick={() => setBusquedaTicket('')} style={s.clearButton} aria-label="Limpiar búsqueda">
                                                <VaultIcon name="close" size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={s.filterChips}>
                                        {[
                                            { id: 'todos', label: 'TODOS', count: tickets.length },
                                            { id: 'soporte', label: 'SOPORTE', count: tickets.filter(t => t.tipo !== 'video_fail').length },
                                            { id: 'video', label: 'VIDEO', count: tickets.filter(t => t.tipo === 'video_fail').length }
                                        ].map(filtro => (
                                            <button
                                                key={filtro.id}
                                                type="button"
                                                onClick={() => setFiltroTicket(filtro.id)}
                                                style={filtroTicket === filtro.id ? s.filterChipActive : s.filterChip}
                                            >
                                                {filtro.label} <span style={s.filterChipCount}>{filtro.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {ticketsFiltrados.length === 0 ? (
                                    <div style={s.emptyState}>
                                        <VaultIcon name="check" size={34} color="#4CAF50" />
                                        <p style={s.emptyTitle}>Todo despejado</p>
                                        <p style={s.emptyText}>No hay tickets con este filtro.</p>
                                    </div>
                                ) : (
                                    <div style={s.ticketGrid}>
                                        {ticketsFiltrados.map(t => (
                                            <div key={t.id} style={s.ticketCard}>
                                                <div style={s.cardHeader}>
                                                    <span style={s.date}>{t.fecha}</span>
                                                    <span style={t.tipo === 'video_fail' ? s.tagError : s.tagInfo}>
                                                        {t.tipo === 'video_fail' ? 'FALLO DE VIDEO' : 'SOPORTE'}
                                                    </span>
                                                </div>
                                                <h4 style={s.userName}>{t.nombre?.toUpperCase() || 'USUARIO'}</h4>
                                                <span style={s.ticketEmail}>{t.email}</span>
                                                <p style={s.message}>{t.mensaje}</p>
                                                <div style={s.cardActions}>
                                                    <div style={s.cardActionGroup}>
                                                        <a href={`mailto:${t.email}?subject=${encodeURIComponent('Respuesta a tu reporte de La Fortuna Vault')}`} style={s.btnMail}>
                                                            <VaultIcon name="mail" size={12} /> Contactar
                                                        </a>
                                                        {t.videoId && (
                                                            <a href={`https://drive.google.com/file/d/${t.videoId}/view`} target="_blank" rel="noreferrer" style={s.btnVideo}>
                                                                <VaultIcon name="play" size={12} /> Abrir video
                                                            </a>
                                                        )}
                                                    </div>
                                                    <button type="button" onClick={() => resolverTicket(t)} className="admin-btn" style={s.btnResolve}>
                                                        <VaultIcon name="check" size={12} /> Resolver
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MANTENIMIENTO */}
                        {tabActiva === 'mantenimiento' && (
                            <div style={s.viewSection}>
                                <div style={s.twoColumnGrid}>
                                    <div style={s.panelBox}>
                                        <div style={s.panelHeader}>
                                            <h2 style={s.panelTitleSmall}><VaultIcon name="settings" size={16} /> Diagnóstico del sistema</h2>
                                            <button type="button" onClick={copiarReporte} style={s.btnGhostSmall}>
                                                <VaultIcon name="copy" size={12} /> Copiar reporte
                                            </button>
                                        </div>
                                        <div style={s.diagnosticList}>
                                            {diagnostico.map(item => (
                                                <div key={item.label} style={s.diagnosticRow}>
                                                    <span style={s.diagnosticLabel}>
                                                        <VaultIcon name={item.ok ? 'check' : 'alert'} size={12} color={item.ok ? '#4CAF50' : '#ff9800'} />
                                                        {item.label}
                                                    </span>
                                                    <span style={{ ...s.diagnosticValue, color: item.ok ? '#4CAF50' : '#ff9800' }}>{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={s.panelBox}>
                                        <h2 style={s.panelTitleSmall}><VaultIcon name="clipboard" size={16} /> Herramientas</h2>
                                        <div style={s.toolStack}>
                                            <button type="button" onClick={exportarUsuariosCSV} className="admin-btn" style={s.btnOutlineAction}>
                                                <VaultIcon name="download" size={14} /> Exportar usuarios a CSV
                                            </button>
                                            <button type="button" onClick={copiarReporte} className="admin-btn" style={s.btnOutlineAction}>
                                                <VaultIcon name="copy" size={14} /> Copiar reporte de diagnóstico
                                            </button>
                                            <button type="button" onClick={handleSincronizarCodigos} className="admin-btn" style={s.btnOutlineAction}>
                                                <VaultIcon name="lock" size={14} /> Sincronizar códigos de acceso
                                            </button>
                                            <button type="button" onClick={handleComprimirLogos} disabled={comprimiendoLogos} className="admin-btn" style={{ ...s.btnOutlineAction, opacity: comprimiendoLogos ? 0.6 : 1 }}>
                                                <VaultIcon name="image" size={14} /> {comprimiendoLogos ? 'Comprimiendo logos...' : 'Comprimir logos pesados'}
                                            </button>
                                        </div>

                                        <div style={s.dangerBox}>
                                            <h3 style={s.dangerTitle}><VaultIcon name="alert" size={14} /> Zona de mantenimiento</h3>
                                            <p style={s.dangerText}>Esta herramienta ejecuta actualizaciones en lote. Úsala solo si sabes lo que haces y tienes un respaldo.</p>
                                            <button type="button" onClick={corregirIdsAlumnos} className="admin-btn" style={s.btnDangerAction}>
                                                <VaultIcon name="alert" size={14} /> Ejecutar migración de IDs erróneos
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color, onClick }) => (
    <div
        className={`admin-stat ${onClick ? 'is-clickable' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        } : undefined}
        style={{ ...s.statCard, borderBottom: `3px solid ${color}` }}
    >
        <div style={s.statTop}>
            <span style={{ ...s.statIcon, color: '#d4af37' }}>{icon}</span>
            <span style={s.statValue}>{value}</span>
        </div>
        <div style={s.statLabel}>{label}</div>
    </div>
);

const UserRow = ({ user, autores = {}, academias = [], sedes = [], onUpdate, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [localAcademiaId, setLocalAcademiaId] = useState(user.academiaId || '');
    const [localSedeId, setLocalSedeId] = useState(user.sedeId || '');

    const academiaActual = academias.find(a => a.id === (user.academiaId || user.teamId));
    const sedeActual = sedes.find(se => se.id === user.sedeId);
    const nombreAcademia = academiaActual?.nombreAcademia || academiaActual?.nombre || user.academiaNombre || (user.academiaId || user.teamId ? 'Academia sin nombre' : 'Sin academia');
    const esSedeMadre = Boolean(user.sedeId && (user.sedeId === user.academiaId || user.sedeId === user.teamId));
    const nombreSede = sedeActual?.nombreSede || sedeActual?.nombre || user.sedeNombre || (esSedeMadre ? 'Sede madre' : (user.sedeId ? 'Sede sin nombre' : 'Sin sede'));
    const sedesDisponibles = sedes.filter(se => !localAcademiaId || se.academiaId === localAcademiaId || se.teamId === localAcademiaId);
    const sedesOpciones = sedesDisponibles.length ? sedesDisponibles : sedes;
    const academiaActualConocida = academias.some(a => a.id === localAcademiaId);
    const sedeActualConocida = sedesOpciones.some(se => se.id === localSedeId);
    const tieneCambiosDeIds = localAcademiaId !== (user.academiaId || '') || localSedeId !== (user.sedeId || '');

    const handleLiberarTodo = async () => {
        if (!autores || Object.keys(autores).length === 0) return notify('No hay catálogo cargado.', 'error');
        const todosLosIds = Object.values(autores).flat().map(curso => curso.id);
        const result = await Swal.fire({
            title: '¿Liberar Vault?',
            text: `Acceso a ${todosLosIds.length} cursos para ${user.nombre || user.email}.`,
            icon: 'warning',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333'
        });
        if (result.isConfirmed) onUpdate({ cursos_liberados: todosLosIds });
    };

    const handleRevocar = async () => {
        const result = await Swal.fire({
            title: '¿Revocar acceso?',
            text: `${user.nombre || user.email} volverá a estado pendiente.`,
            icon: 'warning',
            showCancelButton: true,
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333'
        });
        if (result.isConfirmed) onUpdate({ validado: false });
    };

    return (
        <div className="admin-user-card" style={s.userCard}>
            <div style={s.userHeader} onClick={() => setIsExpanded(!isExpanded)}>
                <div style={s.userIdentity}>
                    <span style={user.validado ? s.statusOnline : s.statusPending} />
                    <div style={s.userText}>
                        <strong style={s.userNameCollapsed}>{user.nombre?.toUpperCase() || 'ANÓNIMO'}</strong>
                        <span style={s.userEmail}>{user.email}</span>
                        <span style={s.userMeta}>
                            <span style={s.roleBadge}>{user.rol || 'sin rol'}</span>
                            {nombreAcademia} · {nombreSede}
                        </span>
                    </div>
                </div>

                <div style={s.userActions}>
                    <span style={user.validado ? s.badgeValidated : s.badgePending}>
                        {user.validado ? 'VALIDADO' : 'PENDIENTE'}
                    </span>
                    {user.cursos_liberados?.length > 0 && (
                        <span style={s.chipExtras}>{user.cursos_liberados.length} cursos</span>
                    )}
                    {!user.validado && (
                        <button
                            type="button"
                            className="admin-btn"
                            onClick={(e) => { e.stopPropagation(); onUpdate({ validado: true }); }}
                            style={s.btnAccess}
                        >
                            <VaultIcon name="check" size={12} /> AUTORIZAR
                        </button>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} style={s.iconButton} aria-label={isExpanded ? 'Contraer usuario' : 'Expandir usuario'}>
                        <VaultIcon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={15} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div style={s.expandedSection}>
                    <div style={s.gridResponsiveExpanded}>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>ROL</label>
                            <select value={user.rol || 'alumno'} onChange={(e) => onUpdate({ rol: e.target.value })} style={s.selectInput}>
                                <option value="alumno">Alumno</option>
                                <option value="instructor">Instructor</option>
                                <option value="profesor">Profesor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>ACADEMIA</label>
                            <select value={localAcademiaId} onChange={(e) => setLocalAcademiaId(e.target.value)} style={s.selectInput}>
                                <option value="">Sin academia</option>
                                {academias.map(a => <option key={a.id} value={a.id}>{a.nombreAcademia || a.nombre}</option>)}
                                {localAcademiaId && !academiaActualConocida && <option value={localAcademiaId}>ID actual: {localAcademiaId}</option>}
                            </select>
                        </div>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>SEDE</label>
                            <select value={localSedeId} onChange={(e) => setLocalSedeId(e.target.value)} style={s.selectInput}>
                                <option value="">Sin sede</option>
                                {sedesOpciones.map(se => (
                                    <option key={se.id} value={se.id}>
                                        {se.nombreSede || se.nombre}{se.ciudad ? ` · ${se.ciudad}` : ''}
                                    </option>
                                ))}
                                {localSedeId && !sedeActualConocida && <option value={localSedeId}>ID actual: {localSedeId}</option>}
                            </select>
                        </div>
                        <div style={s.colData}>
                            <label style={s.courseLabel}>&nbsp;</label>
                            <button
                                type="button"
                                onClick={() => onUpdate({
                                    academiaId: localAcademiaId.trim() || null,
                                    teamId: localAcademiaId.trim() || null,
                                    sedeId: localSedeId.trim() || null
                                })}
                                style={tieneCambiosDeIds ? s.btnSaveIds : s.btnSaveIdsDisabled}
                                disabled={!tieneCambiosDeIds}
                            >
                                GUARDAR
                            </button>
                        </div>
                    </div>

                    <p style={s.helperText}>ID academia: {localAcademiaId || 'sin asignar'} · ID sede: {localSedeId || 'sin asignar'}</p>

                    <div style={s.sectionRow}>
                        <label style={s.courseLabel}>CONTENIDO DESBLOQUEADO</label>
                        <button type="button" onClick={handleLiberarTodo} style={s.btnGhostSmall}>
                            <VaultIcon name="access" size={12} /> TODO EL CATÁLOGO
                        </button>
                    </div>

                    <div style={s.courseChips}>
                        {user.cursos_liberados?.length > 0 ? user.cursos_liberados.map(c => (
                            <span key={c} style={s.chip}>
                                {DB_INSTRUCCIONALES[c]?.titulo || c}
                                <button
                                    type="button"
                                    onClick={() => onUpdate({ cursos_liberados: user.cursos_liberados.filter(id => id !== c) })}
                                    style={s.chipX}
                                    aria-label="Quitar curso"
                                >
                                    <VaultIcon name="close" size={10} />
                                </button>
                            </span>
                        )) : <span style={s.emptyInline}>Sin accesos adicionales.</span>}
                    </div>

                    <div style={s.addCourseBox}>
                        <select style={s.selectFull} value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                            <option value="">Añadir instruccional...</option>
                            {Object.keys(autores).map(autor => (
                                <optgroup key={autor} label={autor.toUpperCase()}>
                                    {autores[autor].map(curso => <option key={curso.id} value={curso.id}>{curso.titulo}</option>)}
                                </optgroup>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                if (!selectedCourse) return;
                                const listaActual = user.cursos_liberados || [];
                                if (!listaActual.includes(selectedCourse)) {
                                    onUpdate({ cursos_liberados: [...listaActual, selectedCourse] });
                                }
                                setSelectedCourse('');
                            }}
                            style={s.btnAdd}
                        >
                            AÑADIR
                        </button>
                    </div>

                    <div style={s.accountFooter}>
                        <div style={s.accountInfo}>
                            <span style={s.courseLabel}>ACTIVIDAD</span>
                            <span style={s.accountMeta}>Registro: {user.fechaRegistro || '—'} · Último acceso: {user.fechaUltimoAcceso || '—'}</span>
                        </div>
                        <div style={s.dangerActions}>
                            {user.validado && (
                                <button type="button" onClick={handleRevocar} style={s.btnDangerOutline}>
                                    <VaultIcon name="lock" size={12} /> REVOCAR ACCESO
                                </button>
                            )}
                            <button type="button" onClick={onDelete} style={s.btnDangerOutline}>
                                <VaultIcon name="trash" size={12} /> ELIMINAR PERFIL
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const s = {
    container: {
        backgroundColor: '#050505',
        minHeight: 'var(--app-vh)',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        padding: 'max(15px, env(safe-area-inset-top)) max(15px, env(safe-area-inset-right)) max(15px, env(safe-area-inset-bottom)) max(15px, env(safe-area-inset-left))'
    },
    page: { maxWidth: '1200px', margin: '0 auto', width: '100%' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '15px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' },
    headerTitleGroup: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 0' },
    titleIcon: { width: '42px', height: '42px', borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37', flexShrink: 0, backgroundColor: 'rgba(212,175,55,0.06)' },
    title: { color: '#d4af37', margin: 0, fontSize: 'clamp(1rem, 3.5vw, 1.35rem)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.2 },
    subtitle: { color: '#888', margin: '3px 0 0 0', fontSize: '0.78rem' },
    btnBack: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 'bold', flexShrink: 0 },

    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '12px', marginBottom: '20px' },
    statCard: { backgroundColor: '#111', padding: '14px', borderRadius: '8px', border: '1px solid #222' },
    statTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
    statIcon: { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(212,175,55,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    statValue: { fontSize: '1.6rem', fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: '0.62rem', color: '#888', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.5px' },

    tabContainer: { display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px', borderBottom: '1px solid #222', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' },
    tabInactive: { background: 'transparent', border: 'none', color: '#666', padding: '10px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.74rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', borderBottom: '2px solid transparent' },
    tabActive: { background: '#1a1a1a', border: 'none', color: '#d4af37', padding: '10px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.74rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', borderBottom: '2px solid #d4af37', borderRadius: '6px 6px 0 0' },
    badge: { backgroundColor: '#d4af37', color: '#000', fontSize: '0.58rem', padding: '2px 6px', borderRadius: '10px', marginLeft: '2px', fontWeight: 'bold' },

    loader: { color: '#d4af37', textAlign: 'center', padding: '40px', fontSize: '0.9rem' },
    main: { display: 'flex', flexDirection: 'column', gap: '15px' },
    viewSection: { animation: 'fadeInAdmin 0.2s ease-in-out' },

    toolbarRow: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
    searchBar: { backgroundColor: '#111', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #333', color: '#d4af37' },
    searchInput: { background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: '0.85rem', minWidth: 0 },
    clearButton: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' },
    filterChips: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' },
    filterChip: { background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#888', borderRadius: '999px', padding: '6px 10px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
    filterChipActive: { background: '#d4af37', border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '6px 10px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
    filterChipCount: { opacity: 0.7, marginLeft: '3px' },
    listMeta: { color: '#666', fontSize: '0.68rem', marginBottom: '8px' },

    userList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    userCard: { backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '12px' },
    userHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', cursor: 'pointer' },
    userIdentity: { display: 'flex', alignItems: 'flex-start', gap: '9px', minWidth: 0, flex: 1 },
    userText: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
    userNameCollapsed: { fontSize: '0.92rem', color: '#fff', lineHeight: 1.2 },
    userEmail: { color: '#777', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis' },
    userMeta: { color: '#888', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' },
    roleBadge: { color: '#d4af37', border: '1px solid rgba(212,175,55,0.35)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.56rem', textTransform: 'uppercase', fontWeight: 'bold' },
    userActions: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', flexShrink: 0 },
    statusOnline: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4CAF50', marginTop: '6px', flexShrink: 0 },
    statusPending: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff9800', marginTop: '6px', flexShrink: 0 },
    badgeValidated: { color: '#4CAF50', border: '1px solid rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.08)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.55rem', fontWeight: 'bold' },
    badgePending: { color: '#ff9800', border: '1px solid rgba(255,152,0,0.4)', backgroundColor: 'rgba(255,152,0,0.08)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.55rem', fontWeight: 'bold' },
    chipExtras: { fontSize: '0.62rem', color: '#d4af37', backgroundColor: 'rgba(212,175,55,0.1)', padding: '3px 6px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.4)' },
    btnAccess: { backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '6px 9px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.62rem', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    iconButton: { background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },

    expandedSection: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #222' },
    gridResponsiveExpanded: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
    colData: { display: 'flex', flexDirection: 'column', gap: '4px' },
    courseLabel: { fontSize: '0.62rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' },
    selectInput: { backgroundColor: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '6px', fontSize: '0.78rem', width: '100%', outline: 'none', boxSizing: 'border-box' },
    btnSaveIds: { width: '100%', backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' },
    btnSaveIdsDisabled: { width: '100%', backgroundColor: '#222', border: '1px solid #333', color: '#555', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '0.75rem' },
    helperText: { color: '#555', fontSize: '0.62rem', margin: '8px 0 0 0', lineHeight: 1.4 },
    sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', margin: '15px 0 8px 0', flexWrap: 'wrap' },
    btnGhostSmall: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid rgba(212,175,55,0.45)', color: '#d4af37', fontSize: '0.6rem', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    courseChips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
    chip: { backgroundColor: '#111', border: '1px solid rgba(212,175,55,0.45)', color: '#e0c068', padding: '4px 8px', borderRadius: '12px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' },
    chipX: { background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' },
    addCourseBox: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    selectFull: { backgroundColor: '#111', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '6px', flex: 1, minWidth: '180px', fontSize: '0.78rem', outline: 'none' },
    btnAdd: { backgroundColor: '#d4af37', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.72rem' },
    accountFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #1a1a1a' },
    accountInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
    accountMeta: { color: '#777', fontSize: '0.68rem' },
    dangerActions: { display: 'flex', gap: '7px', flexWrap: 'wrap' },
    btnDangerOutline: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid rgba(255,68,68,0.5)', color: '#ff6b6b', padding: '6px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 'bold' },

    panelBox: { backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '15px', minWidth: 0 },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap' },
    panelTitle: { color: '#fff', fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
    panelTitleSmall: { color: '#d4af37', fontSize: '0.9rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '7px' },
    panelMeta: { color: '#666', fontSize: '0.65rem' },

    treeCard: { marginBottom: '9px', borderLeft: '2px solid #d4af37', background: '#0a0a0a', borderRadius: '0 6px 6px 0', overflow: 'hidden' },
    treeHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0e0e0e', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', gap: '10px' },
    treeIdentity: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    treeLogo: { width: '30px', height: '30px', objectFit: 'contain', borderRadius: '4px' },
    treeIcon: { width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' },
    treeName: { display: 'block', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' },
    treeMeta: { display: 'block', color: '#666', fontSize: '0.62rem', marginTop: '2px' },
    treeChevron: { color: '#d4af37', display: 'flex', alignItems: 'center' },
    treeBody: { padding: '12px' },
    sedeMadreCard: { background: '#141414', padding: '12px', borderRadius: '6px', borderLeft: '2px solid #d4af37', marginBottom: '12px' },
    sedeMadreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
    sedeTitle: { color: '#d4af37', margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' },
    miniLabel: { color: '#999', fontSize: '0.62rem', margin: '8px 0 4px 0', fontWeight: 'bold' },
    itemPersonal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: '#1f1f1f', padding: '5px 8px', borderRadius: '4px', marginBottom: '4px' },
    itemName: { fontSize: '0.72rem', color: '#ddd' },
    itemRole: { color: '#777' },
    formInputSmall: { backgroundColor: '#000', border: '1px solid #333', color: '#fff', padding: '7px', borderRadius: '4px', fontSize: '0.72rem', outline: 'none', width: '100%', marginBottom: '8px', boxSizing: 'border-box' },
    sedesHeader: { color: '#d4af37', fontSize: '0.72rem', marginBottom: '8px', borderBottom: '1px solid rgba(212,175,55,0.25)', paddingBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' },
    affiliatedSedeCard: { background: '#111', padding: '10px', borderRadius: '6px', marginBottom: '9px', border: '1px solid #222' },
    affiliatedSedeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' },
    sedeName: { color: '#fff', fontSize: '0.78rem', fontWeight: 'bold' },
    sedeMeta: { color: '#666', fontSize: '0.62rem', marginTop: '2px' },
    staffList: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' },

    structureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '15px' },
    formInput: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.82rem', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' },
    fileUploadBtn: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', background: '#1f1f1f', color: '#d4af37', border: '1px dashed #d4af37', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold', marginBottom: '10px' },
    logoPreview: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' },
    logoPreviewImg: { width: '34px', height: '34px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #333' },
    btnGoldAction: { width: '100%', backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.78rem' },
    listTitle: { color: '#aaa', fontSize: '0.72rem', borderBottom: '1px solid #222', paddingBottom: '5px', margin: '14px 0 8px 0' },
    listContainer: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' },
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '7px 8px', borderRadius: '5px' },
    listItemName: { fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ddd' },
    btnTextDelete: { background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', padding: 0 },
    emptyInline: { color: '#555', fontStyle: 'italic', fontSize: '0.7rem', margin: '6px 0' },

    emptyState: { textAlign: 'center', padding: '30px 15px', border: '1px dashed #222', borderRadius: '8px', backgroundColor: '#070707', gridColumn: '1 / -1' },
    emptyTitle: { color: '#aaa', fontSize: '0.85rem', margin: '10px 0 4px 0' },
    emptyText: { color: '#555', fontSize: '0.7rem', margin: 0 },

    twoColumnGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px' },
    anuncioCard: { backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', padding: '18px', minWidth: 0 },
    formTextarea: { width: '100%', backgroundColor: '#000', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.82rem', outline: 'none', minHeight: '130px', resize: 'vertical', boxSizing: 'border-box' },
    charCount: { color: '#555', fontSize: '0.6rem', textAlign: 'right', marginTop: '-6px', marginBottom: '6px' },
    formActions: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' },
    btnPublish: { backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '9px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.72rem', display: 'inline-flex', gap: '6px', alignItems: 'center' },
    btnPublishDisabled: { backgroundColor: '#333', color: '#666', border: 'none', padding: '9px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '0.72rem', display: 'inline-flex', gap: '6px', alignItems: 'center' },
    announcementList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' },
    announcementItem: { backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '6px', padding: '10px' },
    announcementHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
    announcementTitle: { color: '#d4af37', fontSize: '0.78rem' },
    announcementDate: { color: '#555', fontSize: '0.6rem', display: 'block', marginTop: '2px' },
    announcementMessage: { color: '#aaa', fontSize: '0.72rem', lineHeight: 1.4, margin: '6px 0 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },

    ticketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))', gap: '12px' },
    ticketCard: { backgroundColor: '#111', border: '1px solid #333', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', minWidth: 0 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
    date: { color: '#666', fontSize: '0.65rem' },
    tagError: { backgroundColor: 'rgba(255,68,68,0.1)', color: '#ff6b6b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.56rem', fontWeight: 'bold', border: '1px solid rgba(255,68,68,0.5)' },
    tagInfo: { backgroundColor: 'rgba(212,175,55,0.1)', color: '#d4af37', padding: '2px 8px', borderRadius: '10px', fontSize: '0.56rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.5)' },
    userName: { margin: '0 0 2px 0', fontSize: '0.85rem', color: '#fff' },
    ticketEmail: { color: '#666', fontSize: '0.65rem', marginBottom: '6px', wordBreak: 'break-all' },
    message: { fontSize: '0.76rem', color: '#aaa', flex: 1, marginBottom: '12px', lineHeight: 1.45, whiteSpace: 'pre-wrap' },
    cardActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    cardActionGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    btnResolve: { display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.65rem' },
    btnMail: { display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#1a1a1a', color: '#ddd', textDecoration: 'none', border: '1px solid #333', padding: '6px 9px', borderRadius: '5px', fontSize: '0.65rem' },
    btnVideo: { display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', color: '#d4af37', textDecoration: 'none', border: '1px solid rgba(212,175,55,0.4)', padding: '6px 9px', borderRadius: '5px', fontSize: '0.65rem' },

    diagnosticList: { display: 'flex', flexDirection: 'column', gap: '6px' },
    diagnosticRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', backgroundColor: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '5px', padding: '7px 9px' },
    diagnosticLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#bbb', fontSize: '0.7rem' },
    diagnosticValue: { fontWeight: 'bold', fontSize: '0.75rem' },
    toolStack: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' },
    btnOutlineAction: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', background: 'transparent', border: '1px solid #444', color: '#d4af37', padding: '9px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold' },
    dangerBox: { border: '1px solid rgba(255,68,68,0.35)', backgroundColor: 'rgba(255,68,68,0.04)', borderRadius: '8px', padding: '12px' },
    dangerTitle: { color: '#ff6b6b', margin: '0 0 6px 0', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' },
    dangerText: { color: '#888', fontSize: '0.68rem', lineHeight: 1.45, margin: '0 0 10px 0' },
    btnDangerAction: { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#d4af37', color: '#000', border: 'none', padding: '9px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold' }
};

export default AdminPage;
