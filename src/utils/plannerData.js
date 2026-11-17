/**
 * Datos y utilidades del planeador de clases de BJJ.
 * Mantener aquí las plantillas, tipos de bloque y transformaciones
 * permite que el componente se centre en la interfaz.
 */

export const INTENSIDADES = [
    { id: 'suave', label: 'Suave', color: '#4CAF50' },
    { id: 'media', label: 'Media', color: '#d4af37' },
    { id: 'alta', label: 'Alta', color: '#ff6b6b' }
];

export const TIPOS_BLOQUE = {
    calentamiento: {
        label: 'Calentamiento',
        icon: 'flame',
        color: '#ff9f43',
        descripcion: 'Movilidad, activación y entrada en calor.',
        minutos: 10,
        campos: [
            { key: 'ligero', label: 'Calentamiento ligero', tipo: 'textarea', placeholder: 'Movilidad articular, trote suave, gimnasia básica...' },
            { key: 'intenso', label: 'Calentamiento intenso', tipo: 'textarea', placeholder: 'Drills de desplazamiento, shrimp, tumbos, pummeling...' }
        ]
    },
    drills: {
        label: 'Drills',
        icon: 'activity',
        color: '#d4af37',
        descripcion: 'Repetición de movimientos y patrones.',
        minutos: 15,
        campos: [
            { key: 'contenido', label: 'Drills a realizar', tipo: 'textarea', placeholder: 'Secuencias, desplazamientos, repeticiones...' },
            { key: 'repeticiones', label: 'Series / repeticiones', tipo: 'text', placeholder: 'Ej. 3 series de 10 por lado' }
        ]
    },
    tecnica: {
        label: 'Técnica',
        icon: 'target',
        color: '#4CAF50',
        descripcion: 'Enseñanza, corrección y práctica guiada.',
        minutos: 25,
        campos: [
            { key: 'tecnica', label: 'Técnica principal', tipo: 'text', placeholder: 'Ej. Triángulo desde guardia cerrada' },
            { key: 'detalles', label: 'Detalles y progresión', tipo: 'textarea', placeholder: 'Pasos, correcciones, variantes...' },
            { key: 'puntosClave', label: 'Puntos clave', tipo: 'textarea', placeholder: 'Errores comunes y detalles que marcan la diferencia.' }
        ]
    },
    cla: {
        label: 'CLA / Dinámica',
        icon: 'swords',
        color: '#8fa8ff',
        descripcion: 'Juego con restricciones y objetivo claro.',
        minutos: 15,
        campos: [
            { key: 'modalidad', label: 'Modalidad / posición', tipo: 'text', placeholder: 'Ej. Media guardia, espalda, pies a la pared...' },
            { key: 'limitantes', label: 'Restricciones', tipo: 'text', placeholder: 'Ej. Sin cerrar manos, solo una mano, sin fuerza...' },
            { key: 'atacante', label: 'Objetivo del atacante', tipo: 'text', placeholder: 'Qué debe conseguir para ganar el juego.' },
            { key: 'defensor', label: 'Objetivo del defensor', tipo: 'text', placeholder: 'Qué debe conseguir para ganar el juego.' },
            { key: 'rondas', label: 'Rondas', tipo: 'number', placeholder: '5' }
        ]
    },
    sparring: {
        label: 'Sparring',
        icon: 'swords',
        color: '#ff6b6b',
        descripcion: 'Combate controlado, específico o libre.',
        minutos: 20,
        campos: [
            { key: 'reglas', label: 'Reglas del sparring', tipo: 'textarea', placeholder: 'Posición inicial, objetivos, restricciones...' },
            { key: 'rondas', label: 'Rondas', tipo: 'number', placeholder: '5' },
            { key: 'contenido', label: 'Notas del profesor', tipo: 'textarea', placeholder: 'Qué observar, quién descansa, cambios de pareja...' }
        ]
    },
    movilidad: {
        label: 'Movilidad',
        icon: 'activity',
        color: '#4dd0e1',
        descripcion: 'Preparación articular y control corporal.',
        minutos: 10,
        campos: [
            { key: 'contenido', label: 'Trabajo de movilidad', tipo: 'textarea', placeholder: 'Cadera, hombros, columna, tobillos...' }
        ]
    },
    enfriamiento: {
        label: 'Enfriamiento',
        icon: 'heart',
        color: '#9e9e9e',
        descripcion: 'Vuelta a la calma y cierre de clase.',
        minutos: 10,
        campos: [
            { key: 'contenido', label: 'Cierre de clase', tipo: 'textarea', placeholder: 'Estiramientos, respiración, conclusiones...' }
        ]
    },
    nota: {
        label: 'Nota / Teoría',
        icon: 'notes',
        color: '#b0a06a',
        descripcion: 'Conceptos, tareas y recordatorios.',
        minutos: 5,
        campos: [
            { key: 'contenido', label: 'Nota para la clase', tipo: 'textarea', placeholder: 'Concepto, tarea o recordatorio para los alumnos.' }
        ]
    }
};

