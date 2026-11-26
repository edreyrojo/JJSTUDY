import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { localeActual } from '../i18n/translate';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    doc,
    updateDoc,
    deleteDoc,
    where,
    limit,
    arrayUnion,
    arrayRemove,
    writeBatch
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { timerSounds, unlockAudio, vibrate } from '../utils/timerAudio';
import { comprimirImagen } from '../utils/imageUtils';
import {
    PLANTILLAS,
    TIPOS_BLOQUE,
    TIPOS_CLASE,
    NIVELES,
    INTENSIDADES,
    crearClaseVacia,
    nuevoBloque,
    normalizarClase,
    sumarMinutos,
    formatearDuracion,
    formatearFecha,
    etiquetaTipoClase,
    resumenClase,
    fechaHoy
} from '../utils/plannerData';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff6b6b',
        timer: tipo === 'success' ? 1800 : undefined,
        timerProgressBar: tipo === 'success',
        showConfirmButton: tipo !== 'success',
        customClass: { popup: 'gold-border-alert' }
    });
};

const formatearFechaHora = (iso) => {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleDateString(localeActual(), { day: '2-digit', month: 'short' });
};

const iniciales = (nombre = '') => {
    const palabras = String(nombre).trim().split(/\s+/).filter(Boolean);
    if (!palabras.length) return '?';
    return `${palabras[0][0]}${palabras.length > 1 ? palabras[palabras.length - 1][0] : ''}`.toUpperCase();
};

const leerBorrador = () => {
    try {
        const raw = localStorage.getItem('lafortuna_planner_draft');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.nuevaClase?.bloques?.length) return null;
        return parsed;
    } catch {
        return null;
    }
};

const copiarTexto = async (texto) => {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = texto;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            return true;
        } catch {
            return false;
        }
    }
};

const formatearTiempo = (segundos = 0) => {
    const total = Math.max(0, Math.floor(segundos));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segs = total % 60;
    const dos = (n) => String(n).padStart(2, '0');
    return horas > 0 ? `${horas}:${dos(minutos)}:${dos(segs)}` : `${dos(minutos)}:${dos(segs)}`;
};

const tieneContenidoEditor = (clase) => {
    if (clase.titulo?.trim()) return true;
    return clase.bloques?.some((bloque) => (
        bloque.ligero || bloque.intenso || bloque.contenido || bloque.tecnica ||
        bloque.detalles || bloque.puntosClave || bloque.modalidad ||
        bloque.limitantes || bloque.atacante || bloque.defensor || bloque.reglas
    ));
};

