/**
 * Datos y utilidades para la gestión de alumnos y la configuración del dojo.
 * Centralizar aquí los cálculos de pagos, edades, estados y normalización
 * mantiene el componente principal enfocado en la interfaz.
 */

import { localeActual } from '../i18n/translate';

export const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No sé'];
export const GRADOS = ['Blanco', 'Gris', 'Amarilla', 'Naranja', 'Verde', 'Azul', 'Morado', 'Café', 'Negro'];
export const PARENTESCOS = ['Madre', 'Padre', 'Tutor(a)', 'Hermano(a)', 'Cónyuge', 'Hijo(a)', 'Amigo(a)', 'Otro'];
export const MONEDAS = [
    { id: 'MXN', label: 'Peso mexicano (MXN)' },
    { id: 'USD', label: 'Dólar (USD)' },
    { id: 'EUR', label: 'Euro (EUR)' },
    { id: 'COP', label: 'Peso colombiano (COP)' },
    { id: 'ARS', label: 'Peso argentino (ARS)' },
    { id: 'CLP', label: 'Peso chileno (CLP)' },
    { id: 'PEN', label: 'Sol peruano (PEN)' },
    { id: 'BRL', label: 'Real brasileño (BRL)' }
];
export const METODOS_PAGO_DEFAULT = ['Efectivo', 'Transferencia', 'Tarjeta'];
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const isoLocal = (fecha = new Date()) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

export const fechaHoy = () => isoLocal(new Date());

export const parseFechaLocal = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    const texto = String(valor);
    const soloFecha = texto.slice(0, 10);
    const partes = soloFecha.split('-').map(Number);
    if (partes.length === 3 && partes.every(Number.isFinite)) {
        const fecha = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0, 0);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const formatearFecha = (valor, { conAnio = true } = {}) => {
    const fecha = parseFechaLocal(valor);
    if (!fecha) return '—';
    return fecha.toLocaleDateString(localeActual(), {
        day: '2-digit',
        month: 'short',
        ...(conAnio ? { year: 'numeric' } : {})
    });
};

