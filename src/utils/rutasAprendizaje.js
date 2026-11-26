/**
 * RUTAS DE APRENDIZAJE
 * ---------------------------------------------------------------------------
 * Capa compartida entre el constructor (admin), el mapa, la búsqueda y el
 * reproductor. Normaliza videos dinámicos (Drive / YouTube), resuelve las
 * lecciones de una ruta y centraliza quién puede ver qué.
 *
 * El Vault estático sigue viviendo en `src/data`. Aquí solo se agrega la capa
 * dinámica que el maestro publica desde Firestore.
 */
import { normalizar, clasificarVideo, POSICIONES, TIPOS, POSICION_GENERAL, TIPO_GENERAL } from '../data/taxonomia';
import { obtenerTecnica, tecnicasDeCurso } from '../data/vaultIndex';

export const TIPOS_RUTA = [
    { id: 'completa', nombre: 'Mapa completo', descripcion: 'Libera una ruta principal y sus cursos base.' },
    { id: 'rama', nombre: 'Rama específica', descripcion: 'Libera solo las secciones y lecciones elegidas.' }
];

export const TIPOS_DESTINO = [
    { id: 'sede', nombre: 'Dojos / sedes', icono: 'dojo', descripcion: 'Todos los alumnos e instructores de la sede.' },
    { id: 'usuario', nombre: 'Usuarios', icono: 'user', descripcion: 'Una cuenta específica por UID.' },
    { id: 'profesor', nombre: 'Profesores', icono: 'graduation', descripcion: 'Profesores de la academia.' },
    { id: 'instructor', nombre: 'Instructores', icono: 'users', descripcion: 'Instructores de una sede.' }
];

export const NIVELES = ['Todos', 'Principiante', 'Intermedio', 'Avanzado', 'Competencia'];

export const MODALIDADES = ['AMBOS', 'GI', 'NO GI'];

export const OPCIONES_POSICION = [...POSICIONES.map((p) => p.nombre), POSICION_GENERAL];
export const OPCIONES_TIPO = [...TIPOS.map((t) => t.nombre), TIPO_GENERAL];

const ID_DRIVE = /^[a-zA-Z0-9_-]{20,}$/;
const ID_YOUTUBE = /^[a-zA-Z0-9_-]{11}$/;

const unicos = (lista = []) => [...new Set(lista.map((v) => String(v).trim()).filter(Boolean))];

// ---------------------------------------------------------------------------
// EXTRACCIÓN DE IDs
// ---------------------------------------------------------------------------
export const extraerDriveId = (valor = '') => {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    if (ID_DRIVE.test(texto)) return texto;

    const patrones = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/,
        /\/uc\?export=download&id=([a-zA-Z0-9_-]+)/
    ];
    for (const patron of patrones) {
        const match = texto.match(patron);
        if (match?.[1]) return match[1];
    }
    return '';
};

export const extraerYoutubeId = (valor = '') => {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    if (ID_YOUTUBE.test(texto)) return texto;

    const patrones = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/embed\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
        /\/live\/([a-zA-Z0-9_-]{11})/
    ];
    for (const patron of patrones) {
        const match = texto.match(patron);
        if (match?.[1]) return match[1];
    }
    return '';
};

export const detectarFuente = (valor = '') => {
    const texto = String(valor || '').trim();
    if (/youtu\.?be/i.test(texto)) return 'youtube';
    if (/drive\.google|docs\.google/i.test(texto)) return 'drive';
    return '';
};

export const construirUrlVideo = (video = {}) => {
    const fuente = video.fuente === 'youtube' ? 'youtube' : 'drive';
    if (fuente === 'youtube') {
        return video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '';
    }
    return video.driveId ? `https://drive.google.com/file/d/${video.driveId}/view` : '';
};

