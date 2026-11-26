import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
    collection,
    onSnapshot,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
    getDocs,
    query,
    where
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { CURSOS, buscarTecnicas, tecnicasDeCurso, obtenerCurso } from '../data/vaultIndex';
import {
    TIPOS_RUTA,
    TIPOS_DESTINO,
    NIVELES,
    MODALIDADES,
    OPCIONES_POSICION,
    OPCIONES_TIPO,
    crearRutaVacia,
    crearSeccionVacia,
    crearVideoVacio,
    extraerDriveId,
    extraerYoutubeId,
    normalizarVideoDinamico,
    esVideoValido,
    mapaVideos,
    leccionesDeRuta,
    resolverLeccion,
    normalizar
} from '../utils/rutasAprendizaje';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff6b6b',
        timer: tipo === 'success' ? 1600 : undefined,
        timerProgressBar: tipo === 'success',
        showConfirmButton: tipo !== 'success',
        customClass: { popup: 'gold-border-alert' },
        didOpen: (toast) => {
            if (toast.parentElement) toast.parentElement.style.zIndex = '9999';
        }
    });
};

const clonar = (valor) => JSON.parse(JSON.stringify(valor));
const nuevoId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const isoAhora = () => new Date().toISOString();

const RutasAdminPage = ({ onBack, usuario }) => {
    const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    const [rutas, setRutas] = useState([]);
    const [videos, setVideos] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [sedes, setSedes] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [draft, setDraft] = useState(null);
    const [draftBase, setDraftBase] = useState('');
    const [tab, setTab] = useState('contenido');
    const [busquedaRutas, setBusquedaRutas] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todas');
    const [guardando, setGuardando] = useState(false);

    const [modalVideo, setModalVideo] = useState(false);
    const [videoDraft, setVideoDraft] = useState(() => crearVideoVacio());
    const [videoEditandoId, setVideoEditandoId] = useState(null);
    const [guardandoVideo, setGuardandoVideo] = useState(false);

    const [picker, setPicker] = useState(null); // { seccionId, modo: 'vault' | 'videos' }
    const [pickerTerm, setPickerTerm] = useState('');

    const [busquedaDestino, setBusquedaDestino] = useState('');
    const [destinoTab, setDestinoTab] = useState('sede');

    const [cursoTerm, setCursoTerm] = useState('');
    const [seccionContraida, setSeccionContraida] = useState({});

    useEffect(() => {
        const alRedimensionar = () => setAncho(window.innerWidth);
        window.addEventListener('resize', alRedimensionar);
        return () => window.removeEventListener('resize', alRedimensionar);
    }, []);

    const esMovil = ancho < 768;
    const esCompacto = ancho < 1100;

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const manejar = (error) => {
            console.warn('No se pudo leer una colección de rutas:', error?.code || error);
            setCargando(false);
        };
        const unsubRutas = onSnapshot(collection(db, 'rutas'), (snap) => {
            setRutas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setCargando(false);
        }, manejar);
        const unsubVideos = onSnapshot(collection(db, 'videos'), (snap) => {
            setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, manejar);
        const unsubAsignaciones = onSnapshot(collection(db, 'asignacionesRuta'), (snap) => {
            setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, manejar);
        const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snap) => {
            setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, manejar);
        const unsubSedes = onSnapshot(collection(db, 'sedes'), (snap) => {
            setSedes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, manejar);

        return () => {
            unsubRutas();
            unsubVideos();
            unsubAsignaciones();
            unsubUsuarios();
            unsubSedes();
        };
    }, []);

    const videosPorId = useMemo(() => mapaVideos(videos), [videos]);

    const rutasConMetricas = useMemo(() => rutas.map((ruta) => {
        const lecciones = leccionesDeRuta(ruta);
        const destinos = asignaciones.filter((a) => a.rutaId === ruta.id).length;
        const progreso = lecciones.reduce((acc, leccion) => {
            const playable = resolverLeccion(leccion, videosPorId);
            if (playable) acc.total += 1;
            return acc;
        }, { total: 0 });
        return { ...ruta, _lecciones: progreso.total, _secciones: (ruta.secciones || []).length, _destinos: destinos };
    }), [rutas, asignaciones, videosPorId]);

    const visibles = useMemo(() => {
        const texto = busquedaRutas.trim().toLowerCase();
        return rutasConMetricas.filter((ruta) => {
            if (filtroEstado !== 'todas' && (ruta.estado || 'borrador') !== filtroEstado) return false;
            if (!texto) return true;
            return [ruta.nombre, ruta.descripcion, ruta.nivel].join(' ').toLowerCase().includes(texto);
        });
    }, [rutasConMetricas, busquedaRutas, filtroEstado]);

    const hayCambios = useMemo(() => {
        if (!draft) return false;
        return JSON.stringify(draft) !== draftBase;
    }, [draft, draftBase]);

    const descartarDraft = () => {
        if (hayCambios) {
            Swal.fire({
                title: '¿Descartar cambios?',
                text: 'La ruta actual tiene cambios sin guardar.',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Descartar',
                cancelButtonText: 'Seguir editando'
            }).then((res) => {
                if (res.isConfirmed) {
                    setDraft(null);
                    setDraftBase('');
                }
            });
            return;
        }
        setDraft(null);
        setDraftBase('');
    };

    const salir = () => {
        if (!hayCambios) {
            onBack?.();
            return;
        }
        Swal.fire({
            title: '¿Salir sin guardar?',
            text: 'Los cambios de esta ruta se perderán.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Salir sin guardar',
            cancelButtonText: 'Seguir editando'
        }).then((res) => {
            if (res.isConfirmed) onBack?.();
        });
    };

    // --- RUTA ACTIVA ---
    const seleccionarRuta = (ruta) => {
        if (hayCambios) {
            Swal.fire({
                title: '¿Descartar cambios?',
                text: 'La ruta actual tiene cambios sin guardar.',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Descartar',
                cancelButtonText: 'Seguir editando'
            }).then((res) => {
                if (res.isConfirmed) cargarDraft(ruta);
            });
            return;
        }
        cargarDraft(ruta);
    };

    const cargarDraft = (ruta) => {
        const limpia = { ...ruta };
        Object.keys(limpia).forEach((clave) => {
            if (clave.startsWith('_')) delete limpia[clave];
        });
        const copia = clonar(limpia);
        setDraft(copia);
        setDraftBase(JSON.stringify(copia));
        setTab('contenido');
        setBusquedaDestino('');
        setCursoTerm('');
        setSeccionContraida({});
    };

    const nuevaRuta = () => {
        const crear = () => {
            const vacia = crearRutaVacia();
            vacia.creadaPor = usuario?.uid || '';
            vacia.creadaEn = isoAhora();
            vacia.secciones = [crearSeccionVacia(0)];
            setDraft(vacia);
            setDraftBase(JSON.stringify(vacia));
            setTab('contenido');
            setBusquedaRutas('');
        };

        if (hayCambios) {
            Swal.fire({
                title: '¿Descartar cambios?',
                text: 'La ruta actual tiene cambios sin guardar.',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Descartar y crear',
                cancelButtonText: 'Seguir editando'
            }).then((res) => {
                if (res.isConfirmed) crear();
            });
            return;
        }
        crear();
    };

    const actualizar = (campo, valor) => {
        setDraft((prev) => (prev ? { ...prev, [campo]: valor } : prev));
    };

    // --- GUARDAR RUTA ---
    const guardarRuta = async (forzarEstado) => {
        if (!draft || guardando) return null;
        if (!String(draft.nombre || '').trim()) {
            notify('Ponle un nombre a la ruta.', 'error');
            setTab('contenido');
            return null;
        }

        const estado = forzarEstado || draft.estado || 'borrador';
        const lecciones = leccionesDeRuta(draft);
        if (estado === 'publicada') {
            const resolubles = lecciones.filter((leccion) => resolverLeccion(leccion, videosPorId));
            if (resolubles.length === 0) {
                notify('Agrega al menos una lección que se pueda reproducir antes de publicar.', 'error');
                setTab('contenido');
                return null;
            }
            if (resolubles.length < lecciones.length) {
                const rotas = lecciones.length - resolubles.length;
                const res = await Swal.fire({
                    title: 'Lecciones sin contenido',
                    text: `${rotas} lección(es) apuntan a videos o técnicas que ya no existen. Los alumnos las verán vacías. ¿Publicar de todas formas?`,
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#1a1a1a',
                    color: '#fff',
                    confirmButtonColor: '#d4af37',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Publicar',
                    cancelButtonText: 'Revisar'
                });
                if (!res.isConfirmed) return null;
            }
        }

        setGuardando(true);
        try {
            const payload = {
                nombre: String(draft.nombre).trim(),
                descripcion: String(draft.descripcion || '').trim(),
                tipo: draft.tipo || 'rama',
                estado,
                icono: draft.icono || 'route',
                color: draft.color || '#d4af37',
                nivel: draft.nivel || 'Todos',
                cursosLiberados: Array.isArray(draft.cursosLiberados) ? draft.cursosLiberados : [],
                secciones: (draft.secciones || []).map((seccion, indice) => ({
                    id: seccion.id || nuevoId(),
                    titulo: String(seccion.titulo || `Sección ${indice + 1}`).trim(),
                    descripcion: String(seccion.descripcion || '').trim(),
                    lecciones: (seccion.lecciones || []).map((leccion) => ({
                        id: leccion.id || nuevoId(),
                        tipo: leccion.tipo === 'video' ? 'video' : 'vault',
                        ref: leccion.ref,
                        titulo: leccion.titulo || '',
                        cursoTitulo: leccion.cursoTitulo || '',
                        fuente: leccion.fuente || '',
                        nota: leccion.nota || ''
                    }))
                })),
                actualizadaEn: isoAhora()
            };

            if (draft.id) {
                await setDoc(doc(db, 'rutas', draft.id), payload, { merge: true });
                const siguiente = { ...draft, ...payload };
                setDraft(siguiente);
                setDraftBase(JSON.stringify(siguiente));
                notify(estado === 'publicada' ? 'Ruta publicada' : 'Ruta guardada');
                return siguiente;
            }

            const ref = await addDoc(collection(db, 'rutas'), {
                ...payload,
                creadaEn: draft.creadaEn || isoAhora(),
                creadaPor: usuario?.uid || ''
            });
            const siguiente = { id: ref.id, ...payload, creadaEn: draft.creadaEn || isoAhora(), creadaPor: usuario?.uid || '' };
            setDraft(siguiente);
            setDraftBase(JSON.stringify(siguiente));
            notify('Ruta creada');
            return siguiente;
        } catch (error) {
            console.error('Error al guardar ruta:', error);
            notify(error?.code === 'permission-denied' ? 'No tienes permiso para guardar rutas.' : 'No se pudo guardar la ruta.', 'error');
            return null;
        } finally {
            setGuardando(false);
        }
    };

    const publicarRuta = async () => {
        if (!draft) return;
        const destinos = asignaciones.filter((a) => a.rutaId === draft.id).length;
        if (destinos === 0) {
            const res = await Swal.fire({
                title: 'Publicar sin destinos',
                text: 'Nadie más podrá verla hasta que asignes un dojo, usuario o profesor. ¿Publicar de todas formas?',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Publicar',
                cancelButtonText: 'Cancelar'
            });
            if (!res.isConfirmed) return;
        }
        await guardarRuta('publicada');
    };

    const volverABorrador = () => guardarRuta('borrador');

    const eliminarRuta = async () => {
        if (!draft?.id) {
            const res = await Swal.fire({
                title: '¿Descartar borrador?',
                text: 'La ruta que estás creando no se ha guardado.',
                icon: 'warning',
                showCancelButton: true,
                background: '#1a1a1a',
                color: '#fff',
                confirmButtonColor: '#ff6b6b',
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, descartar',
                cancelButtonText: 'Seguir editando'
            });
            if (!res.isConfirmed) return;
            setDraft(null);
            setDraftBase('');
            return;
        }
        const res = await Swal.fire({
            title: '¿Eliminar la ruta?',
            text: 'También se eliminarán sus asignaciones. Las lecciones y videos siguen intactos.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;

        try {
            const q = query(collection(db, 'asignacionesRuta'), where('rutaId', '==', draft.id));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'asignacionesRuta', d.id))));
            await deleteDoc(doc(db, 'rutas', draft.id));
            setDraft(null);
            setDraftBase('');
            notify('Ruta eliminada');
        } catch (error) {
            console.error('Error al eliminar ruta:', error);
            notify('No se pudo eliminar la ruta.', 'error');
        }
    };

    // --- SECCIONES Y LECCIONES ---
    const agregarSeccion = () => {
        setDraft((prev) => ({
            ...prev,
            secciones: [...(prev.secciones || []), crearSeccionVacia((prev.secciones || []).length)]
        }));
    };

    const actualizarSeccion = (seccionId, campo, valor) => {
        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).map((seccion) => (
                seccion.id === seccionId ? { ...seccion, [campo]: valor } : seccion
            ))
        }));
    };

    const moverSeccion = (indice, direccion) => {
        setDraft((prev) => {
            const secciones = [...(prev.secciones || [])];
            const destino = indice + direccion;
            if (destino < 0 || destino >= secciones.length) return prev;
            [secciones[indice], secciones[destino]] = [secciones[destino], secciones[indice]];
            return { ...prev, secciones };
        });
    };

    const eliminarSeccion = (seccionId) => {
        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).filter((seccion) => seccion.id !== seccionId)
        }));
    };

    const agregarLeccion = (seccionId, leccion) => {
        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).map((seccion) => {
                if (seccion.id !== seccionId) return seccion;
                const yaExiste = (seccion.lecciones || []).some(
                    (actual) => actual.ref === leccion.ref && actual.tipo === leccion.tipo
                );
                if (yaExiste) return seccion;
                return { ...seccion, lecciones: [...(seccion.lecciones || []), leccion] };
            })
        }));
    };

    const quitarLeccion = (seccionId, indice) => {
        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).map((seccion) => (
                seccion.id === seccionId
                    ? { ...seccion, lecciones: (seccion.lecciones || []).filter((_, i) => i !== indice) }
                    : seccion
            ))
        }));
    };

    const moverLeccion = (seccionId, indice, direccion) => {
        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).map((seccion) => {
                if (seccion.id !== seccionId) return seccion;
                const lecciones = [...(seccion.lecciones || [])];
                const destino = indice + direccion;
                if (destino < 0 || destino >= lecciones.length) return seccion;
                [lecciones[indice], lecciones[destino]] = [lecciones[destino], lecciones[indice]];
                return { ...seccion, lecciones };
            })
        }));
    };

    const agregarCursoCompleto = (seccionId, cursoId) => {
        const curso = obtenerCurso(cursoId);
        const tecnicas = tecnicasDeCurso(cursoId);
        if (tecnicas.length === 0) return;

        const seccion = (draft?.secciones || []).find((s) => s.id === seccionId);
        const existentes = new Set((seccion?.lecciones || []).map((l) => l.ref));
        const nuevas = tecnicas.filter((t) => !existentes.has(t.id));

        if (nuevas.length === 0) {
            notify('Ese curso ya está completo en esta sección');
            return;
        }

        setDraft((prev) => ({
            ...prev,
            secciones: (prev.secciones || []).map((s) => {
                if (s.id !== seccionId) return s;
                const refs = new Set((s.lecciones || []).map((l) => l.ref));
                const agregar = tecnicas
                    .filter((t) => !refs.has(t.id))
                    .map((t) => ({
                        id: nuevoId(),
                        tipo: 'vault',
                        ref: t.id,
                        titulo: t.nombre,
                        cursoTitulo: curso?.titulo || t.cursoTitulo
                    }));
                return { ...s, lecciones: [...(s.lecciones || []), ...agregar] };
            })
        }));
        notify(`${nuevas.length} lecciones agregadas`);
    };

    // --- CURSOS LIBERADOS (MAPA COMPLETO) ---
    const cursosFiltrados = useMemo(() => {
        const texto = normalizar(cursoTerm);
        if (!texto) return [];
        return CURSOS
            .filter((curso) => normalizar(`${curso.titulo} ${curso.autor}`).includes(texto))
            .slice(0, 12);
    }, [cursoTerm]);

    const alternarCursoLiberado = (cursoId) => {
        setDraft((prev) => {
            const actuales = prev.cursosLiberados || [];
            return {
                ...prev,
                cursosLiberados: actuales.includes(cursoId)
                    ? actuales.filter((id) => id !== cursoId)
                    : [...actuales, cursoId]
            };
        });
    };

    // --- VIDEOS INDEXADOS ---
    const abrirNuevoVideo = () => {
        setVideoEditandoId(null);
        setVideoDraft(crearVideoVacio());
        setModalVideo(true);
    };

    const abrirEditarVideo = (video) => {
        setVideoEditandoId(video.id);
        setVideoDraft({
            fuente: video.fuente === 'youtube' ? 'youtube' : 'drive',
            url: video.url || (video.fuente === 'youtube'
                ? (video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '')
                : (video.driveId ? `https://drive.google.com/file/d/${video.driveId}/view` : '')),
            nombre: video.nombre || '',
            cursoTitulo: video.cursoTitulo || 'Videos propios',
            autor: video.autor || 'La Fortuna',
            nivel: video.nivel || 'Todos',
            posicion: video.posicion || 'AUTO',
            tipo: video.tipo || 'AUTO',
            modalidad: video.modalidad || 'AUTO',
            etiquetas: (video.etiquetas || []).join(', '),
            descripcion: video.descripcion || '',
            duracion: video.duracion || ''
        });
        setModalVideo(true);
    };

    const guardarVideo = async () => {
        if (guardandoVideo) return;
        const fuente = videoDraft.fuente === 'youtube' ? 'youtube' : 'drive';
        const idExtraido = fuente === 'youtube'
            ? extraerYoutubeId(videoDraft.url)
            : extraerDriveId(videoDraft.url);

        if (!String(videoDraft.nombre || '').trim()) return notify('Escribe el nombre del video.', 'error');
        if (!idExtraido) {
            return notify(
                fuente === 'youtube'
                    ? 'No se pudo leer el ID del enlace de YouTube.'
                    : 'No se pudo leer el ID del enlace de Drive.',
                'error'
            );
        }

        const etiquetas = String(videoDraft.etiquetas || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);

        const payload = {
            fuente,
            url: String(videoDraft.url).trim(),
            driveId: fuente === 'drive' ? idExtraido : '',
            youtubeId: fuente === 'youtube' ? idExtraido : '',
            nombre: String(videoDraft.nombre).trim(),
            cursoTitulo: String(videoDraft.cursoTitulo || 'Videos propios').trim(),
            autor: String(videoDraft.autor || 'La Fortuna').trim(),
            nivel: videoDraft.nivel || 'Todos',
            posicion: videoDraft.posicion === 'AUTO' ? '' : videoDraft.posicion,
            tipo: videoDraft.tipo === 'AUTO' ? '' : videoDraft.tipo,
            modalidad: videoDraft.modalidad === 'AUTO' ? '' : videoDraft.modalidad,
            etiquetas,
            descripcion: String(videoDraft.descripcion || '').trim(),
            duracion: String(videoDraft.duracion || '').trim(),
            activo: true,
            actualizadoEn: isoAhora(),
            ...(videoEditandoId ? {} : { creadoEn: isoAhora(), creadoPor: usuario?.uid || '' })
        };

        const normalizado = normalizarVideoDinamico(payload);
        if (!esVideoValido(normalizado)) return notify('El video no es válido.', 'error');

        setGuardandoVideo(true);
        try {
            if (videoEditandoId) {
                await setDoc(doc(db, 'videos', videoEditandoId), payload, { merge: true });
                notify('Video actualizado');
            } else {
                await addDoc(collection(db, 'videos'), payload);
                notify('Video indexado');
            }
            setVideoDraft(crearVideoVacio());
            setVideoEditandoId(null);
            setModalVideo(false);
        } catch (error) {
            console.error('Error al guardar video:', error);
            notify(error?.code === 'permission-denied' ? 'No tienes permiso para indexar videos.' : 'No se pudo guardar el video.', 'error');
        } finally {
            setGuardandoVideo(false);
        }
    };

    const eliminarVideo = async (video) => {
        const res = await Swal.fire({
            title: '¿Eliminar video indexado?',
            text: 'Las rutas que lo usen quedarán con esa lección vacía.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;
        try {
            await deleteDoc(doc(db, 'videos', video.id));
            notify('Video eliminado');
        } catch (error) {
            console.error('Error al eliminar video:', error);
            notify('No se pudo eliminar el video.', 'error');
        }
    };

    // --- ASIGNACIONES ---
    const asignacionesRuta = useMemo(
        () => asignaciones.filter((a) => draft?.id && a.rutaId === draft.id),
        [asignaciones, draft?.id]
    );

    const toggleDestino = async (destinoTipo, destinoId, destinoNombre) => {
        if (!draft?.id) return notify('Guarda la ruta primero para asignar destinos.', 'error');
        const existente = asignacionesRuta.find((a) => a.destinoTipo === destinoTipo && a.destinoId === destinoId);
        try {
            if (existente) {
                await deleteDoc(doc(db, 'asignacionesRuta', existente.id));
                notify('Destino removido');
            } else {
                const sede = destinoTipo === 'sede' ? sedes.find((s) => s.id === destinoId) : null;
                await addDoc(collection(db, 'asignacionesRuta'), {
                    rutaId: draft.id,
                    rutaNombre: draft.nombre || 'Ruta',
                    destinoTipo,
                    destinoId,
                    destinoNombre: destinoNombre || '',
                    destinoTeamId: sede?.teamId || '',
                    estado: 'activa',
                    asignadaPor: usuario?.uid || '',
                    asignadaEn: isoAhora()
                });
                notify('Destino asignado');
            }
        } catch (error) {
            console.error('Error al asignar destino:', error);
            notify('No se pudo actualizar el destino.', 'error');
        }
    };

    const destinosDisponibles = useMemo(() => {
        const texto = busquedaDestino.trim().toLowerCase();
        if (destinoTab === 'sede') {
            return sedes
                .map((sede) => ({
                    id: sede.id,
                    nombre: sede.nombreSede || sede.nombre || 'Sede sin nombre',
                    meta: [sede.ciudad, sede.direccion].filter(Boolean).join(' · ')
                }))
                .filter((item) => !texto || `${item.nombre} ${item.meta}`.toLowerCase().includes(texto));
        }
        const rolObjetivo = destinoTab === 'usuario' ? null : destinoTab;
        return usuarios
            .filter((u) => (rolObjetivo ? u.rol === rolObjetivo : true))
            .filter((u) => destinoTab !== 'usuario' || u.validado === true)
            .map((u) => ({
                id: u.uid || u.id,
                nombre: u.nombre || u.email || 'Usuario',
                meta: [u.rol, u.email].filter(Boolean).join(' · ')
            }))
            .filter((item) => !texto || `${item.nombre} ${item.meta}`.toLowerCase().includes(texto))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [destinoTab, sedes, usuarios, busquedaDestino]);

    const estaAsignado = (destinoTipo, destinoId) => asignacionesRuta.some(
        (a) => a.destinoTipo === destinoTipo && a.destinoId === destinoId
    );
    const globalAsignado = asignacionesRuta.some((a) => a.destinoTipo === 'global');

    // --- MÉTRICAS DEL DRAFT ---
    const metricasDraft = useMemo(() => {
        if (!draft) return { secciones: 0, lecciones: 0, videos: 0, vault: 0 };
        const lecciones = leccionesDeRuta(draft);
        return {
            secciones: (draft.secciones || []).length,
            lecciones: lecciones.length,
            videos: lecciones.filter((l) => l.tipo === 'video').length,
            vault: lecciones.filter((l) => l.tipo !== 'video').length
        };
    }, [draft]);

    const resultadosVault = useMemo(() => {
        if (!picker || picker.modo !== 'vault') return [];
        return buscarTecnicas(pickerTerm).slice(0, 24);
    }, [picker, pickerTerm]);

    const videosFiltrados = useMemo(() => {
        if (!picker || picker.modo !== 'videos') return [];
        const texto = normalizar(pickerTerm);
        return videos
            .map((v) => normalizarVideoDinamico(v))
            .filter((v) => v.id && (!texto || v.busca.includes(texto)))
            .slice(0, 40);
    }, [picker, pickerTerm, videos]);

    const seccionPicker = picker
        ? (draft?.secciones || []).find((seccion) => seccion.id === picker.seccionId) || null
        : null;
    const leccionesSeccionPicker = seccionPicker?.lecciones || [];
    const refsSeccionPicker = new Set(leccionesSeccionPicker.map((leccion) => leccion.ref));
    const refsRutaPicker = new Set(leccionesDeRuta(draft).map((leccion) => leccion.ref));

    return (
        <div style={s.root} className="rutas-admin-root">
            <style>{cssAdmin}</style>
            <div style={s.shell}>
                <header style={s.header}>
                    <div style={s.headerLeft}>
                        <button type="button" onClick={salir} style={s.backBtn} title="Volver" aria-label="Volver">
                            <VaultIcon name="chevronLeft" size={16} />
                        </button>
                        <div style={s.titleGroup}>
                            <span style={s.titleIcon}><VaultIcon name="settings" size={18} /></span>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={s.title}>CONSTRUCTOR DE RUTAS</h1>
                                <p style={s.subtitle}>Diseña mapas y ramas, indexa videos y libera el contenido</p>
                            </div>
                        </div>
                    </div>
                    <div style={s.headerActions}>
                        <button type="button" onClick={nuevaRuta} style={s.goldBtn}>
                            <VaultIcon name="plus" size={14} /> {!esMovil && 'NUEVA RUTA'}
                        </button>
                    </div>
                </header>

                <div style={{ ...s.layout, gridTemplateColumns: esCompacto ? '1fr' : '320px minmax(0, 1fr)' }}>
                    {/* LISTA DE RUTAS */}
                    <aside className="rutas-admin-side-sticky" style={{ ...s.sidebar, display: esCompacto && draft ? 'none' : 'block' }}>
                        <div style={s.sideTop}>
                            <div style={s.searchBox}>
                                <VaultIcon name="search" size={13} color="#777" />
                                <input
                                    value={busquedaRutas}
                                    onChange={(e) => setBusquedaRutas(e.target.value)}
                                    placeholder="Buscar ruta..."
                                    style={s.searchInput}
                                />
                            </div>
                            <div style={s.filterRow}>
                                {[
                                    { id: 'todas', label: 'Todas' },
                                    { id: 'publicada', label: 'Publicadas' },
                                    { id: 'borrador', label: 'Borradores' }
                                ].map((opcion) => (
                                    <button
                                        key={opcion.id}
                                        type="button"
                                        onClick={() => setFiltroEstado(opcion.id)}
                                        style={filtroEstado === opcion.id ? s.filterActive : s.filterChip}
                                    >
                                        {opcion.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={s.routeList}>
                            {cargando && [1, 2, 3].map((n) => <div key={n} style={s.skeleton} />)}
                            {!cargando && visibles.length === 0 && (
                                <div style={s.sideEmpty}>
                                    <VaultIcon name="route" size={22} color="#555" />
                                    <span>Sin rutas todavía.</span>
                                    <button type="button" onClick={nuevaRuta} style={s.softBtn}>
                                        <VaultIcon name="plus" size={12} /> CREAR LA PRIMERA
                                    </button>
                                </div>
                            )}
                            {visibles.map((ruta) => {
                                const activa = draft?.id && draft.id === ruta.id;
                                return (
                                    <button
                                        key={ruta.id}
                                        type="button"
                                        onClick={() => seleccionarRuta(ruta)}
                                        style={activa ? s.routeItemActive : s.routeItem}
                                    >
                                        <span style={s.routeItemTop}>
                                            <span style={s.routeItemName}>{ruta.nombre || 'Ruta sin nombre'}</span>
                                            <span style={{
                                                ...s.estadoDot,
                                                backgroundColor: ruta.estado === 'publicada' ? '#4CAF50' : '#ffbb33'
                                            }} />
                                        </span>
                                        <span style={s.routeItemMeta}>
                                            {ruta.tipo === 'completa' ? 'MAPA COMPLETO' : 'RAMA'}
                                            <span style={s.metaDot} />
                                            {ruta._secciones} sec · {ruta._lecciones} lec
                                        </span>
                                        <span style={s.routeItemMeta}>
                                            <VaultIcon name="users" size={9} /> {ruta._destinos} {ruta._destinos === 1 ? 'destino' : 'destinos'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* EDITOR */}
                    <main style={s.editor}>
                        {!draft ? (
                            <div style={s.emptyEditor}>
                                <span style={s.emptyIcon}><VaultIcon name="route" size={34} color="#d4af37" /></span>
                                <h2 style={s.emptyTitle}>Construye el siguiente camino</h2>
                                <p style={s.emptyText}>
                                    Crea una ruta completa para liberar un mapa entero, o una rama con las secciones
                                    exactas que quieras compartir con un dojo, profesor o alumno.
                                </p>
                                <button type="button" onClick={nuevaRuta} style={s.goldBtn}>
                                    <VaultIcon name="plus" size={14} /> NUEVA RUTA
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    ...s.editorHead,
                                    flexDirection: esMovil ? 'column' : 'row',
                                    alignItems: esMovil ? 'stretch' : 'center'
                                }}>
                                    <div style={s.editorIdentity}>
                                        <span style={s.editorIcon}><VaultIcon name={draft.icono || 'route'} size={20} color="#d4af37" /></span>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={s.editorNameRow}>
                                                <h2 style={s.editorName}>{draft.nombre || 'Ruta sin nombre'}</h2>
                                                <span style={draft.estado === 'publicada' ? s.publishedBadge : s.draftBadge}>
                                                    {draft.estado === 'publicada' ? 'PUBLICADA' : 'BORRADOR'}
                                                </span>
                                                {hayCambios && <span style={s.dirtyBadge}>CAMBIOS SIN GUARDAR</span>}
                                            </div>
                                            <p style={s.editorMeta}>
                                                {draft.tipo === 'completa' ? 'Mapa completo' : 'Rama específica'} · {metricasDraft.secciones} secciones · {metricasDraft.lecciones} lecciones
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ ...s.editorActions, ...(esMovil ? { justifyContent: 'flex-start' } : {}) }}>
                                        {esCompacto && (
                                            <button type="button" onClick={descartarDraft} style={s.ghostBtn}>
                                                <VaultIcon name="route" size={13} /> RUTAS
                                            </button>
                                        )}
                                        {draft.estado === 'publicada' ? (
                                            <button type="button" onClick={volverABorrador} disabled={guardando} style={s.ghostBtn}>
                                                <VaultIcon name="lock" size={13} /> DESPUBLICAR
                                            </button>
                                        ) : (
                                            <button type="button" onClick={publicarRuta} disabled={guardando} style={s.goldBtn}>
                                                <VaultIcon name="send" size={13} /> PUBLICAR
                                            </button>
                                        )}
                                        <button type="button" onClick={() => guardarRuta()} disabled={guardando} style={s.softBtn}>
                                            <VaultIcon name={guardando ? 'clock' : 'checkCircle'} size={13} /> {guardando ? 'GUARDANDO...' : 'GUARDAR'}
                                        </button>
                                        <button type="button" onClick={eliminarRuta} style={s.dangerIconBtn} title="Eliminar ruta" aria-label="Eliminar ruta">
                                            <VaultIcon name="trash" size={13} />
                                        </button>
                                    </div>
                                </div>

                                <div style={s.tabs}>
                                    {[
                                        { id: 'contenido', label: 'Contenido', icon: 'layers' },
                                        { id: 'videos', label: 'Videos', icon: 'youtube' },
                                        { id: 'destinos', label: 'Destinos', icon: 'users' },
                                        { id: 'ajustes', label: 'Ajustes', icon: 'settings' }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setTab(item.id)}
                                            style={tab === item.id ? s.tabActive : s.tab}
                                        >
                                            <VaultIcon name={item.icon} size={13} /> {item.label}
                                            {item.id === 'destinos' && asignacionesRuta.length > 0 && (
                                                <span style={s.tabCount}>{asignacionesRuta.length}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div style={s.editorBody}>
                                    {tab === 'contenido' && (
                                        <TabContenido
                                            draft={draft}
                                            actualizar={actualizar}
                                            metricas={metricasDraft}
                                            videosPorId={videosPorId}
                                            seccionContraida={seccionContraida}
                                            setSeccionContraida={setSeccionContraida}
                                            agregarSeccion={agregarSeccion}
                                            actualizarSeccion={actualizarSeccion}
                                            moverSeccion={moverSeccion}
                                            eliminarSeccion={eliminarSeccion}
                                            agregarCursoCompleto={agregarCursoCompleto}
                                            abrirPicker={(seccionId, modo) => { setPicker({ seccionId, modo }); setPickerTerm(''); }}
                                            quitarLeccion={quitarLeccion}
                                            moverLeccion={moverLeccion}
                                            cursoTerm={cursoTerm}
                                            setCursoTerm={setCursoTerm}
                                            cursosFiltrados={cursosFiltrados}
                                            alternarCursoLiberado={alternarCursoLiberado}
                                        />
                                    )}

                                    {tab === 'videos' && (
                                        <TabVideos
                                            videos={videos}
                                            onNuevo={abrirNuevoVideo}
                                            onEditar={abrirEditarVideo}
                                            onEliminar={eliminarVideo}
                                            onIndexarEnRuta={(video, seccionId) => {
                                                if (!seccionId) return;
                                                agregarLeccion(seccionId, {
                                                    id: nuevoId(),
                                                    tipo: 'video',
                                                    ref: video.id,
                                                    titulo: video.nombre,
                                                    cursoTitulo: video.cursoTitulo,
                                                    fuente: video.fuente
                                                });
                                                notify('Video agregado a la ruta');
                                            }}
                                            draft={draft}
                                        />
                                    )}

                                    {tab === 'destinos' && (
                                        <TabDestinos
                                            draft={draft}
                                            asignacionesRuta={asignacionesRuta}
                                            globalAsignado={globalAsignado}
                                            destinoTab={destinoTab}
                                            setDestinoTab={setDestinoTab}
                                            busquedaDestino={busquedaDestino}
                                            setBusquedaDestino={setBusquedaDestino}
                                            destinosDisponibles={destinosDisponibles}
                                            estaAsignado={estaAsignado}
                                            toggleDestino={toggleDestino}
                                            guardarRuta={guardarRuta}
                                            guardando={guardando}
                                        />
                                    )}

                                    {tab === 'ajustes' && (
                                        <TabAjustes
                                            draft={draft}
                                            actualizar={actualizar}
                                            metricas={metricasDraft}
                                            asignacionesRuta={asignacionesRuta}
                                            onGuardar={() => guardarRuta()}
                                            onPublicar={publicarRuta}
                                            onDespublicar={volverABorrador}
                                            guardando={guardando}
                                            hayCambios={hayCambios}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>

            {modalVideo && (
                <ModalVideo
                    videoDraft={videoDraft}
                    setVideoDraft={setVideoDraft}
                    onCerrar={() => { setModalVideo(false); setVideoEditandoId(null); }}
                    onGuardar={guardarVideo}
                    guardando={guardandoVideo}
                    editando={Boolean(videoEditandoId)}
                />
            )}

            {picker && (
                <ModalPicker
                    picker={picker}
                    termino={pickerTerm}
                    setTermino={setPickerTerm}
                    resultadosVault={resultadosVault}
                    videosFiltrados={videosFiltrados}
                    seccionTitulo={seccionPicker?.titulo || ''}
                    leccionesSeccion={leccionesSeccionPicker}
                    refsSeccion={refsSeccionPicker}
                    refsRuta={refsRutaPicker}
                    esMovil={esMovil}
                    onCerrar={() => setPicker(null)}
                    onElegirVault={(tecnica) => {
                        agregarLeccion(picker.seccionId, {
                            id: nuevoId(),
                            tipo: 'vault',
                            ref: tecnica.id,
                            titulo: tecnica.nombre,
                            cursoTitulo: tecnica.cursoTitulo
                        });
                    }}
                    onElegirVideo={(video) => {
                        agregarLeccion(picker.seccionId, {
                            id: nuevoId(),
                            tipo: 'video',
                            ref: video.id,
                            titulo: video.nombre,
                            cursoTitulo: video.cursoTitulo,
                            fuente: video.fuente
                        });
                    }}
                    onAgregarCurso={(cursoId) => agregarCursoCompleto(picker.seccionId, cursoId)}
                />
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* TAB CONTENIDO                                                       */
/* ------------------------------------------------------------------ */
const TabContenido = ({
    draft,
    actualizar,
    metricas,
    videosPorId,
    seccionContraida,
    setSeccionContraida,
    agregarSeccion,
    actualizarSeccion,
    moverSeccion,
    eliminarSeccion,
    abrirPicker,
    quitarLeccion,
    moverLeccion,
    cursoTerm,
    setCursoTerm,
    cursosFiltrados,
    alternarCursoLiberado
}) => (
    <div style={s.tabStack}>
        <div style={s.metaGrid}>
            <Campo label="Nombre de la ruta" required>
                <input
                    value={draft.nombre || ''}
                    onChange={(e) => actualizar('nombre', e.target.value)}
                    placeholder="Ej. Fundamentos Holkan · Blue Belt"
                    style={s.input}
                    maxLength={90}
                />
            </Campo>
            <Campo label="Tipo de liberación">
                <select value={draft.tipo || 'rama'} onChange={(e) => actualizar('tipo', e.target.value)} style={s.input}>
                    {TIPOS_RUTA.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                </select>
            </Campo>
            <Campo label="Nivel" full>
                <select value={draft.nivel || 'Todos'} onChange={(e) => actualizar('nivel', e.target.value)} style={s.input}>
                    {NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
                </select>
            </Campo>
            <Campo label="Descripción" full hint="Explica a quién va dirigida y qué debe lograr el alumno.">
                <textarea
                    rows={2}
                    value={draft.descripcion || ''}
                    onChange={(e) => actualizar('descripcion', e.target.value)}
                    placeholder="Ej. Ruta de transición de guardia para alumnos azules del dojo Holkan."
                    style={s.textarea}
                    maxLength={260}
                />
            </Campo>
        </div>

        <div style={s.contentToolbar}>
            <div>
                <h3 style={s.sectionTitle}><VaultIcon name="layers" size={15} /> Secciones y lecciones</h3>
                <p style={s.helperText}>Ordena el camino: cada sección agrupa lecciones del Vault o videos indexados.</p>
            </div>
            <button type="button" onClick={agregarSeccion} style={s.softBtn}>
                <VaultIcon name="plus" size={13} /> AÑADIR SECCIÓN
            </button>
        </div>

        {metricas.lecciones === 0 && (
            <div style={s.tipBanner}>
                <VaultIcon name="alert" size={15} color="#ffbb33" />
                <span>Esta ruta todavía no tiene lecciones. Agrega una sección y elige contenido del Vault o un video indexado.</span>
            </div>
        )}

        <div style={s.sectionsStack}>
            {(draft.secciones || []).map((seccion, indice) => {
                const contraida = Boolean(seccionContraida[seccion.id]);
                const lecciones = seccion.lecciones || [];
                return (
                    <div key={seccion.id} style={s.seccionCard}>
                        <div style={s.seccionHead}>
                            <span style={s.seccionNumber}>{String(indice + 1).padStart(2, '0')}</span>
                            <div style={s.seccionFields}>
                                <input
                                    value={seccion.titulo || ''}
                                    onChange={(e) => actualizarSeccion(seccion.id, 'titulo', e.target.value)}
                                    placeholder={`Sección ${indice + 1}`}
                                    style={s.seccionTitleInput}
                                />
                                <input
                                    value={seccion.descripcion || ''}
                                    onChange={(e) => actualizarSeccion(seccion.id, 'descripcion', e.target.value)}
                                    placeholder="Descripción breve (opcional)"
                                    style={s.seccionDescInput}
                                />
                            </div>
                            <div style={s.seccionActions}>
                                <button type="button" onClick={() => moverSeccion(indice, -1)} disabled={indice === 0} style={s.iconBtnSmall} title="Subir sección" aria-label="Subir sección">
                                    <VaultIcon name="chevronUp" size={12} />
                                </button>
                                <button type="button" onClick={() => moverSeccion(indice, 1)} disabled={indice === (draft.secciones || []).length - 1} style={s.iconBtnSmall} title="Bajar sección" aria-label="Bajar sección">
                                    <VaultIcon name="chevronDown" size={12} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSeccionContraida((prev) => ({ ...prev, [seccion.id]: !contraida }))}
                                    style={s.iconBtnSmall}
                                    title={contraida ? 'Expandir' : 'Contraer'}
                                    aria-label={contraida ? 'Expandir sección' : 'Contraer sección'}
                                >
                                    <VaultIcon name={contraida ? 'chevronDown' : 'chevronUp'} size={12} />
                                </button>
                                <button type="button" onClick={() => eliminarSeccion(seccion.id)} style={s.iconBtnDanger} title="Eliminar sección" aria-label="Eliminar sección">
                                    <VaultIcon name="trash" size={12} />
                                </button>
                            </div>
                        </div>

                        {!contraida && (
                            <>
                                <div style={s.lessonList}>
                                    {lecciones.length === 0 && (
                                        <div style={s.lessonEmpty}>Sin lecciones en esta sección.</div>
                                    )}
                                    {lecciones.map((leccion, lIndice) => {
                                        const playable = resolverLeccion({ ...leccion, seccionId: seccion.id }, videosPorId);
                                        const fuente = leccion.tipo === 'video' ? leccion.fuente : 'vault';
                                        return (
                                            <div key={leccion.id || `${leccion.ref}-${lIndice}`} style={s.lessonRow}>
                                                <span style={s.lessonIndex}>{String(lIndice + 1).padStart(2, '0')}</span>
                                                <span style={s.lessonInfo}>
                                                    <span style={s.lessonName}>{playable?.titulo || leccion.titulo || 'Lección sin contenido'}</span>
                                                    <span style={s.lessonMeta}>
                                                        <VaultIcon name={fuente === 'youtube' ? 'youtube' : fuente === 'drive' ? 'drive' : 'bookOpen'} size={9} />
                                                        {fuente === 'youtube' ? 'YouTube' : fuente === 'drive' ? 'Drive' : 'Vault'}
                                                        {leccion.cursoTitulo ? <> <span style={s.metaDot} /> {leccion.cursoTitulo}</> : null}
                                                    </span>
                                                </span>
                                                <span style={s.lessonActions}>
                                                    <button type="button" onClick={() => moverLeccion(seccion.id, lIndice, -1)} disabled={lIndice === 0} style={s.iconBtnTiny} title="Subir" aria-label="Subir lección">
                                                        <VaultIcon name="chevronUp" size={10} />
                                                    </button>
                                                    <button type="button" onClick={() => moverLeccion(seccion.id, lIndice, 1)} disabled={lIndice === lecciones.length - 1} style={s.iconBtnTiny} title="Bajar" aria-label="Bajar lección">
                                                        <VaultIcon name="chevronDown" size={10} />
                                                    </button>
                                                    <button type="button" onClick={() => quitarLeccion(seccion.id, lIndice)} style={s.iconBtnTinyDanger} title="Quitar" aria-label="Quitar lección">
                                                        <VaultIcon name="close" size={10} />
                                                    </button>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={s.lessonAddRow}>
                                    <button type="button" onClick={() => abrirPicker(seccion.id, 'vault')} style={s.addLessonBtn}>
                                        <VaultIcon name="bookOpen" size={12} /> DEL VAULT
                                    </button>
                                    <button type="button" onClick={() => abrirPicker(seccion.id, 'videos')} style={s.addLessonBtn}>
                                        <VaultIcon name="youtube" size={12} /> VIDEO INDEXADO
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>

        <div style={s.cursosBox}>
            <div style={s.contentToolbar}>
                <div>
                    <h3 style={s.sectionTitle}><VaultIcon name="graduation" size={15} /> Cursos que desbloquea</h3>
                    <p style={s.helperText}>Opcional: libera todos los videos de un curso además de las lecciones listadas arriba.</p>
                </div>
            </div>

            <div style={s.chipWrap}>
                {(draft.cursosLiberados || []).length === 0 ? (
                    <span style={s.mutedSmall}>Sin cursos completos liberados.</span>
                ) : (draft.cursosLiberados || []).map((cursoId) => {
                    const curso = obtenerCurso(cursoId);
                    return (
                        <span key={cursoId} style={s.cursoChip}>
                            <VaultIcon name="bookOpen" size={10} />
                            {curso?.titulo || cursoId}
                            <button type="button" onClick={() => alternarCursoLiberado(cursoId)} aria-label={`Quitar ${curso?.titulo || cursoId}`} style={s.chipRemove}>
                                <VaultIcon name="close" size={9} />
                            </button>
                        </span>
                    );
                })}
            </div>

            <div style={s.searchBox}>
                <VaultIcon name="search" size={13} color="#777" />
                <input
                    value={cursoTerm}
                    onChange={(e) => setCursoTerm(e.target.value)}
                    placeholder="Buscar curso del Vault para liberar completo..."
                    style={s.searchInput}
                />
            </div>
            {cursoTerm.trim() && (
                <div style={s.cursoResults}>
                    {cursosFiltrados.length === 0 && <span style={s.mutedSmall}>Sin coincidencias.</span>}
                    {cursosFiltrados.map((curso) => {
                        const activo = (draft.cursosLiberados || []).includes(curso.id);
                        return (
                            <button
                                key={curso.id}
                                type="button"
                                onClick={() => alternarCursoLiberado(curso.id)}
                                style={activo ? s.cursoResultActive : s.cursoResult}
                            >
                                <span style={s.cursoResultName}>{curso.titulo}</span>
                                <span style={s.cursoResultMeta}>{curso.autor} · {curso.total} videos</span>
                                <VaultIcon name={activo ? 'check' : 'plus'} size={12} />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* TAB VIDEOS                                                          */
/* ------------------------------------------------------------------ */
const TabVideos = ({ videos, onNuevo, onEditar, onEliminar, onIndexarEnRuta, draft }) => {
    const secciones = draft?.secciones || [];
    const [seccionDestino, setSeccionDestino] = useState(secciones[0]?.id || '');
    const [busqueda, setBusqueda] = useState('');

    const lista = useMemo(() => {
        const texto = normalizar(busqueda);
        return videos
            .map((v) => normalizarVideoDinamico(v))
            .filter((v) => v.id && (!texto || v.busca.includes(texto)));
    }, [videos, busqueda]);

    return (
        <div style={s.tabStack}>
            <div style={s.videoHero}>
                <div>
                    <h3 style={s.sectionTitle}><VaultIcon name="database" size={15} /> Índice de videos</h3>
                    <p style={s.helperText}>
                        Pega un enlace de Drive o YouTube. El sistema extrae el ID y lo clasifica con la misma
                        taxonomía del Vault para que aparezca en búsqueda, mapa y reproductor.
                    </p>
                </div>
                <button type="button" onClick={onNuevo} style={s.goldBtn}>
                    <VaultIcon name="plus" size={14} /> INDEXAR VIDEO
                </button>
            </div>

            <div style={s.videoStats}>
                <span style={s.statPill}><VaultIcon name="drive" size={13} /> {videos.filter((v) => (v.fuente || 'drive') !== 'youtube').length} Drive</span>
                <span style={s.statPill}><VaultIcon name="youtube" size={13} /> {videos.filter((v) => v.fuente === 'youtube').length} YouTube</span>
                <span style={s.statPill}><VaultIcon name="database" size={13} /> {videos.length} indexados</span>
            </div>

            <div style={s.searchBox}>
                <VaultIcon name="search" size={13} color="#777" />
                <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar video indexado por nombre, curso o etiqueta..."
                    style={s.searchInput}
                />
            </div>

            {lista.length === 0 ? (
                <div style={s.listEmpty}>
                    <VaultIcon name="youtube" size={26} color="#555" />
                    <span>No hay videos indexados todavía.</span>
                    <button type="button" onClick={onNuevo} style={s.softBtn}>
                        <VaultIcon name="plus" size={12} /> INDEXAR EL PRIMERO
                    </button>
                </div>
            ) : (
                <div style={s.videoList}>
                    {lista.map((video) => (
                        <div key={video.id} style={s.videoRow}>
                            <span style={{ ...s.videoSource, color: video.fuente === 'youtube' ? '#ff6b6b' : '#8fa8ff', borderColor: video.fuente === 'youtube' ? 'rgba(255,107,107,0.35)' : 'rgba(143,168,255,0.35)' }}>
                                <VaultIcon name={video.fuente === 'youtube' ? 'youtube' : 'drive'} size={13} />
                            </span>
                            <div style={s.videoInfo}>
                                <span style={s.videoName}>{video.nombre}</span>
                                <span style={s.videoMeta}>
                                    {video.cursoTitulo} <span style={s.metaDot} /> {video.posicion} <span style={s.metaDot} /> {video.tipo}
                                </span>
                                <span style={s.videoTags}>
                                    {(video.etiquetas || []).slice(0, 4).map((etiqueta) => (
                                        <span key={etiqueta} style={s.miniTag}>{etiqueta}</span>
                                    ))}
                                </span>
                            </div>
                            <div style={s.videoActions}>
                                {secciones.length > 0 && (
                                    <select
                                        value={seccionDestino}
                                        onChange={(e) => setSeccionDestino(e.target.value)}
                                        style={s.miniSelect}
                                        aria-label="Sección destino"
                                    >
                                        {secciones.map((seccion) => <option key={seccion.id} value={seccion.id}>{seccion.titulo}</option>)}
                                    </select>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onIndexarEnRuta(video, seccionDestino || secciones[0]?.id)}
                                    style={s.iconBtnSmall}
                                    disabled={secciones.length === 0}
                                    title="Agregar a la ruta"
                                    aria-label="Agregar a la ruta"
                                >
                                    <VaultIcon name="plus" size={12} />
                                </button>
                                <button type="button" onClick={() => onEditar(videos.find((v) => v.id === video.docId) || video)} style={s.iconBtnSmall} title="Editar video" aria-label="Editar video">
                                    <VaultIcon name="edit" size={12} />
                                </button>
                                <button type="button" onClick={() => onEliminar(video)} style={s.iconBtnDanger} title="Eliminar video" aria-label="Eliminar video">
                                    <VaultIcon name="trash" size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* TAB DESTINOS                                                        */
/* ------------------------------------------------------------------ */
const TabDestinos = ({
    draft,
    asignacionesRuta,
    globalAsignado,
    destinoTab,
    setDestinoTab,
    busquedaDestino,
    setBusquedaDestino,
    destinosDisponibles,
    estaAsignado,
    toggleDestino,
    guardarRuta,
    guardando
}) => {
    if (!draft.id) {
        return (
            <div style={s.tabStack}>
                <div style={s.tipBanner}>
                    <VaultIcon name="lock" size={15} color="#ffbb33" />
                    <span>Guarda la ruta primero para poder asignar dojos, usuarios y profesores.</span>
                </div>
                <button type="button" onClick={() => guardarRuta()} disabled={guardando} style={s.goldBtn}>
                    <VaultIcon name={guardando ? 'clock' : 'checkCircle'} size={14} /> {guardando ? 'GUARDANDO...' : 'GUARDAR RUTA'}
                </button>
            </div>
        );
    }

    return (
        <div style={s.tabStack}>
            <div style={s.destinoHead}>
                <div>
                    <h3 style={s.sectionTitle}><VaultIcon name="users" size={15} /> Liberar para</h3>
                    <p style={s.helperText}>Selecciona uno o varios destinos. Cada cambio se guarda al instante.</p>
                </div>
                <span style={s.counterBadge}>{asignacionesRuta.length} {asignacionesRuta.length === 1 ? 'asignación' : 'asignaciones'}</span>
            </div>

            <button
                type="button"
                onClick={() => toggleDestino('global', '*', 'Todos los usuarios')}
                style={globalAsignado ? s.globalCardActive : s.globalCard}
            >
                <span style={globalAsignado ? s.globalIconActive : s.globalIcon}>
                    <VaultIcon name="globe" size={18} />
                </span>
                <span style={s.globalCopy}>
                    <strong>Toda la comunidad</strong>
                    <span>Libera la ruta a cualquier usuario validado de La Fortuna.</span>
                </span>
                <span style={globalAsignado ? s.checkOn : s.checkOff}>
                    <VaultIcon name={globalAsignado ? 'check' : 'plus'} size={13} />
                </span>
            </button>

            <div style={s.destinoTabs}>
                {TIPOS_DESTINO.map((tipo) => (
                    <button
                        key={tipo.id}
                        type="button"
                        onClick={() => setDestinoTab(tipo.id)}
                        style={destinoTab === tipo.id ? s.destinoTabActive : s.destinoTab}
                    >
                        <VaultIcon name={tipo.icono} size={12} /> {tipo.nombre}
                    </button>
                ))}
            </div>

            <div style={s.searchBox}>
                <VaultIcon name="search" size={13} color="#777" />
                <input
                    value={busquedaDestino}
                    onChange={(e) => setBusquedaDestino(e.target.value)}
                    placeholder="Buscar destino por nombre..."
                    style={s.searchInput}
                />
            </div>

            <div style={s.destinoList}>
                {destinosDisponibles.length === 0 && (
                    <div style={s.listEmpty}>
                        <VaultIcon name="users" size={22} color="#555" />
                        <span>No hay {TIPOS_DESTINO.find((t) => t.id === destinoTab)?.nombre.toLowerCase()} disponibles.</span>
                    </div>
                )}
                {destinosDisponibles.map((destino) => {
                    const activo = estaAsignado(destinoTab, destino.id);
                    return (
                        <button
                            key={`${destinoTab}-${destino.id}`}
                            type="button"
                            onClick={() => toggleDestino(destinoTab, destino.id, destino.nombre)}
                            style={activo ? s.destinoItemActive : s.destinoItem}
                        >
                            <span style={activo ? s.destinoAvatarActive : s.destinoAvatar}>
                                <VaultIcon name={destinoTab === 'sede' ? 'dojo' : 'user'} size={13} />
                            </span>
                            <span style={s.destinoText}>
                                <strong>{destino.nombre}</strong>
                                {destino.meta && <span>{destino.meta}</span>}
                            </span>
                            <span style={activo ? s.checkOn : s.checkOff}>
                                <VaultIcon name={activo ? 'check' : 'plus'} size={12} />
                            </span>
                        </button>
                    );
                })}
            </div>

            {asignacionesRuta.length > 0 && (
                <div style={s.assignedList}>
                    <h4 style={s.assignedTitle}>ASIGNADOS</h4>
                    <div style={s.chipWrap}>
                        {asignacionesRuta.map((asignacion) => (
                            <span key={asignacion.id} style={s.assignedChip}>
                                <VaultIcon name={asignacion.destinoTipo === 'global' ? 'globe' : asignacion.destinoTipo === 'sede' ? 'dojo' : 'user'} size={10} />
                                {asignacion.destinoNombre || asignacion.destinoId}
                                <button type="button" onClick={() => toggleDestino(asignacion.destinoTipo, asignacion.destinoId, asignacion.destinoNombre)} style={s.chipRemove} aria-label="Quitar destino">
                                    <VaultIcon name="close" size={9} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* TAB AJUSTES                                                         */
/* ------------------------------------------------------------------ */
const TabAjustes = ({ draft, actualizar, metricas, asignacionesRuta, onGuardar, onPublicar, onDespublicar, guardando, hayCambios }) => (
    <div style={s.tabStack}>
        <div style={s.metaGrid}>
            <Campo label="Nombre de la ruta" required full>
                <input value={draft.nombre || ''} onChange={(e) => actualizar('nombre', e.target.value)} style={s.input} placeholder="Nombre de la ruta" />
            </Campo>
            <Campo label="Descripción" full>
                <textarea rows={3} value={draft.descripcion || ''} onChange={(e) => actualizar('descripcion', e.target.value)} style={s.textarea} placeholder="Describe el objetivo de la ruta." />
            </Campo>
            <Campo label="Nivel">
                <select value={draft.nivel || 'Todos'} onChange={(e) => actualizar('nivel', e.target.value)} style={s.input}>
                    {NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
                </select>
            </Campo>
            <Campo label="Tipo">
                <select value={draft.tipo || 'rama'} onChange={(e) => actualizar('tipo', e.target.value)} style={s.input}>
                    {TIPOS_RUTA.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                </select>
            </Campo>
        </div>

        <div style={s.summaryGrid}>
            <div style={s.summaryCard}>
                <span style={s.summaryLabel}>SECCIONES</span>
                <strong style={s.summaryValue}>{metricas.secciones}</strong>
            </div>
            <div style={s.summaryCard}>
                <span style={s.summaryLabel}>LECCIONES</span>
                <strong style={s.summaryValue}>{metricas.lecciones}</strong>
            </div>
            <div style={s.summaryCard}>
                <span style={s.summaryLabel}>VIDEOS PROPIOS</span>
                <strong style={s.summaryValue}>{metricas.videos}</strong>
            </div>
            <div style={s.summaryCard}>
                <span style={s.summaryLabel}>DESTINOS</span>
                <strong style={s.summaryValue}>{asignacionesRuta.length}</strong>
            </div>
        </div>

        <div style={s.publishBox}>
            <div style={s.publishHead}>
                <span style={{ ...s.publishIcon, borderColor: draft.estado === 'publicada' ? 'rgba(76,175,80,0.45)' : 'rgba(255,187,51,0.4)' }}>
                    <VaultIcon name={draft.estado === 'publicada' ? 'checkCircle' : 'send'} size={18} color={draft.estado === 'publicada' ? '#4CAF50' : '#ffbb33'} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={s.publishTitle}>
                        {draft.estado === 'publicada' ? 'La ruta está publicada' : 'La ruta está en borrador'}
                    </strong>
                    <p style={s.publishText}>
                        {draft.estado === 'publicada'
                            ? 'Los destinos asignados ya pueden verla en su Hub y en el mapa.'
                            : 'Solo tú puedes verla. Publica cuando el contenido y los destinos estén listos.'}
                    </p>
                </div>
            </div>
            <div style={s.publishActions}>
                {hayCambios && (
                    <button type="button" onClick={onGuardar} disabled={guardando} style={s.ghostBtn}>
                        <VaultIcon name={guardando ? 'clock' : 'checkCircle'} size={13} /> GUARDAR CAMBIOS
                    </button>
                )}
                {draft.estado === 'publicada' ? (
                    <button type="button" onClick={onDespublicar} disabled={guardando} style={s.ghostBtn}>
                        <VaultIcon name="lock" size={13} /> VOLVER A BORRADOR
                    </button>
                ) : (
                    <button type="button" onClick={onPublicar} disabled={guardando} style={s.goldBtn}>
                        <VaultIcon name="send" size={13} /> PUBLICAR RUTA
                    </button>
                )}
            </div>
        </div>

        <div style={s.tipBanner}>
            <VaultIcon name="shield" size={15} color="#d4af37" />
            <span>
                Las reglas de acceso se aplican en el mapa, la búsqueda y el reproductor.
                Si un alumno no tiene la ruta asignada, el contenido permanece bloqueado.
            </span>
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* MODAL DE VIDEO                                                      */
/* ------------------------------------------------------------------ */
const ModalVideo = ({ videoDraft, setVideoDraft, onCerrar, onGuardar, guardando, editando }) => {
    const fuente = videoDraft.fuente === 'youtube' ? 'youtube' : 'drive';
    const idDetectado = fuente === 'youtube' ? extraerYoutubeId(videoDraft.url) : extraerDriveId(videoDraft.url);
    const normalizado = normalizarVideoDinamico({ ...videoDraft, driveId: fuente === 'drive' ? idDetectado : '', youtubeId: fuente === 'youtube' ? idDetectado : '' });
    const actualizar = (campo, valor) => setVideoDraft((prev) => ({ ...prev, [campo]: valor }));

    return (
        <div style={s.modalOverlay} className="rutas-admin-modal-overlay">
            <div style={s.modal}>
                <div style={s.modalHead}>
                    <div>
                        <span style={s.eyebrow}>{editando ? 'EDITAR VIDEO' : 'INDEXAR VIDEO'}</span>
                        <h2 style={s.modalTitle}>{editando ? 'Ajustar video indexado' : 'Nuevo video en el Vault'}</h2>
                    </div>
                    <button type="button" onClick={onCerrar} style={s.iconBtnClose} aria-label="Cerrar">
                        <VaultIcon name="close" size={16} />
                    </button>
                </div>

                <div style={s.modalBody}>
                    <div style={s.sourceToggle}>
                        <button type="button" onClick={() => actualizar('fuente', 'drive')} style={fuente === 'drive' ? s.sourceActive : s.sourceBtn}>
                            <VaultIcon name="drive" size={14} /> DRIVE
                        </button>
                        <button type="button" onClick={() => actualizar('fuente', 'youtube')} style={fuente === 'youtube' ? s.sourceActive : s.sourceBtn}>
                            <VaultIcon name="youtube" size={14} /> YOUTUBE
                        </button>
                    </div>

                    <Campo label={fuente === 'youtube' ? 'Enlace de YouTube' : 'Enlace de Drive'} required full hint="Pega el enlace completo. También acepta solo el ID si ya lo tienes.">
                        <input
                            value={videoDraft.url}
                            onChange={(e) => actualizar('url', e.target.value)}
                            placeholder={fuente === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://drive.google.com/file/d/.../view'}
                            style={s.input}
                        />
                    </Campo>

                    <div style={idDetectado ? s.idDetected : s.idMissing}>
                        <VaultIcon name={idDetectado ? 'checkCircle' : 'alert'} size={13} color={idDetectado ? '#4CAF50' : '#ffbb33'} />
                        <span>{idDetectado ? `ID detectado: ${idDetectado}` : 'Aún no se detecta un ID válido en el enlace.'}</span>
                    </div>

                    <div style={s.metaGrid}>
                        <Campo label="Nombre del video" required full>
                            <input value={videoDraft.nombre} onChange={(e) => actualizar('nombre', e.target.value)} placeholder="Ej. Seminario: Back takes" style={s.input} />
                        </Campo>
                        <Campo label="Curso / academia">
                            <input value={videoDraft.cursoTitulo} onChange={(e) => actualizar('cursoTitulo', e.target.value)} placeholder="Ej. Seminarios Holkan" style={s.input} />
                        </Campo>
                        <Campo label="Autor / instructor">
                            <input value={videoDraft.autor} onChange={(e) => actualizar('autor', e.target.value)} placeholder="Ej. Holkan" style={s.input} />
                        </Campo>
                        <Campo label="Nivel">
                            <select value={videoDraft.nivel} onChange={(e) => actualizar('nivel', e.target.value)} style={s.input}>
                                {NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Duración">
                            <input value={videoDraft.duracion} onChange={(e) => actualizar('duracion', e.target.value)} placeholder="Ej. 12:30" style={s.input} />
                        </Campo>
                        <Campo label="Posición" hint={normalizado.posicion ? `Sugerida: ${normalizado.posicion}` : ''}>
                            <select value={videoDraft.posicion} onChange={(e) => actualizar('posicion', e.target.value)} style={s.input}>
                                <option value="AUTO">Automática</option>
                                {OPCIONES_POSICION.map((posicion) => <option key={posicion} value={posicion}>{posicion}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Tipo" hint={normalizado.tipo ? `Sugerido: ${normalizado.tipo}` : ''}>
                            <select value={videoDraft.tipo} onChange={(e) => actualizar('tipo', e.target.value)} style={s.input}>
                                <option value="AUTO">Automático</option>
                                {OPCIONES_TIPO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Modalidad">
                            <select value={videoDraft.modalidad} onChange={(e) => actualizar('modalidad', e.target.value)} style={s.input}>
                                <option value="AUTO">Automática</option>
                                {MODALIDADES.map((modalidad) => <option key={modalidad} value={modalidad}>{modalidad}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Etiquetas" full hint="Sepáralas con comas. Se suman a las detectadas automáticamente.">
                            <input value={videoDraft.etiquetas} onChange={(e) => actualizar('etiquetas', e.target.value)} placeholder="HOLKAN, SEMINARIO, BACK TAKE" style={s.input} />
                        </Campo>
                        <Campo label="Descripción" full>
                            <textarea rows={2} value={videoDraft.descripcion} onChange={(e) => actualizar('descripcion', e.target.value)} style={s.textarea} placeholder="Notas del seminario, técnica o contexto." />
                        </Campo>
                    </div>

                    <div style={s.previewBox}>
                        <span style={s.previewLabel}>CLASIFICACIÓN PREVIA</span>
                        <div style={s.chipWrap}>
                            <span style={s.miniTag}>{normalizado.posicion}</span>
                            <span style={s.miniTag}>{normalizado.tipo}</span>
                            <span style={s.miniTag}>{normalizado.modalidad}</span>
                            {(normalizado.etiquetas || []).slice(0, 5).map((etiqueta) => <span key={etiqueta} style={s.miniTag}>{etiqueta}</span>)}
                        </div>
                    </div>
                </div>

                <div style={s.modalFooter}>
                    <button type="button" onClick={onCerrar} style={s.ghostBtn} disabled={guardando}>CANCELAR</button>
                    <button type="button" onClick={onGuardar} disabled={guardando || !idDetectado} style={guardando ? { ...s.goldBtn, opacity: 0.65 } : s.goldBtn}>
                        <VaultIcon name={guardando ? 'clock' : editando ? 'checkCircle' : 'plus'} size={14} />
                        {guardando ? 'GUARDANDO...' : editando ? 'GUARDAR CAMBIOS' : 'INDEXAR VIDEO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* MODAL PICKER                                                        */
/* ------------------------------------------------------------------ */
const ModalPicker = ({
    picker,
    termino,
    setTermino,
    resultadosVault,
    videosFiltrados,
    seccionTitulo,
    leccionesSeccion = [],
    refsSeccion = new Set(),
    refsRuta = new Set(),
    esMovil = false,
    onCerrar,
    onElegirVault,
    onElegirVideo,
    onAgregarCurso
}) => {
    const modoVault = picker.modo === 'vault';
    const cursos = useMemo(() => {
        if (!modoVault) return [];
        const texto = normalizar(termino);
        if (!texto) return [];
        return CURSOS.filter((curso) => normalizar(`${curso.titulo} ${curso.autor}`).includes(texto)).slice(0, 8);
    }, [modoVault, termino]);

    const estaEnSeccion = (ref) => Boolean(refsSeccion?.has?.(ref));
    const estaEnRuta = (ref) => Boolean(refsRuta?.has?.(ref));

    return (
        <div style={s.modalOverlay} className="rutas-admin-modal-overlay rutas-admin-picker-overlay">
            <div style={{ ...s.modal, maxWidth: modoVault ? '720px' : '640px' }} className="rutas-admin-picker-modal">
                <div style={s.modalHead} className="rutas-admin-picker-head">
                    <div>
                        <span style={s.eyebrow}>AGREGAR LECCIÓN</span>
                        <h2 style={s.modalTitle}>{modoVault ? 'Contenido del Vault' : 'Videos indexados'}</h2>
                    </div>
                    <button type="button" onClick={onCerrar} style={s.iconBtnClose} aria-label="Cerrar">
                        <VaultIcon name="close" size={16} />
                    </button>
                </div>

                <div style={s.modalBody}>
                    <div style={s.searchBox}>
                        <VaultIcon name="search" size={13} color="#777" />
                        <input
                            autoFocus={!esMovil}
                            value={termino}
                            onChange={(e) => setTermino(e.target.value)}
                            placeholder={modoVault ? 'Buscar técnica, autor o curso...' : 'Buscar video indexado...'}
                            style={s.searchInput}
                        />
                    </div>

                    <div style={s.pickerSummary}>
                        <div style={s.pickerSummaryHead}>
                            <span style={s.pickerSummaryTitle}>
                                <VaultIcon name="layers" size={12} />
                                {seccionTitulo || 'Sección'} · {leccionesSeccion.length} {leccionesSeccion.length === 1 ? 'lección' : 'lecciones'}
                            </span>
                            <span style={s.pickerSummaryHint}>Se actualiza al agregar</span>
                        </div>
                        {leccionesSeccion.length > 0 ? (
                            <div style={s.pickerAddedList} className="rutas-picker-added-list">
                                {leccionesSeccion.map((leccion, indice) => (
                                    <span
                                        key={`${leccion.ref}-${indice}`}
                                        style={s.pickerAddedChip}
                                        title={leccion.titulo || ''}
                                    >
                                        <VaultIcon
                                            name={leccion.tipo === 'video'
                                                ? (leccion.fuente === 'youtube' ? 'youtube' : 'drive')
                                                : 'bookOpen'}
                                            size={9}
                                        />
                                        <span style={s.pickerAddedChipText}>{leccion.titulo || 'Lección'}</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span style={s.pickerSummaryEmpty}>Aún no hay lecciones en esta sección.</span>
                        )}
                    </div>

                    {modoVault && cursos.length > 0 && (
                        <div style={s.cursosPicker}>
                            <span style={s.pickerGroupLabel}>CURSOS COMPLETOS</span>
                            {cursos.map((curso) => {
                                const tecnicasCurso = tecnicasDeCurso(curso.id);
                                const agregadas = tecnicasCurso.filter((tecnica) => estaEnSeccion(tecnica.id)).length;
                                const completo = tecnicasCurso.length > 0 && agregadas === tecnicasCurso.length;
                                return (
                                    <div key={curso.id} style={s.cursoPickerRow}>
                                        <div style={s.cursoPickerInfo}>
                                            <strong>{curso.titulo}</strong>
                                            <span>
                                                {curso.autor} · {curso.total} videos
                                                {agregadas > 0 ? ` · ${agregadas} ${agregadas === 1 ? 'agregada' : 'agregadas'}` : ''}
                                            </span>
                                        </div>
                                        {completo ? (
                                            <span style={s.pickerAddedBadge}>
                                                <VaultIcon name="check" size={10} /> AGREGADO
                                            </span>
                                        ) : (
                                            <button type="button" onClick={() => onAgregarCurso(curso.id)} style={s.softBtn}>
                                                <VaultIcon name="plus" size={11} /> AGREGAR TODO
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <span style={s.pickerGroupLabel}>{modoVault ? 'TÉCNICAS' : 'VIDEOS'}</span>
                    <div style={s.pickerList} className="rutas-picker-list">
                        {modoVault && resultadosVault.length === 0 && (
                            <div style={s.listEmpty}><span>Escribe para buscar técnicas del Vault.</span></div>
                        )}
                        {!modoVault && videosFiltrados.length === 0 && (
                            <div style={s.listEmpty}><span>No hay videos indexados que coincidan.</span></div>
                        )}
                        {modoVault && resultadosVault.map((tecnica) => {
                            const agregado = estaEnSeccion(tecnica.id);
                            const enOtra = !agregado && estaEnRuta(tecnica.id);
                            return (
                                <button
                                    key={`${tecnica.id}-${tecnica.cursoId}`}
                                    type="button"
                                    onClick={() => { if (!agregado) onElegirVault(tecnica); }}
                                    style={agregado ? s.pickerItemAdded : s.pickerItem}
                                    title={agregado ? 'Ya está en esta sección' : enOtra ? 'Ya está en otra sección' : 'Agregar a esta sección'}
                                    aria-disabled={agregado}
                                >
                                    <span style={s.pickerIcon}><VaultIcon name="bookOpen" size={13} /></span>
                                    <span style={s.pickerText}>
                                        <strong>{tecnica.nombre}</strong>
                                        <span>{tecnica.cursoTitulo} · {tecnica.posicion} · {tecnica.tipo}</span>
                                    </span>
                                    {agregado ? (
                                        <span style={s.pickerAddedBadge}><VaultIcon name="check" size={10} /> AGREGADO</span>
                                    ) : enOtra ? (
                                        <span style={s.pickerOtherBadge}>OTRA SECCIÓN</span>
                                    ) : (
                                        <VaultIcon name="plus" size={13} />
                                    )}
                                </button>
                            );
                        })}
                        {!modoVault && videosFiltrados.map((video) => {
                            const agregado = estaEnSeccion(video.id);
                            const enOtra = !agregado && estaEnRuta(video.id);
                            return (
                                <button
                                    key={video.id}
                                    type="button"
                                    onClick={() => { if (!agregado) onElegirVideo(video); }}
                                    style={agregado ? s.pickerItemAdded : s.pickerItem}
                                    title={agregado ? 'Ya está en esta sección' : enOtra ? 'Ya está en otra sección' : 'Agregar a esta sección'}
                                    aria-disabled={agregado}
                                >
                                    <span style={s.pickerIcon}>
                                        <VaultIcon name={video.fuente === 'youtube' ? 'youtube' : 'drive'} size={13} />
                                    </span>
                                    <span style={s.pickerText}>
                                        <strong>{video.nombre}</strong>
                                        <span>{video.cursoTitulo} · {video.posicion} · {video.tipo}</span>
                                    </span>
                                    {agregado ? (
                                        <span style={s.pickerAddedBadge}><VaultIcon name="check" size={10} /> AGREGADO</span>
                                    ) : enOtra ? (
                                        <span style={s.pickerOtherBadge}>OTRA SECCIÓN</span>
                                    ) : (
                                        <VaultIcon name="plus" size={13} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={s.modalFooter} className="rutas-admin-picker-footer">
                    <button type="button" onClick={onCerrar} style={s.ghostBtn}>CERRAR</button>
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* CAMPO                                                               */
/* ------------------------------------------------------------------ */
const Campo = ({ label, required, hint, children, full = false }) => (
    <label style={{ ...s.campo, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
        <span style={s.campoLabel}>
            {label}
            {required && <em style={s.required}>*</em>}
        </span>
        {children}
        {hint && <span style={s.campoHint}>{hint}</span>}
    </label>
);

/* ------------------------------------------------------------------ */
/* ESTILOS                                                             */
/* ------------------------------------------------------------------ */
const s = {
    root: {
        minHeight: 'var(--app-vh)', width: '100%', backgroundColor: '#000', color: '#fff', boxSizing: 'border-box',
        overflowX: 'hidden',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
    },
    shell: { width: '100%', maxWidth: '1320px', margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 },
    headerActions: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    backBtn: {
        width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: '10px', cursor: 'pointer'
    },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    titleIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '1px solid #d4af37', color: '#d4af37', background: 'rgba(212,175,55,0.06)'
    },
    title: { margin: 0, color: '#d4af37', fontSize: 'clamp(1rem, 2.6vw, 1.35rem)', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 },
    subtitle: { margin: '2px 0 0', color: '#777', fontSize: '0.64rem', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70vw' },
    goldBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#d4af37',
        color: '#000', border: 'none', borderRadius: '8px', padding: '9px 13px', fontSize: '0.62rem',
        fontWeight: 800, cursor: 'pointer', letterSpacing: '0.3px', whiteSpace: 'nowrap'
    },
    ghostBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'transparent',
        color: '#ccc', border: '1px solid #333', borderRadius: '8px', padding: '8px 11px', fontSize: '0.58rem',
        fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    softBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.28)', color: '#d4af37', borderRadius: '7px', padding: '7px 10px',
        fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    layout: { display: 'grid', gap: '12px', alignItems: 'start' },
    sidebar: { background: '#0a0a0a', border: '1px solid #202020', borderRadius: '13px', padding: '10px', position: 'sticky', top: '12px' },
    sideTop: { display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '8px' },
    searchBox: {
        display: 'flex', alignItems: 'center', gap: '7px', background: '#050505', border: '1px solid #262626',
        borderRadius: '8px', padding: '0 10px', height: '36px', flex: 1, minWidth: 0
    },
    searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.68rem' },
    filterRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    filterChip: {
        background: '#111', border: '1px solid #2a2a2a', color: '#999', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    filterActive: {
        background: '#d4af37', border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    routeList: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: 'calc(var(--app-vh) - 190px)', overflowY: 'auto' },
    routeItem: {
        display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left', width: '100%', background: '#080808',
        border: '1px solid #1d1d1d', borderRadius: '8px', padding: '9px', cursor: 'pointer', color: '#fff'
    },
    routeItemActive: {
        display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left', width: '100%',
        background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.45)', borderRadius: '8px',
        padding: '9px', cursor: 'pointer', color: '#fff'
    },
    routeItemTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' },
    routeItemName: { color: '#eee', fontSize: '0.68rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    estadoDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
    routeItemMeta: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', color: '#777', fontSize: '0.48rem' },
    metaDot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#3a3a3a', flexShrink: 0 },
    skeleton: {
        height: '62px', borderRadius: '8px', border: '1px solid #1c1c1c',
        background: 'linear-gradient(100deg, #0c0c0c 20%, #151515 40%, #0c0c0c 60%)', backgroundSize: '200% 100%'
    },
    sideEmpty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#666', fontSize: '0.58rem', padding: '18px 6px' },

    editor: { background: '#0a0a0a', border: '1px solid #202020', borderRadius: '13px', minHeight: '420px', overflow: 'hidden' },
    emptyEditor: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 22px', minHeight: '420px' },
    emptyIcon: {
        width: '70px', height: '70px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '12px'
    },
    emptyTitle: { margin: '0 0 6px', color: '#d4af37', fontSize: '1.05rem' },
    emptyText: { margin: '0 auto 16px', maxWidth: '440px', color: '#777', fontSize: '0.68rem', lineHeight: 1.55 },

    editorHead: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
        padding: '12px', borderBottom: '1px solid #1c1c1c', background: '#080808'
    },
    editorIdentity: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 },
    editorIcon: {
        width: '42px', height: '42px', flexShrink: 0, borderRadius: '10px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.28)'
    },
    editorNameRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    editorName: { margin: 0, color: '#fff', fontSize: 'clamp(0.95rem, 2.4vw, 1.2rem)', fontWeight: 800, lineHeight: 1.15 },
    editorMeta: { margin: '2px 0 0', color: '#777', fontSize: '0.54rem' },
    publishedBadge: {
        color: '#4CAF50', border: '1px solid rgba(76,175,80,0.42)', background: 'rgba(76,175,80,0.07)',
        borderRadius: '999px', padding: '1px 6px', fontSize: '0.44rem', fontWeight: 800
    },
    draftBadge: {
        color: '#ffbb33', border: '1px solid rgba(255,187,51,0.42)', background: 'rgba(255,187,51,0.07)',
        borderRadius: '999px', padding: '1px 6px', fontSize: '0.44rem', fontWeight: 800
    },
    dirtyBadge: { color: '#ffbb33', fontSize: '0.44rem', fontWeight: 800, letterSpacing: '0.4px' },
    editorActions: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' },
    dangerIconBtn: {
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.35)', color: '#ff6b6b',
        borderRadius: '7px', cursor: 'pointer'
    },
    tabs: {
        display: 'flex', gap: '4px', padding: '8px 10px', background: '#080808', borderBottom: '1px solid #1c1c1c',
        overflowX: 'auto', flexShrink: 0
    },
    tab: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid #222',
        color: '#888', borderRadius: '999px', padding: '6px 10px', fontSize: '0.54rem', fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap'
    },
    tabActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37', border: '1px solid #d4af37',
        color: '#000', borderRadius: '999px', padding: '6px 10px', fontSize: '0.54rem', fontWeight: 800,
        cursor: 'pointer', whiteSpace: 'nowrap'
    },
    tabCount: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px', height: '16px',
        borderRadius: '999px', background: 'rgba(0,0,0,0.25)', color: 'inherit', fontSize: '0.44rem', padding: '0 4px'
    },
    editorBody: { padding: '12px' },
    tabStack: { display: 'flex', flexDirection: 'column', gap: '12px' },

    metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '9px' },
    campo: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    campoLabel: { color: '#888', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase' },
    required: { color: '#ff6b6b', fontStyle: 'normal', marginLeft: '2px' },
    campoHint: { color: '#666', fontSize: '0.48rem', lineHeight: 1.3 },
    input: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626', borderRadius: '7px',
        color: '#fff', padding: '8px 9px', fontSize: '0.68rem', outline: 'none'
    },
    textarea: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626', borderRadius: '7px',
        color: '#fff', padding: '8px 9px', fontSize: '0.66rem', lineHeight: 1.45, outline: 'none',
        resize: 'vertical', fontFamily: 'inherit'
    },
    contentToolbar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#ddd', fontSize: '0.74rem' },
    helperText: { margin: '2px 0 0', color: '#777', fontSize: '0.56rem', lineHeight: 1.4 },
    tipBanner: {
        display: 'flex', alignItems: 'flex-start', gap: '7px', background: 'rgba(255,187,51,0.05)',
        border: '1px solid rgba(255,187,51,0.28)', borderRadius: '8px', padding: '9px 10px',
        color: '#bbb', fontSize: '0.58rem', lineHeight: 1.45
    },
    sectionsStack: { display: 'flex', flexDirection: 'column', gap: '8px' },
    seccionCard: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '9px' },
    seccionHead: { display: 'flex', alignItems: 'flex-start', gap: '7px' },
    seccionNumber: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '7px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.28)',
        color: '#d4af37', fontSize: '0.56rem', fontWeight: 800
    },
    seccionFields: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
    seccionTitleInput: {
        width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #242424', color: '#eee',
        padding: '2px 0', fontSize: '0.72rem', fontWeight: 800, outline: 'none'
    },
    seccionDescInput: {
        width: '100%', background: 'transparent', border: 'none', color: '#888', padding: '1px 0',
        fontSize: '0.56rem', outline: 'none'
    },
    seccionActions: { display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 },
    iconBtnSmall: {
        width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '5px', cursor: 'pointer'
    },
    iconBtnDanger: {
        width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.32)', color: '#ff6b6b',
        borderRadius: '5px', cursor: 'pointer'
    },
    iconBtnTiny: {
        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #252525', color: '#888', borderRadius: '4px', cursor: 'pointer'
    },
    iconBtnTinyDanger: {
        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.28)', color: '#ff6b6b',
        borderRadius: '4px', cursor: 'pointer'
    },
    lessonList: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' },
    lessonEmpty: { color: '#666', fontSize: '0.56rem', padding: '8px', border: '1px dashed #242424', borderRadius: '6px', textAlign: 'center' },
    lessonRow: { display: 'flex', alignItems: 'center', gap: '7px', background: '#0c0c0c', border: '1px solid #1d1d1d', borderRadius: '6px', padding: '6px' },
    lessonIndex: { color: '#d4af37', fontSize: '0.5rem', fontWeight: 800, minWidth: '18px' },
    lessonInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    lessonName: { color: '#ddd', fontSize: '0.62rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    lessonMeta: { display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '0.46rem', flexWrap: 'wrap' },
    lessonActions: { display: 'flex', gap: '2px', flexShrink: 0 },
    lessonAddRow: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '7px' },
    addLessonBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(212,175,55,0.06)',
        border: '1px dashed rgba(212,175,55,0.35)', color: '#d4af37', borderRadius: '6px', padding: '6px 9px',
        fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    cursosBox: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
    chipWrap: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    mutedSmall: { color: '#777', fontSize: '0.54rem' },
    cursoChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(212,175,55,0.07)',
        border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', borderRadius: '999px', padding: '3px 7px', fontSize: '0.5rem'
    },
    chipRemove: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px',
        background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, opacity: 0.8
    },
    cursoResults: { display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '190px', overflowY: 'auto' },
    cursoResult: {
        display: 'grid', gridTemplateColumns: '1fr auto', gap: '1px 8px', alignItems: 'center', textAlign: 'left',
        background: '#0c0c0c', border: '1px solid #202020', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ddd'
    },
    cursoResultActive: {
        display: 'grid', gridTemplateColumns: '1fr auto', gap: '1px 8px', alignItems: 'center', textAlign: 'left',
        background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: '6px',
        padding: '6px 8px', cursor: 'pointer', color: '#d4af37'
    },
    cursoResultName: { fontSize: '0.6rem', fontWeight: 700 },
    cursoResultMeta: { gridColumn: '1', color: '#777', fontSize: '0.48rem' },

    videoHero: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
    videoStats: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    statPill: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0c0c0c', border: '1px solid #222',
        borderRadius: '999px', padding: '4px 8px', color: '#999', fontSize: '0.5rem', fontWeight: 700
    },
    listEmpty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', color: '#777', fontSize: '0.6rem',
        padding: '26px 14px', border: '1px dashed #242424', borderRadius: '9px'
    },
    videoList: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '520px', overflowY: 'auto' },
    videoRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '8px' },
    videoSource: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '7px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d0d0d', border: '1px solid'
    },
    videoInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    videoName: { color: '#eee', fontSize: '0.64rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    videoMeta: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', color: '#777', fontSize: '0.46rem' },
    videoTags: { display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px' },
    miniTag: {
        display: 'inline-flex', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)',
        color: '#d4af37', borderRadius: '3px', padding: '1px 4px', fontSize: '0.42rem', fontWeight: 700
    },
    videoActions: { display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 },
    miniSelect: {
        background: '#0b0b0b', border: '1px solid #262626', color: '#aaa', borderRadius: '5px',
        fontSize: '0.48rem', padding: '4px 5px', maxWidth: '120px', outline: 'none'
    },

    destinoHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
    counterBadge: {
        display: 'inline-flex', alignItems: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.28)',
        color: '#d4af37', borderRadius: '999px', padding: '3px 8px', fontSize: '0.48rem', fontWeight: 800
    },
    globalCard: {
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: '#080808',
        border: '1px solid #202020', borderRadius: '9px', padding: '9px', cursor: 'pointer', color: '#fff'
    },
    globalCardActive: {
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left',
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '9px',
        padding: '9px', cursor: 'pointer', color: '#fff'
    },
    globalIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d0d0d', border: '1px solid #262626', color: '#888'
    },
    globalIconActive: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37'
    },
    globalCopy: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    checkOn: {
        width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.45)', color: '#4CAF50'
    },
    checkOff: {
        width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#777'
    },
    destinoTabs: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    destinoTab: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111', border: '1px solid #262626',
        color: '#999', borderRadius: '999px', padding: '5px 9px', fontSize: '0.5rem', fontWeight: 700, cursor: 'pointer'
    },
    destinoTabActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37', border: '1px solid #d4af37',
        color: '#000', borderRadius: '999px', padding: '5px 9px', fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    destinoList: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' },
    destinoItem: {
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: '#080808',
        border: '1px solid #1e1e1e', borderRadius: '7px', padding: '7px', cursor: 'pointer', color: '#fff'
    },
    destinoItemActive: {
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: '7px',
        padding: '7px', cursor: 'pointer', color: '#fff'
    },
    destinoAvatar: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d0d0d', border: '1px solid #262626', color: '#888'
    },
    destinoAvatarActive: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37'
    },
    destinoText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    assignedList: { display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #1c1c1c', paddingTop: '8px' },
    assignedTitle: { margin: 0, color: '#666', fontSize: '0.48rem', letterSpacing: '0.8px' },
    assignedChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(76,175,80,0.07)',
        border: '1px solid rgba(76,175,80,0.3)', color: '#89d18c', borderRadius: '999px', padding: '3px 7px', fontSize: '0.5rem'
    },

    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '7px' },
    summaryCard: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '9px', display: 'flex', flexDirection: 'column', gap: '2px' },
    summaryLabel: { color: '#666', fontSize: '0.44rem', letterSpacing: '0.6px' },
    summaryValue: { color: '#fff', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1 },
    publishBox: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '9px' },
    publishHead: { display: 'flex', alignItems: 'center', gap: '9px' },
    publishIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d0d0d', border: '1px solid'
    },
    publishTitle: { color: '#ddd', fontSize: '0.7rem' },
    publishText: { margin: '2px 0 0', color: '#777', fontSize: '0.56rem', lineHeight: 1.45 },
    publishActions: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' },

    modalOverlay: {
        position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '14px', background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(4px)', boxSizing: 'border-box'
    },
    modal: {
        width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: '#0b0b0b', border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
    },
    modalHead: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '13px',
        background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', flexShrink: 0
    },
    eyebrow: { display: 'block', color: '#d4af37', fontSize: '0.48rem', fontWeight: 800, letterSpacing: '1.2px', marginBottom: '2px' },
    modalTitle: { margin: 0, color: '#fff', fontSize: 'clamp(1rem, 2.6vw, 1.25rem)', fontWeight: 800 },
    iconBtnClose: {
        width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '8px', cursor: 'pointer'
    },
    modalBody: { flex: 1, overflowY: 'auto', padding: '13px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 },
    modalFooter: {
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '7px', padding: '10px 13px',
        background: '#0a0a0a', borderTop: '1px solid #1c1c1c', flexShrink: 0, flexWrap: 'wrap'
    },
    sourceToggle: { display: 'flex', gap: '5px' },
    sourceBtn: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#111',
        border: '1px solid #262626', color: '#999', borderRadius: '7px', padding: '8px', fontSize: '0.58rem',
        fontWeight: 800, cursor: 'pointer'
    },
    sourceActive: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '7px', padding: '8px', fontSize: '0.58rem',
        fontWeight: 800, cursor: 'pointer'
    },
    idDetected: {
        display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(76,175,80,0.06)',
        border: '1px solid rgba(76,175,80,0.28)', borderRadius: '7px', padding: '7px 9px', color: '#9ad99d', fontSize: '0.56rem'
    },
    idMissing: {
        display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,187,51,0.05)',
        border: '1px solid rgba(255,187,51,0.28)', borderRadius: '7px', padding: '7px 9px', color: '#d8b25e', fontSize: '0.56rem'
    },
    previewBox: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '9px', display: 'flex', flexDirection: 'column', gap: '6px' },
    previewLabel: { color: '#666', fontSize: '0.44rem', letterSpacing: '0.7px', fontWeight: 800 },
    cursosPicker: { display: 'flex', flexDirection: 'column', gap: '4px' },
    pickerGroupLabel: { color: '#666', fontSize: '0.44rem', letterSpacing: '0.7px', fontWeight: 800 },
    cursoPickerRow: {
        display: 'flex', alignItems: 'center', gap: '8px', background: '#080808', border: '1px solid #1e1e1e',
        borderRadius: '7px', padding: '7px'
    },
    cursoPickerInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    pickerList: { display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '330px', overflowY: 'auto' },
    pickerItem: {
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: '#080808',
        border: '1px solid #1e1e1e', borderRadius: '7px', padding: '7px', cursor: 'pointer', color: '#ccc'
    },
    pickerIcon: {
        width: '28px', height: '28px', flexShrink: 0, borderRadius: '6px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.22)', color: '#d4af37'
    },
    pickerText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    pickerSummary: {
        display: 'flex', flexDirection: 'column', gap: '6px', background: '#080808',
        border: '1px solid #1e1e1e', borderRadius: '8px', padding: '8px'
    },
    pickerSummaryHead: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', flexWrap: 'wrap'
    },
    pickerSummaryTitle: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#d4af37',
        fontSize: '0.54rem', fontWeight: 800
    },
    pickerSummaryHint: { color: '#666', fontSize: '0.46rem' },
    pickerSummaryEmpty: { color: '#666', fontSize: '0.52rem' },
    pickerAddedList: {
        display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px',
        scrollbarWidth: 'thin'
    },
    pickerAddedChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '190px',
        background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.25)',
        color: '#89d18c', borderRadius: '999px', padding: '3px 7px', fontSize: '0.48rem',
        flexShrink: 0
    },
    pickerAddedChipText: {
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px'
    },
    pickerItemAdded: {
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
        background: 'rgba(76,175,80,0.05)', border: '1px solid rgba(76,175,80,0.3)',
        borderRadius: '7px', padding: '7px', cursor: 'default', color: '#cfcfcf'
    },
    pickerAddedBadge: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0,
        color: '#4CAF50', border: '1px solid rgba(76,175,80,0.4)',
        background: 'rgba(76,175,80,0.08)', borderRadius: '999px',
        padding: '2px 6px', fontSize: '0.42rem', fontWeight: 800
    },
    pickerOtherBadge: {
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)',
        background: 'rgba(212,175,55,0.06)', borderRadius: '999px',
        padding: '2px 6px', fontSize: '0.42rem', fontWeight: 800
    },
};

const cssAdmin = `
    .rutas-admin-root *, .rutas-admin-root *::before, .rutas-admin-root *::after { box-sizing: border-box; }
    .rutas-admin-root button { transition: transform .12s ease, border-color .18s ease, background .18s ease, color .18s ease; }
    .rutas-admin-root button:active { transform: translateY(1px); }
    .rutas-admin-root button:focus-visible, .rutas-admin-root input:focus-visible,
    .rutas-admin-root textarea:focus-visible, .rutas-admin-root select:focus-visible {
        outline: 2px solid rgba(212,175,55,0.7); outline-offset: 2px;
    }
    .rutas-admin-root button:disabled { opacity: 0.45; cursor: not-allowed; }
    .rutas-admin-modal-overlay { animation: rutasAdminFade .15s ease; }
    @keyframes rutasAdminFade { from { opacity: 0; } to { opacity: 1; } }
    @media (max-width: 1099px) {
        .rutas-admin-root .rutas-admin-side-sticky { position: static !important; }
    }
    @media (max-width: 767px) {
        .rutas-admin-root { padding-left: calc(env(safe-area-inset-left, 0px) + 8px) !important; padding-right: calc(env(safe-area-inset-right, 0px) + 8px) !important; }
        .rutas-admin-root h1 { font-size: 0.95rem !important; letter-spacing: 0.4px !important; }
        .rutas-admin-modal-overlay { padding: 0 !important; align-items: stretch !important; }
        .rutas-admin-modal-overlay > div { width: 100% !important; max-width: none !important; height: 100dvh !important; max-height: 100dvh !important; border-radius: 0 !important; border: none !important; }
        .rutas-admin-modal-overlay.rutas-admin-picker-overlay {
            align-items: stretch !important;
            padding: 0 !important;
        }
        .rutas-admin-modal-overlay.rutas-admin-picker-overlay > .rutas-admin-picker-modal {
            width: 100% !important;
            max-width: none !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            animation: rutasPickerSheet .18s ease;
        }
        .rutas-admin-picker-head {
            padding-top: calc(env(safe-area-inset-top, 0px) + 13px) !important;
        }
        .rutas-admin-picker-footer {
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
        }
        .rutas-admin-picker-modal .rutas-picker-list {
            max-height: none !important;
        }
    }
    @keyframes rutasPickerSheet {
        from { transform: translateY(22px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .rutas-admin-root *, .rutas-admin-root *::before, .rutas-admin-root *::after {
            animation-duration: 0.001ms !important; transition-duration: 0.001ms !important;
        }
    }
`;

export default RutasAdminPage;