export const formatearFechaHora = (valor) => {
    const fecha = parseFechaLocal(valor);
    if (!fecha) return '—';
    return fecha.toLocaleDateString(localeActual(), { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatearMoneda = (valor, moneda = 'MXN') => {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || valor === '' || valor === null || valor === undefined) return '—';
    try {
        return new Intl.NumberFormat(localeActual(), {
            style: 'currency',
            currency: moneda || 'MXN',
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(numero);
    } catch {
        return `$${numero.toFixed(0)}`;
    }
};

export const calcularEdad = (fechaNacimiento) => {
    const nacimiento = parseFechaLocal(fechaNacimiento);
    if (!nacimiento) return '';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
    return edad >= 0 && edad < 120 ? String(edad) : '';
};

export const sumarMeses = (fechaBase, meses = 1) => {
    const base = parseFechaLocal(fechaBase) || new Date();
    const diaOriginal = base.getDate();
    const resultado = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
    resultado.setMonth(resultado.getMonth() + Math.max(1, Number(meses) || 1));
    const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
    resultado.setDate(Math.min(diaOriginal, ultimoDia));
    return isoLocal(resultado);
};

export const proximoVencimiento = (diaVencimiento = 1) => {
    const dia = Math.min(31, Math.max(1, Number(diaVencimiento) || 1));
    const hoy = new Date();
    let anio = hoy.getFullYear();
    let mes = hoy.getMonth();
    if (hoy.getDate() > dia) {
        mes += 1;
        if (mes > 11) {
            mes = 0;
            anio += 1;
        }
    }
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return isoLocal(new Date(anio, mes, Math.min(dia, ultimoDia)));
};

export const calcularEstadoPago = (fechaPago, activo = true) => {
    if (activo === false) {
        return { key: 'inactivo', label: 'INACTIVO', color: '#777', diff: null };
    }
    const vencimiento = parseFechaLocal(fechaPago);
    if (!vencimiento) {
        return { key: 'sinfecha', label: 'SIN FECHA', color: '#777', diff: null };
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const objetivo = new Date(vencimiento);
    objetivo.setHours(0, 0, 0, 0);
    const diff = Math.ceil((objetivo.getTime() - hoy.getTime()) / 86400000);

    if (diff < 0) return { key: 'atrasado', label: `ATRASADO ${Math.abs(diff)}D`, color: '#ff6b6b', diff };
    if (diff === 0) return { key: 'pronto', label: 'PAGA HOY', color: '#ffbb33', diff };
    if (diff <= 7) return { key: 'pronto', label: `VENCE EN ${diff}D`, color: '#ffbb33', diff };
    return { key: 'aldia', label: 'AL DÍA', color: '#4CAF50', diff };
};

export const crearConfigInicial = (sede = {}) => {
    const programas = Array.isArray(sede.programas) && sede.programas.length
        ? sede.programas
        : ['BJJ Adultos', 'BJJ Kids', 'BJJ Teens', 'No-Gi'];
    const metodosPago = Array.isArray(sede.metodosPago) && sede.metodosPago.length
        ? sede.metodosPago
        : METODOS_PAGO_DEFAULT;
    return {
        nombre: sede.nombreSede || sede.nombre || 'Mi Dojo',
        ciudad: sede.ciudad || '',
        direccion: sede.direccion || '',
        telefono: sede.telefono || '',
        email: sede.email || '',
        instagram: sede.instagram || '',
        logoBase64: sede.logoBase64 || sede.logobase64 || '',
        horarios: Array.isArray(sede.horarios) ? sede.horarios : [],
        programas,
        codigoAcceso: sede.codigoAcceso || '',
        moneda: sede.moneda || 'MXN',
        mensualidadBase: sede.mensualidadBase ?? '',
        diaVencimiento: Math.min(31, Math.max(1, Number(sede.diaVencimiento) || 1)),
        metodosPago
    };
};

export const crearAlumnoVacio = (config = {}) => ({
    nombre: '',
    fotoBase64: '',
    fechaNacimiento: '',
    edad: '',
    telefono: '',
    email: '',
    instagram: '',
    direccion: '',
    tutorNombre: '',
    tutorTelefono: '',
    tipoSangre: '',
    alergias: '',
    condicionEspecial: '',
    medicamentos: '',
    seguroMedico: '',
    medicoTratante: '',
    notasMedicas: '',
    contactoEmergenciaNombre: '',
    contactoEmergenciaTel: '',
    parentescoEmergencia: '',
    autorizaAtencion: false,
    tieneExperiencia: 'no',
    tiempoExperiencia: '',
    gradoActual: 'Blanco',
    academiaAnterior: '',
    programas: [],
    horarios: [],
    fechaPago: proximoVencimiento(config.diaVencimiento || 1),
    diaPago: '',
    montoMensualidad: config.mensualidadBase ?? '',
    metodoPagoPreferido: (config.metodosPago || METODOS_PAGO_DEFAULT)[0] || 'Efectivo',
    notasAdministrativas: '',
    notasTecnicas: '',
    activo: true,
    asistencias: [],
    historialTecnico: [],
    historialPagos: [],
    fechaRegistro: '',
    registradoPor: '',
    ultimaActualizacion: ''
});

export const normalizarAlumno = (alumno = {}, config = {}) => {
    const base = crearAlumnoVacio(config);
    const data = { ...base, ...alumno };
    data.nombre = alumno.nombre || '';
    data.fechaNacimiento = alumno.fechaNacimiento ? String(alumno.fechaNacimiento).slice(0, 10) : '';
    data.edad = alumno.edad || calcularEdad(alumno.fechaNacimiento) || '';
    data.fechaPago = alumno.fechaPago ? String(alumno.fechaPago).slice(0, 10) : base.fechaPago;
    data.programas = Array.isArray(alumno.programas) ? alumno.programas : [];
    data.horarios = Array.isArray(alumno.horarios) ? alumno.horarios : [];
    data.asistencias = Array.isArray(alumno.asistencias) ? alumno.asistencias : [];
    data.historialTecnico = Array.isArray(alumno.historialTecnico) ? alumno.historialTecnico : [];
    data.historialPagos = Array.isArray(alumno.historialPagos) ? alumno.historialPagos : [];
    data.montoMensualidad = alumno.montoMensualidad ?? base.montoMensualidad;
    data.metodoPagoPreferido = alumno.metodoPagoPreferido || base.metodoPagoPreferido;
    data.activo = alumno.activo !== false;
    return data;
};

export const tieneContactoEmergencia = (alumno = {}) => Boolean(
    String(alumno.contactoEmergenciaNombre || '').trim() &&
    String(alumno.contactoEmergenciaTel || '').trim()
);

export const tieneAlertaMedica = (alumno = {}) => Boolean(
    String(alumno.alergias || '').trim() ||
    String(alumno.condicionEspecial || '').trim() ||
    String(alumno.medicamentos || '').trim() ||
    String(alumno.notasMedicas || '').trim()
);

export const resumenAlertaMedica = (alumno = {}) => {
    const alertas = [];
    if (String(alumno.alergias || '').trim()) alertas.push(`Alergias: ${alumno.alergias}`);
    if (String(alumno.condicionEspecial || '').trim()) alertas.push(`Condición: ${alumno.condicionEspecial}`);
    if (String(alumno.medicamentos || '').trim()) alertas.push(`Medicamentos: ${alumno.medicamentos}`);
    return alertas.join(' · ');
};

export const totalAsistencias = (alumno = {}) => (Array.isArray(alumno.asistencias) ? alumno.asistencias.length : 0);

export const ultimaAsistencia = (alumno = {}) => {
    const asistencias = Array.isArray(alumno.asistencias) ? [...alumno.asistencias] : [];
    asistencias.sort((a, b) => String(b).localeCompare(String(a)));
    return asistencias[0] || '';
};

export const historialTecnicoOrdenado = (alumno = {}) => {
    const historial = Array.isArray(alumno.historialTecnico) ? [...alumno.historialTecnico] : [];
    return historial.sort((a, b) => String(b?.fecha || '').localeCompare(String(a?.fecha || '')));
};

export const historialPagosOrdenado = (alumno = {}) => {
    const historial = Array.isArray(alumno.historialPagos) ? [...alumno.historialPagos] : [];
    return historial.sort((a, b) => String(b?.fecha || '').localeCompare(String(a?.fecha || '')));
};

export const etiquetaHorario = (horario = {}) => {
    const hora = horario.hora || '--:--';
    const nombre = horario.nombre || 'Clase';
    return `${hora} · ${nombre}${horario.programa ? ` · ${horario.programa}` : ''}`;
};

export const estadisticasAlumnos = (alumnos = [], config = {}) => {
    const activos = alumnos.filter((alumno) => alumno.activo !== false);
    const mesActual = fechaHoy().slice(0, 7);
    let aldia = 0;
    let porVencer = 0;
    let atrasados = 0;
    let sinFecha = 0;
    let alertas = 0;
    let sinContacto = 0;
    let esperadoMes = 0;
    let cobradoMes = 0;
    let pendienteEstimado = 0;
    let conMensualidad = 0;

    activos.forEach((alumno) => {
        const estado = calcularEstadoPago(alumno.fechaPago, true);
        if (estado.key === 'aldia') aldia += 1;
        else if (estado.key === 'pronto') porVencer += 1;
        else if (estado.key === 'atrasado') atrasados += 1;
        else sinFecha += 1;

        if (tieneAlertaMedica(alumno)) alertas += 1;
        if (!tieneContactoEmergencia(alumno)) sinContacto += 1;

        const monto = Number(alumno.montoMensualidad) || Number(config.mensualidadBase) || 0;
        if (monto > 0) {
            conMensualidad += 1;
            esperadoMes += monto;
            if (estado.key === 'atrasado') pendienteEstimado += monto;
        }

        if (Array.isArray(alumno.historialPagos)) {
            alumno.historialPagos.forEach((pago) => {
                if (String(pago?.fecha || '').slice(0, 7) === mesActual) {
                    cobradoMes += Number(pago.monto) || 0;
                }
            });
        }
    });

    return {
        activos: activos.length,
        aldia,
        porVencer,
        atrasados,
        sinFecha,
        alertas,
        sinContacto,
        esperadoMes,
        cobradoMes,
        pendienteEstimado,
        conMensualidad
    };
};
