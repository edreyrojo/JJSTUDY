import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
    writeBatch,
    arrayUnion,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { buildAlumnosQuery, vincularInstructorASede } from '../utils/teamsService';
import { comprimirImagen } from '../utils/imageUtils';
import {
    TIPOS_SANGRE,
    GRADOS,
    PARENTESCOS,
    MONEDAS,
    METODOS_PAGO_DEFAULT,
    DIAS_SEMANA,
    fechaHoy,
    formatearFecha,
    formatearMoneda,
    calcularEdad,
    sumarMeses,
    crearConfigInicial,
    crearAlumnoVacio,
    normalizarAlumno,
    calcularEstadoPago,
    tieneContactoEmergencia,
    tieneAlertaMedica,
    resumenAlertaMedica,
    totalAsistencias,
    ultimaAsistencia,
    historialTecnicoOrdenado,
    historialPagosOrdenado,
    etiquetaHorario,
    estadisticasAlumnos
} from '../utils/gestionAlumnos';

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
        customClass: { popup: 'gold-border-alert' },
        didOpen: (toast) => {
            if (toast.parentElement) toast.parentElement.style.zIndex = '9999';
        }
    });
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

const unicos = (lista = []) => [...new Set(lista.map((item) => String(item).trim()).filter(Boolean))];