const PlaneadorClasesPage = ({ onBack, usuario }) => {
    // --- RESPONSIVE ---
    const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    const esMovil = ancho < 768;

    useEffect(() => {
        const alRedimensionar = () => setAncho(window.innerWidth);
        window.addEventListener('resize', alRedimensionar);
        return () => window.removeEventListener('resize', alRedimensionar);
    }, []);

    // --- IDENTIDAD ---
    const teamId = usuario?.teamId || usuario?.academiaId || '';
    const userName = usuario?.nombre || 'Instructor';
    const dojoNombre = usuario?.academiaNombre || usuario?.nombreSede || '';
    const esAdmin = usuario?.rol === 'admin';

    // --- DATOS ---
    const [clasesEquipo, setClasesEquipo] = useState([]);
    const [clasesGlobales, setClasesGlobales] = useState([]);
    const [alumnos, setAlumnos] = useState([]);
    // Copia local de la clase recién guardada: si el límite de la consulta
    // deja fuera el documento nuevo, la vista de detalle sigue funcionando.
    const [claseRecienGuardada, setClaseRecienGuardada] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [errorDatos, setErrorDatos] = useState('');
    const [errorGlobal, setErrorGlobal] = useState(false);

    // --- NAVEGACIÓN / LISTA ---
    const [modo, setModo] = useState('lista');
    const [claseIdSeleccionada, setClaseIdSeleccionada] = useState(null);
    const [tabBiblioteca, setTabBiblioteca] = useState('dojo');
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('todos');

    // --- EDITOR ---
    const [claseEditandoId, setClaseEditandoId] = useState(null);
    const [nuevaClase, setNuevaClase] = useState(crearClaseVacia);
    const [guardando, setGuardando] = useState(false);
    const [mostrarTipos, setMostrarTipos] = useState(false);
    const [borrador, setBorrador] = useState(leerBorrador);
    const editorOriginalRef = useRef('');

    // --- ASISTENCIA ---
    const [asistencia, setAsistencia] = useState({});
    const [listaDirty, setListaDirty] = useState(false);
    const [guardandoLista, setGuardandoLista] = useState(false);
    const [busquedaAlumno, setBusquedaAlumno] = useState('');

    // --- FOTO / BITÁCORA ---
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [fotoAmpliada, setFotoAmpliada] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState({ rating: 0, funciono: '', mejorar: '' });
    const [guardandoFeedback, setGuardandoFeedback] = useState(false);
    const [comentarioDraft, setComentarioDraft] = useState('');
    const [enviandoComentario, setEnviandoComentario] = useState(false);

    // --- TIMER ---
    const [timerFase, setTimerFase] = useState('idle');
    const [timerRestante, setTimerRestante] = useState(0);
    const [timerBloqueIdx, setTimerBloqueIdx] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            return localStorage.getItem('lafortuna_planner_sound') !== 'off';
        } catch {
            return true;
        }
    });
    const soundRef = useRef(soundEnabled);
    const timerEndAtRef = useRef(0);
    const timerResumePhaseRef = useRef('running');
    const wakeLockRef = useRef(null);

    useEffect(() => {
        soundRef.current = soundEnabled;
        try {
            localStorage.setItem('lafortuna_planner_sound', soundEnabled ? 'on' : 'off');
        } catch {
            /* almacenamiento no disponible */
        }
    }, [soundEnabled]);

    // --- DERIVADOS ---
    const clases = useMemo(() => {
        const mapa = new Map();
        [...clasesEquipo, ...clasesGlobales].forEach((clase) => {
            if (clase?.id) mapa.set(clase.id, normalizarClase(clase));
        });
        return [...mapa.values()].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    }, [clasesEquipo, clasesGlobales]);

    const clasesDojo = useMemo(() => clases.filter((c) => c.teamId === teamId), [clases, teamId]);
    const clasesGlobalesVisibles = useMemo(
        () => clases.filter((c) => c.esPublica && c.teamId !== teamId),
        [clases, teamId]
    );

    const claseActual = useMemo(
        () => clases.find((c) => c.id === claseIdSeleccionada)
            || (claseRecienGuardada?.id === claseIdSeleccionada ? claseRecienGuardada : null),
        [clases, claseIdSeleccionada, claseRecienGuardada]
    );

    const alumnosActivos = useMemo(
        () => alumnos
            .filter((a) => a.activo !== false)
            .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''))),
        [alumnos]
    );

    const esMiClase = Boolean(claseActual && claseActual.teamId === teamId);
    const puedeEditarClase = Boolean(claseActual && (claseActual.teamId === teamId || esAdmin));
    const bloqueTimer = timerBloqueIdx !== null ? claseActual?.bloques?.[timerBloqueIdx] || null : null;
    const timerActivo = timerFase !== 'idle';

    const stats = useMemo(() => {
        const mes = fechaHoy().slice(0, 7);
        return {
            total: clasesDojo.length,
            mes: clasesDojo.filter((c) => String(c.fecha || '').startsWith(mes)).length,
            globales: clasesDojo.filter((c) => c.esPublica).length,
            alumnos: alumnosActivos.length,
            aportes: clases.reduce((total, c) => total + (c.comentarios?.length || 0), 0)
        };
    }, [clasesDojo, alumnosActivos, clases]);

    const baseLista = tabBiblioteca === 'dojo' ? clasesDojo : clasesGlobalesVisibles;
    const clasesFiltradas = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return baseLista.filter((clase) => {
            const tipoOk = filtroTipo === 'todos' || clase.tipoClase === filtroTipo;
            if (!tipoOk) return false;
            if (!texto) return true;
            const contenido = [
                clase.titulo,
                clase.autorNombre,
                clase.dojoNombre,
                etiquetaTipoClase(clase.tipoClase),
                clase.nivel
            ].join(' ').toLowerCase();
            return contenido.includes(texto);
        });
    }, [baseLista, filtroTipo, busqueda]);

    const totalMinutosEditor = sumarMinutos(nuevaClase.bloques);
    const totalAlumnos = alumnosActivos.length;
    const totalPresentes = Object.values(asistencia).filter((registro) => registro?.presente).length;
    const progresoAsistencia = totalAlumnos ? Math.round((totalPresentes / totalAlumnos) * 100) : 0;
    const alumnosFiltrados = useMemo(() => {
        const texto = busquedaAlumno.trim().toLowerCase();
        if (!texto) return alumnosActivos;
        return alumnosActivos.filter((alumno) => String(alumno.nombre || '').toLowerCase().includes(texto));
    }, [alumnosActivos, busquedaAlumno]);

    // --- CARGA DE DATOS ---
    useEffect(() => {
        if (!teamId) {
            setCargando(false);
            return undefined;
        }

        setCargando(true);
        setErrorDatos('');

        const qEquipo = query(collection(db, 'clases'), where('teamId', '==', teamId), limit(150));
        const unsubEquipo = onSnapshot(
            qEquipo,
            (snap) => {
                setClasesEquipo(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setCargando(false);
            },
            (error) => {
                console.error('Error al cargar clases del dojo:', error);
                setErrorDatos('No se pudieron cargar las clases de tu dojo.');
                setCargando(false);
            }
        );

        const qGlobal = query(collection(db, 'clases'), where('visibilidad', '==', 'global'), limit(40));
        const unsubGlobal = onSnapshot(
            qGlobal,
            (snap) => {
                setClasesGlobales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setErrorGlobal(false);
            },
            (error) => {
                console.warn('Biblioteca global no disponible:', error?.code || error);
                setClasesGlobales([]);
                setErrorGlobal(true);
            }
        );

        const qAlumnos = query(collection(db, 'alumnos'), where('teamId', '==', teamId));
        const unsubAlumnos = onSnapshot(
            qAlumnos,
            (snap) => {
                setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            },
            (error) => {
                console.error('Error al cargar alumnos:', error);
            }
        );

        return () => {
            unsubEquipo();
            unsubGlobal();
            unsubAlumnos();
        };
    }, [teamId]);

    // --- ASISTENCIA: INICIALIZAR / MEZCLAR ALUMNOS ---
    useEffect(() => {
        if (!claseActual) return undefined;
        const timeout = setTimeout(() => {
            setAsistencia((prev) => {
                if (!alumnosActivos.length) return prev;
                const next = { ...prev };
                let cambio = false;
                const idsActivos = new Set(alumnosActivos.map((a) => a.id));

                Object.keys(next).forEach((id) => {
                    if (!idsActivos.has(id)) {
                        delete next[id];
                        cambio = true;
                    }
                });

                alumnosActivos.forEach((alumno) => {
                    if (!(alumno.id in next)) {
                        const registro = claseActual.asistencia?.[alumno.id];
                        const yaAsistio = (alumno.asistencias || []).includes(claseActual.fecha);
                        next[alumno.id] = {
                            presente: registro ? Boolean(registro.presente) : yaAsistio,
                            nota: registro?.nota || '',
                            nombre: alumno.nombre || 'Alumno'
                        };
                        cambio = true;
                    }
                });

                return cambio ? next : prev;
            });
        }, 0);
        return () => clearTimeout(timeout);
    }, [claseActual, alumnosActivos]);

    // --- TIMER: WAKE LOCK ---
    const requestWakeLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                const sentinel = await navigator.wakeLock.request('screen');
                wakeLockRef.current = sentinel;
                sentinel.addEventListener('release', () => {
                    if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
                });
            }
        } catch (error) {
            console.warn('Wake Lock:', error);
        }
    }, []);

    const releaseWakeLock = useCallback(async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        } catch (error) {
            console.warn('Wake Lock release:', error);
        }
    }, []);

    useEffect(() => () => { releaseWakeLock(); }, [releaseWakeLock]);

    useEffect(() => {
        const alVolver = () => {
            if (document.visibilityState !== 'visible') return;
            if (['prep', 'running', 'paused'].includes(timerFase)) {
                requestWakeLock();
                unlockAudio();
            }
        };
        document.addEventListener('visibilitychange', alVolver);
        return () => document.removeEventListener('visibilitychange', alVolver);
    }, [timerFase, requestWakeLock]);

    // --- TIMER: CUENTA REGRESIVA ---
    useEffect(() => {
        if (!['prep', 'running'].includes(timerFase)) return undefined;
        let ultimo = null;
        let terminado = false;

        const id = setInterval(() => {
            if (terminado) return;
            const restante = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));

            if (restante !== ultimo) {
                ultimo = restante;
                setTimerRestante(restante);
                if (restante > 0) {
                    if (timerFase === 'prep') {
                        if (restante <= 3) timerSounds.countdown(soundRef.current, restante);
                    } else if (restante === 60 || restante === 30 || restante === 10) {
                        timerSounds.warning(soundRef.current);
                    } else if (restante <= 3) {
                        timerSounds.countdown(soundRef.current, restante);
                    }
                }
            }

            if (restante > 0) return;
            terminado = true;
            clearInterval(id);

            if (timerFase === 'prep') {
                const minutos = Number(bloqueTimer?.minutos) || 0;
                if (minutos > 0) {
                    timerEndAtRef.current = Date.now() + minutos * 60000;
                    setTimerRestante(minutos * 60);
                    setTimerFase('running');
                    timerSounds.workStart(soundRef.current);
                    vibrate([120]);
                } else {
                    setTimerFase('finished');
                    timerSounds.finish(soundRef.current);
                    releaseWakeLock();
                }
                return;
            }

            setTimerFase('finished');
            timerSounds.finish(soundRef.current);
            vibrate([400, 160, 400]);
            releaseWakeLock();
        }, 250);

        return () => clearInterval(id);
    }, [timerFase, timerBloqueIdx, bloqueTimer?.minutos, releaseWakeLock]);

    // --- BORRADOR LOCAL ---
    useEffect(() => {
        if (modo !== 'editor' || claseEditandoId) return undefined;
        if (!tieneContenidoEditor(nuevaClase)) return undefined;

        const timeout = setTimeout(() => {
            const draft = { nuevaClase, actualizadoEn: new Date().toISOString() };
            try {
                localStorage.setItem('lafortuna_planner_draft', JSON.stringify(draft));
                setBorrador(draft);
            } catch {
                /* almacenamiento no disponible */
            }
        }, 600);

        return () => clearTimeout(timeout);
    }, [nuevaClase, modo, claseEditandoId]);

    // --- NAVEGACIÓN ---
    const detenerTimer = useCallback(() => {
        setTimerFase('idle');
        setTimerRestante(0);
        setTimerBloqueIdx(null);
        timerEndAtRef.current = 0;
        releaseWakeLock();
    }, [releaseWakeLock]);

    const intentarVolver = async () => {
        if (modo === 'editor') {
            const hayCambios = JSON.stringify(nuevaClase) !== editorOriginalRef.current;
            if (hayCambios) {
                const res = await Swal.fire({
                    title: '¿Descartar cambios?',
                    text: 'La sesión que estás editando no se ha guardado.',
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#0a0a0a',
                    color: '#fff',
                    confirmButtonColor: '#ff6b6b',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Sí, descartar',
                    cancelButtonText: 'Seguir editando'
                });
                if (!res.isConfirmed) return;
            }
            if (claseEditandoId) {
                setModo('detalle');
                setClaseIdSeleccionada(claseEditandoId);
            } else {
                setModo('lista');
            }
            return;
        }

        if (modo === 'detalle') {
            const feedbackCambio = Boolean(claseActual) && (
                Number(feedbackDraft.rating) !== Number(claseActual.feedback?.rating || 0) ||
                (feedbackDraft.funciono || '') !== (claseActual.feedback?.funciono || '') ||
                (feedbackDraft.mejorar || '') !== (claseActual.feedback?.mejorar || '')
            );
            const hayCambios = listaDirty || Boolean(comentarioDraft.trim()) || feedbackCambio;

            if (timerActivo || hayCambios) {
                const res = await Swal.fire({
                    title: '¿Salir de la clase?',
                    text: timerActivo
                        ? 'El cronómetro se detendrá y volverás a la lista de clases.'
                        : 'Tienes cambios sin guardar en la lista, la bitácora o los comentarios.',
                    icon: 'warning',
                    showCancelButton: true,
                    background: '#0a0a0a',
                    color: '#fff',
                    confirmButtonColor: '#ff6b6b',
                    cancelButtonColor: '#333',
                    confirmButtonText: 'Sí, salir',
                    cancelButtonText: 'Seguir en clase'
                });
                if (!res.isConfirmed) return;
            }
            detenerTimer();
            setModo('lista');
            setClaseIdSeleccionada(null);
            setAsistencia({});
            setListaDirty(false);
            setBusquedaAlumno('');
            setComentarioDraft('');
            return;
        }

        if (timerActivo) detenerTimer();
        onBack();
    };

    const construirAsistencia = useCallback((clase) => {
        const mapa = {};
        alumnosActivos.forEach((alumno) => {
            const registro = clase?.asistencia?.[alumno.id];
            const yaAsistio = (alumno.asistencias || []).includes(clase?.fecha);
            mapa[alumno.id] = {
                presente: registro ? Boolean(registro.presente) : yaAsistio,
                nota: registro?.nota || '',
                nombre: alumno.nombre || 'Alumno'
            };
        });
        return mapa;
    }, [alumnosActivos]);

    const abrirClase = (clase) => {
        if (!clase) return;
        if (timerActivo) detenerTimer();
        setClaseIdSeleccionada(clase.id);
        setModo('detalle');
        setAsistencia(construirAsistencia(clase));
        setListaDirty(false);
        setBusquedaAlumno('');
        setComentarioDraft('');
        setFeedbackDraft({
            rating: Number(clase.feedback?.rating) || 0,
            funciono: clase.feedback?.funciono || '',
            mejorar: clase.feedback?.mejorar || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const iniciarEditor = (clase = null) => {
        if (timerActivo) detenerTimer();
        const base = clase ? normalizarClase(clase) : crearClaseVacia();
        const editable = {
            titulo: clase?.titulo || '',
            fecha: base.fecha || fechaHoy(),
            esPublica: Boolean(base.esPublica),
            tipoClase: base.tipoClase,
            nivel: base.nivel,
            duracionObjetivo: base.duracionObjetivo,
            bloques: base.bloques
        };
        setClaseEditandoId(clase?.id || null);
        setNuevaClase(editable);
        editorOriginalRef.current = JSON.stringify(editable);
        setModo('editor');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const continuarBorrador = () => {
        if (!borrador?.nuevaClase) return;
        setClaseEditandoId(null);
        setNuevaClase(borrador.nuevaClase);
        editorOriginalRef.current = '';
        setModo('editor');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const descartarBorrador = () => {
        try {
            localStorage.removeItem('lafortuna_planner_draft');
        } catch {
            /* almacenamiento no disponible */
        }
        setBorrador(null);
    };

    // --- EDITOR ---
    const actualizarCampo = (campo, valor) => {
        setNuevaClase((prev) => ({ ...prev, [campo]: valor }));
    };

    const actualizarBloque = (indice, cambios) => {
        setNuevaClase((prev) => {
            const bloques = [...prev.bloques];
            bloques[indice] = { ...bloques[indice], ...cambios };
            return { ...prev, bloques };
        });
    };

    const cambiarTipoBloque = (indice, tipo) => {
        const config = TIPOS_BLOQUE[tipo];
        if (!config) return;
        setNuevaClase((prev) => {
            const bloques = [...prev.bloques];
            const actual = bloques[indice];
            const tituloActual = actual?.titulo;
            const tituloEraGenerico = tituloActual === TIPOS_BLOQUE[actual?.tipo]?.label;
            bloques[indice] = {
                ...actual,
                tipo,
                titulo: tituloEraGenerico || !tituloActual ? config.label : tituloActual,
                minutos: Number(actual?.minutos) || config.minutos
            };
            return { ...prev, bloques };
        });
    };

    const agregarBloque = (tipo) => {
        setNuevaClase((prev) => ({ ...prev, bloques: [...prev.bloques, nuevoBloque(tipo)] }));
        setMostrarTipos(false);
    };

    const moverBloque = (indice, direccion) => {
        const destino = indice + direccion;
        if (destino < 0 || destino >= nuevaClase.bloques.length) return;
        const bloques = [...nuevaClase.bloques];
        [bloques[indice], bloques[destino]] = [bloques[destino], bloques[indice]];
        setNuevaClase({ ...nuevaClase, bloques });
    };

    const duplicarBloque = (indice) => {
        const original = nuevaClase.bloques[indice];
        if (!original) return;
        const { id: _id, ...resto } = original;
        const copia = nuevoBloque(original.tipo, {
            ...resto,
            titulo: `${original.titulo || TIPOS_BLOQUE[original.tipo]?.label} (copia)`
        });
        const bloques = [...nuevaClase.bloques];
        bloques.splice(indice + 1, 0, copia);
        setNuevaClase({ ...nuevaClase, bloques });
    };

    const eliminarBloque = (indice) => {
        setNuevaClase({ ...nuevaClase, bloques: nuevaClase.bloques.filter((_, i) => i !== indice) });
    };

    const aplicarPlantilla = async (plantilla) => {
        if (nuevaClase.bloques.length > 0) {
            const res = await Swal.fire({
                title: `¿Aplicar plantilla ${plantilla.nombre}?`,
                text: 'Los bloques actuales serán reemplazados por la estructura de la plantilla.',
                icon: 'question',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Aplicar',
                cancelButtonText: 'Cancelar'
            });
            if (!res.isConfirmed) return;
        }
        setNuevaClase((prev) => ({
            ...prev,
            tipoClase: plantilla.tipoClase,
            duracionObjetivo: plantilla.duracion,
            bloques: plantilla.bloques.map((bloque) => nuevoBloque(bloque.tipo, { ...bloque }))
        }));
        notify(`Plantilla "${plantilla.nombre}" aplicada`);
    };

    const guardarClase = async () => {
        if (guardando) return;
        if (!nuevaClase.titulo.trim()) return notify('Falta el título de la sesión', 'error');
        if (!teamId) return notify('Tu cuenta no tiene un dojo asignado.', 'error');

        setGuardando(true);
        try {
            const claseOriginal = claseEditandoId ? clases.find((c) => c.id === claseEditandoId) : null;
            const payload = {
                titulo: nuevaClase.titulo.trim().slice(0, 80),
                fecha: nuevaClase.fecha || fechaHoy(),
                esPublica: Boolean(nuevaClase.esPublica),
                visibilidad: nuevaClase.esPublica ? 'global' : 'dojo',
                tipoClase: nuevaClase.tipoClase,
                nivel: nuevaClase.nivel,
                duracionObjetivo: Math.max(0, Number(nuevaClase.duracionObjetivo) || 0),
                bloques: nuevaClase.bloques,
                autorNombre: claseOriginal?.autorNombre || userName,
                dojoNombre: claseOriginal?.dojoNombre || dojoNombre,
                actualizadoEn: new Date().toISOString(),
                actualizadoPor: usuario?.uid || ''
            };

            if (claseEditandoId) {
                await updateDoc(doc(db, 'clases', claseEditandoId), payload);
                setClaseRecienGuardada((prev) => (
                    prev && prev.id === claseEditandoId ? { ...prev, ...payload } : prev
                ));
                setClaseIdSeleccionada(claseEditandoId);
                setClaseEditandoId(null);
                setModo('detalle');
                notify('Clase actualizada');
            } else {
                const nuevoDoc = {
                    ...payload,
                    teamId,
                    academiaId: teamId,
                    sedeId: usuario?.sedeId || '',
                    creadoPor: usuario?.uid || '',
                    creadoEn: new Date().toISOString(),
                    asistencia: {},
                    comentarios: [],
                    feedback: null
                };
                const ref = await addDoc(collection(db, 'clases'), nuevoDoc);
                setClaseRecienGuardada(normalizarClase({ id: ref.id, ...nuevoDoc }));
                setClaseIdSeleccionada(ref.id);
                setClaseEditandoId(null);
                setModo('detalle');
                notify('Clase guardada');
            }

            try {
                localStorage.removeItem('lafortuna_planner_draft');
            } catch {
                /* almacenamiento no disponible */
            }
            setBorrador(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error('Error al guardar clase:', error);
            notify(error?.code === 'permission-denied'
                ? 'No tienes permiso para guardar esta clase. Revisa las reglas de Firestore.'
                : 'No se pudo guardar la clase.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    // --- ASISTENCIA ---
    const toggleAsistencia = (alumnoId) => {
        setAsistencia((prev) => ({
            ...prev,
            [alumnoId]: {
                ...(prev[alumnoId] || { nota: '', nombre: '' }),
                presente: !prev[alumnoId]?.presente
            }
        }));
        setListaDirty(true);
    };

    const cambiarNotaAlumno = (alumnoId, nota) => {
        setAsistencia((prev) => ({
            ...prev,
            [alumnoId]: {
                ...(prev[alumnoId] || { presente: false, nombre: '' }),
                nota
            }
        }));
        setListaDirty(true);
    };

    const marcarTodos = (presente) => {
        setAsistencia((prev) => {
            const next = { ...prev };
            alumnosActivos.forEach((alumno) => {
                next[alumno.id] = {
                    ...(next[alumno.id] || { nota: '', nombre: alumno.nombre }),
                    presente,
                    nombre: alumno.nombre || 'Alumno'
                };
            });
            return next;
        });
        setListaDirty(true);
    };

    const guardarAsistencia = async () => {
        if (!claseActual || !esMiClase || guardandoLista) return;
        setGuardandoLista(true);
        try {
            const batch = writeBatch(db);
            const mapaAsistencia = {};
            const fechaClase = claseActual.fecha || fechaHoy();

            alumnosActivos.forEach((alumno) => {
                const registro = asistencia[alumno.id] || { presente: false, nota: '' };
                mapaAsistencia[alumno.id] = {
                    presente: Boolean(registro.presente),
                    nota: registro.nota || '',
                    nombre: alumno.nombre || 'Alumno'
                };

                const yaAsistio = (alumno.asistencias || []).includes(fechaClase);
                const registroPrevio = claseActual.asistencia?.[alumno.id] || null;
                if (registro.presente && !yaAsistio) {
                    batch.update(doc(db, 'alumnos', alumno.id), {
                        asistencias: arrayUnion(fechaClase),
                        historialTecnico: arrayUnion({
                            fecha: fechaClase,
                            clase: claseActual.titulo,
                            nota: registro.nota || 'Asistió'
                        })
                    });
                } else if (!registro.presente && registroPrevio?.presente) {
                    // Solo desmarcamos si ESTA clase había marcado al alumno.
                    // Así no borramos la asistencia que otra clase del mismo día registró.
                    batch.update(doc(db, 'alumnos', alumno.id), {
                        asistencias: arrayRemove(fechaClase),
                        historialTecnico: arrayRemove({
                            fecha: fechaClase,
                            clase: claseActual.titulo,
                            nota: registroPrevio.nota || 'Asistió'
                        })
                    });
                }
            });

            batch.update(doc(db, 'clases', claseActual.id), {
                asistencia: mapaAsistencia,
                asistenciaGuardadaEn: new Date().toISOString(),
                actualizadoEn: new Date().toISOString()
            });

            await batch.commit();
            setListaDirty(false);
            notify('Lista de asistencia guardada');
        } catch (error) {
            console.error('Error al guardar asistencia:', error);
            notify('No se pudo guardar la lista. Revisa tus permisos.', 'error');
        } finally {
            setGuardandoLista(false);
        }
    };

    // --- FOTO ---
    const subirFoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !claseActual || !puedeEditarClase) return;
        setSubiendoFoto(true);
        try {
            const base64 = await comprimirImagen(file, { maxDimension: 1100, quality: 0.72, maxBytes: 620000 });
            await updateDoc(doc(db, 'clases', claseActual.id), {
                fotoBase64: base64,
                fotoFecha: new Date().toISOString(),
                actualizadoEn: new Date().toISOString(),
                actualizadoPor: usuario?.uid || ''
            });
            notify('Foto del día guardada');
        } catch (error) {
            console.error('Error al subir foto:', error);
            notify(error?.message || 'No se pudo guardar la foto.', 'error');
        } finally {
            setSubiendoFoto(false);
        }
    };

    const quitarFoto = async () => {
        if (!claseActual || !puedeEditarClase) return;
        const res = await Swal.fire({
            title: '¿Quitar la foto?',
            text: 'La foto se eliminará de esta clase.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#ff6b6b',
            cancelButtonColor: '#333',
            confirmButtonText: 'Quitar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;
        try {
            await updateDoc(doc(db, 'clases', claseActual.id), {
                fotoBase64: null,
                fotoFecha: null,
                actualizadoEn: new Date().toISOString()
            });
            notify('Foto eliminada');
        } catch (error) {
            console.error('Error al quitar foto:', error);
            notify('No se pudo quitar la foto.', 'error');
        }
    };

    // --- BITÁCORA / COMENTARIOS ---
    const guardarFeedback = async () => {
        if (!claseActual || !puedeEditarClase || guardandoFeedback) return;
        setGuardandoFeedback(true);
        try {
            await updateDoc(doc(db, 'clases', claseActual.id), {
                feedback: {
                    rating: Number(feedbackDraft.rating) || 0,
                    funciono: feedbackDraft.funciono.trim(),
                    mejorar: feedbackDraft.mejorar.trim(),
                    autor: userName,
                    fecha: new Date().toISOString()
                },
                actualizadoEn: new Date().toISOString()
            });
            notify('Bitácora guardada');
        } catch (error) {
            console.error('Error al guardar feedback:', error);
            notify('No se pudo guardar la bitácora.', 'error');
        } finally {
            setGuardandoFeedback(false);
        }
    };

    const agregarComentario = async () => {
        const texto = comentarioDraft.trim();
        if (!claseActual || !texto || enviandoComentario) return;
        if (texto.length < 3) return notify('Escribe un comentario un poco más largo.', 'error');
        if ((claseActual.comentarios?.length || 0) >= 40) {
            return notify('Esta clase ya alcanzó el límite de comentarios.', 'error');
        }
        setEnviandoComentario(true);
        try {
            await updateDoc(doc(db, 'clases', claseActual.id), {
                comentarios: arrayUnion({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    texto: texto.slice(0, 600),
                    autor: userName,
                    autorUid: usuario?.uid || '',
                    dojo: dojoNombre,
                    fecha: new Date().toISOString()
                }),
                actualizadoEn: new Date().toISOString()
            });
            setComentarioDraft('');
            notify('Comentario publicado');
        } catch (error) {
            console.error('Error al comentar:', error);
            notify(error?.code === 'permission-denied'
                ? 'Para comentar clases globales, actualiza las reglas de Firestore.'
                : 'No se pudo publicar el comentario.', 'error');
        } finally {
            setEnviandoComentario(false);
        }
    };

    const eliminarComentario = async (comentario) => {
        if (!claseActual) return;
        if (!(esAdmin || esMiClase || comentario.autorUid === usuario?.uid)) return;
        const res = await Swal.fire({
            title: '¿Eliminar comentario?',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#ff6b6b',
            cancelButtonColor: '#333',
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;
        try {
            await updateDoc(doc(db, 'clases', claseActual.id), {
                comentarios: arrayRemove(comentario)
            });
            notify('Comentario eliminado');
        } catch (error) {
            console.error('Error al eliminar comentario:', error);
            notify('No se pudo eliminar el comentario.', 'error');
        }
    };

    // --- ACCIONES DE CLASE ---
    const compartirClase = async (clase = claseActual) => {
        const objetivo = clase || claseActual;
        if (!objetivo) return;
        const texto = resumenClase(objetivo);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: objetivo.titulo,
                    text: texto
                });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        const copiado = await copiarTexto(texto);
        notify(copiado ? 'Resumen copiado al portapapeles' : 'No se pudo compartir la clase', copiado ? 'success' : 'error');
    };

    const duplicarClase = (clase) => {
        if (!clase) return;
        const base = normalizarClase(clase);
        const copia = {
            ...base,
            id: undefined,
            titulo: `${clase.titulo} (copia)`,
            fecha: fechaHoy(),
            esPublica: false,
            asistencia: {},
            comentarios: [],
            feedback: null,
            fotoBase64: null,
            fotoFecha: null
        };
        iniciarEditor(copia);
        notify('Clase duplicada. Ajusta la fecha y guarda.');
    };

    const eliminarClase = async (clase) => {
        if (!clase || !(esAdmin || clase.teamId === teamId)) return;
        const res = await Swal.fire({
            title: '¿Eliminar esta clase?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#ff6b6b',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;
        try {
            await deleteDoc(doc(db, 'clases', clase.id));
            if (claseIdSeleccionada === clase.id) {
                detenerTimer();
                setModo('lista');
                setClaseIdSeleccionada(null);
            }
            notify('Clase eliminada');
        } catch (error) {
            console.error('Error al eliminar clase:', error);
            notify('No se pudo eliminar la clase.', 'error');
        }
    };

    // --- TIMER: ACCIONES ---
    const iniciarBloque = async (indice) => {
        const bloque = claseActual?.bloques?.[indice];
        if (!bloque) return;
        await unlockAudio();
        setTimerBloqueIdx(indice);
        setTimerRestante(10);
        timerEndAtRef.current = Date.now() + 10000;
        timerResumePhaseRef.current = 'prep';
        setTimerFase('prep');
        timerSounds.prep(soundRef.current);
        vibrate([80]);
        requestWakeLock();
    };

    const alternarTimer = async () => {
        if (timerFase === 'finished') {
            iniciarBloque(timerBloqueIdx ?? 0);
            return;
        }
        if (['prep', 'running'].includes(timerFase)) {
            timerResumePhaseRef.current = timerFase;
            setTimerFase('paused');
            releaseWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }
        if (timerFase === 'paused') {
            timerEndAtRef.current = Date.now() + Math.max(1, timerRestante) * 1000;
            setTimerFase(timerResumePhaseRef.current);
            requestWakeLock();
            timerSounds.tick(soundRef.current);
        }
    };

    const sumarMinutoTimer = () => {
        if (timerFase === 'prep') return;
        if (timerFase === 'running') {
            timerEndAtRef.current += 60000;
            setTimerRestante((prev) => prev + 60);
        } else if (timerFase === 'paused' && timerResumePhaseRef.current === 'running') {
            setTimerRestante((prev) => prev + 60);
        }
    };

    const siguienteBloque = () => {
        if (!claseActual) return;
        const siguiente = (timerBloqueIdx ?? -1) + 1;
        if (siguiente < claseActual.bloques.length) {
            iniciarBloque(siguiente);
        } else {
            detenerTimer();
            notify('Sesión completada');
            setTimeout(() => {
                document.getElementById('planner-bitacora')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }
    };

    const finalizarSesion = () => {
        detenerTimer();
        notify('Sesión finalizada');
        setTimeout(() => {
            document.getElementById('planner-bitacora')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    };

    const toggleSound = async () => {
        const siguiente = !soundEnabled;
        setSoundEnabled(siguiente);
        if (siguiente) {
            await unlockAudio();
            timerSounds.test(true);
        }
    };

    // --- RENDER ---
    return (
        <div style={s.root} className="planner-root">
            <style>{cssPlanner}</style>

            <div style={s.shell}>
                <header style={s.header}>
                    <div style={s.headerLeft}>
                        <button type="button" onClick={intentarVolver} style={s.backBtn} title="Volver" aria-label="Volver">
                            <VaultIcon name="chevronLeft" size={16} />
                        </button>
                        <div style={s.titleGroup}>
                            <span style={s.titleIcon}><VaultIcon name="clipboard" size={18} /></span>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={s.title}>PLANEADOR DE CLASES</h1>
                                <p style={s.subtitle}>
                                    {modo === 'lista' && 'Diseña, dirige y comparte tus sesiones'}
                                    {modo === 'editor' && (claseEditandoId ? 'Editar sesión' : 'Nueva sesión')}
                                    {modo === 'detalle' && (claseActual?.titulo || 'Detalle de la clase')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div style={s.headerRight}>
                        <button
                            type="button"
                            onClick={toggleSound}
                            style={soundEnabled ? s.iconBtnActive : s.iconBtn}
                            title={soundEnabled ? 'Silenciar cronómetro' : 'Activar sonido'}
                            aria-label={soundEnabled ? 'Silenciar cronómetro' : 'Activar sonido'}
                        >
                            <VaultIcon name={soundEnabled ? 'volume' : 'mute'} size={15} />
                        </button>
                    </div>
                </header>

                {modo === 'lista' && (
                    <>
                        {errorDatos && (
                            <div style={s.errorBanner}>
                                <VaultIcon name="alert" size={14} color="#ff6b6b" />
                                <span>{errorDatos}</span>
                            </div>
                        )}

                        <section style={s.statsGrid}>
                            <StatCard icon="clipboard" label="Sesiones" value={stats.total} />
                            <StatCard icon="calendar" label="Este mes" value={stats.mes} />
                            <StatCard icon="globe" label="Globales" value={stats.globales} />
                            <StatCard icon="users" label="Alumnos" value={stats.alumnos} />
                        </section>

                        {borrador?.nuevaClase && (
                            <div style={s.draftBanner}>
                                <div style={s.draftIcon}><VaultIcon name="edit" size={16} color="#d4af37" /></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong style={s.draftTitle}>Borrador sin guardar</strong>
                                    <span style={s.draftMeta}>
                                        {borrador.nuevaClase.titulo || 'Sesión sin título'} · {formatearFecha(borrador.nuevaClase.fecha)}
                                    </span>
                                </div>
                                <button type="button" onClick={continuarBorrador} style={s.draftPrimary}>CONTINUAR</button>
                                <button type="button" onClick={descartarBorrador} style={s.draftGhost} title="Descartar borrador" aria-label="Descartar borrador">
                                    <VaultIcon name="trash" size={14} />
                                </button>
                            </div>
                        )}

                        <div style={s.listToolbar}>
                            <div style={s.mainTabs}>
                                <button
                                    type="button"
                                    onClick={() => setTabBiblioteca('dojo')}
                                    style={tabBiblioteca === 'dojo' ? s.mainTabActive : s.mainTab}
                                >
                                    <VaultIcon name="users" size={14} /> MI DOJO
                                    <span style={s.tabCount}>{clasesDojo.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTabBiblioteca('global')}
                                    style={tabBiblioteca === 'global' ? s.mainTabActive : s.mainTab}
                                >
                                    <VaultIcon name="globe" size={14} /> GLOBAL
                                    <span style={s.tabCount}>{clasesGlobalesVisibles.length}</span>
                                </button>
                            </div>
                            <button type="button" onClick={() => iniciarEditor()} style={s.goldBtn}>
                                <VaultIcon name="plus" size={15} /> NUEVA SESIÓN
                            </button>
                        </div>

                        <div style={s.filtersRow}>
                            <div style={s.searchBox}>
                                <VaultIcon name="search" size={14} color="#777" />
                                <input
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder={tabBiblioteca === 'dojo' ? 'Buscar en mi dojo...' : 'Buscar clases globales...'}
                                    style={s.searchInput}
                                />
                                {busqueda && (
                                    <button type="button" onClick={() => setBusqueda('')} style={s.clearSearch} aria-label="Limpiar búsqueda">
                                        <VaultIcon name="close" size={12} />
                                    </button>
                                )}
                            </div>
                            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={s.select} aria-label="Filtrar por tipo de clase">
                                <option value="todos">Todos los tipos</option>
                                {TIPOS_CLASE.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                                ))}
                            </select>
                        </div>

                        {tabBiblioteca === 'global' && errorGlobal && (
                            <div style={s.infoBanner}>
                                <VaultIcon name="globe" size={14} color="#ffbb33" />
                                <span>La biblioteca global se activará al desplegar las reglas de Firestore incluidas en este cambio.</span>
                            </div>
                        )}

                        {cargando ? (
                            <div style={s.cardsGrid}>
                                {[1, 2, 3].map((n) => <div key={n} className="planner-skeleton" style={s.skeletonCard} />)}
                            </div>
                        ) : clasesFiltradas.length === 0 ? (
                            <EmptyState
                                global={tabBiblioteca === 'global'}
                                onCrear={() => iniciarEditor()}
                            />
                        ) : (
                            <div style={s.cardsGrid}>
                                {clasesFiltradas.map((clase) => (
                                    <TarjetaClase
                                        key={clase.id}
                                        clase={clase}
                                        esPropia={clase.teamId === teamId || esAdmin}
                                        onAbrir={() => abrirClase(clase)}
                                        onEditar={() => iniciarEditor(clase)}
                                        onDuplicar={() => duplicarClase(clase)}
                                        onCompartir={() => compartirClase(clase)}
                                    />
                                ))}
                            </div>
                        )}

                        <div style={s.footerNote}>
                            <VaultIcon name="share" size={13} color="#666" />
                            <span>Comparte una clase como Global para que otros instructores aprendan de lo que funcionó en tu dojo.</span>
                        </div>
                    </>
                )}

                {modo === 'editor' && (
                    <div style={s.editorWrap}>
                        <div style={s.editorHeaderCard}>
                            <div>
                                <span style={s.eyebrow}>{claseEditandoId ? 'EDITANDO SESIÓN' : 'NUEVA SESIÓN'}</span>
                                <h2 style={s.editorTitle}>{nuevaClase.titulo || 'Dale un nombre a tu clase'}</h2>
                                <p style={s.editorHint}>Construye la sesión, ajusta los tiempos y decide si la compartes con todo el ecosistema.</p>
                            </div>
                            <div style={s.durationBadge}>
                                <VaultIcon name="clock" size={15} color="#d4af37" />
                                <div>
                                    <strong style={s.durationValue}>{formatearDuracion(totalMinutosEditor)}</strong>
                                    <span style={s.durationLabel}>planificados</span>
                                </div>
                            </div>
                        </div>

                        <div style={s.formCard}>
                            <label style={s.fieldLabel}>TÍTULO DE LA SESIÓN</label>
                            <input
                                value={nuevaClase.titulo}
                                onChange={(e) => actualizarCampo('titulo', e.target.value)}
                                placeholder="Ej. Guardia cerrada: ataques y control"
                                maxLength={80}
                                style={s.titleInput}
                            />

                            <div style={s.metaGrid}>
                                <Field label="FECHA" icon="calendar">
                                    <input type="date" value={nuevaClase.fecha} onChange={(e) => actualizarCampo('fecha', e.target.value)} style={s.input} />
                                </Field>
                                <Field label="DURACIÓN OBJETIVO" icon="clock">
                                    <div style={s.inlineInput}>
                                        <input
                                            type="number"
                                            min="15"
                                            max="180"
                                            step="5"
                                            value={nuevaClase.duracionObjetivo}
                                            onChange={(e) => actualizarCampo('duracionObjetivo', Math.max(0, Number(e.target.value) || 0))}
                                            style={s.numberInput}
                                        />
                                        <span style={s.unit}>min</span>
                                    </div>
                                </Field>
                                <Field label="TIPO DE CLASE" icon="clipboard">
                                    <select value={nuevaClase.tipoClase} onChange={(e) => actualizarCampo('tipoClase', e.target.value)} style={s.input}>
                                        {TIPOS_CLASE.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                                    </select>
                                </Field>
                                <Field label="NIVEL" icon="belt">
                                    <select value={nuevaClase.nivel} onChange={(e) => actualizarCampo('nivel', e.target.value)} style={s.input}>
                                        {NIVELES.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
                                    </select>
                                </Field>
                            </div>

                            <div style={s.visibilityBox}>
                                <span style={s.fieldLabel}>VISIBILIDAD</span>
                                <div style={s.visibilityOptions}>
                                    <button
                                        type="button"
                                        onClick={() => actualizarCampo('esPublica', false)}
                                        className="planner-visibility-option"
                                        style={!nuevaClase.esPublica ? s.visibilityActive : s.visibilityOption}
                                    >
                                        <VaultIcon name="lock" size={16} color={!nuevaClase.esPublica ? '#000' : '#888'} />
                                        <span>
                                            <strong>MI DOJO</strong>
                                            <small>Solo instructores de tu equipo.</small>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => actualizarCampo('esPublica', true)}
                                        className="planner-visibility-option"
                                        style={nuevaClase.esPublica ? s.visibilityActive : s.visibilityOption}
                                    >
                                        <VaultIcon name="globe" size={16} color={nuevaClase.esPublica ? '#000' : '#888'} />
                                        <span>
                                            <strong>GLOBAL</strong>
                                            <small>Visible para instructores de otros dojos.</small>
                                        </span>
                                    </button>
                                </div>
                                {nuevaClase.esPublica && (
                                    <p style={s.visibilityNote}>
                                        Otros instructores podrán ver la clase y dejar comentarios. No podrán editarla.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div style={s.templateSection}>
                            <div style={s.sectionHeading}>
                                <div>
                                    <span style={s.eyebrow}>ESTRUCTURAS DE CLASE</span>
                                    <h3 style={s.sectionTitle}>Empieza con una plantilla</h3>
                                </div>
                            </div>
                            <div className="planner-templates" style={s.templateGrid}>
                                {PLANTILLAS.map((plantilla) => (
                                    <button key={plantilla.id} type="button" onClick={() => aplicarPlantilla(plantilla)} style={s.templateCard}>
                                        <div style={s.templateTop}>
                                            <span style={s.templateIcon}><VaultIcon name="clipboard" size={16} color="#d4af37" /></span>
                                            <span style={s.templateDuration}>{plantilla.duracion}′</span>
                                        </div>
                                        <strong style={s.templateName}>{plantilla.nombre}</strong>
                                        <span style={s.templateDetail}>{plantilla.detalle}</span>
                                        <span style={s.templateBlocks}>{plantilla.bloques.length} bloques</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={s.blocksSection}>
                            <div style={s.sectionHeading}>
                                <div>
                                    <span style={s.eyebrow}>PLAN DE SESIÓN</span>
                                    <h3 style={s.sectionTitle}>Bloques de la clase</h3>
                                </div>
                                <div style={s.totalPill}>
                                    <VaultIcon name="clock" size={13} />
                                    <span>{formatearDuracion(totalMinutosEditor)}</span>
                                </div>
                            </div>

                            {nuevaClase.duracionObjetivo > 0 && (
                                <div style={s.durationProgressWrap}>
                                    <div style={s.durationProgressTrack}>
                                        <div
                                            style={{
                                                ...s.durationProgressFill,
                                                width: `${Math.min(100, Math.round((totalMinutosEditor / nuevaClase.duracionObjetivo) * 100))}%`,
                                                backgroundColor: totalMinutosEditor > nuevaClase.duracionObjetivo ? '#ff9f43' : '#4CAF50'
                                            }}
                                        />
                                    </div>
                                    <span style={s.durationProgressText}>
                                        {totalMinutosEditor > nuevaClase.duracionObjetivo
                                            ? `${totalMinutosEditor - nuevaClase.duracionObjetivo} min por encima`
                                            : totalMinutosEditor < nuevaClase.duracionObjetivo
                                                ? `${nuevaClase.duracionObjetivo - totalMinutosEditor} min disponibles`
                                                : 'Duración exacta'}
                                    </span>
                                </div>
                            )}

                            <div style={s.blockList}>
                                {nuevaClase.bloques.map((bloque, indice) => (
                                    <EditorBloque
                                        key={bloque.id}
                                        bloque={bloque}
                                        indice={indice}
                                        total={nuevaClase.bloques.length}
                                        onActualizar={(cambios) => actualizarBloque(indice, cambios)}
                                        onCambiarTipo={(tipo) => cambiarTipoBloque(indice, tipo)}
                                        onMover={(direccion) => moverBloque(indice, direccion)}
                                        onDuplicar={() => duplicarBloque(indice)}
                                        onEliminar={() => eliminarBloque(indice)}
                                    />
                                ))}
                            </div>

                            <button type="button" onClick={() => setMostrarTipos(true)} style={s.addBlockBtn}>
                                <VaultIcon name="plus" size={16} /> AGREGAR BLOQUE
                            </button>
                        </div>

                        <div style={s.stickyEditorBar}>
                            <div style={s.stickyEditorInfo}>
                                <span style={s.stickyEditorLabel}>TOTAL</span>
                                <strong style={s.stickyEditorValue}>{formatearDuracion(totalMinutosEditor)}</strong>
                                <span style={s.stickyEditorBlocks}>{nuevaClase.bloques.length} bloques</span>
                            </div>
                            <div style={s.stickyEditorActions}>
                                <button type="button" onClick={intentarVolver} style={s.ghostBtn} disabled={guardando}>
                                    CANCELAR
                                </button>
                                <button type="button" onClick={guardarClase} style={s.goldBtn} disabled={guardando}>
                                    <VaultIcon name={guardando ? 'clock' : 'checkCircle'} size={15} />
                                    {guardando ? 'GUARDANDO...' : claseEditandoId ? 'GUARDAR CAMBIOS' : 'GUARDAR CLASE'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {modo === 'detalle' && (
                    <div>
                        {!claseActual ? (
                            <div style={s.detailLoading}>
                                <VaultIcon name="clock" size={26} color="#d4af37" />
                                <span>Abriendo clase...</span>
                                <button type="button" onClick={() => { setModo('lista'); setClaseIdSeleccionada(null); }} style={s.ghostBtn}>
                                    VOLVER A LA LISTA
                                </button>
                            </div>
                        ) : (
                            <DetalleClase
                                clase={claseActual}
                                esMiClase={esMiClase}
                                puedeEditar={puedeEditarClase}
                                esAdmin={esAdmin}
                                usuario={usuario}
                                alumnos={alumnosActivos}
                                asistencia={asistencia}
                                totalAlumnos={totalAlumnos}
                                totalPresentes={totalPresentes}
                                progresoAsistencia={progresoAsistencia}
                                busquedaAlumno={busquedaAlumno}
                                setBusquedaAlumno={setBusquedaAlumno}
                                alumnosFiltrados={alumnosFiltrados}
                                listaDirty={listaDirty}
                                guardandoLista={guardandoLista}
                                toggleAsistencia={toggleAsistencia}
                                cambiarNotaAlumno={cambiarNotaAlumno}
                                marcarTodos={marcarTodos}
                                guardarAsistencia={guardarAsistencia}
                                subiendoFoto={subiendoFoto}
                                subirFoto={subirFoto}
                                quitarFoto={quitarFoto}
                                abrirFoto={() => setFotoAmpliada(true)}
                                feedbackDraft={feedbackDraft}
                                setFeedbackDraft={setFeedbackDraft}
                                guardandoFeedback={guardandoFeedback}
                                guardarFeedback={guardarFeedback}
                                comentarioDraft={comentarioDraft}
                                setComentarioDraft={setComentarioDraft}
                                enviandoComentario={enviandoComentario}
                                agregarComentario={agregarComentario}
                                eliminarComentario={eliminarComentario}
                                onVolver={intentarVolver}
                                onEditar={() => iniciarEditor(claseActual)}
                                onDuplicar={() => duplicarClase(claseActual)}
                                onCompartir={compartirClase}
                                onEliminar={() => eliminarClase(claseActual)}
                                timerFase={timerFase}
                                timerRestante={timerRestante}
                                timerBloqueIdx={timerBloqueIdx}
                                bloqueTimer={bloqueTimer}
                                iniciarBloque={iniciarBloque}
                                alternarTimer={alternarTimer}
                                sumarMinutoTimer={sumarMinutoTimer}
                                siguienteBloque={siguienteBloque}
                                detenerTimer={detenerTimer}
                                finalizarSesion={finalizarSesion}
                                esMovil={esMovil}
                            />
                        )}
                    </div>
                )}
            </div>

            {mostrarTipos && (
                <ModalTiposBloque
                    onCerrar={() => setMostrarTipos(false)}
                    onElegir={agregarBloque}
                />
            )}

            {fotoAmpliada && claseActual?.fotoBase64 && (
                <div style={s.modalOverlay} onClick={() => setFotoAmpliada(false)}>
                    <div style={s.photoModal} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setFotoAmpliada(false)} style={s.modalClose} aria-label="Cerrar foto">
                            <VaultIcon name="close" size={18} />
                        </button>
                        <img src={claseActual.fotoBase64} alt={`Foto de la clase ${claseActual.titulo}`} style={s.photoModalImg} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaneadorClasesPage;

/* ------------------------------------------------------------------ */
/* COMPONENTES AUXILIARES                                              */
/* ------------------------------------------------------------------ */

const StatCard = ({ icon, label, value }) => (
    <div style={s.statCard}>
        <span style={s.statIcon}><VaultIcon name={icon} size={17} color="#d4af37" /></span>
        <div style={s.statContent}>
            <strong style={s.statValue}>{value}</strong>
            <span style={s.statLabel}>{label}</span>
        </div>
    </div>
);

const Field = ({ label, icon, children }) => (
    <label style={s.fieldGroup}>
        <span style={s.fieldLabelInline}>
            {icon && <VaultIcon name={icon} size={12} color="#666" />}
            {label}
        </span>
        {children}
    </label>
);

const EmptyState = ({ global, onCrear }) => (
    <div style={s.emptyState}>
        <span style={s.emptyIcon}>
            <VaultIcon name={global ? 'globe' : 'clipboard'} size={30} color="#d4af37" />
        </span>
        <h3 style={s.emptyTitle}>
            {global ? 'La biblioteca global está esperando' : 'Tu dojo aún no tiene clases'}
        </h3>
        <p style={s.emptyText}>
            {global
                ? 'Cuando un instructor comparta una clase como Global, aparecerá aquí para que todo el ecosistema aprenda de ella.'
                : 'Crea la primera sesión, elige una plantilla y empieza a construir tu método de enseñanza.'}
        </p>
        <button type="button" onClick={onCrear} style={s.goldBtn}>
            <VaultIcon name="plus" size={15} /> CREAR PRIMERA SESIÓN
        </button>
    </div>
);

const TarjetaClase = ({ clase, esPropia, onAbrir, onEditar, onDuplicar, onCompartir }) => {
    const minutos = sumarMinutos(clase.bloques);
    const asistentes = Object.values(clase.asistencia || {}).filter((r) => r?.presente).length;
    const comentarios = clase.comentarios?.length || 0;
    const rating = Number(clase.feedback?.rating) || 0;
    const tipoConfig = TIPOS_CLASE.find((t) => t.id === clase.tipoClase);

    return (
        <article
            className="planner-card"
            style={s.card}
            onClick={onAbrir}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAbrir();
                }
            }}
            role="button"
            tabIndex={0}
        >
            <div style={s.cardCover}>
                {clase.fotoBase64 ? (
                    <img src={clase.fotoBase64} alt={`Foto de ${clase.titulo}`} style={s.cardCoverImg} />
                ) : (
                    <div style={s.cardCoverFallback}>
                        <VaultIcon name="clipboard" size={34} color="rgba(212,175,55,0.55)" />
                    </div>
                )}
                <div style={s.cardCoverGradient} />
                <span style={clase.esPublica ? s.cardVisibilityGlobal : s.cardVisibilityDojo}>
                    <VaultIcon name={clase.esPublica ? 'globe' : 'lock'} size={10} />
                    {clase.esPublica ? 'GLOBAL' : 'MI DOJO'}
                </span>
                <span style={s.cardType}>{tipoConfig?.label || 'Sesión'}</span>
            </div>

            <div style={s.cardBody}>
                <h3 style={s.cardTitle}>{clase.titulo || 'Sesión sin título'}</h3>
                <div style={s.cardMeta}>
                    <span style={s.cardMetaItem}><VaultIcon name="calendar" size={11} /> {formatearFecha(clase.fecha)}</span>
                    <span style={s.cardMetaItem}><VaultIcon name="clock" size={11} /> {formatearDuracion(minutos)}</span>
                </div>

                {!esPropia && (
                    <div style={s.cardAuthor}>
                        <span style={s.cardAuthorAvatar}>{iniciales(clase.autorNombre || 'Instructor')}</span>
                        <span style={s.cardAuthorName}>
                            {clase.autorNombre || 'Instructor'}{clase.dojoNombre ? ` · ${clase.dojoNombre}` : ''}
                        </span>
                    </div>
                )}

                <div style={s.cardFooter}>
                    <div style={s.cardStats}>
                        <span style={s.cardStat}><VaultIcon name="clipboard" size={11} /> {clase.bloques?.length || 0}</span>
                        {esPropia && (
                            <span style={s.cardStat}><VaultIcon name="users" size={11} /> {asistentes}</span>
                        )}
                        <span style={s.cardStat}><VaultIcon name="message" size={11} /> {comentarios}</span>
                        {rating > 0 && (
                            <span style={s.cardStatGold}><VaultIcon name="star" size={11} style={{ fill: '#d4af37' }} /> {rating}</span>
                        )}
                    </div>
                    <div style={s.cardActions}>
                        {esPropia && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEditar(); }}
                                style={s.cardAction}
                                title="Editar clase"
                                aria-label="Editar clase"
                            >
                                <VaultIcon name="edit" size={13} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDuplicar(); }}
                            style={s.cardAction}
                            title="Duplicar clase"
                            aria-label="Duplicar clase"
                        >
                            <VaultIcon name="copy" size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCompartir(); }}
                            style={s.cardAction}
                            title="Compartir resumen"
                            aria-label="Compartir resumen"
                        >
                            <VaultIcon name="share" size={13} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
};

const EditorBloque = ({
    bloque,
    indice,
    total,
    onActualizar,
    onCambiarTipo,
    onMover,
    onDuplicar,
    onEliminar
}) => {
    const [abierto, setAbierto] = useState(true);
    const config = TIPOS_BLOQUE[bloque.tipo] || TIPOS_BLOQUE.nota;
    const minutos = Number(bloque.minutos) || 0;

    const cambiarMinutos = (delta) => {
        onActualizar({ minutos: Math.max(0, Math.min(240, minutos + delta)) });
    };

    return (
        <div style={{ ...s.blockCard, borderLeftColor: config.color }}>
            <div className="planner-block-head" style={s.blockHead}>
                <div style={s.blockHeadLeft}>
                    <span style={s.blockNumber}>{indice + 1}</span>
                    <span style={{ ...s.blockIcon, border: `1px solid ${config.color}55` }}>
                        <VaultIcon name={config.icon} size={16} color={config.color} />
                    </span>
                    <div style={s.blockHeadText}>
                        <select
                            value={bloque.tipo}
                            onChange={(e) => onCambiarTipo(e.target.value)}
                            style={s.blockTypeSelect}
                            aria-label={`Tipo del bloque ${indice + 1}`}
                        >
                            {Object.entries(TIPOS_BLOQUE).map(([id, tipo]) => (
                                <option key={id} value={id}>{tipo.label}</option>
                            ))}
                        </select>
                        <span style={s.blockTypeHint}>{config.descripcion}</span>
                    </div>
                </div>

                <div style={s.blockHeadRight}>
                    <div style={s.minutesStepper}>
                        <button type="button" onClick={() => cambiarMinutos(-5)} style={s.stepBtn} aria-label="Restar 5 minutos">
                            <VaultIcon name="minus" size={12} />
                        </button>
                        <input
                            type="number"
                            min="0"
                            max="240"
                            value={minutos}
                            onChange={(e) => onActualizar({ minutos: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })}
                            style={s.minutesInput}
                            aria-label="Minutos del bloque"
                        />
                        <span style={s.minutesUnit}>MIN</span>
                        <button type="button" onClick={() => cambiarMinutos(5)} style={s.stepBtn} aria-label="Sumar 5 minutos">
                            <VaultIcon name="plus" size={12} />
                        </button>
                    </div>

                    <div style={s.blockActions}>
                        <button type="button" onClick={() => onMover(-1)} disabled={indice === 0} style={s.blockAction} title="Subir bloque" aria-label="Subir bloque">
                            <VaultIcon name="chevronUp" size={13} />
                        </button>
                        <button type="button" onClick={() => onMover(1)} disabled={indice === total - 1} style={s.blockAction} title="Bajar bloque" aria-label="Bajar bloque">
                            <VaultIcon name="chevronDown" size={13} />
                        </button>
                        <button type="button" onClick={onDuplicar} style={s.blockAction} title="Duplicar bloque" aria-label="Duplicar bloque">
                            <VaultIcon name="copy" size={13} />
                        </button>
                        <button type="button" onClick={onEliminar} style={{ ...s.blockAction, color: '#ff6b6b' }} title="Eliminar bloque" aria-label="Eliminar bloque">
                            <VaultIcon name="trash" size={13} />
                        </button>
                        <button type="button" onClick={() => setAbierto((prev) => !prev)} style={s.blockAction} title={abierto ? 'Contraer bloque' : 'Expandir bloque'} aria-label={abierto ? 'Contraer bloque' : 'Expandir bloque'}>
                            <VaultIcon name={abierto ? 'chevronUp' : 'chevronDown'} size={13} />
                        </button>
                    </div>
                </div>
            </div>

            {abierto && (
                <div style={s.blockBody}>
                    <input
                        value={bloque.titulo || ''}
                        onChange={(e) => onActualizar({ titulo: e.target.value })}
                        placeholder={`Nombre del bloque (${config.label})`}
                        maxLength={70}
                        style={s.blockTitleInput}
                    />

                    <div className="planner-block-fields" style={s.blockFields}>
                        {config.campos.map((campo) => (
                            <label key={campo.key} style={s.blockField}>
                                <span style={s.blockFieldLabel}>{campo.label}</span>
                                {campo.tipo === 'textarea' ? (
                                    <textarea
                                        rows={2}
                                        value={bloque[campo.key] || ''}
                                        onChange={(e) => onActualizar({ [campo.key]: e.target.value })}
                                        placeholder={campo.placeholder}
                                        style={s.textarea}
                                    />
                                ) : (
                                    <input
                                        type={campo.tipo === 'number' ? 'number' : 'text'}
                                        inputMode={campo.tipo === 'number' ? 'numeric' : undefined}
                                        min={campo.tipo === 'number' ? 0 : undefined}
                                        value={bloque[campo.key] ?? ''}
                                        onChange={(e) => onActualizar({
                                            [campo.key]: campo.tipo === 'number'
                                                ? (e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))
                                                : e.target.value
                                        })}
                                        placeholder={campo.placeholder}
                                        style={s.input}
                                    />
                                )}
                            </label>
                        ))}
                    </div>

                    <div style={s.intensityRow}>
                        <span style={s.blockFieldLabel}>INTENSIDAD</span>
                        <div style={s.intensityChips}>
                            {INTENSIDADES.map((intensidad) => {
                                const activa = (bloque.intensidad || 'media') === intensidad.id;
                                return (
                                    <button
                                        key={intensidad.id}
                                        type="button"
                                        onClick={() => onActualizar({ intensidad: intensidad.id })}
                                        style={activa
                                            ? { ...s.intensityChip, border: `1px solid ${intensidad.color}`, color: intensidad.color, background: `${intensidad.color}14` }
                                            : s.intensityChip}
                                    >
                                        <span style={{ ...s.intensityDot, backgroundColor: intensidad.color }} />
                                        {intensidad.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DetalleClase = ({
    clase,
    esMiClase,
    puedeEditar,
    esAdmin,
    usuario,
    alumnos,
    asistencia,
    totalAlumnos,
    totalPresentes,
    progresoAsistencia,
    busquedaAlumno,
    setBusquedaAlumno,
    alumnosFiltrados,
    listaDirty,
    guardandoLista,
    toggleAsistencia,
    cambiarNotaAlumno,
    marcarTodos,
    guardarAsistencia,
    subiendoFoto,
    subirFoto,
    quitarFoto,
    abrirFoto,
    feedbackDraft,
    setFeedbackDraft,
    guardandoFeedback,
    guardarFeedback,
    comentarioDraft,
    setComentarioDraft,
    enviandoComentario,
    agregarComentario,
    eliminarComentario,
    onVolver,
    onEditar,
    onDuplicar,
    onCompartir,
    onEliminar,
    timerFase,
    timerRestante,
    timerBloqueIdx,
    bloqueTimer,
    iniciarBloque,
    alternarTimer,
    sumarMinutoTimer,
    siguienteBloque,
    detenerTimer,
    finalizarSesion,
    esMovil
}) => {
    const totalMinutos = sumarMinutos(clase.bloques);
    const tipoLabel = etiquetaTipoClase(clase.tipoClase);
    const comentarios = [...(clase.comentarios || [])].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const esGlobalAjena = clase.esPublica && !esMiClase;
    const urgente = timerFase === 'running' && timerRestante <= 10;
    const esUltimoBloque = timerBloqueIdx !== null && timerBloqueIdx >= (clase.bloques?.length || 0) - 1;
    const puedeIniciar = Boolean(clase.bloques?.length) && timerFase === 'idle';

    const scrollA = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const etiquetaFase = () => {
        if (timerFase === 'prep') return 'PREPARACIÓN';
        if (timerFase === 'running') return 'TIEMPO ACTIVO';
        if (timerFase === 'paused') return 'PAUSA';
        if (timerFase === 'finished') return 'BLOQUE COMPLETADO';
        return '';
    };

    const textoBotonTimer = () => {
        if (timerFase === 'finished') return 'REINICIAR';
        if (timerFase === 'paused') return 'REANUDAR';
        if (timerFase === 'prep' || timerFase === 'running') return 'PAUSA';
        return 'INICIAR';
    };

    const plan = (
        <section style={s.sectionCard}>
            <div style={s.sectionCardHead}>
                <div>
                    <span style={s.eyebrow}>PLAN DE CLASE</span>
                    <h3 style={s.sectionTitle}>Secuencia de bloques</h3>
                </div>
                <span style={s.totalPill}>
                    <VaultIcon name="clock" size={13} /> {formatearDuracion(totalMinutos)} · {clase.bloques?.length || 0} bloques
                </span>
            </div>

            {(clase.bloques || []).length === 0 ? (
                <div style={s.planEmpty}>
                    <VaultIcon name="clipboard" size={26} color="#666" />
                    <span>Esta clase todavía no tiene bloques.</span>
                    {puedeEditar && <button type="button" onClick={onEditar} style={s.ghostBtn}>EDITAR CLASE</button>}
                </div>
            ) : (
                <div style={s.timeline}>
                    {clase.bloques.map((bloque, indice) => {
                        const config = TIPOS_BLOQUE[bloque.tipo] || TIPOS_BLOQUE.nota;
                        const activo = timerFase !== 'idle' && timerBloqueIdx === indice;
                        const intensidad = INTENSIDADES.find((i) => i.id === (bloque.intensidad || 'media'));
                        return (
                            <div key={bloque.id || indice} style={s.timelineRow}>
                                <div style={s.timelineRail}>
                                    <span style={{ ...s.timelineDot, border: `1px solid ${config.color}`, color: config.color }}>
                                        {indice + 1}
                                    </span>
                                    {indice < (clase.bloques.length - 1) && <span style={s.timelineLine} />}
                                </div>

                                <div style={{
                                    ...s.timelineCard,
                                    borderColor: activo ? config.color : '#222',
                                    backgroundColor: activo ? `${config.color}0d` : '#0a0a0a'
                                }}>
                                    <div className="planner-timeline-head" style={s.timelineHead}>
                                        <div style={s.timelineTitleWrap}>
                                            <VaultIcon name={config.icon} size={15} color={config.color} />
                                            <h4 style={s.timelineTitle}>{bloque.titulo || config.label}</h4>
                                            <span style={s.timelineMinutes}>{bloque.minutos}′</span>
                                            {intensidad && (
                                                <span style={{ ...s.intensityBadge, color: intensidad.color, border: `1px solid ${intensidad.color}55` }}>
                                                    {intensidad.label}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => iniciarBloque(indice)}
                                            style={activo ? { ...s.timelineStart, backgroundColor: config.color, color: '#000' } : s.timelineStart}
                                        >
                                            <VaultIcon name={activo && timerFase === 'running' ? 'pause' : 'play'} size={12} />
                                            {activo ? 'EN CURSO' : 'INICIAR'}
                                        </button>
                                    </div>

                                    <div style={s.timelineFields}>
                                        {config.campos.map((campo) => {
                                            const valor = bloque[campo.key];
                                            if (valor === undefined || valor === null || String(valor).trim() === '') return null;
                                            return (
                                                <div key={campo.key} style={s.timelineField}>
                                                    <span style={s.timelineFieldLabel}>{campo.label}</span>
                                                    <p style={s.timelineFieldText}>{String(valor)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );

    const asistenciaPanel = (
        <section id="planner-asistencia" style={{ ...s.sideCard, scrollMarginTop: '90px' }}>
            <div style={s.sideCardHead}>
                <h3 style={s.sideTitle}><VaultIcon name="users" size={15} /> Pasar lista</h3>
                {esMiClase && <span style={s.sideCount}>{totalPresentes}/{totalAlumnos}</span>}
            </div>

            {esMiClase ? (
                <>
                    <div style={s.attendanceProgress}>
                        <div style={s.attendanceProgressTrack}>
                            <div style={{ ...s.attendanceProgressFill, width: `${progresoAsistencia}%` }} />
                        </div>
                        <span style={s.attendancePercent}>{progresoAsistencia}%</span>
                    </div>

                    <div style={s.attendanceTools}>
                        <div style={s.studentSearch}>
                            <VaultIcon name="search" size={12} color="#666" />
                            <input
                                value={busquedaAlumno}
                                onChange={(e) => setBusquedaAlumno(e.target.value)}
                                placeholder="Buscar alumno..."
                                style={s.studentSearchInput}
                            />
                        </div>
                        <button type="button" onClick={() => marcarTodos(true)} style={s.miniBtn}>TODOS</button>
                        <button type="button" onClick={() => marcarTodos(false)} style={s.miniBtn}>NADIE</button>
                    </div>

                    {alumnos.length === 0 ? (
                        <div style={s.attendanceEmpty}>
                            <VaultIcon name="users" size={22} color="#666" />
                            <span>No hay alumnos activos en tu dojo.</span>
                        </div>
                    ) : (
                        <div style={s.studentList}>
                            {alumnosFiltrados.map((alumno) => {
                                const registro = asistencia[alumno.id] || { presente: false, nota: '' };
                                return (
                                    <div key={alumno.id} style={s.studentRow}>
                                        <span style={s.studentAvatar}>
                                            {alumno.fotoBase64
                                                ? <img src={alumno.fotoBase64} alt="" style={s.studentAvatarImg} />
                                                : iniciales(alumno.nombre)}
                                        </span>
                                        <div style={s.studentInfo}>
                                            <span style={s.studentName}>{alumno.nombre || 'Alumno'}</span>
                                            <input
                                                value={registro.nota || ''}
                                                onChange={(e) => cambiarNotaAlumno(alumno.id, e.target.value)}
                                                placeholder="Nota de la clase..."
                                                style={s.studentNote}
                                                maxLength={90}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleAsistencia(alumno.id)}
                                            style={registro.presente ? s.presentBtn : s.absentBtn}
                                            aria-label={registro.presente ? 'Marcar como ausente' : 'Marcar como presente'}
                                        >
                                            <VaultIcon name={registro.presente ? 'checkCircle' : 'circle'} size={14} />
                                            {registro.presente ? 'PRESENTE' : 'FALTA'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={guardarAsistencia}
                        disabled={!listaDirty || guardandoLista}
                        style={!listaDirty || guardandoLista ? { ...s.goldBtn, opacity: 0.45, cursor: 'not-allowed' } : s.goldBtn}
                    >
                        <VaultIcon name={guardandoLista ? 'clock' : 'checkCircle'} size={14} />
                        {guardandoLista ? 'GUARDANDO...' : listaDirty ? 'GUARDAR LISTA' : 'LISTA GUARDADA'}
                    </button>
                </>
            ) : (
                <div style={s.privatePanel}>
                    <span style={s.privateIcon}><VaultIcon name="lock" size={18} color="#777" /></span>
                    <strong>Asistencia privada</strong>
                    <p>La lista de alumnos pertenece al dojo que creó esta clase.</p>
                </div>
            )}
        </section>
    );

    const fotoPanel = (
        <section id="planner-foto" style={{ ...s.sideCard, scrollMarginTop: '90px' }}>
            <div style={s.sideCardHead}>
                <h3 style={s.sideTitle}><VaultIcon name="camera" size={15} /> Foto del día</h3>
                {clase.fotoFecha && <span style={s.sideCount}>{formatearFechaHora(clase.fotoFecha)}</span>}
            </div>

            <input
                id="planner-foto-input"
                type="file"
                accept="image/*"
                hidden
                onChange={subirFoto}
            />

            {clase.fotoBase64 ? (
                <>
                    <button type="button" onClick={abrirFoto} style={s.photoButton} aria-label="Ampliar foto de la clase">
                        <img src={clase.fotoBase64} alt={`Foto de la clase ${clase.titulo}`} style={s.photoImg} />
                    </button>
                    {puedeEditar && (
                        <div style={s.photoActions}>
                            <label htmlFor="planner-foto-input" style={s.photoActionBtn}>
                                <VaultIcon name="camera" size={12} /> {subiendoFoto ? 'PROCESANDO...' : 'CAMBIAR'}
                            </label>
                            <button type="button" onClick={quitarFoto} style={{ ...s.photoActionBtn, color: '#ff6b6b' }}>
                                <VaultIcon name="trash" size={12} /> QUITAR
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={s.photoEmpty}>
                    <span style={s.photoEmptyIcon}><VaultIcon name="camera" size={24} color="#d4af37" /></span>
                    <strong style={s.photoEmptyTitle}>{puedeEditar ? 'Inmortaliza la sesión' : 'Sin foto del día'}</strong>
                    <p style={s.photoEmptyText}>
                        {puedeEditar
                            ? 'Una foto del grupo, del drill o del detalle técnico del día.'
                            : 'El dojo autor no compartió una foto de esta sesión.'}
                    </p>
                    {puedeEditar && (
                        <label htmlFor="planner-foto-input" style={s.goldBtn}>
                            <VaultIcon name="camera" size={14} /> {subiendoFoto ? 'PROCESANDO...' : 'TOMAR / SUBIR FOTO'}
                        </label>
                    )}
                </div>
            )}
        </section>
    );

    const bitacora = (
        <section id="planner-bitacora" style={{ ...s.sectionCard, scrollMarginTop: '90px' }}>
            <div style={s.sectionCardHead}>
                <div>
                    <span style={s.eyebrow}>BITÁCORA</span>
                    <h3 style={s.sectionTitle}>Cómo salió la clase</h3>
                </div>
                {clase.feedback?.fecha && (
                    <span style={s.sideCount}>Guardada {formatearFechaHora(clase.feedback.fecha)}</span>
                )}
            </div>

            {puedeEditar ? (
                <div style={s.feedbackBody}>
                    <div style={s.ratingRow}>
                        <span style={s.fieldLabelInline}>VALORACIÓN</span>
                        <div style={s.starsRow}>
                            {[1, 2, 3, 4, 5].map((valor) => (
                                <button
                                    key={valor}
                                    type="button"
                                    onClick={() => setFeedbackDraft((prev) => ({ ...prev, rating: valor }))}
                                    style={s.starButton}
                                    aria-label={`Valorar con ${valor} estrellas`}
                                >
                                    <VaultIcon
                                        name="star"
                                        size={20}
                                        color={valor <= feedbackDraft.rating ? '#d4af37' : '#3a3a3a'}
                                        style={{ fill: valor <= feedbackDraft.rating ? '#d4af37' : 'none' }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="planner-feedback-grid" style={s.feedbackGrid}>
                        <label style={s.blockField}>
                            <span style={s.blockFieldLabel}>QUÉ FUNCIONÓ</span>
                            <textarea
                                rows={3}
                                value={feedbackDraft.funciono}
                                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, funciono: e.target.value }))}
                                placeholder="Dinámica, corrección, ritmo, respuesta del grupo..."
                                style={s.textarea}
                            />
                        </label>
                        <label style={s.blockField}>
                            <span style={s.blockFieldLabel}>QUÉ MEJORAR</span>
                            <textarea
                                rows={3}
                                value={feedbackDraft.mejorar}
                                onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, mejorar: e.target.value }))}
                                placeholder="Tiempos, explicación, parejas, material..."
                                style={s.textarea}
                            />
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={guardarFeedback}
                        disabled={guardandoFeedback}
                        style={guardandoFeedback ? { ...s.ghostBtn, opacity: 0.5 } : s.ghostBtn}
                    >
                        <VaultIcon name="checkCircle" size={14} /> {guardandoFeedback ? 'GUARDANDO...' : 'GUARDAR BITÁCORA'}
                    </button>
                </div>
            ) : (
                <div style={s.feedbackReadonly}>
                    {clase.feedback ? (
                        <>
                            <div style={s.starsRow}>
                                {[1, 2, 3, 4, 5].map((valor) => (
                                    <VaultIcon
                                        key={valor}
                                        name="star"
                                        size={16}
                                        color={valor <= (clase.feedback.rating || 0) ? '#d4af37' : '#333'}
                                        style={{ fill: valor <= (clase.feedback.rating || 0) ? '#d4af37' : 'none' }}
                                    />
                                ))}
                            </div>
                            {clase.feedback.funciono && <p style={s.readonlyText}><strong>Funcionó:</strong> {clase.feedback.funciono}</p>}
                            {clase.feedback.mejorar && <p style={s.readonlyText}><strong>Mejorar:</strong> {clase.feedback.mejorar}</p>}
                        </>
                    ) : (
                        <p style={s.readonlyText}>El dojo autor aún no ha compartido su bitácora de esta sesión.</p>
                    )}
                </div>
            )}
        </section>
    );

    const comentariosPanel = (
        <section id="planner-comentarios" style={{ ...s.sectionCard, scrollMarginTop: '90px' }}>
            <div style={s.sectionCardHead}>
                <div>
                    <span style={s.eyebrow}>APORTES</span>
                    <h3 style={s.sectionTitle}>Comentarios de instructores</h3>
                </div>
                <span style={s.sideCount}>{comentarios.length}</span>
            </div>

            {comentarios.length === 0 ? (
                <div style={s.commentsEmpty}>
                    <VaultIcon name="message" size={22} color="#555" />
                    <span>Aún no hay aportes. Comparte qué funcionó o qué ajustarías.</span>
                </div>
            ) : (
                <div style={s.commentsList}>
                    {comentarios.map((comentario) => {
                        const puedeBorrar = esAdmin || esMiClase || comentario.autorUid === usuario?.uid;
                        return (
                            <div key={comentario.id || comentario.fecha} style={s.commentItem}>
                                <span style={s.commentAvatar}>{iniciales(comentario.autor || 'Instructor')}</span>
                                <div style={s.commentBody}>
                                    <div style={s.commentHead}>
                                        <strong style={s.commentAuthor}>{comentario.autor || 'Instructor'}</strong>
                                        {comentario.dojo && <span style={s.commentDojo}>{comentario.dojo}</span>}
                                        <span style={s.commentDate}>{formatearFechaHora(comentario.fecha)}</span>
                                        {puedeBorrar && (
                                            <button
                                                type="button"
                                                onClick={() => eliminarComentario(comentario)}
                                                style={s.commentDelete}
                                                title="Eliminar comentario"
                                                aria-label="Eliminar comentario"
                                            >
                                                <VaultIcon name="trash" size={11} />
                                            </button>
                                        )}
                                    </div>
                                    <p style={s.commentText}>{comentario.texto}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={s.commentComposer}>
                <textarea
                    rows={2}
                    value={comentarioDraft}
                    onChange={(e) => setComentarioDraft(e.target.value)}
                    placeholder="¿Qué funcionó? ¿Qué ajustarías? Comparte con el resto de instructores..."
                    maxLength={600}
                    style={s.textarea}
                />
                <button
                    type="button"
                    onClick={agregarComentario}
                    disabled={enviandoComentario || comentarioDraft.trim().length < 3}
                    style={enviandoComentario || comentarioDraft.trim().length < 3
                        ? { ...s.sendBtn, opacity: 0.4, cursor: 'not-allowed' }
                        : s.sendBtn}
                    aria-label="Publicar comentario"
                >
                    <VaultIcon name="send" size={15} />
                </button>
            </div>
            <p style={s.commentHint}>
                {clase.esPublica
                    ? 'Visible para instructores y profesores de todos los dojos.'
                    : 'Visible para los instructores de tu dojo.'}
            </p>
        </section>
    );

    return (
        <div>
            {timerFase !== 'idle' && (
                <div
                    className="planner-timer-bar"
                    style={{
                        ...s.timerBar,
                        borderColor: urgente ? 'rgba(255,107,107,0.6)' : timerFase === 'finished' ? 'rgba(76,175,80,0.5)' : 'rgba(212,175,55,0.45)'
                    }}
                >
                    <div style={s.timerBarLeft}>
                        <span style={s.timerIcon}><VaultIcon name="timer" size={17} color="#d4af37" /></span>
                        <div style={s.timerBarText}>
                            <span style={s.timerBlockLabel}>BLOQUE {(timerBloqueIdx ?? 0) + 1}/{clase.bloques?.length || 0}</span>
                            <strong style={s.timerBlockName}>{bloqueTimer?.titulo || 'Bloque'}</strong>
                            <span style={s.timerPhase}>{etiquetaFase()}</span>
                        </div>
                    </div>

                    <div style={s.timerClockWrap}>
                        <span className={urgente ? 'planner-timer-urgent' : ''} style={s.timerClock}>
                            {formatearTiempo(timerRestante)}
                        </span>
                        <span style={s.timerClockLabel}>{timerFase === 'prep' ? 'PREP' : 'TIEMPO'}</span>
                    </div>

                    <div style={s.timerControls}>
                        <button type="button" onClick={alternarTimer} style={s.timerCtrlGold} title="Pausar o reanudar">
                            <VaultIcon name={timerFase === 'paused' || timerFase === 'finished' ? 'play' : 'pause'} size={14} />
                            <span className="planner-hide-mobile">{textoBotonTimer()}</span>
                        </button>
                        <button
                            type="button"
                            onClick={sumarMinutoTimer}
                            disabled={timerFase !== 'running'}
                            style={s.timerCtrl}
                            title="Añadir un minuto"
                        >
                            <VaultIcon name="plus" size={13} /> 1:00
                        </button>
                        <button type="button" onClick={siguienteBloque} style={s.timerCtrl} title={esUltimoBloque ? 'Finalizar sesión' : 'Siguiente bloque'}>
                            <VaultIcon name="skipNext" size={13} />
                            <span className="planner-hide-mobile">{esUltimoBloque ? 'FINALIZAR' : 'SIGUIENTE'}</span>
                        </button>
                        <button type="button" onClick={detenerTimer} style={s.timerCtrlDanger} title="Detener cronómetro" aria-label="Detener cronómetro">
                            <VaultIcon name="close" size={13} />
                        </button>
                    </div>
                </div>
            )}

            <section style={s.detailHero}>
                <div style={s.detailHeroMain}>
                    <button type="button" onClick={onVolver} style={s.crumbBtn}>
                        <VaultIcon name="chevronLeft" size={12} /> CLASES
                    </button>

                    <div style={s.detailBadges}>
                        <span style={clase.esPublica ? s.chipGlobal : s.chipDojo}>
                            <VaultIcon name={clase.esPublica ? 'globe' : 'lock'} size={11} />
                            {clase.esPublica ? 'GLOBAL' : 'MI DOJO'}
                        </span>
                        <span style={s.chip}>{tipoLabel}</span>
                        {clase.nivel && clase.nivel !== tipoLabel && (
                            <span style={s.chip}><VaultIcon name="belt" size={11} /> {clase.nivel}</span>
                        )}
                        <span style={s.chip}><VaultIcon name="clock" size={11} /> {formatearDuracion(totalMinutos)}</span>
                        <span style={s.chip}><VaultIcon name="calendar" size={11} /> {formatearFecha(clase.fecha)}</span>
                        {timerFase !== 'idle' && <span style={s.chipLive}><span style={s.liveDot} /> EN VIVO</span>}
                    </div>

                    <h2 style={s.detailTitle}>{clase.titulo || 'Sesión sin título'}</h2>

                    <div style={s.detailAuthorRow}>
                        <span style={s.detailAvatar}>{iniciales(clase.autorNombre || usuario?.nombre || 'Instructor')}</span>
                        <span style={s.detailAuthorName}>
                            {clase.autorNombre || usuario?.nombre || 'Instructor'}
                            {clase.dojoNombre ? ` · ${clase.dojoNombre}` : ''}
                        </span>
                        <span style={s.dot} />
                        <span style={s.detailMetaText}>{clase.bloques?.length || 0} bloques</span>
                        <span style={s.dot} />
                        <span style={s.detailMetaText}>{comentarios.length} aportes</span>
                        {clase.feedback?.rating > 0 && (
                            <>
                                <span style={s.dot} />
                                <span style={s.detailMetaGold}>
                                    <VaultIcon name="star" size={12} style={{ fill: '#d4af37' }} /> {clase.feedback.rating}/5
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="planner-detail-actions" style={s.detailActions}>
                    <button
                        type="button"
                        onClick={() => iniciarBloque(0)}
                        disabled={!puedeIniciar}
                        className="planner-primary-action"
                        style={!puedeIniciar ? { ...s.goldBtn, opacity: 0.4 } : s.goldBtn}
                    >
                        <VaultIcon name="play" size={15} /> {timerFase === 'idle' ? 'INICIAR CLASE' : 'SESIÓN EN CURSO'}
                    </button>
                    {esMiClase ? (
                        <button type="button" onClick={() => scrollA('planner-asistencia')} style={s.ghostBtn}>
                            <VaultIcon name="users" size={14} /> PASAR LISTA
                        </button>
                    ) : (
                        <button type="button" onClick={() => scrollA('planner-comentarios')} style={s.ghostBtn}>
                            <VaultIcon name="message" size={14} /> COMENTAR
                        </button>
                    )}
                    <button type="button" onClick={() => scrollA('planner-foto')} style={s.ghostBtn}>
                        <VaultIcon name="camera" size={14} /> FOTO
                    </button>
                    <button type="button" onClick={onCompartir} style={s.ghostBtn}>
                        <VaultIcon name="share" size={14} /> COMPARTIR
                    </button>
                    <button type="button" onClick={onDuplicar} style={s.ghostBtn}>
                        <VaultIcon name="copy" size={14} /> DUPLICAR
                    </button>
                    {puedeEditar && (
                        <button type="button" onClick={onEditar} style={s.ghostBtn}>
                            <VaultIcon name="edit" size={14} /> EDITAR
                        </button>
                    )}
                    {puedeEditar && (
                        <button type="button" onClick={onEliminar} style={s.dangerBtn}>
                            <VaultIcon name="trash" size={14} /> ELIMINAR
                        </button>
                    )}
                </div>
            </section>

            {esGlobalAjena && (
                <div className="planner-global-banner" style={s.globalBanner}>
                    <span style={s.globalBannerIcon}><VaultIcon name="globe" size={18} color="#d4af37" /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={s.globalBannerTitle}>Clase compartida por otro dojo</strong>
                        <span style={s.globalBannerText}>Puedes usar el cronómetro y comentar. Si te sirve, duplícala a tu dojo y adáptala.</span>
                    </div>
                    <button type="button" onClick={onDuplicar} style={{ ...s.goldBtn, width: esMovil ? '100%' : undefined }}>DUPLICAR A MI DOJO</button>
                </div>
            )}

            {timerFase !== 'idle' && (
                <div style={s.sessionBar}>
                    <div style={s.sessionBarLeft}>
                        <span style={s.liveDot} />
                        <span>SESIÓN EN CURSO</span>
                        <span style={s.sessionBarMeta}>{clase.bloques?.length || 0} bloques planificados</span>
                    </div>
                    <button type="button" onClick={finalizarSesion} style={s.ghostBtn}>
                        <VaultIcon name="flag" size={13} /> TERMINAR SESIÓN
                    </button>
                </div>
            )}

            {esMovil ? (
                <div style={s.detailMain}>
                    {plan}
                    {asistenciaPanel}
                    {fotoPanel}
                    {bitacora}
                    {comentariosPanel}
                </div>
            ) : (
                <div style={s.detailGrid}>
                    <div style={s.detailMain}>
                        {plan}
                        {bitacora}
                        {comentariosPanel}
                    </div>
                    <aside style={s.detailSide}>
                        {asistenciaPanel}
                        {fotoPanel}
                    </aside>
                </div>
            )}
        </div>
    );
};

const ModalTiposBloque = ({ onCerrar, onElegir }) => (
    <div style={s.modalOverlay} onClick={onCerrar}>
        <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
                <div>
                    <span style={s.eyebrow}>NUEVO BLOQUE</span>
                    <h3 style={s.modalTitle}>¿Qué toca ahora?</h3>
                </div>
                <button type="button" onClick={onCerrar} style={s.iconBtn} aria-label="Cerrar">
                    <VaultIcon name="close" size={17} />
                </button>
            </div>
            <div className="planner-type-grid" style={s.typeGrid}>
                {Object.entries(TIPOS_BLOQUE).map(([id, tipo]) => (
                    <button key={id} type="button" onClick={() => onElegir(id)} style={s.typeOption}>
                        <span style={{ ...s.typeOptionIcon, border: `1px solid ${tipo.color}55` }}>
                            <VaultIcon name={tipo.icon} size={20} color={tipo.color} />
                        </span>
                        <strong style={s.typeOptionName}>{tipo.label}</strong>
                        <span style={s.typeOptionDesc}>{tipo.descripcion}</span>
                        <span style={s.typeOptionMinutes}>{tipo.minutos} min base</span>
                    </button>
                ))}
            </div>
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* ESTILOS                                                             */
/* ------------------------------------------------------------------ */

const s = {
    root: {
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#000',
        color: '#fff',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
    },
    shell: { width: '100%', maxWidth: '1240px', margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    headerRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    backBtn: {
        width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: '10px', cursor: 'pointer'
    },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    titleIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', border: '1px solid #d4af37',
        color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(212,175,55,0.06)'
    },
    title: {
        margin: 0, color: '#d4af37', fontSize: 'clamp(1rem, 2.6vw, 1.35rem)', fontWeight: 800,
        letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1
    },
    subtitle: {
        margin: '2px 0 0 0', color: '#777', fontSize: '0.64rem', lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '72vw'
    },
    iconBtn: {
        width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '9px', cursor: 'pointer'
    },
    iconBtnActive: {
        width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(212,175,55,0.12)', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '9px', cursor: 'pointer'
    },

    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px', marginBottom: '14px'
    },
    statCard: {
        display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0b0b',
        border: '1px solid #1f1f1f', borderRadius: '10px', padding: '11px 12px'
    },
    statIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '9px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.18)'
    },
    statContent: { display: 'flex', flexDirection: 'column', minWidth: 0 },
    statValue: { color: '#fff', fontSize: '1.1rem', lineHeight: 1, fontWeight: 800 },
    statLabel: { color: '#777', fontSize: '0.58rem', letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '3px' },

    draftBanner: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px',
        background: 'linear-gradient(90deg, rgba(212,175,55,0.12), #0b0b0b 60%)',
        border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', marginBottom: '14px'
    },
    draftIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)'
    },
    draftTitle: { display: 'block', color: '#d4af37', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.4px' },
    draftMeta: { display: 'block', color: '#888', fontSize: '0.6rem', marginTop: '2px' },
    draftPrimary: {
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', padding: '7px 10px',
        fontSize: '0.58rem', fontWeight: 800, cursor: 'pointer'
    },
    draftGhost: {
        width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '6px', cursor: 'pointer'
    },

    listToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' },
    mainTabs: {
        display: 'flex', gap: '4px', flex: 1, minWidth: '220px', background: '#0b0b0b',
        border: '1px solid #1d1d1d', borderRadius: '10px', padding: '4px'
    },
    mainTab: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: 'transparent', border: 'none', color: '#777', padding: '8px 10px', borderRadius: '7px',
        fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    mainTabActive: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: '#d4af37', border: 'none', color: '#000', padding: '8px 10px', borderRadius: '7px',
        fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    tabCount: {
        background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(0,0,0,0.12)', color: 'inherit',
        borderRadius: '999px', padding: '0 6px', fontSize: '0.52rem', lineHeight: '1.5'
    },
    goldBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '8px',
        padding: '10px 14px', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer',
        letterSpacing: '0.3px', boxShadow: '0 6px 20px rgba(212,175,55,0.12)'
    },
    ghostBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: 'transparent', color: '#ccc', border: '1px solid #333', borderRadius: '8px',
        padding: '9px 12px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer'
    },
    dangerBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: 'rgba(255,107,107,0.06)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.35)',
        borderRadius: '8px', padding: '9px 12px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer'
    },
    dangerIconBtn: {
        width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.35)',
        color: '#ff6b6b', borderRadius: '8px', cursor: 'pointer'
    },

    filtersRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
    searchBox: {
        flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '7px',
        background: '#0b0b0b', border: '1px solid #222', borderRadius: '8px', padding: '0 10px', height: '38px'
    },
    searchInput: {
        flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
        color: '#fff', fontSize: '0.7rem'
    },
    clearSearch: {
        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', color: '#666', cursor: 'pointer'
    },
    select: {
        background: '#0b0b0b', border: '1px solid #222', color: '#ccc', borderRadius: '8px',
        padding: '0 10px', height: '38px', fontSize: '0.66rem', outline: 'none', minWidth: '150px'
    },
    infoBanner: {
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px',
        background: 'rgba(255,187,51,0.06)', border: '1px solid rgba(255,187,51,0.25)',
        color: '#d8b04a', fontSize: '0.65rem', lineHeight: 1.45, marginBottom: '12px'
    },
    errorBanner: {
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)',
        color: '#ff9b9b', fontSize: '0.65rem', lineHeight: 1.45, marginBottom: '12px'
    },

    cardsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: '12px', marginBottom: '16px'
    },
    skeletonCard: {
        height: '238px', borderRadius: '12px', border: '1px solid #1c1c1c',
        background: 'linear-gradient(100deg, #0c0c0c 20%, #151515 40%, #0c0c0c 60%)',
        backgroundSize: '200% 100%'
    },
    card: {
        display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a',
        border: '1px solid #202020', borderRadius: '12px', cursor: 'pointer', outline: 'none'
    },
    cardCover: { position: 'relative', height: '130px', flexShrink: 0, background: '#111' },
    cardCoverImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.9 },
    cardCoverFallback: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 30% 20%, rgba(212,175,55,0.18), #0b0b0b 70%)'
    },
    cardCoverGradient: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.88) 100%)'
    },
    cardVisibilityGlobal: {
        position: 'absolute', top: '8px', left: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: '#d4af37', color: '#000', borderRadius: '999px', padding: '3px 7px',
        fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.5px'
    },
    cardVisibilityDojo: {
        position: 'absolute', top: '8px', left: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: 'rgba(0,0,0,0.65)', color: '#ccc', border: '1px solid #444', borderRadius: '999px',
        padding: '3px 7px', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.5px'
    },
    cardType: {
        position: 'absolute', bottom: '8px', left: '8px', color: '#eee', fontSize: '0.56rem',
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
        background: 'rgba(0,0,0,0.55)', border: '1px solid #333', borderRadius: '5px', padding: '2px 6px'
    },
    cardBody: { display: 'flex', flexDirection: 'column', gap: '7px', padding: '12px', flex: 1 },
    cardTitle: {
        margin: 0, color: '#d4af37', fontSize: '0.92rem', lineHeight: 1.25, fontWeight: 800,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
    },
    cardMeta: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    cardMetaItem: { display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#777', fontSize: '0.6rem' },
    cardAuthor: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' },
    cardAuthorAvatar: {
        width: '20px', height: '20px', flexShrink: 0, borderRadius: '50%', background: 'rgba(212,175,55,0.1)',
        border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', fontSize: '0.5rem',
        fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    cardAuthorName: {
        color: '#999', fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
    },
    cardFooter: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        borderTop: '1px solid #1c1c1c', paddingTop: '8px', marginTop: 'auto'
    },
    cardStats: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    cardStat: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#777', fontSize: '0.58rem' },
    cardStatGold: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#d4af37', fontSize: '0.58rem', fontWeight: 700 },
    cardActions: { display: 'flex', gap: '4px' },
    cardAction: {
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '6px', cursor: 'pointer'
    },

    emptyState: {
        textAlign: 'center', padding: '40px 18px', border: '1px dashed #2a2a2a', borderRadius: '14px',
        background: '#080808', marginBottom: '16px'
    },
    emptyIcon: {
        width: '64px', height: '64px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)',
        marginBottom: '12px'
    },
    emptyTitle: { margin: '0 0 6px 0', color: '#d4af37', fontSize: '1rem' },
    emptyText: { margin: '0 auto 14px', maxWidth: '480px', color: '#777', fontSize: '0.7rem', lineHeight: 1.5 },
    footerNote: {
        display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.6rem',
        padding: '10px 4px', borderTop: '1px solid #1a1a1a', lineHeight: 1.4
    },

    editorWrap: { display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '110px' },
    editorHeaderCard: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.1), #0a0a0a 48%)',
        border: '1px solid rgba(212,175,55,0.25)', borderRadius: '14px', padding: '16px'
    },
    eyebrow: {
        display: 'block', color: '#d4af37', fontSize: '0.56rem', fontWeight: 800,
        letterSpacing: '1.4px', marginBottom: '4px'
    },
    editorTitle: {
        margin: '0 0 5px 0', color: '#fff', fontSize: 'clamp(1.2rem, 3vw, 1.7rem)',
        lineHeight: 1.15, fontWeight: 800
    },
    editorHint: { margin: 0, maxWidth: '600px', color: '#777', fontSize: '0.72rem', lineHeight: 1.5 },
    durationBadge: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
        background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '10px'
    },
    durationValue: { display: 'block', color: '#d4af37', fontSize: '1rem', lineHeight: 1 },
    durationLabel: { display: 'block', color: '#666', fontSize: '0.5rem', letterSpacing: '0.6px', textTransform: 'uppercase' },

    formCard: {
        display: 'flex', flexDirection: 'column', gap: '10px', background: '#0b0b0b',
        border: '1px solid #202020', borderRadius: '12px', padding: '14px'
    },
    fieldLabel: {
        color: '#888', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase'
    },
    titleInput: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #2a2a2a',
        borderBottom: '2px solid #d4af37', borderRadius: '8px', color: '#fff',
        padding: '12px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontWeight: 700, outline: 'none'
    },
    metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    fieldLabelInline: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#777',
        fontSize: '0.57rem', fontWeight: 800, letterSpacing: '0.7px'
    },
    input: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #2a2a2a',
        borderRadius: '7px', color: '#fff', padding: '9px 10px', fontSize: '0.74rem', outline: 'none'
    },
    numberInput: {
        width: '70px', boxSizing: 'border-box', background: '#050505', border: '1px solid #2a2a2a',
        borderRadius: '7px', color: '#fff', padding: '9px 8px', fontSize: '0.74rem',
        textAlign: 'center', outline: 'none'
    },
    inlineInput: { display: 'flex', alignItems: 'center', gap: '6px' },
    unit: { color: '#777', fontSize: '0.58rem' },
    visibilityBox: {
        display: 'flex', flexDirection: 'column', gap: '7px', borderTop: '1px solid #1c1c1c',
        paddingTop: '10px', marginTop: '2px'
    },
    visibilityOptions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' },
    visibilityOption: {
        display: 'flex', alignItems: 'center', gap: '9px', textAlign: 'left', background: '#080808',
        border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '9px', padding: '10px 12px',
        cursor: 'pointer', fontSize: '0.65rem'
    },
    visibilityActive: {
        display: 'flex', alignItems: 'center', gap: '9px', textAlign: 'left', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '9px', padding: '10px 12px',
        cursor: 'pointer', fontSize: '0.65rem'
    },
    visibilityNote: { margin: '1px 0 0', color: '#777', fontSize: '0.64rem', lineHeight: 1.4 },

    templateSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
    sectionHeading: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px',
        flexWrap: 'wrap', marginBottom: '2px'
    },
    sectionTitle: { margin: 0, color: '#fff', fontSize: 'clamp(0.95rem, 2vw, 1.12rem)', fontWeight: 700 },
    templateGrid: {
        display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin'
    },
    templateCard: {
        flex: '0 0 205px', minWidth: '205px', maxWidth: '220px', display: 'flex', flexDirection: 'column',
        alignItems: 'stretch', gap: '4px', textAlign: 'left', background: '#0a0a0a',
        border: '1px solid #222', borderRadius: '10px', padding: '12px',
        cursor: 'pointer', transition: 'border-color .18s ease, transform .18s ease'
    },
    templateTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    templateIcon: {
        width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.22)'
    },
    templateDuration: { color: '#d4af37', fontSize: '0.65rem', fontWeight: 800 },
    templateName: { color: '#ddd', fontSize: '0.78rem', marginTop: '2px' },
    templateDetail: { color: '#777', fontSize: '0.62rem', lineHeight: 1.35, minHeight: '2.4em' },
    templateBlocks: { color: '#d4af37', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.4px', marginTop: '2px' },

    blocksSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
    totalPill: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#0b0b0b',
        border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', borderRadius: '999px',
        padding: '5px 9px', fontSize: '0.58rem', fontWeight: 800
    },
    durationProgressWrap: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' },
    durationProgressTrack: { flex: 1, height: '6px', background: '#151515', borderRadius: '999px', overflow: 'hidden' },
    durationProgressFill: { height: '100%', borderRadius: '999px', transition: 'width .2s ease, background .2s ease' },
    durationProgressText: { minWidth: '105px', textAlign: 'right', color: '#666', fontSize: '0.53rem' },
    blockList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    addBlockBtn: {
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: 'rgba(212,175,55,0.05)', border: '1px dashed rgba(212,175,55,0.35)',
        color: '#d4af37', padding: '12px', borderRadius: '10px', fontSize: '0.64rem',
        fontWeight: 800, cursor: 'pointer'
    },
    stickyEditorBar: {
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(920px, calc(100% - 20px))', zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        background: 'rgba(8,8,8,0.97)', border: '1px solid #2a2a2a', borderBottom: 'none',
        borderRadius: '12px 12px 0 0', padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', flexWrap: 'wrap'
    },
    stickyEditorInfo: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' },
    stickyEditorLabel: { color: '#666', fontSize: '0.48rem', letterSpacing: '0.8px' },
    stickyEditorValue: { color: '#d4af37', fontSize: '0.9rem' },
    stickyEditorBlocks: { color: '#666', fontSize: '0.52rem' },
    stickyEditorActions: { display: 'flex', gap: '7px', justifyContent: 'flex-end', flexWrap: 'wrap' },

    blockCard: {
        backgroundColor: '#0a0a0a', borderWidth: '1px', borderStyle: 'solid', borderColor: '#202020',
        borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: '#d4af37',
        borderRadius: '10px', overflow: 'hidden'
    },
    blockHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
        flexWrap: 'wrap', padding: '9px 10px', background: '#0d0d0d', borderBottom: '1px solid #1b1b1b'
    },
    blockHeadLeft: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '190px' },
    blockNumber: {
        width: '24px', height: '24px', flexShrink: 0, borderRadius: '7px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', fontSize: '0.56rem', fontWeight: 800
    },
    blockIcon: {
        width: '32px', height: '32px', flexShrink: 0, borderRadius: '8px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#080808', border: '1px solid #333'
    },
    blockHeadText: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
    blockTypeSelect: {
        background: 'transparent', border: 'none', color: '#ddd', fontSize: '0.74rem',
        fontWeight: 800, outline: 'none', cursor: 'pointer', padding: 0, maxWidth: '180px'
    },
    blockTypeHint: {
        color: '#666', fontSize: '0.55rem', whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: '220px'
    },
    blockHeadRight: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    minutesStepper: {
        display: 'flex', alignItems: 'center', gap: '3px', background: '#050505',
        border: '1px solid #2a2a2a', borderRadius: '7px', padding: '2px'
    },
    stepBtn: {
        width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '5px', cursor: 'pointer'
    },
    minutesInput: {
        width: '34px', background: 'transparent', border: 'none', color: '#fff',
        textAlign: 'center', fontSize: '0.74rem', outline: 'none'
    },
    minutesUnit: { color: '#666', fontSize: '0.46rem', marginRight: '2px' },
    blockActions: { display: 'flex', gap: '3px' },
    blockAction: {
        width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '5px', cursor: 'pointer'
    },
    blockBody: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' },
    blockTitleInput: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626',
        borderRadius: '7px', color: '#fff', padding: '8px 10px', fontSize: '0.74rem',
        fontWeight: 700, outline: 'none'
    },
    blockFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' },
    blockField: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
    blockFieldLabel: { color: '#777', fontSize: '0.54rem', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase' },
    textarea: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626',
        borderRadius: '7px', color: '#fff', padding: '8px 10px', fontSize: '0.72rem',
        lineHeight: 1.45, outline: 'none', resize: 'vertical', fontFamily: 'inherit'
    },
    intensityRow: {
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        borderTop: '1px solid #1b1b1b', paddingTop: '7px'
    },
    intensityChips: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    intensityChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent',
        border: '1px solid #2a2a2a', color: '#777', borderRadius: '999px', padding: '4px 8px',
        fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer'
    },
    intensityDot: { width: '6px', height: '6px', borderRadius: '50%' },

    detailLoading: {
        minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '10px', color: '#888', fontSize: '0.72rem', textAlign: 'center'
    },
    detailHero: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px',
        flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(212,175,55,0.1), #080808 48%)',
        border: '1px solid rgba(212,175,55,0.25)', borderRadius: '14px', padding: '16px', marginBottom: '12px'
    },
    detailHeroMain: { flex: 1, minWidth: '250px' },
    crumbBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent',
        border: 'none', color: '#777', fontSize: '0.56rem', fontWeight: 700, cursor: 'pointer',
        padding: '0 0 7px 0', letterSpacing: '0.6px'
    },
    detailBadges: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' },
    chip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0b0b0b',
        border: '1px solid #2a2a2a', color: '#999', borderRadius: '999px', padding: '3px 8px',
        fontSize: '0.58rem', fontWeight: 700
    },
    chipGlobal: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(212,175,55,0.12)',
        border: '1px solid rgba(212,175,55,0.5)', color: '#d4af37', borderRadius: '999px',
        padding: '3px 8px', fontSize: '0.54rem', fontWeight: 800
    },
    chipDojo: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0b0b0b',
        border: '1px solid #333', color: '#aaa', borderRadius: '999px', padding: '3px 8px',
        fontSize: '0.54rem', fontWeight: 800
    },
    chipLive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,77,77,0.12)',
        border: '1px solid rgba(255,77,77,0.4)', color: '#ff6b6b', borderRadius: '999px',
        padding: '3px 8px', fontSize: '0.52rem', fontWeight: 800
    },
    liveDot: {
        width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ff4d4d',
        display: 'inline-block', boxShadow: '0 0 0 3px rgba(255,77,77,0.14)'
    },
    detailTitle: {
        margin: '0 0 8px 0', color: '#fff', fontSize: 'clamp(1.4rem, 3.4vw, 2.1rem)',
        lineHeight: 1.1, letterSpacing: '-0.3px', fontWeight: 800
    },
    detailAuthorRow: {
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#888', fontSize: '0.6rem'
    },
    detailAvatar: {
        width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%', background: 'rgba(212,175,55,0.12)',
        border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', fontSize: '0.52rem',
        fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    detailAuthorName: { color: '#ccc', fontSize: '0.62rem', fontWeight: 600 },
    dot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#444' },
    detailMetaText: { color: '#777', fontSize: '0.62rem' },
    detailMetaGold: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#d4af37',
        fontSize: '0.64rem', fontWeight: 700
    },
    detailActions: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'flex-end', maxWidth: '430px' },

    globalBanner: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px',
        background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.22)',
        borderRadius: '10px', marginBottom: '12px'
    },
    globalBannerIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.22)'
    },
    globalBannerTitle: { display: 'block', color: '#d4af37', fontSize: '0.68rem', fontWeight: 800 },
    globalBannerText: { display: 'block', color: '#888', fontSize: '0.6rem', lineHeight: 1.4, marginTop: '2px' },

    sessionBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
        flexWrap: 'wrap', padding: '7px 10px', marginBottom: '10px', background: '#080808',
        border: '1px solid #222', borderLeft: '3px solid #d4af37', borderRadius: '8px'
    },
    sessionBarLeft: {
        display: 'flex', alignItems: 'center', gap: '6px', color: '#d4af37',
        fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.6px', flexWrap: 'wrap'
    },
    sessionBarMeta: { color: '#666', fontSize: '0.52rem', fontWeight: 400 },

    timerBar: {
        position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 70, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
        background: 'rgba(8,8,8,0.97)', borderWidth: '1px', borderStyle: 'solid',
        borderColor: 'rgba(212,175,55,0.45)',
        borderRadius: '10px', padding: '8px 10px', marginBottom: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)'
    },
    timerBarLeft: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '180px' },
    timerIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.3)'
    },
    timerBarText: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
    timerBlockLabel: { color: '#666', fontSize: '0.46rem', letterSpacing: '0.8px', fontWeight: 800 },
    timerBlockName: {
        color: '#eee', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', maxWidth: '230px'
    },
    timerPhase: { color: '#d4af37', fontSize: '0.48rem', fontWeight: 800, letterSpacing: '0.8px' },
    timerClockWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '88px' },
    timerClock: {
        color: '#d4af37', fontSize: 'clamp(1.55rem, 4vw, 2.4rem)', fontWeight: 900,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '1px'
    },
    timerClockLabel: { color: '#666', fontSize: '0.44rem', letterSpacing: '1px' },
    timerControls: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' },
    timerCtrlGold: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px',
        padding: '7px 9px', fontSize: '0.58rem', fontWeight: 800, cursor: 'pointer'
    },
    timerCtrl: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
        background: '#111', border: '1px solid #333', color: '#bbb', borderRadius: '6px',
        padding: '6px 8px', fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer'
    },
    timerCtrlDanger: {
        width: '31px', height: '31px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.35)',
        color: '#ff6b6b', borderRadius: '6px', cursor: 'pointer'
    },

    detailGrid: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.85fr)',
        gap: '12px', alignItems: 'start'
    },
    detailMain: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 },
    detailSide: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 },
    sectionCard: {
        display: 'flex', flexDirection: 'column', gap: '10px', background: '#0a0a0a',
        border: '1px solid #202020', borderRadius: '12px', padding: '14px'
    },
    sectionCardHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap'
    },
    planEmpty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '8px', padding: '24px', textAlign: 'center', color: '#777', fontSize: '0.66rem',
        border: '1px dashed #2a2a2a', borderRadius: '10px'
    },
    timeline: { display: 'flex', flexDirection: 'column' },
    timelineRow: { display: 'flex', gap: '8px' },
    timelineRail: { width: '26px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' },
    timelineDot: {
        width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%', border: '1px solid #333',
        background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.56rem', fontWeight: 800
    },
    timelineLine: { flex: 1, width: '1px', background: '#222', minHeight: '18px' },
    timelineCard: {
        flex: 1, minWidth: 0, padding: '10px', marginBottom: '10px', backgroundColor: '#0a0a0a',
        borderWidth: '1px', borderStyle: 'solid', borderColor: '#222', borderRadius: '10px',
        transition: 'border-color .2s ease, background-color .2s ease'
    },
    timelineHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap'
    },
    timelineTitleWrap: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1, minWidth: 0 },
    timelineTitle: { margin: 0, color: '#eee', fontSize: '0.82rem', lineHeight: 1.25, fontWeight: 700 },
    timelineMinutes: {
        color: '#d4af37', fontSize: '0.6rem', fontWeight: 800, background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.2)', padding: '1px 5px', borderRadius: '4px'
    },
    intensityBadge: {
        border: '1px solid', borderRadius: '999px', padding: '1px 5px', fontSize: '0.46rem', fontWeight: 700
    },
    timelineStart: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0,
        backgroundColor: '#111', border: '1px solid #333', color: '#d4af37', borderRadius: '6px',
        padding: '5px 8px', fontSize: '0.58rem', fontWeight: 800, cursor: 'pointer'
    },
    timelineFields: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', marginTop: '7px'
    },
    timelineField: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
    timelineFieldLabel: {
        color: '#666', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase'
    },
    timelineFieldText: { margin: 0, color: '#bbb', fontSize: '0.7rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' },

    sideCard: {
        display: 'flex', flexDirection: 'column', gap: '9px', background: '#0a0a0a',
        border: '1px solid #202020', borderRadius: '12px', padding: '12px'
    },
    sideCardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
    sideTitle: { margin: 0, color: '#ddd', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' },
    sideCount: {
        color: '#d4af37', fontSize: '0.56rem', fontWeight: 700, background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.2)', borderRadius: '999px', padding: '2px 7px'
    },
    attendanceProgress: { display: 'flex', alignItems: 'center', gap: '8px' },
    attendanceProgressTrack: {
        flex: 1, height: '6px', background: '#151515', borderRadius: '999px', overflow: 'hidden'
    },
    attendanceProgressFill: {
        height: '100%', background: '#d4af37', borderRadius: '999px', transition: 'width .2s ease'
    },
    attendancePercent: { color: '#d4af37', fontSize: '0.58rem', fontWeight: 800, minWidth: '30px', textAlign: 'right' },
    attendanceTools: { display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' },
    studentSearch: {
        flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', gap: '5px',
        background: '#050505', border: '1px solid #262626', borderRadius: '7px',
        padding: '0 8px', height: '30px'
    },
    studentSearchInput: {
        flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
        color: '#fff', fontSize: '0.68rem'
    },
    miniBtn: {
        background: '#111', border: '1px solid #2a2a2a', color: '#999', borderRadius: '6px',
        padding: '4px 7px', fontSize: '0.48rem', fontWeight: 800, cursor: 'pointer'
    },
    studentList: {
        display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '390px',
        overflowY: 'auto', paddingRight: '2px'
    },
    studentRow: {
        display: 'flex', alignItems: 'center', gap: '7px', background: '#080808',
        border: '1px solid #1e1e1e', borderRadius: '8px', padding: '6px 7px'
    },
    studentAvatar: {
        width: '28px', height: '28px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
        color: '#d4af37', fontSize: '0.56rem', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    studentAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    studentInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
    studentName: {
        color: '#ddd', fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis'
    },
    studentNote: {
        width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'transparent', border: 'none',
        borderBottom: '1px dashed #242424', color: '#888', fontSize: '0.6rem',
        padding: '1px 0', outline: 'none'
    },
    presentBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0,
        background: '#d4af37', color: '#000', border: '1px solid #d4af37', borderRadius: '6px',
        padding: '5px 6px', fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    absentBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0,
        background: '#111', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.35)',
        borderRadius: '6px', padding: '5px 6px', fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer'
    },
    attendanceEmpty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        padding: '18px', textAlign: 'center', color: '#666', fontSize: '0.64rem'
    },
    privatePanel: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        padding: '20px', textAlign: 'center', color: '#777', fontSize: '0.66rem', lineHeight: 1.45
    },
    privateIcon: {
        width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0b0b0b', border: '1px solid #2a2a2a'
    },
    photoButton: {
        width: '100%', display: 'block', padding: 0, border: '1px solid #2a2a2a',
        background: '#050505', borderRadius: '9px', overflow: 'hidden', cursor: 'pointer'
    },
    photoImg: { width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' },
    photoActions: { display: 'flex', gap: '6px' },
    photoActionBtn: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        background: '#111', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '6px',
        padding: '6px', fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer'
    },
    photoEmpty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '16px',
        textAlign: 'center', background: '#070707', border: '1px dashed #2a2a2a', borderRadius: '9px'
    },
    photoEmptyIcon: {
        width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)'
    },
    photoEmptyTitle: { color: '#ddd', fontSize: '0.7rem' },
    photoEmptyText: { margin: 0, color: '#777', fontSize: '0.62rem', lineHeight: 1.4 },

    feedbackBody: { display: 'flex', flexDirection: 'column', gap: '10px' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    starsRow: { display: 'flex', gap: '2px', alignItems: 'center' },
    starButton: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent',
        border: 'none', padding: '1px', cursor: 'pointer'
    },
    feedbackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' },
    feedbackReadonly: { display: 'flex', flexDirection: 'column', gap: '6px' },
    readonlyText: { margin: 0, color: '#999', fontSize: '0.7rem', lineHeight: 1.5 },

    commentsEmpty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        padding: '16px', color: '#666', fontSize: '0.6rem', textAlign: 'center'
    },
    commentsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    commentItem: {
        display: 'flex', gap: '8px', background: '#080808', border: '1px solid #1e1e1e',
        borderRadius: '8px', padding: '8px'
    },
    commentAvatar: {
        width: '28px', height: '28px', flexShrink: 0, borderRadius: '50%',
        background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
        color: '#d4af37', fontSize: '0.56rem', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    commentBody: { flex: 1, minWidth: 0 },
    commentHead: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' },
    commentAuthor: { color: '#ddd', fontSize: '0.66rem' },
    commentDojo: { color: '#666', fontSize: '0.54rem' },
    commentDate: { color: '#555', fontSize: '0.52rem', marginLeft: 'auto' },
    commentDelete: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent',
        border: 'none', color: '#666', padding: '2px', cursor: 'pointer'
    },
    commentText: { margin: '3px 0 0 0', color: '#bbb', fontSize: '0.7rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
    commentComposer: { display: 'flex', gap: '6px', alignItems: 'flex-end', marginTop: '2px' },
    sendBtn: {
        width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#d4af37', color: '#000', border: 'none',
        borderRadius: '7px', cursor: 'pointer'
    },
    commentHint: { margin: 0, color: '#555', fontSize: '0.54rem', lineHeight: 1.4 },

    modalOverlay: {
        position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '14px', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)'
    },
    modalCard: {
        width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto',
        background: '#0b0b0b', border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
        padding: '16px', boxSizing: 'border-box', boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
    },
    modalHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px'
    },
    modalTitle: { margin: 0, color: '#fff', fontSize: '1.05rem' },
    typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
    typeOption: {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px',
        textAlign: 'left', background: '#080808', border: '1px solid #222', borderRadius: '10px',
        padding: '11px', cursor: 'pointer'
    },
    typeOptionIcon: {
        width: '40px', height: '40px', borderRadius: '10px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#050505', border: '1px solid #333'
    },
    typeOptionName: { color: '#ddd', fontSize: '0.75rem' },
    typeOptionDesc: { color: '#777', fontSize: '0.6rem', lineHeight: 1.35 },
    typeOptionMinutes: { color: '#d4af37', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.4px' },
    photoModal: {
        position: 'relative', maxWidth: 'min(1100px, 96vw)', maxHeight: '92vh', display: 'flex'
    },
    photoModalImg: {
        maxWidth: '100%', maxHeight: '92vh', objectFit: 'contain', borderRadius: '10px',
        border: '1px solid rgba(212,175,55,0.35)'
    },
    modalClose: {
        position: 'absolute', top: '-12px', right: '-12px', width: '36px', height: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a',
        border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', borderRadius: '50%', cursor: 'pointer'
    }
};