export const TIPOS_CLASE = [
    { id: 'tradicional', label: 'Tradicional' },
    { id: 'fundamentos', label: 'Fundamentos' },
    { id: 'competencia', label: 'Competición' },
    { id: 'cla', label: 'CLA / Dinámicas' },
    { id: 'sparring', label: 'Sparring' },
    { id: 'infantil', label: 'Infantil' },
    { id: 'personalizada', label: 'Personalizada' }
];

export const NIVELES = ['Todos', 'Principiantes', 'Intermedio', 'Avanzado', 'Competición', 'Infantil'];

export const PLANTILLAS = [
    {
        id: 'tradicional',
        nombre: 'Tradicional',
        detalle: 'Ligero, intenso, drills, técnica y sparring.',
        duracion: 90,
        tipoClase: 'tradicional',
        bloques: [
            { tipo: 'calentamiento', titulo: 'Calentamiento ligero', minutos: 10, ligero: 'Movilidad articular, trote suave, gimnasia básica y juegos de activación.' },
            { tipo: 'calentamiento', titulo: 'Calentamiento intenso', minutos: 10, intenso: 'Drills de desplazamiento, shrimp, tumbos, espalda, pummeling y entradas.' },
            { tipo: 'drills', titulo: 'Drills técnicos', minutos: 15, contenido: 'Repeticiones del movimiento principal de la semana.' },
            { tipo: 'tecnica', titulo: 'Técnica principal', minutos: 25, tecnica: 'Técnica de la semana', detalles: 'Explicación, correcciones y práctica guiada por parejas.', puntosClave: 'Conexión, base, presión y timing.' },
            { tipo: 'sparring', titulo: 'Sparring específico', minutos: 15, reglas: 'Desde la posición trabajada. Rondas cortas con un objetivo claro.', rondas: 5 },
            { tipo: 'sparring', titulo: 'Sparring libre', minutos: 15, reglas: 'Rondas libres controladas. Prioriza técnica sobre fuerza.', rondas: 5 }
        ]
    },
    {
        id: 'fundamentos',
        nombre: 'Fundamentos 60′',
        detalle: 'Base técnica, movilidad y sparring posicional.',
        duracion: 60,
        tipoClase: 'fundamentos',
        bloques: [
            { tipo: 'movilidad', titulo: 'Movilidad y activación', minutos: 10, contenido: 'Cadera, hombros, columna y tobillos. Juegos de desplazamiento.' },
            { tipo: 'tecnica', titulo: 'Técnica base', minutos: 25, tecnica: 'Fundamento del día', detalles: 'Demostración lenta, práctica por parejas y correcciones.', puntosClave: 'Postura, bases y control.' },
            { tipo: 'drills', titulo: 'Drills de fijación', minutos: 10, contenido: 'Repeticiones del fundamento con resistencia progresiva.' },
            { tipo: 'sparring', titulo: 'Sparring posicional', minutos: 15, reglas: 'Empieza desde la posición trabajada. Cambio de pareja cada ronda.', rondas: 4 }
        ]
    },
    {
        id: 'competencia',
        nombre: 'Competición 120′',
        detalle: 'Alta intensidad, situaciones y sparring duro.',
        duracion: 120,
        tipoClase: 'competencia',
        bloques: [
            { tipo: 'calentamiento', titulo: 'Activación competitiva', minutos: 15, intenso: 'Movilidad dinámica, drills, entradas y ritmo de combate.' },
            { tipo: 'drills', titulo: 'Drills de competición', minutos: 20, contenido: 'Entradas, defensas de derribo, guardia y salidas.' },
            { tipo: 'tecnica', titulo: 'Situaciones de combate', minutos: 20, tecnica: 'Escenarios del día', detalles: 'Puntos, salidas de situaciones difíciles y gestión del tiempo.', puntosClave: 'Decisión bajo presión.' },
            { tipo: 'sparring', titulo: 'Sparring duro', minutos: 50, reglas: 'Rondas de competición con puntuación y descansos controlados.', rondas: 8 },
            { tipo: 'enfriamiento', titulo: 'Vuelta a la calma', minutos: 15, contenido: 'Estiramientos, respiración y análisis breve de la sesión.' }
        ]
    },
    {
        id: 'cla',
        nombre: 'CLA / Dinámicas 75′',
        detalle: 'Juegos con restricciones para descubrir soluciones.',
        duracion: 75,
        tipoClase: 'cla',
        bloques: [
            { tipo: 'calentamiento', titulo: 'Activación y juego', minutos: 10, ligero: 'Movilidad, desplazamientos y un juego de activación.' },
            { tipo: 'cla', titulo: 'Juego 1', minutos: 15, modalidad: 'Guardia vs presión', limitantes: 'Sin cerrar manos', atacante: 'Pasar la guardia', defensor: 'Recuperar la guardia', rondas: 4 },
            { tipo: 'cla', titulo: 'Juego 2', minutos: 15, modalidad: 'Espalda', limitantes: 'Sin usar fuerza', atacante: 'Mantener la espalda', defensor: 'Escapar y quedar arriba', rondas: 4 },
            { tipo: 'cla', titulo: 'Juego 3', minutos: 15, modalidad: 'Derribos', limitantes: 'Solo una mano', atacante: 'Derribar', defensor: 'Mantener de pie', rondas: 4 },
            { tipo: 'sparring', titulo: 'Sparring libre', minutos: 20, reglas: 'Aplica las soluciones que aparecieron en los juegos.', rondas: 5 }
        ]
    },
    {
        id: 'sparring',
        nombre: 'Solo sparring 60′',
        detalle: 'Sesión corta para entrenar combate.',
        duracion: 60,
        tipoClase: 'sparring',
        bloques: [
            { tipo: 'movilidad', titulo: 'Movilidad y activación', minutos: 10, contenido: 'Articulaciones, cadera, hombros y ritmo.' },
            { tipo: 'sparring', titulo: 'Sparring específico', minutos: 20, reglas: 'Posiciones del día. Cambio de pareja cada ronda.', rondas: 5 },
            { tipo: 'sparring', titulo: 'Sparring libre', minutos: 30, reglas: 'Rondas libres con control. Prioriza técnica y seguridad.', rondas: 6 }
        ]
    },
    {
        id: 'infantil',
        nombre: 'Infantil 45′',
        detalle: 'Juego, técnica y valores en formato corto.',
        duracion: 45,
        tipoClase: 'infantil',
        bloques: [
            { tipo: 'calentamiento', titulo: 'Juego de activación', minutos: 10, ligero: 'Carreras, roles y juego con reglas simples.' },
            { tipo: 'tecnica', titulo: 'Técnica jugada', minutos: 15, tecnica: 'Fundamento del día', detalles: 'Explicación breve y juego técnico por parejas.', puntosClave: 'Escuchar, respetar al compañero y divertirse.' },
            { tipo: 'cla', titulo: 'Juego con restricción', minutos: 10, modalidad: 'Posición del día', limitantes: 'Sin usar fuerza', atacante: 'Conseguir el objetivo', defensor: 'Evitarlo', rondas: 4 },
            { tipo: 'sparring', titulo: 'Sparring jugado', minutos: 10, reglas: 'Rondas cortas con objetivo. Celebra el esfuerzo y el respeto.', rondas: 4 }
        ]
    }
];