const GestionAlumnosPage = ({ onBack, usuario, sedeActual }) => {
    // --- RESPONSIVE ---
    const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
    const esMovil = ancho < 768;
    const esCompacto = ancho < 1024;

    useEffect(() => {
        const alRedimensionar = () => setAncho(window.innerWidth);
        window.addEventListener('resize', alRedimensionar);
        return () => window.removeEventListener('resize', alRedimensionar);
    }, []);

    // --- IDENTIDAD ---
    const teamId = usuario?.teamId || usuario?.academiaId || usuario?.uid || '';
    const rol = usuario?.rol || 'instructor';
    const esPropietario = rol === 'admin' || rol === 'propietario' || Boolean(usuario?.uid && teamId === usuario.uid);

    // --- DATOS ---
    const [alumnosActivos, setAlumnosActivos] = useState([]);
    const [alumnosArchivados, setAlumnosArchivados] = useState([]);
    const [config, setConfig] = useState(() => crearConfigInicial(sedeActual || {}));
    const [sedeFallbackId, setSedeFallbackId] = useState('');
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState('');
    const errorNotificadoRef = useRef(false);

    // --- FILTROS / LISTA ---
    const [verArchivados, setVerArchivados] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPago, setFiltroPago] = useState('todos');
    const [filtroPrograma, setFiltroPrograma] = useState('todos');
    const [soloAlertas, setSoloAlertas] = useState(false);

    // --- FORMULARIO DE ALUMNO ---
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [pasoForm, setPasoForm] = useState(1);
    const [nuevo, setNuevo] = useState(() => crearAlumnoVacio());
    const [guardandoAlumno, setGuardandoAlumno] = useState(false);
    const [procesandoFoto, setProcesandoFoto] = useState(false);

    // --- EXPEDIENTE ---
    const [alumnoSeleccionadoId, setAlumnoSeleccionadoId] = useState(null);
    const [tabDetalle, setTabDetalle] = useState('resumen');
    const [notasDetalle, setNotasDetalle] = useState('');
    const [guardandoNotas, setGuardandoNotas] = useState(false);

    // --- CONFIGURACIÓN DE SEDE ---
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [configDraft, setConfigDraft] = useState(() => crearConfigInicial(sedeActual || {}));
    const [tabConfig, setTabConfig] = useState('identidad');
    const [guardandoConfig, setGuardandoConfig] = useState(false);
    const [procesandoLogo, setProcesandoLogo] = useState(false);
    const [codigoVinculacion, setCodigoVinculacion] = useState('');
    const [vinculandoInstructor, setVinculandoInstructor] = useState(false);
    const [tempHora, setTempHora] = useState('19:00');
    const [tempNombreClase, setTempNombreClase] = useState('');
    const [tempProgramaClase, setTempProgramaClase] = useState('');
    const [tempDiasClase, setTempDiasClase] = useState(['Lunes', 'Miércoles', 'Viernes']);
    const [horarioEditandoIdx, setHorarioEditandoIdx] = useState(null);
    const [tempNuevoPrograma, setTempNuevoPrograma] = useState('');
    const [tempNuevoMetodo, setTempNuevoMetodo] = useState('');
    const horarioFormRef = useRef(null);

    // --- PAGOS ---
    const [alumnoPagoId, setAlumnoPagoId] = useState(null);
    const [pagoDraft, setPagoDraft] = useState({ fecha: fechaHoy(), monto: '', metodo: 'Efectivo', meses: 1, nota: '' });
    const [guardandoPago, setGuardandoPago] = useState(false);

    // --- DERIVADOS ---
    const sedeIdEfectiva = sedeActual?.id || usuario?.sedeId || sedeFallbackId || '';
    const todosAlumnos = useMemo(() => {
        const mapa = new Map();
        [...alumnosActivos, ...alumnosArchivados].forEach((alumno) => {
            if (alumno?.id) mapa.set(alumno.id, alumno);
        });
        return [...mapa.values()];
    }, [alumnosActivos, alumnosArchivados]);

    const alumnoActual = useMemo(
        () => todosAlumnos.find((alumno) => alumno.id === alumnoSeleccionadoId) || null,
        [todosAlumnos, alumnoSeleccionadoId]
    );

    const alumnoPago = useMemo(
        () => todosAlumnos.find((alumno) => alumno.id === alumnoPagoId) || null,
        [todosAlumnos, alumnoPagoId]
    );

    const stats = useMemo(() => estadisticasAlumnos(alumnosActivos, config), [alumnosActivos, config]);
    const visibles = useMemo(() => {
        const base = verArchivados ? alumnosArchivados : alumnosActivos;
        const texto = busqueda.trim().toLowerCase();
        return base.filter((alumno) => {
            if (soloAlertas && !tieneAlertaMedica(alumno) && tieneContactoEmergencia(alumno)) return false;
            // En archivados no aplicamos filtro de pago: un alumno archivado
            // siempre está "INACTIVO" y el filtro dejaría la lista vacía.
            if (!verArchivados && filtroPago !== 'todos') {
                const estado = calcularEstadoPago(alumno.fechaPago, alumno.activo);
                if (estado.key !== filtroPago) return false;
            }
            if (filtroPrograma !== 'todos' && !(alumno.programas || []).includes(filtroPrograma)) return false;
            if (!texto) return true;
            const contenido = [
                alumno.nombre,
                alumno.telefono,
                alumno.email,
                alumno.instagram,
                alumno.contactoEmergenciaNombre,
                ...(alumno.programas || [])
            ].join(' ').toLowerCase();
            return contenido.includes(texto);
        });
    }, [alumnosActivos, alumnosArchivados, verArchivados, busqueda, filtroPago, filtroPrograma, soloAlertas]);

    const programas = config.programas || [];
    const metodosPago = config.metodosPago?.length ? config.metodosPago : METODOS_PAGO_DEFAULT;
    const configDirty = useMemo(
        () => JSON.stringify(configDraft) !== JSON.stringify(config),
        [configDraft, config]
    );
    const nombreDojo = config.nombre || sedeActual?.nombre || 'Mi Dojo';
    const ciudadDojo = config.ciudad || sedeActual?.ciudad || '';
    const filtrosActivos = Boolean(busqueda.trim() || filtroPago !== 'todos' || filtroPrograma !== 'todos' || soloAlertas);

    // --- CARGA DE SEDE ---
    useEffect(() => {
        if (sedeActual?.id || usuario?.sedeId || !teamId) return undefined;
        let cancelado = false;
        const q = query(collection(db, 'sedes'), where('teamId', '==', teamId));
        getDocs(q)
            .then((snap) => {
                if (cancelado) return;
                // Si no existe una sede real, NO usamos el teamId como sedeId:
                // eso dejaba alumnos huérfanos que los instructores no veían.
                setSedeFallbackId(snap.empty ? '' : snap.docs[0].id);
            })
            .catch((error) => {
                console.error('Error al detectar la sede:', error);
                if (!cancelado) setSedeFallbackId('');
            });
        return () => { cancelado = true; };
    }, [sedeActual?.id, usuario?.sedeId, teamId]);

    useEffect(() => {
        if (!sedeIdEfectiva) return undefined;
        const unsub = onSnapshot(
            doc(db, 'sedes', sedeIdEfectiva),
            (snap) => {
                if (snap.exists()) {
                    setConfig(crearConfigInicial(snap.data()));
                }
            },
            (error) => {
                console.error('Error al cargar la sede:', error);
            }
        );
        return () => unsub();
    }, [sedeIdEfectiva]);

    // --- CARGA DE ALUMNOS ---
    useEffect(() => {
        if (!usuario || !teamId) {
            setCargando(false);
            return undefined;
        }

        const qActivos = buildAlumnosQuery({ rol, teamId, sedeId: sedeIdEfectiva, soloArchivados: false });
        const qArchivados = buildAlumnosQuery({ rol, teamId, sedeId: sedeIdEfectiva, soloArchivados: true });

        if (!qActivos || !qArchivados) {
            setErrorCarga('Tu cuenta no tiene un dojo asignado.');
            setCargando(false);
            return undefined;
        }

        const manejarError = (error) => {
            console.error('Error al cargar alumnos:', error);
            setErrorCarga('No se pudieron cargar los alumnos de este dojo.');
            setCargando(false);
            if (error?.code === 'permission-denied' && !errorNotificadoRef.current) {
                errorNotificadoRef.current = true;
                notify('No tienes permiso para ver estos alumnos.', 'error');
            }
        };

        const unsubActivos = onSnapshot(qActivos, (snap) => {
            setAlumnosActivos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setCargando(false);
            setErrorCarga('');
        }, manejarError);

        const unsubArchivados = onSnapshot(qArchivados, (snap) => {
            setAlumnosArchivados(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, manejarError);

        return () => {
            unsubActivos();
            unsubArchivados();
        };
    }, [usuario, teamId, rol, sedeIdEfectiva]);

    // --- BLOQUEO DE SCROLL CON MODALES ---
    const modalAbierto = mostrarForm || Boolean(alumnoSeleccionadoId) || editandoConfig || Boolean(alumnoPagoId);
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const anterior = document.body.style.overflow;
        if (modalAbierto) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = anterior; };
    }, [modalAbierto]);

    // --- HANDLERS DE LISTA / FILTROS ---
    const cambiarArchivados = () => {
        setVerArchivados((prev) => !prev);
        setFiltroPago('todos');
        setSoloAlertas(false);
    };

    const limpiarFiltros = () => {
        setBusqueda('');
        setFiltroPago('todos');
        setFiltroPrograma('todos');
        setSoloAlertas(false);
    };

    const filtrarPorPago = (key) => {
        setVerArchivados(false);
        setSoloAlertas(false);
        setFiltroPago(key);
    };

    const filtrarAlertas = () => {
        setVerArchivados(false);
        setFiltroPago('todos');
        setSoloAlertas(true);
    };

    // --- ABRIR / CERRAR FORMULARIO ---
    const abrirNuevoAlumno = () => {
        setNuevo(crearAlumnoVacio(config));
        setEditandoId(null);
        setPasoForm(1);
        setMostrarForm(true);
    };

    const abrirEditarAlumno = (alumno) => {
        if (!alumno) return;
        setNuevo(normalizarAlumno(alumno, config));
        setEditandoId(alumno.id);
        setPasoForm(1);
        setMostrarForm(true);
    };

    const cerrarFormulario = () => {
        if (guardandoAlumno) return;
        setMostrarForm(false);
        setEditandoId(null);
        setPasoForm(1);
        setNuevo(crearAlumnoVacio(config));
    };

    const actualizarNuevo = (campo, valor) => {
        setNuevo((prev) => {
            const siguiente = { ...prev, [campo]: valor };
            if (campo === 'fechaNacimiento') siguiente.edad = calcularEdad(valor);
            return siguiente;
        });
    };

    const togglePrograma = (programa) => {
        setNuevo((prev) => {
            const actuales = prev.programas || [];
            return {
                ...prev,
                programas: actuales.includes(programa)
                    ? actuales.filter((p) => p !== programa)
                    : [...actuales, programa]
            };
        });
    };

    const toggleHorario = (etiqueta) => {
        setNuevo((prev) => {
            const actuales = prev.horarios || [];
            return {
                ...prev,
                horarios: actuales.includes(etiqueta)
                    ? actuales.filter((h) => h !== etiqueta)
                    : [...actuales, etiqueta]
            };
        });
    };

    const validarPaso = (paso) => {
        if (paso === 1 && !nuevo.nombre.trim()) {
            notify('El nombre del alumno es obligatorio.', 'error');
            return false;
        }
        if (paso === 2) {
            const tieneNombre = Boolean(nuevo.contactoEmergenciaNombre.trim());
            const tieneTelefono = Boolean(nuevo.contactoEmergenciaTel.trim());
            if (tieneNombre !== tieneTelefono) {
                notify('Completa nombre y teléfono del contacto de emergencia.', 'error');
                return false;
            }
        }
        if (paso === 4 && !nuevo.fechaPago) {
            notify('Indica la fecha del próximo pago.', 'error');
            return false;
        }
        if (paso === 4 && nuevo.montoMensualidad !== '' && Number(nuevo.montoMensualidad) < 0) {
            notify('El monto de la mensualidad no puede ser negativo.', 'error');
            return false;
        }
        return true;
    };

    const siguientePaso = () => {
        if (!validarPaso(pasoForm)) return;
        setPasoForm((prev) => Math.min(4, prev + 1));
        setTimeout(() => document.getElementById('gestion-form-body')?.scrollTo({ top: 0, behavior: 'smooth' }), 30);
    };

    const pasoAnterior = () => {
        setPasoForm((prev) => Math.max(1, prev - 1));
        setTimeout(() => document.getElementById('gestion-form-body')?.scrollTo({ top: 0, behavior: 'smooth' }), 30);
    };

    const handleFotoChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setProcesandoFoto(true);
        try {
            const base64 = await comprimirImagen(file, { maxDimension: 720, quality: 0.74, maxBytes: 320000 });
            setNuevo((prev) => ({ ...prev, fotoBase64: base64 }));
        } catch (error) {
            notify(error?.message || 'No se pudo procesar la foto.', 'error');
        } finally {
            setProcesandoFoto(false);
        }
    };

    const guardarAlumno = async () => {
        if (guardandoAlumno) return;
        if (!nuevo.nombre.trim()) {
            setPasoForm(1);
            return notify('El nombre del alumno es obligatorio.', 'error');
        }
        if (!nuevo.fechaPago) {
            setPasoForm(4);
            return notify('Indica la fecha del próximo pago.', 'error');
        }
        const tieneNombreEmergencia = Boolean(String(nuevo.contactoEmergenciaNombre || '').trim());
        const tieneTelefonoEmergencia = Boolean(String(nuevo.contactoEmergenciaTel || '').trim());
        if (tieneNombreEmergencia !== tieneTelefonoEmergencia) {
            setPasoForm(2);
            return notify('Completa nombre y teléfono del contacto de emergencia.', 'error');
        }

        setGuardandoAlumno(true);
        try {
            const idSede = sedeIdEfectiva || '';
            if (!idSede) {
                notify('Tu cuenta no tiene una sede asignada. Pide a un administrador que la cree antes de registrar alumnos.', 'error');
                return;
            }
            const edadFinal = nuevo.fechaNacimiento ? calcularEdad(nuevo.fechaNacimiento) : nuevo.edad;
            const payload = {
                ...nuevo,
                nombre: nuevo.nombre.trim(),
                edad: edadFinal,
                programas: unicos(nuevo.programas || []),
                horarios: unicos(nuevo.horarios || []),
                montoMensualidad: nuevo.montoMensualidad === '' ? '' : Math.max(0, Number(nuevo.montoMensualidad) || 0),
                diaPago: (nuevo.fechaPago || '').split('-')[2] || '',
                activo: nuevo.activo !== false,
                teamId,
                sedeId: idSede,
                academiaId: teamId,
                ultimaActualizacion: new Date().toISOString()
            };

            Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

            if (editandoId) {
                const editable = { ...payload };
                ['id', 'asistencias', 'historialTecnico', 'historialPagos', 'ultimoPago', 'fechaRegistro', 'registradoPor'].forEach((campo) => delete editable[campo]);
                await setDoc(doc(db, 'alumnos', editandoId), editable, { merge: true });
                setMostrarForm(false);
                setEditandoId(null);
                setNuevo(crearAlumnoVacio(config));
                notify('Expediente actualizado');
            } else {
                const ref = await addDoc(collection(db, 'alumnos'), {
                    ...payload,
                    fechaRegistro: new Date().toISOString(),
                    registradoPor: usuario?.uid || ''
                });
                setMostrarForm(false);
                setNuevo(crearAlumnoVacio(config));
                setAlumnoSeleccionadoId(ref.id);
                setTabDetalle('resumen');
                notify('Alumno registrado');
            }
        } catch (error) {
            console.error('Error al guardar alumno:', error);
            notify(
                error?.code === 'permission-denied'
                    ? 'No tienes permiso para guardar este alumno.'
                    : 'No se pudo guardar el alumno.',
                'error'
            );
        } finally {
            setGuardandoAlumno(false);
        }
    };

    // --- EXPEDIENTE / ARCHIVO ---
    const abrirDetalle = (alumno) => {
        if (!alumno) return;
        setAlumnoSeleccionadoId(alumno.id);
        setTabDetalle('resumen');
        setNotasDetalle(alumno.notasTecnicas || '');
    };

    const cerrarDetalle = () => {
        setAlumnoSeleccionadoId(null);
        setTabDetalle('resumen');
        setNotasDetalle('');
    };

    const guardarNotasDetalle = async () => {
        if (!alumnoActual || guardandoNotas) return;
        setGuardandoNotas(true);
        try {
            await updateDoc(doc(db, 'alumnos', alumnoActual.id), {
                notasTecnicas: notasDetalle,
                ultimaActualizacion: new Date().toISOString()
            });
            notify('Bitácora técnica actualizada');
        } catch (error) {
            console.error('Error al guardar notas:', error);
            notify('No se pudo guardar la bitácora.', 'error');
        } finally {
            setGuardandoNotas(false);
        }
    };

    const archivarAlumno = async (alumno) => {
        if (!alumno) return;
        const res = await Swal.fire({
            title: alumno.activo !== false ? '¿Archivar alumno?' : '¿Reactivar alumno?',
            text: alumno.activo !== false
                ? 'Pasará al archivo y dejará de aparecer en la lista activa.'
                : 'Volverá a la lista de alumnos activos.',
            icon: 'warning',
            showCancelButton: true,
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar'
        });
        if (!res.isConfirmed) return;
        try {
            await updateDoc(doc(db, 'alumnos', alumno.id), {
                activo: alumno.activo === false,
                ultimaActualizacion: new Date().toISOString()
            });
            notify(alumno.activo !== false ? 'Alumno archivado' : 'Alumno reactivado');
        } catch (error) {
            console.error('Error al archivar alumno:', error);
            notify('No se pudo actualizar el estado del alumno.', 'error');
        }
    };

    // --- PAGOS ---
    const abrirPago = (alumno) => {
        if (!alumno) return;
        setAlumnoPagoId(alumno.id);
        setPagoDraft({
            fecha: fechaHoy(),
            monto: (alumno.montoMensualidad !== '' && alumno.montoMensualidad != null)
                ? alumno.montoMensualidad
                : (config.mensualidadBase ?? ''),
            metodo: alumno.metodoPagoPreferido || metodosPago[0] || 'Efectivo',
            meses: 1,
            nota: ''
        });
    };

    const cerrarPago = () => {
        if (guardandoPago) return;
        setAlumnoPagoId(null);
    };

    const guardarPago = async () => {
        if (!alumnoPago || guardandoPago) return;
        const monto = Number(pagoDraft.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            return notify('Ingresa un monto válido.', 'error');
        }
        const meses = Math.min(12, Math.max(1, Number(pagoDraft.meses) || 1));
        const fechaBase = alumnoPago.fechaPago || fechaHoy();
        const nuevaFecha = sumarMeses(fechaBase, meses);
        const registro = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fecha: pagoDraft.fecha || fechaHoy(),
            monto,
            metodo: pagoDraft.metodo || 'Efectivo',
            meses,
            nota: pagoDraft.nota.trim(),
            periodo: fechaBase,
            registradoPor: usuario?.uid || '',
            registradoEn: new Date().toISOString()
        };

        setGuardandoPago(true);
        try {
            await updateDoc(doc(db, 'alumnos', alumnoPago.id), {
                fechaPago: nuevaFecha,
                diaPago: nuevaFecha.split('-')[2] || '',
                ultimoPago: { fecha: registro.fecha, monto, metodo: registro.metodo },
                metodoPagoPreferido: registro.metodo,
                historialPagos: arrayUnion(registro),
                ultimaActualizacion: new Date().toISOString()
            });
            setAlumnoPagoId(null);
            notify('Pago registrado');
        } catch (error) {
            console.error('Error al registrar pago:', error);
            notify('No se pudo registrar el pago.', 'error');
        } finally {
            setGuardandoPago(false);
        }
    };

    // --- CONFIGURACIÓN DE SEDE ---
    const abrirConfig = () => {
        const base = crearConfigInicial(config);
        setConfigDraft(base);
        setTabConfig('identidad');
        setCodigoVinculacion('');
        setTempNuevoPrograma('');
        setTempNuevoMetodo('');
        setTempNombreClase('');
        setTempHora('19:00');
        setTempDiasClase(['Lunes', 'Miércoles', 'Viernes']);
        setTempProgramaClase(base.programas?.[0] || '');
        setHorarioEditandoIdx(null);
        setEditandoConfig(true);
    };

    const cerrarConfig = () => {
        if (guardandoConfig) return;
        setEditandoConfig(false);
    };

    const handleLogoChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setProcesandoLogo(true);
        try {
            const base64 = await comprimirImagen(file, { maxDimension: 600, quality: 0.76, maxBytes: 380000 });
            setConfigDraft((prev) => ({ ...prev, logoBase64: base64 }));
        } catch (error) {
            notify(error?.message || 'No se pudo procesar el logo.', 'error');
        } finally {
            setProcesandoLogo(false);
        }
    };

    const agregarPrograma = () => {
        const programa = tempNuevoPrograma.trim();
        if (!programa) return;
        if ((configDraft.programas || []).some((p) => p.toLowerCase() === programa.toLowerCase())) {
            return notify('Ese programa ya existe.', 'error');
        }
        setConfigDraft((prev) => ({ ...prev, programas: [...(prev.programas || []), programa] }));
        setTempNuevoPrograma('');
    };

    const eliminarPrograma = (programa) => {
        setConfigDraft((prev) => ({
            ...prev,
            programas: (prev.programas || []).filter((p) => p !== programa)
        }));
    };

    const toggleDiaTemp = (dia) => {
        setTempDiasClase((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
    };

    const limpiarFormularioHorario = () => {
        setTempNombreClase('');
        setTempHora('19:00');
        setTempDiasClase(['Lunes', 'Miércoles', 'Viernes']);
        setHorarioEditandoIdx(null);
        setTempProgramaClase(configDraft.programas?.[0] || '');
    };

    const guardarHorario = () => {
        if (!tempNombreClase.trim()) return notify('Escribe el nombre de la clase.', 'error');
        if (!tempDiasClase.length) return notify('Selecciona al menos un día.', 'error');
        const horario = {
            hora: tempHora || '19:00',
            programa: tempProgramaClase || configDraft.programas?.[0] || 'BJJ',
            nombre: tempNombreClase.trim(),
            dias: [...tempDiasClase]
        };
        setConfigDraft((prev) => {
            const horarios = [...(prev.horarios || [])];
            if (horarioEditandoIdx !== null) horarios[horarioEditandoIdx] = horario;
            else horarios.push(horario);
            horarios.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
            return { ...prev, horarios };
        });
        limpiarFormularioHorario();
        notify(horarioEditandoIdx !== null ? 'Horario actualizado' : 'Horario agregado');
    };

    const editarHorario = (horario, indice) => {
        setTempHora(horario.hora || '19:00');
        setTempNombreClase(horario.nombre || '');
        setTempProgramaClase(horario.programa || configDraft.programas?.[0] || '');
        setTempDiasClase(horario.dias || []);
        setHorarioEditandoIdx(indice);
        setTimeout(() => horarioFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };

    const eliminarHorario = (indice) => {
        setConfigDraft((prev) => ({
            ...prev,
            horarios: (prev.horarios || []).filter((_, i) => i !== indice)
        }));
        if (horarioEditandoIdx === indice) limpiarFormularioHorario();
    };

    const agregarMetodo = () => {
        const metodo = tempNuevoMetodo.trim();
        if (!metodo) return;
        if ((configDraft.metodosPago || []).some((m) => m.toLowerCase() === metodo.toLowerCase())) {
            return notify('Ese método ya existe.', 'error');
        }
        setConfigDraft((prev) => ({ ...prev, metodosPago: [...(prev.metodosPago || []), metodo] }));
        setTempNuevoMetodo('');
    };

    const eliminarMetodo = (metodo) => {
        setConfigDraft((prev) => ({
            ...prev,
            metodosPago: (prev.metodosPago || []).filter((m) => m !== metodo)
        }));
    };

    const guardarConfig = async () => {
        if (guardandoConfig) return;
        if (!sedeIdEfectiva) return notify('No hay una sede asignada para guardar.', 'error');
        if (!configDraft.nombre.trim()) return notify('El nombre del dojo es obligatorio.', 'error');

        setGuardandoConfig(true);
        try {
            const payload = {
                ...configDraft,
                nombre: configDraft.nombre.trim(),
                nombreSede: configDraft.nombre.trim(),
                programas: unicos(configDraft.programas || []),
                metodosPago: unicos(configDraft.metodosPago || []),
                horarios: [...(configDraft.horarios || [])].sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
                mensualidadBase: configDraft.mensualidadBase === '' ? '' : Math.max(0, Number(configDraft.mensualidadBase) || 0),
                diaVencimiento: Math.min(31, Math.max(1, Number(configDraft.diaVencimiento) || 1)),
                ultimaActualizacion: new Date().toISOString()
            };
            // Si el logo ya estaba guardado y es gigante, no lo reescribimos:
            // así el guardado de la sede no choca con el límite de 1 MB.
            if (
                payload.logoBase64 &&
                payload.logoBase64.length > 500000 &&
                payload.logoBase64 === config.logoBase64
            ) {
                delete payload.logoBase64;
            }
            const batch = writeBatch(db);
            batch.set(doc(db, 'sedes', sedeIdEfectiva), payload, { merge: true });

            // Mantenemos el mapeo privado código → sede al día (atómico con la sede).
            const codigo = String(payload.codigoAcceso || '').trim().toUpperCase();
            if (codigo) {
                batch.set(doc(db, 'codigosAcceso', codigo), {
                    sedeId: sedeIdEfectiva,
                    teamId: configDraft.teamId || teamId,
                    nombreSede: payload.nombre,
                    actualizadoEn: new Date().toISOString()
                }, { merge: true });
            }

            await batch.commit();

            setConfig(crearConfigInicial(payload));
            setEditandoConfig(false);
            notify('Configuración del dojo guardada');
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            notify(
                error?.code === 'permission-denied'
                    ? 'No tienes permiso para editar la sede.'
                    : 'No se pudo guardar la configuración.',
                'error'
            );
        } finally {
            setGuardandoConfig(false);
        }
    };

    const copiarCodigo = async () => {
        if (!config.codigoAcceso) return;
        const copiado = await copiarTexto(config.codigoAcceso);
        notify(copiado ? 'Código copiado' : 'No se pudo copiar el código', copiado ? 'success' : 'error');
    };

    const vincularInstructor = async () => {
        if (!codigoVinculacion.trim()) return notify('Pega un código válido.', 'error');
        setVinculandoInstructor(true);
        try {
            const result = await vincularInstructorASede(usuario.uid, codigoVinculacion);
            notify(`Vinculado a ${result.nombreSede || 'la sede'} correctamente.`);
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            notify(error.message || 'No se pudo vincular la sede.', 'error');
        } finally {
            setVinculandoInstructor(false);
        }
    };

    // --- RENDER ---
    return (
        <div style={s.root} className="gestion-root">
            <style>{cssGestion}</style>

            <div style={s.shell}>
                <header style={s.header}>
                    <div style={s.headerLeft}>
                        <button type="button" onClick={onBack} style={s.backBtn} title="Volver" aria-label="Volver">
                            <VaultIcon name="chevronLeft" size={16} />
                        </button>
                        <div style={s.titleGroup}>
                            <span style={s.titleIcon} className="gestion-title-icon"><VaultIcon name="users" size={18} /></span>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={s.title}>GESTIÓN DE ALUMNOS</h1>
                                <p style={s.subtitle} className="gestion-subtitle">Administra tu dojo, tu equipo y tu operación</p>
                            </div>
                        </div>
                    </div>
                    <div style={s.headerActions}>
                        <button
                            type="button"
                            onClick={abrirConfig}
                            style={s.iconBtn}
                            title="Configuración del dojo"
                            aria-label="Configuración del dojo"
                        >
                            <VaultIcon name="settings" size={16} />
                        </button>
                        <button type="button" onClick={abrirNuevoAlumno} style={s.goldBtn} title="Nuevo alumno" aria-label="Nuevo alumno">
                            <VaultIcon name="plus" size={15} />
                            {!esMovil && 'NUEVO ALUMNO'}
                        </button>
                    </div>
                </header>

                <section style={s.dojoHero}>
                    <div style={s.dojoIdentity}>
                        <span style={s.dojoLogo}>
                            {config.logoBase64
                                ? <img src={config.logoBase64} alt={`Logo de ${nombreDojo}`} style={s.dojoLogoImg} />
                                : <VaultIcon name="dojo" size={24} color="#d4af37" />}
                        </span>
                        <div style={s.dojoText}>
                            <div style={s.dojoNameRow}>
                                <h2 style={s.dojoName}>{nombreDojo}</h2>
                                {esPropietario && (
                                    <span style={s.ownerBadge}>
                                        <VaultIcon name="shield" size={10} /> PROPIETARIO
                                    </span>
                                )}
                            </div>
                            <span style={s.dojoMeta}>
                                {[ciudadDojo, config.direccion].filter(Boolean).join(' · ') || 'Configura la ubicación de tu dojo'}
                            </span>
                            <div style={s.dojoContactRow}>
                                {config.telefono && (
                                    <a href={`tel:${config.telefono}`} style={s.dojoContact}>
                                        <VaultIcon name="phone" size={11} /> {config.telefono}
                                    </a>
                                )}
                                {config.email && (
                                    <a href={`mailto:${config.email}`} style={s.dojoContact}>
                                        <VaultIcon name="mail" size={11} /> {config.email}
                                    </a>
                                )}
                                {config.instagram && (
                                    <span style={s.dojoContact}>
                                        <VaultIcon name="camera" size={11} /> {config.instagram}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={s.dojoHeroActions}>
                        <span style={s.heroStat}>
                            <strong style={s.heroStatValue}>{stats.activos}</strong>
                            <small style={s.heroStatLabel}>ALUMNOS ACTIVOS</small>
                        </span>
                        <button type="button" onClick={abrirConfig} style={s.ghostBtn}>
                            <VaultIcon name="settings" size={14} /> CONFIGURAR
                        </button>
                    </div>
                </section>

                <section style={s.statsGrid}>
                    <StatCard icon="users" label="Alumnos activos" value={stats.activos} onClick={() => { setVerArchivados(false); limpiarFiltros(); }} />
                    <StatCard icon="checkCircle" color="#4CAF50" label="Al día" value={stats.aldia} onClick={() => filtrarPorPago('aldia')} />
                    <StatCard icon="clock" color="#ffbb33" label="Por vencer" value={stats.porVencer} onClick={() => filtrarPorPago('pronto')} />
                    <StatCard icon="alert" color="#ff6b6b" label="Atrasados" value={stats.atrasados} onClick={() => filtrarPorPago('atrasado')} />
                </section>

                <section style={s.financeCard}>
                    <div style={s.financeHead}>
                        <h3 style={s.financeTitle}><VaultIcon name="wallet" size={16} /> Finanzas del mes</h3>
                        {stats.conMensualidad === 0 ? (
                            <button type="button" onClick={() => { abrirConfig(); setTabConfig('cobros'); }} style={s.linkBtn}>
                                CONFIGURAR MENSUALIDAD
                            </button>
                        ) : (
                            <span style={s.financeHint}>{stats.conMensualidad} alumnos con mensualidad</span>
                        )}
                    </div>
                    <div style={s.financeMetrics}>
                        <div style={s.financeMetric}>
                            <span style={s.financeLabel}>ESPERADO</span>
                            <strong style={s.financeValue}>{formatearMoneda(stats.esperadoMes, config.moneda)}</strong>
                        </div>
                        <div style={s.financeMetric}>
                            <span style={s.financeLabel}>COBRADO</span>
                            <strong style={{ ...s.financeValue, color: '#4CAF50' }}>{formatearMoneda(stats.cobradoMes, config.moneda)}</strong>
                        </div>
                        <div style={s.financeMetric}>
                            <span style={s.financeLabel}>PENDIENTE EST.</span>
                            <strong style={{ ...s.financeValue, color: stats.pendienteEstimado > 0 ? '#ff6b6b' : '#777' }}>
                                {formatearMoneda(stats.pendienteEstimado, config.moneda)}
                            </strong>
                        </div>
                    </div>
                    <div style={s.financeProgressTrack}>
                        <div
                            style={{
                                ...s.financeProgressFill,
                                width: `${stats.esperadoMes > 0 ? Math.min(100, Math.round((stats.cobradoMes / stats.esperadoMes) * 100)) : 0}%`
                            }}
                        />
                    </div>
                </section>

                {(stats.alertas > 0 || stats.sinContacto > 0) && (
                    <section style={s.safetyBanner}>
                        <span style={s.safetyIcon}><VaultIcon name="medical" size={18} color="#ffbb33" /></span>
                        <div style={s.safetyText}>
                            <strong>Salud y emergencia</strong>
                            <span>
                                {stats.alertas > 0 ? `${stats.alertas} alumno${stats.alertas === 1 ? '' : 's'} con alerta médica` : 'Sin alertas médicas'}
                                {' · '}
                                {stats.sinContacto > 0 ? `${stats.sinContacto} sin contacto de emergencia` : 'Contactos completos'}
                            </span>
                        </div>
                        <button type="button" onClick={filtrarAlertas} style={s.safetyBtn}>REVISAR</button>
                    </section>
                )}

                <section style={s.toolbar}>
                    <div style={s.searchBox}>
                        <VaultIcon name="search" size={14} color="#777" />
                        <input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre, teléfono, programa..."
                            style={s.searchInput}
                        />
                        {busqueda && (
                            <button type="button" onClick={() => setBusqueda('')} style={s.clearSearch} aria-label="Limpiar búsqueda">
                                <VaultIcon name="close" size={12} />
                            </button>
                        )}
                    </div>

                    <div className="gestion-filters" style={s.filterRow}>
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'aldia', label: 'Al día' },
                            { key: 'pronto', label: 'Por vencer' },
                            { key: 'atrasado', label: 'Atrasados' },
                            { key: 'sinfecha', label: 'Sin fecha' }
                        ].map((filtro) => (
                            <button
                                key={filtro.key}
                                type="button"
                                onClick={() => setFiltroPago(filtro.key)}
                                style={filtroPago === filtro.key ? s.filterChipActive : s.filterChip}
                            >
                                {filtro.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={cambiarArchivados}
                            style={verArchivados ? s.filterChipActive : s.filterChip}
                        >
                            <VaultIcon name={verArchivados ? 'undo' : 'folder'} size={12} />
                            {verArchivados ? 'Activos' : 'Archivados'}
                        </button>
                        <select
                            value={filtroPrograma}
                            onChange={(e) => setFiltroPrograma(e.target.value)}
                            style={s.select}
                            aria-label="Filtrar por programa"
                        >
                            <option value="todos">Todos los programas</option>
                            {programas.map((programa) => <option key={programa} value={programa}>{programa}</option>)}
                        </select>
                        {filtrosActivos && (
                            <button type="button" onClick={limpiarFiltros} style={s.clearFilters}>
                                LIMPIAR
                            </button>
                        )}
                    </div>

                    <div style={s.resultCount}>
                        <span>{visibles.length} {visibles.length === 1 ? 'alumno' : 'alumnos'}</span>
                        {soloAlertas && <span style={s.alertFilterTag}><VaultIcon name="medical" size={10} /> SALUD</span>}
                    </div>
                </section>

                {errorCarga && (
                    <div style={s.errorBanner}>
                        <VaultIcon name="alert" size={14} color="#ff6b6b" />
                        <span>{errorCarga}</span>
                    </div>
                )}

                {cargando ? (
                    <div style={s.cardsGrid}>
                        {[1, 2, 3, 4].map((n) => <div key={n} className="gestion-skeleton" style={s.skeletonCard} />)}
                    </div>
                ) : visibles.length === 0 ? (
                    <EmptyState
                        archivados={verArchivados}
                        filtros={filtrosActivos}
                        onLimpiar={limpiarFiltros}
                        onNuevo={abrirNuevoAlumno}
                    />
                ) : esCompacto ? (
                    <div style={s.cardsGrid}>
                        {visibles.map((alumno) => (
                            <AlumnoCard
                                key={alumno.id}
                                alumno={alumno}
                                moneda={config.moneda}
                                onAbrir={() => abrirDetalle(alumno)}
                                onEditar={() => abrirEditarAlumno(alumno)}
                                onPagar={() => abrirPago(alumno)}
                                onArchivar={() => archivarAlumno(alumno)}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={s.tableWrap}>
                        <div style={s.tableHead}>
                            <span>ALUMNO</span>
                            <span>PROGRAMAS</span>
                            <span>PAGO</span>
                            <span>ASISTENCIA</span>
                            <span>EMERGENCIA</span>
                            <span style={{ textAlign: 'right' }}>ACCIONES</span>
                        </div>
                        <div style={s.tableBody}>
                            {visibles.map((alumno) => (
                                <FilaAlumno
                                    key={alumno.id}
                                    alumno={alumno}
                                    moneda={config.moneda}
                                    onAbrir={() => abrirDetalle(alumno)}
                                    onEditar={() => abrirEditarAlumno(alumno)}
                                    onPagar={() => abrirPago(alumno)}
                                    onArchivar={() => archivarAlumno(alumno)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <footer style={s.footerNote}>
                    <VaultIcon name="shield" size={13} color="#666" />
                    <span>Los datos médicos y de emergencia solo son visibles para el staff de tu dojo. Úsalos para actuar rápido cuando importa.</span>
                </footer>
            </div>

            {mostrarForm && (
                <FormularioAlumno
                    nuevo={nuevo}
                    actualizarNuevo={actualizarNuevo}
                    editandoId={editandoId}
                    pasoForm={pasoForm}
                    setPasoForm={setPasoForm}
                    siguientePaso={siguientePaso}
                    pasoAnterior={pasoAnterior}
                    guardarAlumno={guardarAlumno}
                    guardandoAlumno={guardandoAlumno}
                    cerrarFormulario={cerrarFormulario}
                    procesandoFoto={procesandoFoto}
                    handleFotoChange={handleFotoChange}
                    programas={programas}
                    horarios={config.horarios || []}
                    config={config}
                    togglePrograma={togglePrograma}
                    toggleHorario={toggleHorario}
                />
            )}

            {alumnoActual && (
                <DetalleAlumno
                    alumno={alumnoActual}
                    config={config}
                    tabDetalle={tabDetalle}
                    setTabDetalle={setTabDetalle}
                    cerrarDetalle={cerrarDetalle}
                    abrirEditar={() => abrirEditarAlumno(alumnoActual)}
                    abrirPago={() => abrirPago(alumnoActual)}
                    archivar={() => archivarAlumno(alumnoActual)}
                    notasDetalle={notasDetalle}
                    setNotasDetalle={setNotasDetalle}
                    guardarNotasDetalle={guardarNotasDetalle}
                    guardandoNotas={guardandoNotas}
                />
            )}

            {editandoConfig && (
                <ConfiguracionSede
                    configDraft={configDraft}
                    setConfigDraft={setConfigDraft}
                    tabConfig={tabConfig}
                    setTabConfig={setTabConfig}
                    cerrarConfig={cerrarConfig}
                    guardarConfig={guardarConfig}
                    guardandoConfig={guardandoConfig}
                    configDirty={configDirty}
                    procesandoLogo={procesandoLogo}
                    handleLogoChange={handleLogoChange}
                    tempNuevoPrograma={tempNuevoPrograma}
                    setTempNuevoPrograma={setTempNuevoPrograma}
                    agregarPrograma={agregarPrograma}
                    eliminarPrograma={eliminarPrograma}
                    tempHora={tempHora}
                    setTempHora={setTempHora}
                    tempNombreClase={tempNombreClase}
                    setTempNombreClase={setTempNombreClase}
                    tempProgramaClase={tempProgramaClase}
                    setTempProgramaClase={setTempProgramaClase}
                    tempDiasClase={tempDiasClase}
                    toggleDiaTemp={toggleDiaTemp}
                    horarioEditandoIdx={horarioEditandoIdx}
                    guardarHorario={guardarHorario}
                    editarHorario={editarHorario}
                    eliminarHorario={eliminarHorario}
                    limpiarFormularioHorario={limpiarFormularioHorario}
                    horarioFormRef={horarioFormRef}
                    tempNuevoMetodo={tempNuevoMetodo}
                    setTempNuevoMetodo={setTempNuevoMetodo}
                    agregarMetodo={agregarMetodo}
                    eliminarMetodo={eliminarMetodo}
                    codigoVinculacion={codigoVinculacion}
                    setCodigoVinculacion={setCodigoVinculacion}
                    vinculandoInstructor={vinculandoInstructor}
                    vincularInstructor={vincularInstructor}
                    copiarCodigo={copiarCodigo}
                    esPropietario={esPropietario}
                />
            )}

            {alumnoPago && (
                <ModalPago
                    alumno={alumnoPago}
                    config={config}
                    metodosPago={metodosPago}
                    pagoDraft={pagoDraft}
                    setPagoDraft={setPagoDraft}
                    cerrarPago={cerrarPago}
                    guardarPago={guardarPago}
                    guardandoPago={guardandoPago}
                />
            )}
        </div>
    );
};

export default GestionAlumnosPage;

/* ------------------------------------------------------------------ */
/* COMPONENTES AUXILIARES                                              */
/* ------------------------------------------------------------------ */

const iniciales = (nombre = '') => {
    const partes = String(nombre).trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return `${partes[0][0]}${partes.length > 1 ? partes[partes.length - 1][0] : ''}`.toUpperCase();
};

const StatCard = ({ icon, label, value, color = '#d4af37', onClick }) => (
    <button type="button" onClick={onClick} style={s.statCard}>
        <span style={{ ...s.statIcon, borderColor: `${color}45`, background: `${color}12` }}>
            <VaultIcon name={icon} size={17} color={color} />
        </span>
        <span style={s.statContent}>
            <strong style={{ ...s.statValue, color: value > 0 ? '#fff' : '#777' }}>{value}</strong>
            <span style={s.statLabel}>{label}</span>
        </span>
    </button>
);

const EmptyState = ({ archivados, filtros, onLimpiar, onNuevo }) => (
    <div style={s.emptyState}>
        <span style={s.emptyIcon}>
            <VaultIcon name={filtros ? 'search' : archivados ? 'folder' : 'users'} size={30} color="#d4af37" />
        </span>
        <h3 style={s.emptyTitle}>
            {filtros ? 'No hay resultados con estos filtros' : archivados ? 'El archivo está vacío' : 'Tu dojo aún no tiene alumnos activos'}
        </h3>
        <p style={s.emptyText}>
            {filtros
                ? 'Prueba con otra búsqueda o limpia los filtros para ver a todos los alumnos.'
                : archivados
                    ? 'Los alumnos que archives aparecerán aquí para mantener su expediente y poder reactivarlos.'
                    : 'Registra al primer alumno para comenzar a llevar asistencia, pagos y datos de emergencia.'}
        </p>
        {filtros ? (
            <button type="button" onClick={onLimpiar} style={s.ghostBtn}>
                <VaultIcon name="filter" size={14} /> LIMPIAR FILTROS
            </button>
        ) : !archivados ? (
            <button type="button" onClick={onNuevo} style={s.goldBtn}>
                <VaultIcon name="plus" size={15} /> REGISTRAR PRIMER ALUMNO
            </button>
        ) : null}
    </div>
);

const AlumnoCard = ({ alumno, moneda, onAbrir, onEditar, onPagar, onArchivar }) => {
    const estado = calcularEstadoPago(alumno.fechaPago, alumno.activo);
    const alerta = tieneAlertaMedica(alumno);
    const contactoOk = tieneContactoEmergencia(alumno);
    const asistencias = totalAsistencias(alumno);
    const ultima = ultimaAsistencia(alumno);
    const programas = alumno.programas || [];

    return (
        <article
            className="gestion-alumno-card"
            style={s.alumnoCard}
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
            <div style={s.studentCardTop}>
                <span style={s.avatar}>
                    {alumno.fotoBase64
                        ? <img src={alumno.fotoBase64} alt="" style={s.avatarImg} />
                        : iniciales(alumno.nombre)}
                </span>
                <div style={s.studentCardIdentity}>
                    <h3 style={s.studentName}>{alumno.nombre || 'Alumno sin nombre'}</h3>
                    <span style={s.studentSub}>
                        <VaultIcon name="belt" size={11} /> {alumno.gradoActual || 'Blanco'}
                        {alumno.edad ? ` · ${alumno.edad} años` : ''}
                    </span>
                </div>
                <span style={{ ...s.statusPill, color: estado.color, borderColor: `${estado.color}55` }}>
                    {estado.label}
                </span>
            </div>

            {(alerta || !contactoOk) && (
                <div style={{ ...s.medicalStrip, borderColor: alerta ? 'rgba(255,107,107,0.35)' : 'rgba(255,187,51,0.35)' }}>
                    <VaultIcon name={alerta ? 'medical' : 'alert'} size={13} color={alerta ? '#ff6b6b' : '#ffbb33'} />
                    <span>
                        {alerta
                            ? resumenAlertaMedica(alumno) || 'Alerta médica registrada'
                            : 'Falta contacto de emergencia'}
                    </span>
                </div>
            )}

            <div style={s.programChips}>
                {programas.length === 0 ? (
                    <span style={s.mutedSmall}>Sin programa asignado</span>
                ) : programas.slice(0, 3).map((programa) => (
                    <span key={programa} style={s.programChip}>{programa}</span>
                ))}
                {programas.length > 3 && <span style={s.programMore}>+{programas.length - 3}</span>}
            </div>

            <div style={s.studentCardGrid}>
                <div style={s.studentMiniBlock}>
                    <span style={s.miniLabel}><VaultIcon name="wallet" size={11} /> PAGO</span>
                    <strong style={{ ...s.miniValue, color: estado.color }}>
                        {formatearMoneda(alumno.montoMensualidad, moneda)}
                    </strong>
                    <span style={s.miniMeta}>{alumno.fechaPago ? `Vence ${formatearFecha(alumno.fechaPago, { conAnio: false })}` : 'Sin fecha'}</span>
                </div>
                <div style={s.studentMiniBlock}>
                    <span style={s.miniLabel}><VaultIcon name="calendar" size={11} /> ASISTENCIA</span>
                    <strong style={s.miniValue}>{asistencias}</strong>
                    <span style={s.miniMeta}>{ultima ? `Última ${formatearFecha(ultima, { conAnio: false })}` : 'Sin registros'}</span>
                </div>
            </div>

            <div style={s.contactRow}>
                {alumno.tipoSangre && (
                    <span style={s.bloodChip}>
                        <VaultIcon name="medical" size={10} /> {alumno.tipoSangre}
                    </span>
                )}
                <span style={s.contactItem}>
                    <VaultIcon name="phone" size={11} /> {alumno.telefono || 'Sin teléfono'}
                </span>
                <span style={s.contactItem}>
                    <VaultIcon name="medical" size={11} /> {alumno.contactoEmergenciaNombre
                        ? `${alumno.contactoEmergenciaNombre}${alumno.contactoEmergenciaTel ? ` · ${alumno.contactoEmergenciaTel}` : ''}`
                        : 'Sin contacto'}
                </span>
            </div>

            <div style={s.cardActions}>
                <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(); }} style={s.cardActionPrimary}>
                    <VaultIcon name="eye" size={13} /> EXPEDIENTE
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onEditar(); }} style={s.cardActionIcon} title="Editar alumno" aria-label="Editar alumno">
                    <VaultIcon name="edit" size={13} />
                </button>
                {alumno.activo !== false && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onPagar(); }} style={s.cardActionIcon} title="Registrar pago" aria-label="Registrar pago">
                        <VaultIcon name="wallet" size={13} />
                    </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onArchivar(); }} style={s.cardActionIcon} title={alumno.activo === false ? 'Reactivar' : 'Archivar'} aria-label={alumno.activo === false ? 'Reactivar' : 'Archivar'}>
                    <VaultIcon name={alumno.activo === false ? 'undo' : 'folder'} size={13} />
                </button>
            </div>
        </article>
    );
};

const FilaAlumno = ({ alumno, moneda, onAbrir, onEditar, onPagar, onArchivar }) => {
    const estado = calcularEstadoPago(alumno.fechaPago, alumno.activo);
    const alerta = tieneAlertaMedica(alumno);
    const contactoOk = tieneContactoEmergencia(alumno);
    const programas = alumno.programas || [];
    const asistencias = totalAsistencias(alumno);
    const ultima = ultimaAsistencia(alumno);

    return (
        <div
            className="gestion-row"
            style={s.tableRow}
            onClick={onAbrir}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAbrir();
                }
            }}
        >
            <div style={s.cellStudent}>
                <span style={s.avatarSmall}>
                    {alumno.fotoBase64
                        ? <img src={alumno.fotoBase64} alt="" style={s.avatarImg} />
                        : iniciales(alumno.nombre)}
                </span>
                <div style={s.cellStudentText}>
                    <strong style={s.rowName}>{alumno.nombre || 'Alumno sin nombre'}</strong>
                    <span style={s.rowSub}>
                        {alumno.gradoActual || 'Blanco'}{alumno.edad ? ` · ${alumno.edad} años` : ''}
                    </span>
                </div>
            </div>

            <div style={s.cellPrograms}>
                {programas.length === 0 ? <span style={s.mutedSmall}>Sin programa</span> : (
                    <>
                        {programas.slice(0, 2).map((programa) => <span key={programa} style={s.programChipSmall}>{programa}</span>)}
                        {programas.length > 2 && <span style={s.programMore}>+{programas.length - 2}</span>}
                    </>
                )}
            </div>

            <div style={s.cellPay}>
                <span style={{ ...s.payText, color: estado.color }}>{estado.label}</span>
                <span style={s.paySub}>
                    {formatearMoneda(alumno.montoMensualidad, moneda)} · {alumno.fechaPago ? formatearFecha(alumno.fechaPago, { conAnio: false }) : 'Sin fecha'}
                </span>
            </div>

            <div style={s.cellAttendance}>
                <strong style={s.rowStrong}>{asistencias}</strong>
                <span style={s.paySub}>{ultima ? formatearFecha(ultima, { conAnio: false }) : 'Sin registros'}</span>
            </div>

            <div style={s.cellEmergency}>
                {contactoOk ? (
                    <>
                        <span style={s.emergencyName}>{alumno.contactoEmergenciaNombre}</span>
                        <span style={s.paySub}>{alumno.contactoEmergenciaTel}</span>
                    </>
                ) : (
                    <span style={s.missingEmergency}><VaultIcon name="alert" size={11} /> Sin contacto</span>
                )}
                {alerta && (
                    <span style={s.medicalFlag} title={resumenAlertaMedica(alumno)}>
                        <VaultIcon name="medical" size={10} /> Alerta
                    </span>
                )}
                {alumno.tipoSangre && (
                    <span style={s.bloodChipSmall}>
                        <VaultIcon name="medical" size={9} /> {alumno.tipoSangre}
                    </span>
                )}
            </div>

            <div style={s.cellActions}>
                <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(); }} style={s.rowAction} title="Expediente" aria-label="Expediente">
                    <VaultIcon name="eye" size={13} />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onEditar(); }} style={s.rowAction} title="Editar" aria-label="Editar">
                    <VaultIcon name="edit" size={13} />
                </button>
                {alumno.activo !== false && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onPagar(); }} style={s.rowAction} title="Registrar pago" aria-label="Registrar pago">
                        <VaultIcon name="wallet" size={13} />
                    </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onArchivar(); }} style={s.rowAction} title={alumno.activo === false ? 'Reactivar' : 'Archivar'} aria-label={alumno.activo === false ? 'Reactivar' : 'Archivar'}>
                    <VaultIcon name={alumno.activo === false ? 'undo' : 'folder'} size={13} />
                </button>
            </div>
        </div>
    );
};

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