// ---------------------------------------------------------------------------
// NORMALIZACIÓN DE VIDEOS DINÁMICOS
// Igual que `vaultIndex`, el video dinámico se expone con la misma forma que
// una técnica para que búsqueda, mapa y reproductor lo consuman sin adaptadores.
// ---------------------------------------------------------------------------
export const normalizarVideoDinamico = (doc = {}) => {
    const fuente = doc.fuente === 'youtube' ? 'youtube' : 'drive';
    const driveId = doc.driveId || (fuente === 'drive' ? extraerDriveId(doc.url || '') : '');
    const youtubeId = doc.youtubeId || (fuente === 'youtube' ? extraerYoutubeId(doc.url || '') : '');
    const id = doc.id || driveId || youtubeId;
    const nombre = String(doc.nombre || doc.titulo || 'Video sin título').trim();
    const cursoTitulo = String(doc.cursoTitulo || 'Videos propios').trim();
    const autor = String(doc.autor || doc.academia || 'La Fortuna').trim();
    const nivel = doc.nivel || 'Todos';
    const etiquetasManuales = Array.isArray(doc.etiquetas)
        ? doc.etiquetas
        : String(doc.etiquetas || '').split(',');

    const clasificacion = clasificarVideo({
        cursoKey: cursoTitulo,
        curso: {
            titulo: cursoTitulo,
            autor,
            eje: Array.isArray(doc.ejes) ? doc.ejes : [],
            tags: unicos([cursoTitulo, autor, ...etiquetasManuales])
        },
        volumen: { nombre: doc.volumenNombre || nivel },
        parte: { id, nombre, subcategoria: doc.subcategoria || '', categoria: doc.categoria || '' }
    });

    const posicion = doc.posicion && (doc.posicion !== 'AUTO') ? doc.posicion : clasificacion.posicion;
    const tipo = doc.tipo && (doc.tipo !== 'AUTO') ? doc.tipo : clasificacion.tipo;
    const modalidad = doc.modalidad && doc.modalidad !== 'AUTO' ? doc.modalidad : clasificacion.modalidad;
    const etiquetas = unicos([...etiquetasManuales, ...(clasificacion.etiquetas || [])])
        .map((e) => String(e).toUpperCase())
        .slice(0, 12);

    return {
        id,
        docId: doc.docId || doc.id || '',
        nombre,
        titulo: nombre,
        cursoId: doc.cursoId || `dinamico-${normalizar(cursoTitulo).replace(/\s+/g, '-')}`,
        cursoTitulo,
        autor,
        posicion,
        tipo,
        modalidad,
        etiquetas,
        nivel,
        duracion: doc.duracion || '',
        descripcion: doc.descripcion || '',
        fuente,
        driveId,
        youtubeId,
        url: doc.url || construirUrlVideo({ fuente, driveId, youtubeId }),
        activo: doc.activo !== false,
        dinamico: true,
        orden: Number(doc.orden) || 0,
        creadoEn: doc.creadoEn || '',
        busca: normalizar([
            nombre,
            cursoTitulo,
            autor,
            posicion,
            tipo,
            modalidad,
            nivel,
            etiquetas.join(' '),
            doc.descripcion || ''
        ].filter(Boolean).join(' '))
    };
};

export const esVideoValido = (video = {}) => {
    if (!video.nombre) return false;
    if (video.fuente === 'youtube') return Boolean(video.youtubeId);
    return Boolean(video.driveId);
};

// ---------------------------------------------------------------------------
// BORRADORES
// ---------------------------------------------------------------------------
export const crearVideoVacio = () => ({
    fuente: 'drive',
    url: '',
    nombre: '',
    cursoTitulo: 'Videos propios',
    autor: 'La Fortuna',
    nivel: 'Todos',
    posicion: 'AUTO',
    tipo: 'AUTO',
    modalidad: 'AUTO',
    etiquetas: '',
    descripcion: '',
    duracion: ''
});