export const fechaHoy = () => {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
};

export const crearId = (prefijo = 'bloque') => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefijo}-${crypto.randomUUID()}`;
    } catch {
        /* fallback */
    }
    return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const nuevoBloque = (tipo = 'tecnica', datos = {}) => {
    const config = TIPOS_BLOQUE[tipo] || TIPOS_BLOQUE.tecnica;
    return {
        id: crearId(),
        tipo,
        titulo: config.label,
        minutos: config.minutos,
        intensidad: 'media',
        ...datos
    };
};

const mapaTiposLegacy = {
    calentamiento: 'calentamiento',
    drills: 'drills',
    drill: 'drills',
    tecnica: 'tecnica',
    técnica: 'tecnica',
    cla: 'cla',
    sparring: 'sparring',
    movilidad: 'movilidad',
    enfriamiento: 'enfriamiento',
    nota: 'nota',
    teoria: 'nota',
    teoría: 'nota'
};

export const normalizarTipo = (tipo) => {
    const limpio = String(tipo || '').trim().toLowerCase();
    return mapaTiposLegacy[limpio] || 'nota';
};

export const normalizarBloque = (bloque = {}, index = 0) => {
    const tipo = normalizarTipo(bloque.tipo);
    const config = TIPOS_BLOQUE[tipo] || TIPOS_BLOQUE.nota;
    return {
        ...bloque,
        id: bloque.id || `legacy-${index}-${Date.now()}`,
        tipo,
        titulo: bloque.titulo || config.label,
        minutos: Math.max(0, Number(bloque.minutos) || config.minutos),
        intensidad: INTENSIDADES.some(i => i.id === bloque.intensidad) ? bloque.intensidad : 'media'
    };
};

export const sumarMinutos = (bloques = []) => bloques.reduce((total, bloque) => total + Math.max(0, Number(bloque.minutos) || 0), 0);

export const normalizarClase = (clase = {}) => {
    const bloques = (clase.bloques || []).map(normalizarBloque);
    return {
        ...clase,
        esPublica: clase.visibilidad ? clase.visibilidad === 'global' : false,
        bloques,
        duracionObjetivo: Math.max(0, Number(clase.duracionObjetivo) || sumarMinutos(bloques)),
        tipoClase: clase.tipoClase || 'personalizada',
        nivel: clase.nivel || 'Todos',
        asistencia: clase.asistencia && typeof clase.asistencia === 'object' ? clase.asistencia : {},
        comentarios: Array.isArray(clase.comentarios) ? clase.comentarios : [],
        feedback: clase.feedback && typeof clase.feedback === 'object' ? clase.feedback : null
    };
};

export const crearClaseVacia = () => ({
    titulo: '',
    fecha: fechaHoy(),
    esPublica: false,
    tipoClase: 'tradicional',
    nivel: 'Todos',
    duracionObjetivo: 60,
    bloques: [
        nuevoBloque('calentamiento', { titulo: 'Calentamiento ligero', minutos: 10 }),
        nuevoBloque('tecnica', { minutos: 25 }),
        nuevoBloque('sparring', { titulo: 'Sparring específico', minutos: 20 })
    ]
});

export const formatearDuracion = (minutos = 0) => {
    const total = Math.max(0, Math.round(Number(minutos) || 0));
    if (total < 60) return `${total} min`;
    const horas = Math.floor(total / 60);
    const resto = total % 60;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
};

export const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';
    const partes = String(fecha).split('-').map(Number);
    if (partes.length !== 3 || partes.some(n => !Number.isFinite(n))) return fecha;
    const [anio, mes, dia] = partes;
    const fechaLocal = new Date(anio, mes - 1, dia);
    if (Number.isNaN(fechaLocal.getTime())) return fecha;
    return fechaLocal.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const etiquetaTipoClase = (id) => TIPOS_CLASE.find(t => t.id === id)?.label || 'Personalizada';

export const textoVisibilidad = (esPublica) => (esPublica ? 'Global' : 'Mi dojo');

export const descripcionBreveBloque = (bloque) => {
    const tipo = normalizarTipo(bloque.tipo);
    if (tipo === 'cla') {
        return [bloque.modalidad, bloque.limitantes, bloque.atacante, bloque.defensor].filter(Boolean).join(' · ');
    }
    if (tipo === 'sparring') return [bloque.reglas, bloque.contenido].filter(Boolean).join(' · ');
    if (tipo === 'tecnica') return [bloque.tecnica, bloque.detalles, bloque.puntosClave].filter(Boolean).join(' · ');
    if (tipo === 'calentamiento') return [bloque.ligero, bloque.intenso].filter(Boolean).join(' · ');
    if (tipo === 'drills') return [bloque.contenido, bloque.repeticiones].filter(Boolean).join(' · ');
    return bloque.contenido || '';
};

export const resumenClase = (clase) => {
    const normalizada = normalizarClase(clase);
    const lineas = [
        `CLASE: ${normalizada.titulo || 'Sin título'}`,
        `${formatearFecha(normalizada.fecha)} · ${formatearDuracion(sumarMinutos(normalizada.bloques))}`,
        `${etiquetaTipoClase(normalizada.tipoClase)} · Nivel ${normalizada.nivel}`,
        `Visibilidad: ${textoVisibilidad(normalizada.esPublica)}${normalizada.autorNombre ? ` · ${normalizada.autorNombre}` : ''}${normalizada.dojoNombre ? ` (${normalizada.dojoNombre})` : ''}`,
        ''
    ];
    normalizada.bloques.forEach((bloque, index) => {
        const descripcion = descripcionBreveBloque(bloque);
        lineas.push(`${index + 1}. ${bloque.titulo || 'Bloque'} (${bloque.minutos} min)${descripcion ? `: ${descripcion}` : ''}`);
    });
    return lineas.join('\n').slice(0, 1600);
};