const DetalleAlumno = ({
    alumno,
    config,
    tabDetalle,
    setTabDetalle,
    cerrarDetalle,
    abrirEditar,
    abrirPago,
    archivar,
    notasDetalle,
    setNotasDetalle,
    guardarNotasDetalle,
    guardandoNotas}) => {
    const data = normalizarAlumno(alumno, config);
    const estado = calcularEstadoPago(data.fechaPago, data.activo);
    const alerta = tieneAlertaMedica(data);
    const contactoOk = tieneContactoEmergencia(data);
    const asistencias = totalAsistencias(data);
    const ultima = ultimaAsistencia(data);
    const historialTecnico = historialTecnicoOrdenado(data);
    const historialPagos = historialPagosOrdenado(data);
    const tabs = [
        { id: 'resumen', label: 'Resumen', icon: 'idCard' },
        { id: 'salud', label: 'Salud', icon: 'medical' },
        { id: 'entrenamiento', label: 'Entrenamiento', icon: 'belt' },
        { id: 'pagos', label: 'Pagos', icon: 'wallet' }
    ];

    const telefonoWhatsApp = String(data.contactoEmergenciaTel || data.telefono || '').replace(/\D/g, '');
    const whatsappContacto = telefonoWhatsApp ? `https://wa.me/${telefonoWhatsApp}` : '';

    return (
        <div style={{ ...s.modalOverlay, padding: 0, alignItems: 'stretch', justifyContent: 'flex-end' }} className="gestion-modal-overlay" onClick={cerrarDetalle}>
            <aside style={s.drawer} className="gestion-drawer" onClick={(e) => e.stopPropagation()}>
                <div style={s.drawerHeader}>
                    <div style={s.drawerIdentity}>
                        <span style={s.drawerAvatar}>
                            {data.fotoBase64
                                ? <img src={data.fotoBase64} alt="" style={s.drawerAvatarImg} />
                                : iniciales(data.nombre)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <span style={s.eyebrow}>EXPEDIENTE DEL ALUMNO</span>
                            <h2 style={s.drawerName}>{data.nombre || 'Alumno sin nombre'}</h2>
                            <div style={s.drawerMeta}>
                                <span style={{ color: estado.color }}>{estado.label}</span>
                                <span style={s.dot} />
                                <span>{data.gradoActual || 'Blanco'}</span>
                                {data.edad && <><span style={s.dot} /><span>{data.edad} años</span></>}
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={cerrarDetalle} style={s.iconBtn} aria-label="Cerrar expediente">
                        <VaultIcon name="close" size={17} />
                    </button>
                </div>

                <div style={s.drawerQuickActions}>
                    {data.telefono && (
                        <a href={`tel:${data.telefono}`} style={s.quickAction}>
                            <VaultIcon name="phone" size={13} /> LLAMAR
                        </a>
                    )}
                    {whatsappContacto && (
                        <a href={whatsappContacto} target="_blank" rel="noreferrer" style={s.quickAction}>
                            <VaultIcon name="message" size={13} /> WHATSAPP
                        </a>
                    )}
                    <button type="button" onClick={abrirEditar} style={s.quickAction}>
                        <VaultIcon name="edit" size={13} /> EDITAR
                    </button>
                    {data.activo !== false && (
                        <button type="button" onClick={abrirPago} style={{ ...s.quickAction, color: '#d4af37', borderColor: 'rgba(212,175,55,0.35)' }}>
                            <VaultIcon name="wallet" size={13} /> COBRAR
                        </button>
                    )}
                </div>

                <div className="gestion-detail-tabs" style={s.detailTabs}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTabDetalle(tab.id)}
                            style={tabDetalle === tab.id ? s.detailTabActive : s.detailTab}
                        >
                            <VaultIcon name={tab.icon} size={13} /> {tab.label}
                        </button>
                    ))}
                </div>

                <div style={s.drawerBody}>
                    {tabDetalle === 'resumen' && (
                        <div style={s.detailStack}>
                            <div className="gestion-detail-grid2" style={s.detailGrid2}>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="phone" size={13} /> Contacto</span>
                                    <span style={s.detailLine}><strong>Tel:</strong> {data.telefono || '—'}</span>
                                    <span style={s.detailLine}><strong>Email:</strong> {data.email || '—'}</span>
                                    <span style={s.detailLine}><strong>Instagram:</strong> {data.instagram || '—'}</span>
                                    <span style={s.detailLine}><strong>Dirección:</strong> {data.direccion || '—'}</span>
                                </div>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="wallet" size={13} /> Pago</span>
                                    <span style={{ ...s.detailLine, color: estado.color, fontWeight: 800 }}>{estado.label}</span>
                                    <span style={s.detailLine}><strong>Próximo:</strong> {formatearFecha(data.fechaPago)}</span>
                                    <span style={s.detailLine}><strong>Monto:</strong> {formatearMoneda(data.montoMensualidad, config.moneda)}</span>
                                    <span style={s.detailLine}><strong>Método:</strong> {data.metodoPagoPreferido || '—'}</span>
                                </div>
                            </div>

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}><VaultIcon name="target" size={13} /> Programas y horarios</span>
                                <div style={s.programChips}>
                                    {(data.programas || []).length === 0
                                        ? <span style={s.mutedSmall}>Sin programas asignados</span>
                                        : data.programas.map((programa) => <span key={programa} style={s.programChip}>{programa}</span>)}
                                </div>
                                <div style={s.detailLine}>
                                    {(data.horarios || []).length === 0 ? 'Sin horarios asignados' : data.horarios.join(' · ')}
                                </div>
                            </div>

                            <div className="gestion-detail-grid2" style={s.detailGrid2}>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="calendar" size={13} /> Asistencia</span>
                                    <strong style={s.bigDetailValue}>{asistencias}</strong>
                                    <span style={s.detailLine}>{ultima ? `Última clase: ${formatearFecha(ultima)}` : 'Sin registros todavía'}</span>
                                </div>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="users" size={13} /> Tutor</span>
                                    <span style={s.detailLine}><strong>Nombre:</strong> {data.tutorNombre || '—'}</span>
                                    <span style={s.detailLine}><strong>Tel:</strong> {data.tutorTelefono || '—'}</span>
                                </div>
                            </div>

                            {data.notasAdministrativas && (
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="notes" size={13} /> Notas administrativas</span>
                                    <p style={s.detailParagraph}>{data.notasAdministrativas}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {tabDetalle === 'salud' && (
                        <div style={s.detailStack}>
                            <div style={{ ...s.healthAlertBox, borderColor: alerta ? 'rgba(255,107,107,0.45)' : 'rgba(76,175,80,0.35)' }}>
                                <span style={{ ...s.healthAlertIcon, color: alerta ? '#ff6b6b' : '#4CAF50' }}>
                                    <VaultIcon name={alerta ? 'medical' : 'checkCircle'} size={20} />
                                </span>
                                <div>
                                    <strong style={s.healthAlertTitle}>{alerta ? 'Alerta médica registrada' : 'Sin alertas médicas registradas'}</strong>
                                    <p style={s.healthAlertText}>{alerta ? resumenAlertaMedica(data) || 'Revisa las notas médicas.' : 'Mantén esta información actualizada.'}</p>
                                </div>
                            </div>

                            <div className="gestion-detail-grid2" style={s.detailGrid2}>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="medical" size={13} /> Tipo de sangre</span>
                                    <strong style={s.bigDetailValue}>{data.tipoSangre || '—'}</strong>
                                </div>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="shield" size={13} /> Seguro médico</span>
                                    <span style={s.detailLine}>{data.seguroMedico || '—'}</span>
                                    <span style={s.detailLine}><strong>Médico:</strong> {data.medicoTratante || '—'}</span>
                                </div>
                            </div>

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}>Alergias / condiciones / medicamentos</span>
                                <span style={s.detailLine}><strong>Alergias:</strong> {data.alergias || 'Ninguna'}</span>
                                <span style={s.detailLine}><strong>Condiciones:</strong> {data.condicionEspecial || 'Ninguna'}</span>
                                <span style={s.detailLine}><strong>Medicamentos:</strong> {data.medicamentos || 'Ninguno'}</span>
                                {data.notasMedicas && <p style={s.detailParagraph}>{data.notasMedicas}</p>}
                            </div>

                            <div style={{ ...s.detailBlock, borderColor: contactoOk ? 'rgba(212,175,55,0.35)' : 'rgba(255,107,107,0.45)' }}>
                                <span style={s.detailBlockTitle}><VaultIcon name="phone" size={13} /> Contacto de emergencia</span>
                                {contactoOk ? (
                                    <>
                                        <strong style={s.emergencyContactName}>{data.contactoEmergenciaNombre}</strong>
                                        <span style={s.detailLine}>{data.contactoEmergenciaTel} · {data.parentescoEmergencia || 'Sin parentesco'}</span>
                                        <div style={s.emergencyActions}>
                                            <a href={`tel:${data.contactoEmergenciaTel}`} style={s.quickAction}>
                                                <VaultIcon name="phone" size={13} /> LLAMAR
                                            </a>
                                            {whatsappContacto && (
                                                <a href={whatsappContacto} target="_blank" rel="noreferrer" style={s.quickAction}>
                                                    <VaultIcon name="message" size={13} /> WHATSAPP
                                                </a>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <span style={s.missingEmergency}><VaultIcon name="alert" size={12} /> Sin contacto de emergencia. Edita el expediente para completarlo.</span>
                                )}
                                <span style={s.detailLine}>
                                    <strong>Autorización médica:</strong> {data.autorizaAtencion ? 'Sí' : 'No registrada'}
                                </span>
                            </div>
                        </div>
                    )}

                    {tabDetalle === 'entrenamiento' && (
                        <div style={s.detailStack}>
                            <div className="gestion-detail-grid2" style={s.detailGrid2}>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="belt" size={13} /> Grado</span>
                                    <strong style={s.bigDetailValue}>{data.gradoActual || 'Blanco'}</strong>
                                    <span style={s.detailLine}>{data.tieneExperiencia === 'si' ? data.tiempoExperiencia || 'Con experiencia' : 'Sin experiencia previa'}</span>
                                </div>
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="calendar" size={13} /> Asistencia</span>
                                    <strong style={s.bigDetailValue}>{asistencias}</strong>
                                    <span style={s.detailLine}>{ultima ? `Última: ${formatearFecha(ultima)}` : 'Sin registros'}</span>
                                </div>
                            </div>

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}><VaultIcon name="target" size={13} /> Programas y academia</span>
                                <div style={s.programChips}>
                                    {(data.programas || []).length === 0
                                        ? <span style={s.mutedSmall}>Sin programas</span>
                                        : data.programas.map((programa) => <span key={programa} style={s.programChip}>{programa}</span>)}
                                </div>
                                <span style={s.detailLine}><strong>Academia anterior:</strong> {data.academiaAnterior || '—'}</span>
                                <span style={s.detailLine}><strong>Horarios:</strong> {(data.horarios || []).join(' · ') || '—'}</span>
                            </div>

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}><VaultIcon name="notes" size={13} /> Bitácora técnica</span>
                                <textarea
                                    rows={4}
                                    value={notasDetalle}
                                    onChange={(e) => setNotasDetalle(e.target.value)}
                                    placeholder="Objetivos, detalles técnicos, seguimiento..."
                                    style={s.textarea}
                                />
                                <button type="button" onClick={guardarNotasDetalle} disabled={guardandoNotas} style={s.ghostBtn}>
                                    <VaultIcon name={guardandoNotas ? 'clock' : 'checkCircle'} size={13} /> {guardandoNotas ? 'GUARDANDO...' : 'GUARDAR BITÁCORA'}
                                </button>
                            </div>

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}><VaultIcon name="clipboard" size={13} /> Historial de clases</span>
                                {historialTecnico.length === 0 ? (
                                    <span style={s.mutedSmall}>Aún no hay clases registradas en el historial.</span>
                                ) : historialTecnico.slice(0, 8).map((item, indice) => (
                                    <div key={`${item.fecha}-${indice}`} style={s.historyRow}>
                                        <span style={s.historyDate}>{formatearFecha(item.fecha, { conAnio: false })}</span>
                                        <div style={s.historyText}>
                                            <strong>{item.clase || 'Clase'}</strong>
                                            {item.nota && <span>{item.nota}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tabDetalle === 'pagos' && (
                        <div style={s.detailStack}>
                            <div style={s.paymentSummary}>
                                <div>
                                    <span style={s.financeLabel}>ESTADO</span>
                                    <strong style={{ ...s.paymentSummaryValue, color: estado.color }}>{estado.label}</strong>
                                </div>
                                <div>
                                    <span style={s.financeLabel}>PRÓXIMO PAGO</span>
                                    <strong style={s.paymentSummaryValue}>{formatearFecha(data.fechaPago)}</strong>
                                </div>
                                <div>
                                    <span style={s.financeLabel}>MENSUALIDAD</span>
                                    <strong style={s.paymentSummaryValue}>{formatearMoneda(data.montoMensualidad, config.moneda)}</strong>
                                </div>
                            </div>

                            {data.activo !== false && (
                                <button type="button" onClick={abrirPago} style={s.goldBtn}>
                                    <VaultIcon name="wallet" size={15} /> REGISTRAR PAGO
                                </button>
                            )}

                            <div style={s.detailBlock}>
                                <span style={s.detailBlockTitle}><VaultIcon name="receipt" size={13} /> Historial de pagos</span>
                                {historialPagos.length === 0 ? (
                                    <span style={s.mutedSmall}>Aún no hay pagos registrados en la app.</span>
                                ) : historialPagos.map((pago, indice) => (
                                    <div key={pago.id || `${pago.fecha}-${indice}`} style={s.paymentRow}>
                                        <span style={s.paymentIcon}><VaultIcon name="wallet" size={14} color="#d4af37" /></span>
                                        <div style={s.paymentRowText}>
                                            <strong>{formatearMoneda(pago.monto, config.moneda)}</strong>
                                            <span>{formatearFecha(pago.fecha)} · {pago.metodo || 'Pago'}{pago.meses > 1 ? ` · ${pago.meses} meses` : ''}</span>
                                            {pago.nota && <span style={s.paymentNote}>{pago.nota}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {data.notasAdministrativas && (
                                <div style={s.detailBlock}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="notes" size={13} /> Notas administrativas</span>
                                    <p style={s.detailParagraph}>{data.notasAdministrativas}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={s.drawerFooter}>
                    <button type="button" onClick={archivar} style={s.ghostBtn}>
                        <VaultIcon name={data.activo === false ? 'undo' : 'folder'} size={14} /> {data.activo === false ? 'REACTIVAR' : 'ARCHIVAR'}
                    </button>
                    <button type="button" onClick={abrirEditar} style={s.ghostBtn}>
                        <VaultIcon name="edit" size={14} /> EDITAR
                    </button>
                    <button type="button" onClick={cerrarDetalle} style={s.goldBtn}>CERRAR</button>
                </div>
            </aside>
        </div>
    );
};

const FormularioAlumno = ({
    nuevo,
    actualizarNuevo,
    editandoId,
    pasoForm,
    setPasoForm,
    siguientePaso,
    pasoAnterior,
    guardarAlumno,
    guardandoAlumno,
    cerrarFormulario,
    procesandoFoto,
    handleFotoChange,
    programas,
    horarios,
    config,
    togglePrograma,
    toggleHorario}) => {
    const pasos = [
        { label: 'Personal', icon: 'user' },
        { label: 'Salud', icon: 'medical' },
        { label: 'Entrenamiento', icon: 'belt' },
        { label: 'Pagos', icon: 'wallet' }
    ];
    const metodosFormulario = [...new Set([
        ...(config.metodosPago || METODOS_PAGO_DEFAULT),
        nuevo.metodoPagoPreferido
    ].filter(Boolean))];

    return (
        <div style={{ ...s.modalOverlay, zIndex: 3200 }} className="gestion-modal-overlay">
            <div style={s.formModal} className="gestion-form-modal">
                <div style={s.formHeader}>
                    <div style={{ minWidth: 0 }}>
                        <span style={s.eyebrow}>{editandoId ? 'EDITAR EXPEDIENTE' : 'NUEVO ALUMNO'}</span>
                        <h2 style={s.formTitle}>{nuevo.nombre || 'Registro de alumno'}</h2>
                    </div>
                    <div style={s.formHeaderActions}>
                        {editandoId && (
                            <button type="button" onClick={guardarAlumno} style={s.goldIconBtn} disabled={guardandoAlumno} title="Guardar cambios" aria-label="Guardar cambios">
                                <VaultIcon name={guardandoAlumno ? 'clock' : 'checkCircle'} size={16} />
                            </button>
                        )}
                        <button type="button" onClick={cerrarFormulario} style={s.iconBtn} aria-label="Cerrar formulario">
                            <VaultIcon name="close" size={17} />
                        </button>
                    </div>
                </div>

                <div style={s.stepper}>
                    {pasos.map((paso, indice) => {
                        const numero = indice + 1;
                        const activo = pasoForm === numero;
                        const completado = pasoForm > numero;
                        return (
                            <div key={paso.label} style={s.stepItem}>
                                <button
                                    type="button"
                                    onClick={() => { if (completado) setPasoForm(numero); }}
                                    style={{
                                        ...s.stepCircle,
                                        ...(activo ? s.stepCircleActive : {}),
                                        ...(completado ? s.stepCircleDone : {})
                                    }}
                                    aria-label={`Paso ${numero}: ${paso.label}`}
                                >
                                    {completado ? <VaultIcon name="check" size={13} /> : <VaultIcon name={paso.icon} size={13} />}
                                </button>
                                <span className="gestion-step-label" style={activo ? s.stepLabelActive : s.stepLabel}>{paso.label}</span>
                                {indice < pasos.length - 1 && <span style={s.stepLine} />}
                            </div>
                        );
                    })}
                </div>

                <div id="gestion-form-body" style={s.formBody}>
                    {pasoForm === 1 && (
                        <div style={s.formSection}>
                            <div style={s.photoRow}>
                                <span style={s.photoPreview}>
                                    {nuevo.fotoBase64
                                        ? <img src={nuevo.fotoBase64} alt="" style={s.photoPreviewImg} />
                                        : <VaultIcon name="camera" size={24} color="#d4af37" />}
                                </span>
                                <div style={s.photoCopy}>
                                    <strong style={s.photoTitle}>Foto del alumno</strong>
                                    <span style={s.photoHint}>Ayuda a identificar al alumno en clase y en una emergencia.</span>
                                    <input id="gestion-foto-input" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                                    <label htmlFor="gestion-foto-input" style={s.softBtn}>
                                        <VaultIcon name="camera" size={13} /> {procesandoFoto ? 'PROCESANDO...' : nuevo.fotoBase64 ? 'CAMBIAR FOTO' : 'SUBIR FOTO'}
                                    </label>
                                </div>
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="idCard" size={15} /> Datos personales</h3>
                                <span style={s.sectionHint}>Información básica de contacto</span>
                            </div>

                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Nombre completo" required full>
                                    <input value={nuevo.nombre} onChange={(e) => actualizarNuevo('nombre', e.target.value)} placeholder="Nombre y apellidos" style={s.input} maxLength={80} />
                                </Campo>
                                <Campo label="Fecha de nacimiento" hint={nuevo.fechaNacimiento ? `Edad calculada: ${calcularEdad(nuevo.fechaNacimiento)} años` : 'Opcional'}>
                                    <input type="date" value={nuevo.fechaNacimiento} onChange={(e) => actualizarNuevo('fechaNacimiento', e.target.value)} style={s.input} />
                                </Campo>
                                {!nuevo.fechaNacimiento && (
                                    <Campo label="Edad">
                                        <input type="number" min="0" max="110" value={nuevo.edad} onChange={(e) => actualizarNuevo('edad', e.target.value)} placeholder="Años" style={s.input} />
                                    </Campo>
                                )}
                                <Campo label="WhatsApp / teléfono" hint="Se usará para contacto y emergencias.">
                                    <input value={nuevo.telefono} onChange={(e) => actualizarNuevo('telefono', e.target.value)} placeholder="Ej. 555 123 4567" style={s.input} inputMode="tel" />
                                </Campo>
                                <Campo label="Correo electrónico">
                                    <input type="email" value={nuevo.email} onChange={(e) => actualizarNuevo('email', e.target.value)} placeholder="correo@ejemplo.com" style={s.input} />
                                </Campo>
                                <Campo label="Instagram">
                                    <input value={nuevo.instagram} onChange={(e) => actualizarNuevo('instagram', e.target.value)} placeholder="@usuario" style={s.input} />
                                </Campo>
                                <Campo label="Dirección" full>
                                    <input value={nuevo.direccion} onChange={(e) => actualizarNuevo('direccion', e.target.value)} placeholder="Calle, número, colonia, ciudad" style={s.input} />
                                </Campo>
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="users" size={15} /> Tutor o responsable</h3>
                                <span style={s.sectionHint}>Especialmente para menores de edad</span>
                            </div>
                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Nombre del tutor">
                                    <input value={nuevo.tutorNombre} onChange={(e) => actualizarNuevo('tutorNombre', e.target.value)} placeholder="Nombre del tutor" style={s.input} />
                                </Campo>
                                <Campo label="Teléfono del tutor">
                                    <input value={nuevo.tutorTelefono} onChange={(e) => actualizarNuevo('tutorTelefono', e.target.value)} placeholder="Teléfono" style={s.input} inputMode="tel" />
                                </Campo>
                            </div>
                        </div>
                    )}

                    {pasoForm === 2 && (
                        <div style={s.formSection}>
                            <div style={s.safetyNote}>
                                <span style={s.safetyNoteIcon}><VaultIcon name="medical" size={18} color="#ffbb33" /></span>
                                <div>
                                    <strong>Información para emergencias</strong>
                                    <p>Estos datos ayudan a reaccionar de forma oportuna ante una lesión o urgencia médica. Mantenlos actualizados.</p>
                                </div>
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="medical" size={15} /> Datos médicos</h3>
                            </div>
                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Tipo de sangre">
                                    <select value={nuevo.tipoSangre} onChange={(e) => actualizarNuevo('tipoSangre', e.target.value)} style={s.input}>
                                        <option value="">Seleccionar</option>
                                        {TIPOS_SANGRE.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                                    </select>
                                </Campo>
                                <Campo label="Alergias" full>
                                    <textarea rows={2} value={nuevo.alergias} onChange={(e) => actualizarNuevo('alergias', e.target.value)} placeholder="Medicamentos, alimentos, picaduras..." style={s.textarea} />
                                </Campo>
                                <Campo label="Condiciones médicas / lesiones" full>
                                    <textarea rows={2} value={nuevo.condicionEspecial} onChange={(e) => actualizarNuevo('condicionEspecial', e.target.value)} placeholder="Asma, epilepsia, lesiones previas, cirugías..." style={s.textarea} />
                                </Campo>
                                <Campo label="Medicamentos actuales" full>
                                    <textarea rows={2} value={nuevo.medicamentos} onChange={(e) => actualizarNuevo('medicamentos', e.target.value)} placeholder="Nombre, dosis y frecuencia..." style={s.textarea} />
                                </Campo>
                                <Campo label="Seguro médico">
                                    <input value={nuevo.seguroMedico} onChange={(e) => actualizarNuevo('seguroMedico', e.target.value)} placeholder="Aseguradora o número de póliza" style={s.input} />
                                </Campo>
                                <Campo label="Médico tratante">
                                    <input value={nuevo.medicoTratante} onChange={(e) => actualizarNuevo('medicoTratante', e.target.value)} placeholder="Nombre y teléfono" style={s.input} />
                                </Campo>
                                <Campo label="Notas médicas" full>
                                    <textarea rows={2} value={nuevo.notasMedicas} onChange={(e) => actualizarNuevo('notasMedicas', e.target.value)} placeholder="Cualquier detalle que el profesor deba saber." style={s.textarea} />
                                </Campo>
                            </div>

                            <div style={s.emergencyBox}>
                                <div style={s.sectionTitleRow}>
                                    <h3 style={s.formSectionTitle}><VaultIcon name="phone" size={15} /> Contacto de emergencia</h3>
                                    <span style={s.emergencyHint}>Llamar primero en caso de urgencia</span>
                                </div>
                                <div className="gestion-form-grid" style={s.formGrid}>
                                    <Campo label="Nombre completo">
                                        <input value={nuevo.contactoEmergenciaNombre} onChange={(e) => actualizarNuevo('contactoEmergenciaNombre', e.target.value)} placeholder="Nombre del contacto" style={s.input} />
                                    </Campo>
                                    <Campo label="Teléfono">
                                        <input value={nuevo.contactoEmergenciaTel} onChange={(e) => actualizarNuevo('contactoEmergenciaTel', e.target.value)} placeholder="Teléfono de emergencia" style={s.input} inputMode="tel" />
                                    </Campo>
                                    <Campo label="Parentesco">
                                        <select value={nuevo.parentescoEmergencia} onChange={(e) => actualizarNuevo('parentescoEmergencia', e.target.value)} style={s.input}>
                                            <option value="">Seleccionar</option>
                                            {PARENTESCOS.map((parentesco) => <option key={parentesco} value={parentesco}>{parentesco}</option>)}
                                        </select>
                                    </Campo>
                                    <label style={s.checkRow}>
                                        <input type="checkbox" checked={Boolean(nuevo.autorizaAtencion)} onChange={(e) => actualizarNuevo('autorizaAtencion', e.target.checked)} />
                                        Autorizo atención médica de emergencia
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {pasoForm === 3 && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="belt" size={15} /> Experiencia y grado</h3>
                            </div>
                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="¿Tiene experiencia previa?">
                                    <select value={nuevo.tieneExperiencia} onChange={(e) => actualizarNuevo('tieneExperiencia', e.target.value)} style={s.input}>
                                        <option value="no">No</option>
                                        <option value="si">Sí</option>
                                    </select>
                                </Campo>
                                <Campo label="Grado / cinturón">
                                    <input list="grados-bjj" value={nuevo.gradoActual} onChange={(e) => actualizarNuevo('gradoActual', e.target.value)} placeholder="Blanco, Azul, Morado..." style={s.input} />
                                    <datalist id="grados-bjj">
                                        {GRADOS.map((grado) => <option key={grado} value={grado} />)}
                                    </datalist>
                                </Campo>
                                {nuevo.tieneExperiencia === 'si' && (
                                    <>
                                        <Campo label="Tiempo de experiencia">
                                            <input value={nuevo.tiempoExperiencia} onChange={(e) => actualizarNuevo('tiempoExperiencia', e.target.value)} placeholder="Ej. 2 años" style={s.input} />
                                        </Campo>
                                        <Campo label="Academia anterior" full>
                                            <input value={nuevo.academiaAnterior} onChange={(e) => actualizarNuevo('academiaAnterior', e.target.value)} placeholder="Nombre de la academia" style={s.input} />
                                        </Campo>
                                    </>
                                )}
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="target" size={15} /> Programas</h3>
                                <span style={s.sectionHint}>Selecciona uno o varios</span>
                            </div>
                            <div style={s.chipWrap}>
                                {programas.length === 0 ? (
                                    <span style={s.mutedSmall}>Configura programas en Ajustes del dojo.</span>
                                ) : programas.map((programa) => {
                                    const activo = (nuevo.programas || []).includes(programa);
                                    return (
                                        <button key={programa} type="button" onClick={() => togglePrograma(programa)} style={activo ? s.selectChipActive : s.selectChip}>
                                            {activo && <VaultIcon name="check" size={11} />} {programa}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="calendar" size={15} /> Horarios</h3>
                                <span style={s.sectionHint}>Clases en las que suele entrenar</span>
                            </div>
                            <div style={s.chipWrap}>
                                {horarios.length === 0 ? (
                                    <span style={s.mutedSmall}>Aún no hay horarios configurados.</span>
                                ) : horarios.map((horario, indice) => {
                                    const etiqueta = etiquetaHorario(horario);
                                    const activo = (nuevo.horarios || []).includes(etiqueta);
                                    return (
                                        <button key={`${etiqueta}-${indice}`} type="button" onClick={() => toggleHorario(etiqueta)} style={activo ? s.selectChipActive : s.selectChip}>
                                            {activo && <VaultIcon name="check" size={11} />} {etiqueta}
                                        </button>
                                    );
                                })}
                            </div>

                            <Campo label="Notas técnicas" full>
                                <textarea rows={3} value={nuevo.notasTecnicas} onChange={(e) => actualizarNuevo('notasTecnicas', e.target.value)} placeholder="Objetivos, detalles técnicos, seguimiento..." style={s.textarea} />
                            </Campo>
                        </div>
                    )}

                    {pasoForm === 4 && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="wallet" size={15} /> Administración y pagos</h3>
                                <span style={s.sectionHint}>Mensualidad sugerida: {formatearMoneda(config.mensualidadBase, config.moneda)}</span>
                            </div>
                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Próximo pago" required>
                                    <input type="date" value={nuevo.fechaPago} onChange={(e) => actualizarNuevo('fechaPago', e.target.value)} style={s.input} />
                                </Campo>
                                <Campo label={`Monto mensual (${config.moneda || 'MXN'})`}>
                                    <input type="number" min="0" step="50" value={nuevo.montoMensualidad} onChange={(e) => actualizarNuevo('montoMensualidad', e.target.value)} placeholder="0" style={s.input} />
                                </Campo>
                                <Campo label="Método de pago preferido">
                                    <select value={nuevo.metodoPagoPreferido} onChange={(e) => actualizarNuevo('metodoPagoPreferido', e.target.value)} style={s.input}>
                                        {metodosFormulario.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
                                    </select>
                                </Campo>
                                <Campo label="Estado">
                                    <select value={nuevo.activo === false ? 'inactivo' : 'activo'} onChange={(e) => actualizarNuevo('activo', e.target.value === 'activo')} style={s.input}>
                                        <option value="activo">Activo</option>
                                        <option value="inactivo">Archivado</option>
                                    </select>
                                </Campo>
                                <Campo label="Notas administrativas" full>
                                    <textarea rows={3} value={nuevo.notasAdministrativas} onChange={(e) => actualizarNuevo('notasAdministrativas', e.target.value)} placeholder="Becas, descuentos, acuerdos de pago..." style={s.textarea} />
                                </Campo>
                            </div>

                            <div style={s.summaryBox}>
                                <span style={s.summaryIcon}><VaultIcon name="shield" size={18} color="#d4af37" /></span>
                                <div>
                                    <strong style={s.summaryTitle}>Expediente listo para guardar</strong>
                                    <p style={s.summaryText}>
                                        {nuevo.nombre || 'Alumno'}{nuevo.gradoActual ? ` · ${nuevo.gradoActual}` : ''} · Próximo pago {formatearFecha(nuevo.fechaPago)}
                                        {(nuevo.contactoEmergenciaNombre && nuevo.contactoEmergenciaTel) ? ' · Contacto de emergencia completo' : ' · Sin contacto de emergencia'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="gestion-form-footer" style={s.formFooter}>
                    <div style={s.formFooterInfo}>
                        <span style={s.stepCounter}>PASO {pasoForm} DE 4</span>
                        <div style={s.stepProgressTrack}>
                            <div style={{ ...s.stepProgressFill, width: `${(pasoForm / 4) * 100}%` }} />
                        </div>
                    </div>
                    <div style={s.formFooterActions}>
                        {pasoForm > 1 && (
                            <button type="button" onClick={pasoAnterior} style={s.ghostBtn} disabled={guardandoAlumno}>
                                ATRÁS
                            </button>
                        )}
                        <button type="button" onClick={cerrarFormulario} className="gestion-cancel-btn" style={s.ghostBtn} disabled={guardandoAlumno}>
                            CANCELAR
                        </button>
                        {pasoForm < 4 ? (
                            <button type="button" onClick={siguientePaso} style={s.goldBtn}>
                                SIGUIENTE <VaultIcon name="chevronRight" size={14} />
                            </button>
                        ) : (
                            <button type="button" onClick={guardarAlumno} style={guardandoAlumno ? { ...s.goldBtn, opacity: 0.6 } : s.goldBtn} disabled={guardandoAlumno}>
                                <VaultIcon name={guardandoAlumno ? 'clock' : 'checkCircle'} size={15} />
                                {guardandoAlumno ? 'GUARDANDO...' : editandoId ? 'GUARDAR CAMBIOS' : 'REGISTRAR ALUMNO'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConfiguracionSede = ({
    configDraft,
    setConfigDraft,
    tabConfig,
    setTabConfig,
    cerrarConfig,
    guardarConfig,
    guardandoConfig,
    configDirty,
    procesandoLogo,
    handleLogoChange,
    tempNuevoPrograma,
    setTempNuevoPrograma,
    agregarPrograma,
    eliminarPrograma,
    tempHora,
    setTempHora,
    tempNombreClase,
    setTempNombreClase,
    tempProgramaClase,
    setTempProgramaClase,
    tempDiasClase,
    toggleDiaTemp,
    horarioEditandoIdx,
    guardarHorario,
    editarHorario,
    eliminarHorario,
    limpiarFormularioHorario,
    horarioFormRef,
    tempNuevoMetodo,
    setTempNuevoMetodo,
    agregarMetodo,
    eliminarMetodo,
    codigoVinculacion,
    setCodigoVinculacion,
    vinculandoInstructor,
    vincularInstructor,
    copiarCodigo,
    esPropietario}) => {
    const tabs = [
        { id: 'identidad', label: 'Identidad', icon: 'building' },
        { id: 'horarios', label: 'Horarios', icon: 'calendar' },
        { id: 'programas', label: 'Programas', icon: 'target' },
        { id: 'cobros', label: 'Cobros', icon: 'wallet' },
        { id: 'acceso', label: 'Acceso', icon: 'lock' }
    ];

    return (
        <div style={{ ...s.modalOverlay, zIndex: 3300 }} className="gestion-modal-overlay">
            <div style={s.configModal} className="gestion-config-modal">
                <div style={s.formHeader}>
                    <div style={{ minWidth: 0 }}>
                        <span style={s.eyebrow}>PANEL DEL DOJO</span>
                        <h2 style={s.formTitle}>Configuración de sede</h2>
                    </div>
                    <button type="button" onClick={cerrarConfig} style={s.iconBtn} aria-label="Cerrar configuración">
                        <VaultIcon name="close" size={17} />
                    </button>
                </div>

                <div className="gestion-config-tabs" style={s.configTabs}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTabConfig(tab.id)}
                            style={tabConfig === tab.id ? s.configTabActive : s.configTab}
                        >
                            <VaultIcon name={tab.icon} size={13} /> {tab.label}
                        </button>
                    ))}
                </div>

                <div style={s.configBody}>
                    {tabConfig === 'identidad' && (
                        <div style={s.formSection}>
                            <div style={s.configLogoRow}>
                                <span style={s.configLogo}>
                                    {configDraft.logoBase64
                                        ? <img src={configDraft.logoBase64} alt="Logo del dojo" style={s.configLogoImg} />
                                        : <VaultIcon name="dojo" size={28} color="#d4af37" />}
                                </span>
                                <div style={s.photoCopy}>
                                    <strong style={s.photoTitle}>Logo del dojo</strong>
                                    <span style={s.photoHint}>Se muestra en la cabecera y en la identidad visual de la sede.</span>
                                    <input id="gestion-logo-input" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                                    <label htmlFor="gestion-logo-input" style={s.softBtn}>
                                        <VaultIcon name="camera" size={13} /> {procesandoLogo ? 'PROCESANDO...' : configDraft.logoBase64 ? 'CAMBIAR LOGO' : 'SUBIR LOGO'}
                                    </label>
                                </div>
                            </div>

                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Nombre del dojo" required full>
                                    <input value={configDraft.nombre} onChange={(e) => setConfigDraft((prev) => ({ ...prev, nombre: e.target.value }))} style={s.input} placeholder="Nombre de la sede" />
                                </Campo>
                                <Campo label="Ciudad">
                                    <input value={configDraft.ciudad} onChange={(e) => setConfigDraft((prev) => ({ ...prev, ciudad: e.target.value }))} style={s.input} placeholder="Ciudad" />
                                </Campo>
                                <Campo label="Dirección" full>
                                    <input value={configDraft.direccion} onChange={(e) => setConfigDraft((prev) => ({ ...prev, direccion: e.target.value }))} style={s.input} placeholder="Calle, número, colonia" />
                                </Campo>
                                <Campo label="Teléfono">
                                    <input value={configDraft.telefono} onChange={(e) => setConfigDraft((prev) => ({ ...prev, telefono: e.target.value }))} style={s.input} inputMode="tel" placeholder="Teléfono del dojo" />
                                </Campo>
                                <Campo label="Correo">
                                    <input type="email" value={configDraft.email} onChange={(e) => setConfigDraft((prev) => ({ ...prev, email: e.target.value }))} style={s.input} placeholder="correo@dojo.com" />
                                </Campo>
                                <Campo label="Instagram">
                                    <input value={configDraft.instagram} onChange={(e) => setConfigDraft((prev) => ({ ...prev, instagram: e.target.value }))} style={s.input} placeholder="@tudojo" />
                                </Campo>
                            </div>
                        </div>
                    )}

                    {tabConfig === 'horarios' && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="calendar" size={15} /> Horarios de clase</h3>
                                <span style={s.sectionHint}>Se usan para asignar horarios a los alumnos</span>
                            </div>

                            <div ref={horarioFormRef} style={s.scheduleForm}>
                                <div className="gestion-form-grid" style={s.formGrid}>
                                    <Campo label="Hora">
                                        <input type="time" value={tempHora} onChange={(e) => setTempHora(e.target.value)} style={s.input} />
                                    </Campo>
                                    <Campo label="Programa">
                                        <select value={tempProgramaClase} onChange={(e) => setTempProgramaClase(e.target.value)} style={s.input}>
                                            {(configDraft.programas || []).length === 0 && <option value="">Sin programas</option>}
                                            {(configDraft.programas || []).map((programa) => <option key={programa} value={programa}>{programa}</option>)}
                                        </select>
                                    </Campo>
                                    <Campo label="Nombre de la clase" full>
                                        <input value={tempNombreClase} onChange={(e) => setTempNombreClase(e.target.value)} style={s.input} placeholder="Ej. Fundamentos, Técnica, Sparring" />
                                    </Campo>
                                </div>
                                <div style={s.daysRow}>
                                    <span style={s.campoLabel}>DÍAS</span>
                                    <div style={s.chipWrap}>
                                        {DIAS_SEMANA.map((dia) => (
                                            <button key={dia} type="button" onClick={() => toggleDiaTemp(dia)} style={tempDiasClase.includes(dia) ? s.dayChipActive : s.dayChip}>
                                                {dia.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div style={s.scheduleActions}>
                                    {horarioEditandoIdx !== null && (
                                        <button type="button" onClick={limpiarFormularioHorario} style={s.ghostBtn}>CANCELAR EDICIÓN</button>
                                    )}
                                    <button type="button" onClick={guardarHorario} style={s.goldBtn}>
                                        <VaultIcon name={horarioEditandoIdx !== null ? 'checkCircle' : 'plus'} size={14} />
                                        {horarioEditandoIdx !== null ? 'ACTUALIZAR HORARIO' : 'AÑADIR HORARIO'}
                                    </button>
                                </div>
                            </div>

                            <div style={s.scheduleList}>
                                {(configDraft.horarios || []).length === 0 ? (
                                    <span style={s.mutedSmall}>Aún no hay horarios configurados.</span>
                                ) : configDraft.horarios.map((horario, indice) => (
                                    <div key={`${horario.hora}-${indice}`} style={s.scheduleRow}>
                                        <span style={s.scheduleTime}>{horario.hora}</span>
                                        <div style={s.scheduleInfo}>
                                            <strong>{horario.nombre}</strong>
                                            <span>{horario.programa} · {(horario.dias || []).map((d) => d.slice(0, 3)).join(', ')}</span>
                                        </div>
                                        <button type="button" onClick={() => editarHorario(horario, indice)} style={s.iconBtnSmall} title="Editar horario" aria-label="Editar horario">
                                            <VaultIcon name="edit" size={12} />
                                        </button>
                                        <button type="button" onClick={() => eliminarHorario(indice)} style={s.iconBtnDanger} title="Eliminar horario" aria-label="Eliminar horario">
                                            <VaultIcon name="trash" size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {(configDraft.horarios || []).length > 0 && (
                                <div style={s.weekGrid}>
                                    {DIAS_SEMANA.map((dia) => {
                                        const clases = (configDraft.horarios || []).filter((horario) => (horario.dias || []).includes(dia));
                                        return (
                                            <div key={dia} style={s.weekDay}>
                                                <strong style={s.weekDayTitle}>{dia.slice(0, 3)}</strong>
                                                {clases.length === 0 ? (
                                                    <span style={s.weekEmpty}>—</span>
                                                ) : clases.map((horario, indice) => (
                                                    <span key={`${dia}-${indice}`} style={s.weekClass}>
                                                        <b>{horario.hora}</b> {horario.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {tabConfig === 'programas' && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="target" size={15} /> Programas y disciplinas</h3>
                            </div>
                            <p style={s.formHelp}>Los programas aparecen al registrar alumnos y al crear horarios de clase.</p>
                            <div style={s.addRow}>
                                <input
                                    value={tempNuevoPrograma}
                                    onChange={(e) => setTempNuevoPrograma(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') agregarPrograma(); }}
                                    style={s.input}
                                    placeholder="Ej. BJJ Kids, No-Gi, Luta Livre..."
                                />
                                <button type="button" onClick={agregarPrograma} style={s.goldBtn}>
                                    <VaultIcon name="plus" size={14} /> AÑADIR
                                </button>
                            </div>
                            <div style={s.chipWrap}>
                                {(configDraft.programas || []).map((programa) => (
                                    <span key={programa} style={s.programChipEditable}>
                                        {programa}
                                        <button type="button" onClick={() => eliminarPrograma(programa)} aria-label={`Eliminar ${programa}`}>
                                            <VaultIcon name="close" size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {tabConfig === 'cobros' && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="wallet" size={15} /> Cobros y mensualidades</h3>
                            </div>
                            <p style={s.formHelp}>Estos valores se usan como base para nuevos alumnos y para calcular las finanzas del dojo.</p>
                            <div className="gestion-form-grid" style={s.formGrid}>
                                <Campo label="Moneda">
                                    <select value={configDraft.moneda} onChange={(e) => setConfigDraft((prev) => ({ ...prev, moneda: e.target.value }))} style={s.input}>
                                        {MONEDAS.map((moneda) => <option key={moneda.id} value={moneda.id}>{moneda.label}</option>)}
                                    </select>
                                </Campo>
                                <Campo label="Mensualidad base">
                                    <input type="number" min="0" step="50" value={configDraft.mensualidadBase} onChange={(e) => setConfigDraft((prev) => ({ ...prev, mensualidadBase: e.target.value }))} style={s.input} placeholder="0" />
                                </Campo>
                                <Campo label="Día de vencimiento" hint="Se usa para sugerir la próxima fecha de pago.">
                                    <input type="number" min="1" max="31" value={configDraft.diaVencimiento} onChange={(e) => setConfigDraft((prev) => ({ ...prev, diaVencimiento: e.target.value }))} style={s.input} />
                                </Campo>
                            </div>

                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="receipt" size={15} /> Métodos de pago</h3>
                            </div>
                            <div style={s.addRow}>
                                <input
                                    value={tempNuevoMetodo}
                                    onChange={(e) => setTempNuevoMetodo(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') agregarMetodo(); }}
                                    style={s.input}
                                    placeholder="Ej. Efectivo, Transferencia, Tarjeta..."
                                />
                                <button type="button" onClick={agregarMetodo} style={s.goldBtn}>
                                    <VaultIcon name="plus" size={14} /> AÑADIR
                                </button>
                            </div>
                            <div style={s.chipWrap}>
                                {(configDraft.metodosPago || []).map((metodo) => (
                                    <span key={metodo} style={s.programChipEditable}>
                                        {metodo}
                                        <button type="button" onClick={() => eliminarMetodo(metodo)} aria-label={`Eliminar ${metodo}`}>
                                            <VaultIcon name="close" size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {tabConfig === 'acceso' && (
                        <div style={s.formSection}>
                            <div style={s.sectionTitleRow}>
                                <h3 style={s.formSectionTitle}><VaultIcon name="lock" size={15} /> Acceso para instructores</h3>
                            </div>
                            <p style={s.formHelp}>Comparte este código con instructores de confianza para que se vinculen a esta sede.</p>
                            <div style={s.accessCodeBox}>
                                <code style={s.accessCode}>{configDraft.codigoAcceso || 'SIN CÓDIGO'}</code>
                                {configDraft.codigoAcceso && (
                                    <button type="button" onClick={copiarCodigo} style={s.softBtn}>
                                        <VaultIcon name="copy" size={13} /> COPIAR
                                    </button>
                                )}
                            </div>

                            {!esPropietario && (
                                <div style={s.linkBox}>
                                    <span style={s.detailBlockTitle}><VaultIcon name="users" size={13} /> Vincular otra sede</span>
                                    <p style={s.formHelp}>Si eres instructor, puedes vincularte a otra sede con su código de acceso.</p>
                                    <div style={s.addRow}>
                                        <input
                                            value={codigoVinculacion}
                                            onChange={(e) => setCodigoVinculacion(e.target.value.toUpperCase())}
                                            style={s.input}
                                            placeholder="CÓDIGO DE SEDE"
                                        />
                                        <button type="button" onClick={vincularInstructor} disabled={vinculandoInstructor} style={s.goldBtn}>
                                            <VaultIcon name={vinculandoInstructor ? 'clock' : 'access'} size={14} />
                                            {vinculandoInstructor ? 'VINCULANDO...' : 'VINCULAR'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={s.securityNote}>
                                <VaultIcon name="shield" size={16} color="#d4af37" />
                                <p>El código debe compartirse solo con instructores de confianza. Cualquier persona con el código puede vincularse a esta sede.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="gestion-form-footer" style={s.formFooter}>
                    <span style={configDirty ? s.dirtyLabel : s.savedLabel}>
                        {configDirty ? 'CAMBIOS SIN GUARDAR' : 'CONFIGURACIÓN GUARDADA'}
                    </span>
                    <div style={s.formFooterActions}>
                        <button type="button" onClick={cerrarConfig} style={s.ghostBtn} disabled={guardandoConfig}>CANCELAR</button>
                        <button type="button" onClick={guardarConfig} style={guardandoConfig ? { ...s.goldBtn, opacity: 0.6 } : s.goldBtn} disabled={guardandoConfig}>
                            <VaultIcon name={guardandoConfig ? 'clock' : 'checkCircle'} size={15} />
                            {guardandoConfig ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ModalPago = ({
    alumno,
    config,
    metodosPago,
    pagoDraft,
    setPagoDraft,
    cerrarPago,
    guardarPago,
    guardandoPago}) => {
    const fechaBase = alumno.fechaPago || fechaHoy();
    const proximaFecha = sumarMeses(fechaBase, Math.max(1, Number(pagoDraft.meses) || 1));
    const metodosDisponibles = [...new Set([...(metodosPago || []), pagoDraft.metodo].filter(Boolean))];

    return (
        <div style={{ ...s.modalOverlay, zIndex: 3400 }} className="gestion-modal-overlay gestion-payment-overlay">
            <div style={s.paymentModal} className="gestion-payment-modal">
                <div style={s.formHeader}>
                    <div>
                        <span style={s.eyebrow}>REGISTRAR PAGO</span>
                        <h2 style={s.formTitle}>{alumno.nombre || 'Alumno'}</h2>
                    </div>
                    <button type="button" onClick={cerrarPago} style={s.iconBtn} aria-label="Cerrar pago">
                        <VaultIcon name="close" size={17} />
                    </button>
                </div>

                <div style={s.paymentModalBody}>
                    <div style={s.paymentCurrent}>
                        <span style={s.financeLabel}>PRÓXIMO PAGO ACTUAL</span>
                        <strong style={s.paymentCurrentValue}>{formatearFecha(fechaBase)}</strong>
                        <span style={s.paymentCurrentSub}>{formatearMoneda(alumno.montoMensualidad, config.moneda)} de mensualidad</span>
                    </div>

                    <div className="gestion-form-grid" style={s.formGrid}>
                        <Campo label="Fecha del pago">
                            <input type="date" value={pagoDraft.fecha} onChange={(e) => setPagoDraft((prev) => ({ ...prev, fecha: e.target.value }))} style={s.input} />
                        </Campo>
                        <Campo label={`Monto (${config.moneda || 'MXN'})`} required>
                            <input type="number" min="0" step="50" value={pagoDraft.monto} onChange={(e) => setPagoDraft((prev) => ({ ...prev, monto: e.target.value }))} style={s.input} placeholder="0" />
                        </Campo>
                        <Campo label="Método de pago">
                            <select value={pagoDraft.metodo} onChange={(e) => setPagoDraft((prev) => ({ ...prev, metodo: e.target.value }))} style={s.input}>
                                {metodosDisponibles.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Meses cubiertos">
                            <select value={pagoDraft.meses} onChange={(e) => setPagoDraft((prev) => ({ ...prev, meses: Number(e.target.value) }))} style={s.input}>
                                {[1, 2, 3, 4, 6, 12].map((meses) => <option key={meses} value={meses}>{meses} {meses === 1 ? 'mes' : 'meses'}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Nota" full>
                            <textarea rows={2} value={pagoDraft.nota} onChange={(e) => setPagoDraft((prev) => ({ ...prev, nota: e.target.value }))} style={s.textarea} placeholder="Ej. Pago en efectivo, transferencia, acuerdo..." />
                        </Campo>
                    </div>

                    <div style={s.nextPaymentBox}>
                        <VaultIcon name="calendar" size={16} color="#4CAF50" />
                        <div>
                            <span style={s.financeLabel}>NUEVO PRÓXIMO PAGO</span>
                            <strong style={s.nextPaymentValue}>{formatearFecha(proximaFecha)}</strong>
                        </div>
                    </div>
                </div>

                <div className="gestion-form-footer" style={s.formFooter}>
                    <div style={{ ...s.formFooterActions, marginLeft: 'auto' }}>
                        <button type="button" onClick={cerrarPago} style={s.ghostBtn} disabled={guardandoPago}>CANCELAR</button>
                        <button type="button" onClick={guardarPago} style={guardandoPago ? { ...s.goldBtn, opacity: 0.6 } : s.goldBtn} disabled={guardandoPago}>
                            <VaultIcon name={guardandoPago ? 'clock' : 'checkCircle'} size={15} />
                            {guardandoPago ? 'REGISTRANDO...' : 'REGISTRAR PAGO'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* ESTILOS                                                             */
/* ------------------------------------------------------------------ */

const s = {
    root: {
        minHeight: 'var(--app-vh)',
        width: '100%',
        backgroundColor: '#000',
        color: '#fff',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
    },
    shell: { width: '100%', maxWidth: '1240px', margin: '0 auto' },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        flexWrap: 'wrap', marginBottom: '14px'
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 },
    headerActions: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    backBtn: {
        width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'transparent', border: '1px solid #333', color: '#ccc',
        borderRadius: '10px', cursor: 'pointer'
    },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    titleIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: '1px solid #d4af37',
        color: '#d4af37', background: 'rgba(212,175,55,0.06)'
    },
    title: {
        margin: 0, color: '#d4af37', fontSize: 'clamp(1rem, 2.6vw, 1.35rem)',
        fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1
    },
    subtitle: {
        margin: '2px 0 0 0', color: '#777', fontSize: '0.64rem', lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70vw'
    },
    iconBtn: {
        width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'transparent', border: '1px solid #333',
        color: '#888', borderRadius: '9px', cursor: 'pointer'
    },
    goldIconBtn: {
        width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#d4af37', border: '1px solid #d4af37',
        color: '#000', borderRadius: '9px', cursor: 'pointer'
    },
    formHeaderActions: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    goldBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '8px',
        padding: '10px 14px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer',
        letterSpacing: '0.3px', whiteSpace: 'nowrap'
    },
    ghostBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        background: 'transparent', color: '#ccc', border: '1px solid #333', borderRadius: '8px',
        padding: '9px 12px', fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer'
    },
    softBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        alignSelf: 'flex-start', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)',
        color: '#d4af37', borderRadius: '6px', padding: '6px 9px', fontSize: '0.52rem',
        fontWeight: 800, cursor: 'pointer'
    },

    dojoHero: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
        flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(212,175,55,0.1), #080808 52%)',
        border: '1px solid rgba(212,175,55,0.25)', borderRadius: '14px', padding: '14px',
        marginBottom: '12px'
    },
    dojoIdentity: { display: 'flex', alignItems: 'center', gap: '11px', flex: 1, minWidth: '220px' },
    dojoLogo: {
        width: '58px', height: '58px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505',
        border: '1px solid rgba(212,175,55,0.35)'
    },
    dojoLogoImg: { width: '100%', height: '100%', objectFit: 'cover' },
    dojoText: { minWidth: 0 },
    dojoNameRow: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' },
    dojoName: {
        margin: 0, color: '#fff', fontSize: 'clamp(1.1rem, 2.8vw, 1.4rem)',
        fontWeight: 800, lineHeight: 1.1
    },
    ownerBadge: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(212,175,55,0.12)',
        border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37', borderRadius: '999px',
        padding: '2px 7px', fontSize: '0.44rem', fontWeight: 800, letterSpacing: '0.4px'
    },
    dojoMeta: { display: 'block', marginTop: '2px', color: '#777', fontSize: '0.62rem' },
    dojoContactRow: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', marginTop: '5px' },
    dojoContact: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#999',
        fontSize: '0.56rem', textDecoration: 'none'
    },
    dojoHeroActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    heroStat: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '2px' },
    heroStatValue: { color: '#d4af37', fontSize: '1.2rem', fontWeight: 800, lineHeight: 1 },
    heroStatLabel: { color: '#666', fontSize: '0.46rem', letterSpacing: '0.6px', marginTop: '2px' },
    statValue: { color: '#fff', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1 },
    statLabel: { color: '#777', fontSize: '0.54rem', letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '3px' },

    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '8px', marginBottom: '10px'
    },
    statCard: {
        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', background: '#0b0b0b',
        border: '1px solid #202020', borderRadius: '10px', padding: '11px 12px', cursor: 'pointer'
    },
    statIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '9px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: '1px solid #333'
    },
    statContent: { display: 'flex', flexDirection: 'column', minWidth: 0 },

    financeCard: {
        background: '#0a0a0a', border: '1px solid #202020', borderRadius: '12px',
        padding: '12px', marginBottom: '12px'
    },
    financeHead: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', flexWrap: 'wrap', marginBottom: '8px'
    },
    financeTitle: { display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#ddd', fontSize: '0.76rem' },
    financeHint: { color: '#666', fontSize: '0.52rem' },
    linkBtn: { background: 'transparent', border: 'none', color: '#d4af37', fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' },
    financeMetrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' },
    financeMetric: { display: 'flex', flexDirection: 'column', gap: '2px' },
    financeLabel: { color: '#666', fontSize: '0.46rem', letterSpacing: '0.6px', textTransform: 'uppercase' },
    financeValue: { color: '#fff', fontSize: 'clamp(0.95rem, 2vw, 1.18rem)', fontWeight: 800, lineHeight: 1.1 },
    financeProgressTrack: { height: '6px', background: '#151515', borderRadius: '999px', overflow: 'hidden', marginTop: '8px' },
    financeProgressFill: { height: '100%', background: '#d4af37', borderRadius: '999px', transition: 'width .2s ease' },

    safetyBanner: {
        display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap',
        background: 'rgba(255,187,51,0.06)', border: '1px solid rgba(255,187,51,0.3)',
        borderRadius: '10px', padding: '9px 11px', marginBottom: '12px'
    },
    safetyIcon: {
        width: '34px', height: '34px', flexShrink: 0, borderRadius: '9px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(255,187,51,0.08)',
        border: '1px solid rgba(255,187,51,0.28)'
    },
    safetyText: { flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px' },
    safetyBtn: {
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px',
        padding: '6px 10px', fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer'
    },
    safetyNote: {
        display: 'flex', alignItems: 'flex-start', gap: '9px', background: 'rgba(255,187,51,0.06)',
        border: '1px solid rgba(255,187,51,0.3)', borderRadius: '10px', padding: '10px'
    },
    safetyNoteIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '9px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(255,187,51,0.08)'
    },

    toolbar: {
        display: 'flex', flexDirection: 'column', gap: '8px', background: '#0a0a0a',
        border: '1px solid #202020', borderRadius: '12px', padding: '10px', marginBottom: '12px'
    },
    searchBox: {
        display: 'flex', alignItems: 'center', gap: '7px', background: '#050505',
        border: '1px solid #262626', borderRadius: '8px', padding: '0 10px', height: '38px'
    },
    searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.7rem' },
    clearSearch: {
        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', color: '#666', cursor: 'pointer'
    },
    filterRow: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' },
    filterChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111',
        border: '1px solid #2a2a2a', color: '#999', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    filterChipActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    select: {
        background: '#0b0b0b', border: '1px solid #222', color: '#ccc', borderRadius: '8px',
        padding: '0 9px', height: '32px', fontSize: '0.6rem', outline: 'none', minWidth: '140px'
    },
    clearFilters: { background: 'transparent', border: 'none', color: '#ff6b6b', fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer', padding: '4px' },
    resultCount: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#666', fontSize: '0.52rem' },
    alertFilterTag: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ffbb33',
        border: '1px solid rgba(255,187,51,0.35)', borderRadius: '999px', padding: '2px 6px',
        fontSize: '0.48rem', fontWeight: 800
    },

    tableWrap: { background: '#0a0a0a', border: '1px solid #202020', borderRadius: '12px', overflow: 'hidden' },
    tableHead: {
        display: 'grid',
        gridTemplateColumns: 'minmax(190px,1.5fr) minmax(120px,1fr) minmax(140px,1fr) minmax(95px,.75fr) minmax(130px,1fr) 140px',
        gap: '8px', padding: '10px 12px', background: '#0d0d0d', borderBottom: '1px solid #1b1b1b',
        color: '#666', fontSize: '0.48rem', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 800
    },
    tableBody: { display: 'flex', flexDirection: 'column' },
    tableRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(190px,1.5fr) minmax(120px,1fr) minmax(140px,1fr) minmax(95px,.75fr) minmax(130px,1fr) 140px',
        gap: '8px', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #151515',
        cursor: 'pointer', transition: 'background .15s ease'
    },
    cellStudent: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
    avatarSmall: {
        width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
        color: '#d4af37', fontSize: '0.58rem', fontWeight: 800, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    },
    cellStudentText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
    rowName: { color: '#eee', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rowSub: { color: '#777', fontSize: '0.54rem' },
    cellPrograms: { display: 'flex', gap: '4px', flexWrap: 'wrap', minWidth: 0 },
    programChipSmall: {
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)',
        color: '#d4af37', borderRadius: '4px', padding: '1px 5px', fontSize: '0.46rem',
        fontWeight: 700, whiteSpace: 'nowrap'
    },
    cellPay: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
    payText: { fontSize: '0.56rem', fontWeight: 800 },
    paySub: { color: '#777', fontSize: '0.52rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cellAttendance: { display: 'flex', flexDirection: 'column', gap: '1px' },
    rowStrong: { color: '#fff', fontSize: '0.8rem', fontWeight: 800 },
    cellEmergency: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
    emergencyName: { color: '#ccc', fontSize: '0.56rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    missingEmergency: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ffbb33', fontSize: '0.5rem', fontWeight: 700 },
    medicalFlag: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ff6b6b', fontSize: '0.46rem', fontWeight: 800 },
    cellActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' },
    rowAction: {
        width: '27px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '5px', cursor: 'pointer'
    },

    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' },
    skeletonCard: {
        height: '238px', borderRadius: '12px', border: '1px solid #1c1c1c',
        background: 'linear-gradient(100deg, #0c0c0c 20%, #151515 40%, #0c0c0c 60%)',
        backgroundSize: '200% 100%'
    },
    alumnoCard: {
        display: 'flex', flexDirection: 'column', gap: '8px', background: '#0a0a0a',
        border: '1px solid #202020', borderRadius: '12px', padding: '12px', cursor: 'pointer',
        outline: 'none', transition: 'transform .16s ease, border-color .16s ease, box-shadow .16s ease'
    },
    studentCardTop: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    avatar: {
        width: '44px', height: '44px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)',
        color: '#d4af37', fontSize: '0.68rem', fontWeight: 800, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    studentCardIdentity: { flex: 1, minWidth: 0 },
    studentName: { margin: 0, color: '#fff', fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    studentSub: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#888', fontSize: '0.58rem' },
    statusPill: {
        flexShrink: 0, border: '1px solid', borderRadius: '999px', padding: '2px 7px',
        fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.3px'
    },
    medicalStrip: {
        display: 'flex', alignItems: 'flex-start', gap: '5px', background: '#080808',
        border: '1px solid', borderRadius: '6px', padding: '5px 7px', color: '#ccc',
        fontSize: '0.52rem', lineHeight: 1.35
    },
    programChips: { display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' },
    programChip: {
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)',
        color: '#d4af37', borderRadius: '4px', padding: '1px 5px', fontSize: '0.5rem',
        fontWeight: 700
    },
    programMore: { color: '#777', fontSize: '0.46rem', fontWeight: 700 },
    mutedSmall: { color: '#777', fontSize: '0.55rem' },
    studentCardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },
    studentMiniBlock: { display: 'flex', flexDirection: 'column', gap: '1px', background: '#080808', border: '1px solid #1c1c1c', borderRadius: '7px', padding: '6px' },
    miniLabel: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#666', fontSize: '0.48rem', letterSpacing: '0.5px' },
    miniValue: { display: 'block', color: '#fff', fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.1, marginTop: '1px' },
    miniMeta: { color: '#777', fontSize: '0.5rem' },
    contactRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #1a1a1a', paddingTop: '6px' },
    bloodChip: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(255,107,107,0.08)',
        border: '1px solid rgba(255,107,107,0.3)', color: '#ff9b9b', borderRadius: '4px',
        padding: '1px 5px', fontSize: '0.5rem', fontWeight: 800
    },
    bloodChipSmall: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ff9b9b',
        fontSize: '0.46rem', fontWeight: 800
    },
    contactItem: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#888', fontSize: '0.52rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    cardActions: { display: 'flex', alignItems: 'center', gap: '5px', borderTop: '1px solid #1a1a1a', paddingTop: '7px' },
    cardActionPrimary: {
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px',
        padding: '7px', fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer'
    },
    cardActionIcon: {
        width: '32px', height: '32px', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#111', border: '1px solid #2a2a2a',
        color: '#888', borderRadius: '6px', cursor: 'pointer'
    },

    emptyState: {
        textAlign: 'center', padding: '38px 18px', background: '#080808',
        border: '1px dashed #2a2a2a', borderRadius: '14px'
    },
    emptyIcon: {
        width: '62px', height: '62px', borderRadius: '50%', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.06)',
        border: '1px solid rgba(212,175,55,0.25)', marginBottom: '12px'
    },
    emptyTitle: { margin: '0 0 6px', color: '#d4af37', fontSize: '1rem' },
    emptyText: { margin: '0 auto 14px', maxWidth: '480px', color: '#777', fontSize: '0.68rem', lineHeight: 1.5 },
    errorBanner: {
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)',
        borderRadius: '8px', color: '#ff9b9b', fontSize: '0.64rem', lineHeight: 1.45,
        marginBottom: '12px'
    },
    footerNote: {
        display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.56rem',
        padding: '12px 4px', borderTop: '1px solid #1a1a1a', lineHeight: 1.4, marginTop: '16px'
    },

    modalOverlay: {
        position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '14px', background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(4px)', boxSizing: 'border-box'
    },
    formModal: {
        width: '100%', maxWidth: '820px', maxHeight: '92vh', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', background: '#0b0b0b',
        border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
    },
    configModal: {
        width: '100%', maxWidth: '900px', maxHeight: '92vh', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', background: '#0b0b0b',
        border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
    },
    paymentModal: {
        width: '100%', maxWidth: '500px', maxHeight: '92vh', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', background: '#0b0b0b',
        border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
    },
    formHeader: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '10px', padding: '14px', background: '#0a0a0a', borderBottom: '1px solid #1c1c1c',
        flexShrink: 0
    },
    eyebrow: { display: 'block', color: '#d4af37', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '1.2px', marginBottom: '3px' },
    formTitle: { margin: 0, color: '#fff', fontSize: 'clamp(1.05rem, 3vw, 1.35rem)', lineHeight: 1.15, fontWeight: 800 },
    formBody: { flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 },
    formSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '10px' },
    campo: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    campoLabel: { color: '#888', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase' },
    required: { color: '#ff6b6b', fontStyle: 'normal', marginLeft: '2px' },
    campoHint: { color: '#666', fontSize: '0.5rem', lineHeight: 1.3 },
    input: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626',
        borderRadius: '7px', color: '#fff', padding: '9px 10px', fontSize: '0.72rem', outline: 'none'
    },
    textarea: {
        width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid #262626',
        borderRadius: '7px', color: '#fff', padding: '9px 10px', fontSize: '0.7rem',
        lineHeight: 1.45, outline: 'none', resize: 'vertical', fontFamily: 'inherit'
    },
    checkRow: { display: 'flex', alignItems: 'center', gap: '7px', color: '#999', fontSize: '0.62rem', alignSelf: 'end', paddingBottom: '8px' },
    sectionTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginTop: '2px' },
    formSectionTitle: { display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#ddd', fontSize: '0.76rem' },
    sectionHint: { color: '#666', fontSize: '0.52rem' },
    formHelp: { margin: 0, color: '#777', fontSize: '0.6rem', lineHeight: 1.45 },
    photoRow: { display: 'flex', alignItems: 'center', gap: '12px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px' },
    photoPreview: {
        width: '64px', height: '64px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    photoPreviewImg: { width: '100%', height: '100%', objectFit: 'cover' },
    photoCopy: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    photoTitle: { color: '#ddd', fontSize: '0.7rem' },
    photoHint: { color: '#777', fontSize: '0.54rem', lineHeight: 1.35 },
    emergencyBox: {
        display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,187,51,0.04)',
        border: '1px solid rgba(255,187,51,0.25)', borderRadius: '10px', padding: '10px', marginTop: '2px'
    },
    emergencyHint: { color: '#ffbb33', fontSize: '0.5rem', fontWeight: 700 },
    chipWrap: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    selectChip: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111',
        border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.54rem', fontWeight: 700, cursor: 'pointer'
    },
    selectChipActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '5px 9px',
        fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer'
    },
    summaryBox: { display: 'flex', alignItems: 'center', gap: '9px', background: '#080808', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '10px', padding: '10px' },
    summaryIcon: {
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.06)',
        border: '1px solid rgba(212,175,55,0.25)'
    },
    summaryTitle: { color: '#d4af37', fontSize: '0.68rem' },
    summaryText: { margin: '3px 0 0', color: '#888', fontSize: '0.56rem', lineHeight: 1.4 },
    stepper: {
        display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px',
        background: '#080808', borderBottom: '1px solid #1c1c1c', overflowX: 'auto', flexShrink: 0
    },
    stepItem: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
    stepCircle: {
        width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#0e0e0e',
        border: '1px solid #333', color: '#777', cursor: 'default'
    },
    stepCircleActive: { background: '#d4af37', border: '1px solid #d4af37', color: '#000' },
    stepCircleDone: { background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.45)', color: '#4CAF50' },
    stepLabel: { color: '#666', fontSize: '0.52rem', fontWeight: 700, whiteSpace: 'nowrap' },
    stepLabelActive: { color: '#d4af37', fontSize: '0.52rem', fontWeight: 800, whiteSpace: 'nowrap' },
    stepLine: { width: '18px', height: '1px', background: '#222', flexShrink: 0 },
    formFooter: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        padding: '10px 14px', background: '#0a0a0a', borderTop: '1px solid #1c1c1c',
        flexShrink: 0, flexWrap: 'wrap'
    },
    formFooterInfo: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '95px' },
    formFooterActions: { display: 'flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'flex-end' },
    stepCounter: { color: '#666', fontSize: '0.46rem', letterSpacing: '0.6px' },
    stepProgressTrack: { width: '110px', height: '5px', background: '#151515', borderRadius: '999px', overflow: 'hidden' },
    stepProgressFill: { height: '100%', background: '#d4af37', borderRadius: '999px', transition: 'width .2s ease' },

    configTabs: {
        display: 'flex', gap: '4px', padding: '8px 14px', background: '#080808',
        borderBottom: '1px solid #1c1c1c', overflowX: 'auto', flexShrink: 0
    },
    configTab: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent',
        border: '1px solid #222', color: '#888', borderRadius: '999px', padding: '6px 10px',
        fontSize: '0.54rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    configTabActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '999px', padding: '6px 10px',
        fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    configBody: { flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 },
    configLogoRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' },
    configLogo: {
        width: '64px', height: '64px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden',
        background: '#050505', border: '1px solid rgba(212,175,55,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    configLogoImg: { width: '100%', height: '100%', objectFit: 'cover' },
    addRow: { display: 'flex', gap: '6px', alignItems: 'stretch' },
    programChipEditable: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', borderRadius: '999px',
        padding: '4px 8px', fontSize: '0.54rem'
    },
    daysRow: { display: 'flex', flexDirection: 'column', gap: '5px' },
    dayChip: {
        background: '#111', border: '1px solid #2a2a2a', color: '#999', borderRadius: '5px',
        padding: '5px 8px', fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer'
    },
    dayChipActive: {
        background: '#d4af37', border: '1px solid #d4af37', color: '#000', borderRadius: '5px',
        padding: '5px 8px', fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer'
    },
    scheduleForm: { display: 'flex', flexDirection: 'column', gap: '8px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '10px' },
    scheduleActions: { display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' },
    scheduleList: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto' },
    scheduleRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '7px' },
    scheduleTime: { color: '#d4af37', fontSize: '0.66rem', fontWeight: 800, minWidth: '46px' },
    scheduleInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    iconBtnSmall: {
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', border: '1px solid #2a2a2a', color: '#888', borderRadius: '5px', cursor: 'pointer'
    },
    iconBtnDanger: {
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.35)',
        color: '#ff6b6b', borderRadius: '5px', cursor: 'pointer'
    },
    weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: '5px', overflowX: 'auto', marginTop: '4px' },
    weekDay: { background: '#080808', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '6px', minHeight: '80px' },
    weekDayTitle: { display: 'block', color: '#d4af37', fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
    weekClass: { display: 'block', color: '#bbb', fontSize: '0.48rem', lineHeight: 1.35, marginBottom: '3px' },
    weekEmpty: { color: '#333', fontSize: '0.56rem' },
    accessCodeBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#050505', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', padding: '8px' },
    accessCode: { flex: 1, color: '#d4af37', fontSize: '0.9rem', letterSpacing: '2px', textAlign: 'center' },
    linkBox: { display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #1c1c1c', paddingTop: '10px' },
    securityNote: {
        display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(212,175,55,0.04)',
        border: '1px solid rgba(212,175,55,0.18)', borderRadius: '8px', padding: '10px'
    },
    dirtyLabel: { color: '#ffbb33', fontSize: '0.5rem', fontWeight: 800 },
    savedLabel: { color: '#4CAF50', fontSize: '0.5rem', fontWeight: 800 },

    drawer: {
        width: 'min(580px, 100%)', height: '100%', maxHeight: '100dvh', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', background: '#0b0b0b',
        borderLeft: '1px solid rgba(212,175,55,0.35)', boxShadow: '-20px 0 60px rgba(0,0,0,0.7)'
    },
    drawerHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '14px', background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', flexShrink: 0 },
    drawerIdentity: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
    drawerAvatar: {
        width: '56px', height: '56px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)',
        color: '#d4af37', fontSize: '0.8rem', fontWeight: 800, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    },
    drawerAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    drawerName: { margin: 0, color: '#fff', fontSize: 'clamp(1.05rem, 3vw, 1.3rem)', lineHeight: 1.15 },
    drawerMeta: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#888', fontSize: '0.56rem', marginTop: '2px' },
    dot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#444' },
    drawerQuickActions: { display: 'flex', gap: '5px', flexWrap: 'wrap', padding: '8px 14px', borderBottom: '1px solid #1c1c1c', flexShrink: 0 },
    quickAction: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111',
        border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '6px', padding: '5px 8px',
        fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap'
    },
    detailTabs: { display: 'flex', gap: '4px', padding: '8px 14px', background: '#080808', borderBottom: '1px solid #1c1c1c', overflowX: 'auto', flexShrink: 0 },
    detailTab: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent',
        border: '1px solid #222', color: '#888', borderRadius: '7px', padding: '6px 8px',
        fontSize: '0.54rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    detailTabActive: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d4af37',
        border: '1px solid #d4af37', color: '#000', borderRadius: '7px', padding: '6px 8px',
        fontSize: '0.54rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
    },
    drawerBody: { flex: 1, overflowY: 'auto', padding: '14px', minHeight: 0 },
    detailStack: { display: 'flex', flexDirection: 'column', gap: '10px' },
    detailGrid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' },
    detailBlock: { display: 'flex', flexDirection: 'column', gap: '3px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '9px' },
    detailBlockTitle: { display: 'flex', alignItems: 'center', gap: '5px', color: '#d4af37', fontSize: '0.54rem', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '2px' },
    detailLine: { color: '#aaa', fontSize: '0.6rem', lineHeight: 1.45 },
    detailParagraph: { margin: 0, color: '#aaa', fontSize: '0.62rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
    bigDetailValue: { color: '#fff', fontSize: '1.25rem', lineHeight: 1.1, fontWeight: 800 },
    healthAlertBox: { display: 'flex', alignItems: 'center', gap: '9px', background: '#080808', border: '1px solid', borderRadius: '9px', padding: '10px' },
    healthAlertIcon: { width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', border: '1px solid #2a2a2a' },
    healthAlertTitle: { color: '#ddd', fontSize: '0.68rem' },
    healthAlertText: { margin: '3px 0 0', color: '#888', fontSize: '0.58rem', lineHeight: 1.4 },
    emergencyContactName: { color: '#fff', fontSize: '0.78rem', fontWeight: 800 },
    emergencyActions: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '3px' },
    paymentSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', background: '#080808', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '9px', padding: '10px' },
    paymentSummaryValue: { display: 'block', color: '#fff', fontSize: '0.78rem', marginTop: '2px' },
    paymentRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#080808', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '7px' },
    paymentIcon: { width: '30px', height: '30px', flexShrink: 0, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.06)' },
    paymentRowText: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
    paymentNote: { color: '#d4af37', fontSize: '0.5rem' },
    historyRow: { display: 'flex', gap: '8px', borderBottom: '1px solid #151515', padding: '5px 0' },
    historyDate: { color: '#d4af37', fontSize: '0.52rem', minWidth: '55px', fontWeight: 700 },
    historyText: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
    drawerFooter: { display: 'flex', gap: '7px', justifyContent: 'space-between', flexWrap: 'wrap', padding: '10px 14px', background: '#0a0a0a', borderTop: '1px solid #1c1c1c', flexShrink: 0 },
    paymentModalBody: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 },
    paymentCurrent: { display: 'flex', flexDirection: 'column', gap: '2px', background: '#080808', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '9px', padding: '10px' },
    paymentCurrentValue: { color: '#d4af37', fontSize: '1.05rem' },
    paymentCurrentSub: { color: '#777', fontSize: '0.56rem' },
    nextPaymentBox: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: '8px', padding: '9px' },
    nextPaymentValue: { color: '#4CAF50', fontSize: '0.86rem' }
};

const cssGestion = `
    .gestion-root *, .gestion-root *::before, .gestion-root *::after { box-sizing: border-box; }
    .gestion-root { -webkit-tap-highlight-color: transparent; }
    .gestion-root button, .gestion-root input, .gestion-root textarea, .gestion-root select { font-family: inherit; }
    .gestion-root button { transition: transform .12s ease, border-color .18s ease, background .18s ease, color .18s ease; }
    .gestion-root button:active { transform: translateY(1px); }
    .gestion-root button:focus:not(:focus-visible) { outline: none; }
    .gestion-root button:focus-visible, .gestion-root input:focus-visible, .gestion-root textarea:focus-visible, .gestion-root select:focus-visible {
        outline: 2px solid rgba(212,175,55,0.7) !important;
        outline-offset: 2px;
    }
    .gestion-alumno-card { transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
    .gestion-alumno-card:hover { transform: translateY(-2px); border-color: rgba(212,175,55,0.5) !important; box-shadow: 0 10px 30px rgba(0,0,0,0.45); }
    .gestion-row:hover { background: rgba(212,175,55,0.035); }
    .gestion-skeleton { animation: gestionShimmer 1.4s infinite linear; }
    .gestion-modal-overlay { animation: gestionFade .15s ease; }
    .gestion-drawer { animation: gestionSlide .2s ease; }
    .gestion-form-modal, .gestion-config-modal, .gestion-payment-modal { animation: gestionRise .18s ease; }
    @keyframes gestionShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes gestionFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes gestionSlide { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes gestionRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 767px) {
        .gestion-root { padding-left: calc(env(safe-area-inset-left, 0px) + 8px) !important; padding-right: calc(env(safe-area-inset-right, 0px) + 8px) !important; }
        .gestion-title-icon { display: none !important; }
        .gestion-root h1 { font-size: 1rem !important; letter-spacing: 0.5px !important; }
        .gestion-subtitle { font-size: 0.58rem !important; max-width: 52vw !important; }
        .gestion-modal-overlay { padding: 0 !important; align-items: stretch !important; }
        .gestion-form-modal, .gestion-config-modal { width: 100% !important; max-width: none !important; height: 100dvh !important; max-height: 100dvh !important; border-radius: 0 !important; border: none !important; }
        .gestion-payment-modal { width: 100% !important; max-width: 100% !important; max-height: 92dvh !important; border-radius: 14px !important; }
        .gestion-payment-overlay { align-items: center !important; padding: 12px !important; }
        .gestion-payment-modal { height: auto !important; }
        .gestion-step-label { display: none !important; }
        .gestion-form-footer { flex-direction: column !important; align-items: stretch !important; }
        .gestion-form-footer > div:last-child { width: 100%; justify-content: stretch !important; }
        .gestion-form-footer > div:last-child > button { flex: 1 1 0; }
        .gestion-cancel-btn { display: none !important; }
        .gestion-filters { flex-wrap: wrap !important; overflow: visible !important; }
        .gestion-config-tabs, .gestion-detail-tabs { padding-left: 10px !important; padding-right: 10px !important; }
        .gestion-detail-grid2 { grid-template-columns: 1fr !important; }
        .gestion-drawer { width: 100% !important; border-left: none !important; }
    }
    @media (max-width: 420px) {
        .gestion-root .gestion-form-grid { grid-template-columns: 1fr !important; }
        .gestion-root .gestion-step-line { width: 10px !important; }
        .gestion-root .gestion-detail-tabs { gap: 3px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
        .gestion-root *, .gestion-root *::before, .gestion-root *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
        }
    }
`;