export const crearSeccionVacia = (indice = 0) => ({
    id: `seccion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    titulo: `Sección ${indice + 1}`,
    descripcion: '',
    lecciones: []
});

export const crearRutaVacia = () => ({
    id: '',
    nombre: '',
    descripcion: '',
    tipo: 'rama',
    estado: 'borrador',
    icono: 'route',
    color: '#d4af37',
    nivel: 'Todos',
    cursosLiberados: [],
    secciones: [],
    creadaPor: '',
    creadaEn: '',
    actualizadaEn: ''
});

// ---------------------------------------------------------------------------
// LECCIONES Y PROGRESO
// ---------------------------------------------------------------------------
export const leccionesDeRuta = (ruta) => (ruta?.secciones || []).flatMap((seccion, sIndice) => (
    (seccion.lecciones || []).map((leccion, lIndice) => ({
        ...leccion,
        seccionId: seccion.id,
        seccionTitulo: seccion.titulo,
        seccionIndice: sIndice,
        leccionIndice: lIndice
    }))
));

export const resolverLeccion = (leccion, videosPorId) => {
    if (!leccion) return null;
    if (leccion.tipo === 'video') {
        const video = videosPorId instanceof Map
            ? videosPorId.get(leccion.ref)
            : videosPorId?.[leccion.ref];
        if (!video) return null;
        return {
            titulo: video.nombre,
            id: video.id,
            fuente: video.fuente,
            driveId: video.driveId,
            youtubeId: video.youtubeId,
            cursoTitulo: video.cursoTitulo,
            duracion: video.duracion || '',
            seccionId: leccion.seccionId,
            seccionTitulo: leccion.seccionTitulo
        };
    }

    const tecnica = obtenerTecnica(leccion.ref);
    if (!tecnica) {
        return leccion.titulo
            ? {
                titulo: leccion.titulo,
                id: leccion.ref,
                fuente: 'drive',
                cursoTitulo: leccion.cursoTitulo || '',
                seccionId: leccion.seccionId,
                seccionTitulo: leccion.seccionTitulo
            }
            : null;
    }
    return {
        titulo: tecnica.nombre,
        id: tecnica.id,
        fuente: 'drive',
        cursoTitulo: tecnica.cursoTitulo,
        duracion: '',
        seccionId: leccion.seccionId,
        seccionTitulo: leccion.seccionTitulo
    };
};

export const mapaVideos = (videos = []) => {
    const mapa = new Map();
    videos.forEach((doc) => {
        const normalizado = normalizarVideoDinamico(doc);
        if (normalizado.id) mapa.set(normalizado.id, normalizado);
    });
    return mapa;
};

export const progresoRuta = (ruta, vistos = [], videosPorId = new Map()) => {
    const lecciones = leccionesDeRuta(ruta)
        .map((leccion) => resolverLeccion(leccion, videosPorId))
        .filter(Boolean);
    const vistosSet = new Set(vistos);
    const completadas = lecciones.filter((l) => vistosSet.has(l.id)).length;
    return {
        total: lecciones.length,
        completadas,
        porcentaje: lecciones.length ? Math.round((completadas / lecciones.length) * 100) : 0
    };
};

export const adyacenteEnRuta = (video, direccion, rutas = [], videosPorId = new Map()) => {
    if (!video?.rutaId) return null;
    const ruta = rutas.find((r) => r.id === video.rutaId);
    if (!ruta) return null;
    const lecciones = leccionesDeRuta(ruta)
        .map((leccion) => resolverLeccion(leccion, videosPorId))
        .filter(Boolean);
    const indice = lecciones.findIndex((l) => l.id === video.id);
    if (indice === -1) return null;
    const destino = lecciones[indice + (direccion === 'next' ? 1 : -1)];
    if (!destino) return null;
    return {
        titulo: destino.titulo,
        id: destino.id,
        fuente: destino.fuente,
        driveId: destino.driveId,
        youtubeId: destino.youtubeId,
        cursoTitulo: destino.cursoTitulo,
        rutaId: ruta.id,
        seccionId: destino.seccionId
    };
};

// ---------------------------------------------------------------------------
// ACCESO
// ---------------------------------------------------------------------------
export const esAdminRutas = (usuario) => usuario?.rol === 'admin';

const asignacionVigente = (asignacion) => {
    if (!asignacion) return false;
    if (asignacion.estado === 'inactiva') return false;
    if (asignacion.expiraEn) {
        const fin = new Date(asignacion.expiraEn);
        if (!Number.isNaN(fin.getTime()) && fin.getTime() < Date.now()) return false;
    }
    return true;
};

export const coincideDestino = (asignacion, usuario) => {
    if (!asignacion || !usuario || !asignacionVigente(asignacion)) return false;
    const tipo = asignacion.destinoTipo;
    if (tipo === 'global') return true;
    const uid = usuario.uid || '';
    const sedeId = usuario.sedeId || '';
    const teamId = usuario.teamId || usuario.academiaId || '';
    const destino = asignacion.destinoId || '';

    if (['usuario', 'profesor', 'instructor'].includes(tipo)) {
        return Boolean(destino) && destino === uid;
    }
    if (tipo === 'sede' || tipo === 'dojo') {
        if (!destino) return false;
        if (destino === sedeId || destino === teamId) return true;
        const teamSede = asignacion.destinoTeamId || '';
        return Boolean(teamSede) && teamSede === teamId;
    }
    if (tipo === 'academia' || tipo === 'team') {
        const academiaId = usuario.academiaId || '';
        return (Boolean(destino) && (destino === academiaId || destino === teamId)) ||
            (Boolean(asignacion.destinoTeamId) && asignacion.destinoTeamId === teamId);
    }
    return false;
};

export const puedeVerRuta = (usuario, ruta, asignaciones = []) => {
    if (!usuario || !ruta) return false;
    if (esAdminRutas(usuario)) return true;
    if ((ruta.estado || 'borrador') !== 'publicada') return false;
    return asignaciones.some((a) => a.rutaId === ruta.id && coincideDestino(a, usuario));
};

export const rutasParaUsuario = (usuario, rutas = [], asignaciones = []) => (
    rutas
        .filter((ruta) => puedeVerRuta(usuario, ruta, asignaciones))
        .sort((a, b) => String(b.actualizadaEn || '').localeCompare(String(a.actualizadaEn || '')))
);

/**
 * Construye el paquete de acceso que consumen el mapa, la búsqueda y el
 * reproductor. `ids` son lecciones exactas liberadas; `cursos` son cursos
 * completos liberados por una ruta de tipo "mapa completo".
 */
export const construirAccesoRutas = (usuario, { rutas = [], videos = [], asignaciones = [] } = {}) => {
    const liberadas = rutasParaUsuario(usuario, rutas, asignaciones);
    const videosPorId = mapaVideos(videos);
    const ids = new Set();
    const cursos = new Set();
    const videosLiberados = new Map();

    liberadas.forEach((ruta) => {
        (ruta.cursosLiberados || []).forEach((cursoId) => cursos.add(cursoId));
        leccionesDeRuta(ruta).forEach((leccion) => {
            if (!leccion.ref) return;
            ids.add(leccion.ref);
            if (leccion.tipo === 'video' && videosPorId.has(leccion.ref)) {
                videosLiberados.set(leccion.ref, videosPorId.get(leccion.ref));
            }
        });
    });

    if (esAdminRutas(usuario)) {
        videosPorId.forEach((video, id) => videosLiberados.set(id, video));
    }

    return { ids, cursos, liberadas, videosLiberados, videosPorId };
};

export const idsCursosParaLeccion = (cursoId) => tecnicasDeCurso(cursoId).map((t) => t.id);

export { normalizar };