const cssPlanner = `
    .planner-root *, .planner-root *::before, .planner-root *::after { box-sizing: border-box; }
    .planner-root { -webkit-tap-highlight-color: transparent; }
    .planner-root button, .planner-root input, .planner-root textarea, .planner-root select { font-family: inherit; }
    .planner-root button { transition: transform .12s ease, border-color .18s ease, background .18s ease, color .18s ease; }
    .planner-root button:active { transform: translateY(1px); }
    .planner-root button:focus-visible, .planner-root input:focus-visible, .planner-root textarea:focus-visible, .planner-root select:focus-visible {
        outline: 2px solid rgba(212,175,55,0.7) !important;
        outline-offset: 2px;
    }
    .planner-card { transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
    .planner-card:hover { transform: translateY(-2px); border-color: rgba(212,175,55,0.5) !important; box-shadow: 0 10px 30px rgba(0,0,0,0.45); }
    .planner-card:focus-visible { outline: 2px solid #d4af37; outline-offset: 2px; }
    .planner-skeleton { animation: plannerShimmer 1.4s infinite linear; }
    .planner-timer-urgent { animation: plannerPulse 1s infinite; color: #ff6b6b !important; }
    .planner-timer-bar { animation: plannerDrop .18s ease; }
    .planner-templates { scrollbar-color: #333 transparent; -webkit-overflow-scrolling: touch; }
    .planner-templates::-webkit-scrollbar { height: 6px; }
    .planner-templates::-webkit-scrollbar-thumb { background: #333; border-radius: 999px; }
    .planner-templates > button:hover { border-color: rgba(212,175,55,0.5); transform: translateY(-1px); }
    .planner-visibility-option strong { display: block; font-size: .7rem; letter-spacing: .4px; }
    .planner-visibility-option small { display: block; margin-top: 1px; font-size: .55rem; line-height: 1.3; font-weight: 400; opacity: .72; }
    @keyframes plannerShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes plannerPulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    @keyframes plannerDrop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 767px) {
        .planner-root { padding-left: calc(env(safe-area-inset-left, 0px) + 8px) !important; padding-right: calc(env(safe-area-inset-right, 0px) + 8px) !important; }
        .planner-hide-mobile { display: none !important; }
        .planner-detail-actions { justify-content: stretch !important; max-width: none !important; width: 100%; }
        .planner-detail-actions > button { flex: 1 1 calc(50% - 6px); }
        .planner-detail-actions > .planner-primary-action { flex: 1 1 100%; }
        .planner-timer-bar { gap: 6px; padding: 7px 8px; }
        .planner-timeline-head { align-items: flex-start !important; }
        .planner-block-head > div:first-child { flex: 1 1 100%; }
        .planner-block-head > div:last-child { width: 100%; justify-content: space-between; }
        .planner-global-banner { flex-direction: column; align-items: flex-start !important; }
        .planner-global-banner > div { width: 100%; }
        .planner-feedback-grid { grid-template-columns: 1fr !important; }
        .planner-type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 420px) {
        .planner-card { border-radius: 10px; }
    }
    @media (prefers-reduced-motion: reduce) {
        .planner-root *, .planner-root *::before, .planner-root *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
        }
    }
`;

