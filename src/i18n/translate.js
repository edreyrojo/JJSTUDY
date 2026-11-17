/**
 * MOTOR DE TRADUCCIÓN
 * ---------------------------------------------------------------------------
 * La app se escribió originalmente en español. El diccionario traduce las
 * frases exactas y los patrones dinámicos; la capa DOM aplica el resultado
 * sobre el contenido ya renderizado sin tocar el runtime de React.
 *
 * - `es` devuelve el texto original.
 * - `en` busca la frase exacta y, si no existe, prueba patrones para textos
 *   dinámicos (contadores, pasos, etc.).
 *
 * El contenido del Vault (títulos de cursos y nombres de técnicas) se conserva
 * tal como lo escribió el autor.
 */
import { COMMON } from './dictionary/common';
import { LEARNING } from './dictionary/learning';
import { MANAGEMENT } from './dictionary/management';
import { TAXONOMY } from './dictionary/taxonomy';

let idiomaRuntime = 'es';

export const setRuntimeLang = (idioma) => {
    idiomaRuntime = idioma === 'en' ? 'en' : 'es';
};

export const getRuntimeLang = () => idiomaRuntime;

export const localeActual = () => (idiomaRuntime === 'en' ? 'en-US' : 'es-MX');

const normalizarClave = (texto) => String(texto).replace(/\s+/g, ' ').trim().toLowerCase();

const DICCIONARIO = {
    ...TAXONOMY,
    ...MANAGEMENT,
    ...LEARNING,
    ...COMMON,
};

// Índice exacto (conserva mayúsculas) e índice flexible (ignora mayúsculas
// y espacios repetidos) para frases escritas con otra capitalización.
const DIRECTO = new Map(Object.entries(DICCIONARIO));
const INDICE = new Map();
Object.entries(DICCIONARIO).forEach(([es, en]) => {
    const clave = normalizarClave(es);
    if (clave && !INDICE.has(clave)) INDICE.set(clave, en);
});

const plural = (n, uno, varios) => (String(n) === '1' ? uno : varios);

const PATRONES = [
    { re: /^(\d+)\s+videos?$/i, en: (m, n) => `${n} ${plural(n, 'video', 'videos')}` },
    { re: /^(\d+)\s+cursos?$/i, en: (m, n) => `${n} ${plural(n, 'course', 'courses')}` },
    { re: /^(\d+)\s+lecciones?$/i, en: (m, n) => `${n} ${plural(n, 'lesson', 'lessons')}` },
    { re: /^(\d+)\s+secciones?$/i, en: (m, n) => `${n} ${plural(n, 'section', 'sections')}` },
    { re: /^(\d+)\s+alumnos?$/i, en: (m, n) => `${n} ${plural(n, 'student', 'students')}` },
    { re: /^(\d+)\s+destinos?$/i, en: (m, n) => `${n} ${plural(n, 'target', 'targets')}` },
    { re: /^(\d+)\s+asignaciones?$/i, en: (m, n) => `${n} ${plural(n, 'assignment', 'assignments')}` },
    { re: /^(\d+)\s+rutas?$/i, en: (m, n) => `${n} ${plural(n, 'route', 'routes')}` },
    { re: /^(\d+)\s+rutas? disponibles?$/i, en: (m, n) => `${n} ${plural(n, 'route', 'routes')} available` },
    { re: /^(\d+)\s+clases?$/i, en: (m, n) => `${n} ${plural(n, 'class', 'classes')}` },
    { re: /^(\d+)\s+sedes?$/i, en: (m, n) => `${n} ${plural(n, 'location', 'locations')}` },
    { re: /^(\d+)\s+academias?$/i, en: (m, n) => `${n} ${plural(n, 'academy', 'academies')}` },
    { re: /^(\d+)\s+usuarios?$/i, en: (m, n) => `${n} ${plural(n, 'user', 'users')}` },
    { re: /^(\d+)\s+profesores?$/i, en: (m, n) => `${n} ${plural(n, 'professor', 'professors')}` },
    { re: /^(\d+)\s+instructores?$/i, en: (m, n) => `${n} ${plural(n, 'instructor', 'instructors')}` },
    { re: /^(\d+)\s+bloques?$/i, en: (m, n) => `${n} ${plural(n, 'block', 'blocks')}` },
    { re: /^(\d+)\s+minutos?$/i, en: (m, n) => `${n} ${plural(n, 'minute', 'minutes')}` },
    { re: /^(\d+)\s+segundos?$/i, en: (m, n) => `${n} ${plural(n, 'second', 'seconds')}` },
    { re: /^(\d+)\s+rondas?$/i, en: (m, n) => `${n} ${plural(n, 'round', 'rounds')}` },
    { re: /^(\d+)\s+puntos?$/i, en: (m, n) => `${n} ${plural(n, 'point', 'points')}` },
    { re: /^(\d+)\s+de\s+(\d+)\s+completadas?$/i, en: (m, c, t) => `${c} of ${t} completed` },
    { re: /^(\d+)\s+de\s+(\d+)\s+vistos?$/i, en: (m, c, t) => `${c} of ${t} watched` },
    { re: /^(\d+)\s+de\s+(\d+)$/, en: (m, c, t) => `${c} of ${t}` },
    { re: /^(\d+)\s+videos?\s*·\s*(\d+)\s+cursos?$/i, en: (m, v, c) => `${v} ${plural(v, 'video', 'videos')} · ${c} ${plural(c, 'course', 'courses')}` },
    { re: /^(\d+)\s+secciones?\s*·\s*(\d+)\s+lecciones?$/i, en: (m, s, l) => `${s} ${plural(s, 'section', 'sections')} · ${l} ${plural(l, 'lesson', 'lessons')}` },
    { re: /^(\d+)\s+sec\s*·\s*(\d+)\s+lec$/i, en: (m, s, l) => `${s} sec · ${l} les` },
    { re: /^RUTAS LIBERADAS\s*·\s*(\d+)$/i, en: (m, n) => `RELEASED ROUTES · ${n}` },
    { re: /^PASO\s+(\d+)\s+DE\s+(\d+)$/i, en: (m, a, b) => `STEP ${a} OF ${b}` },
    { re: /^Paso\s+(\d+)\s+de\s+(\d+)$/i, en: (m, a, b) => `Step ${a} of ${b}` },
    { re: /^(\d+)\s*\/\s*(\d+)\s+lecciones completadas$/i, en: (m, a, b) => `${a}/${b} lessons completed` },
    { re: /^(\d+)\s+minutos? de trabajo$/i, en: (m, n) => `${n} ${plural(n, 'minute', 'minutes')} of work` },
    { re: /^(\d+)\s+minutos? de descanso$/i, en: (m, n) => `${n} ${plural(n, 'minute', 'minutes')} of rest` },
    { re: /^(\d+)\s+segundos? de trabajo$/i, en: (m, n) => `${n} ${plural(n, 'second', 'seconds')} of work` },
    { re: /^(\d+)\s+segundos? de descanso$/i, en: (m, n) => `${n} ${plural(n, 'second', 'seconds')} of rest` },
    { re: /^(\d+)\s+segundos? de preparación$/i, en: (m, n) => `${n} ${plural(n, 'second', 'seconds')} of preparation` },
    { re: /^Monto mensual \((.+)\)$/i, en: (m, moneda) => `Monthly amount (${moneda})` },
    { re: /^Monto \((.+)\)$/i, en: (m, moneda) => `Amount (${moneda})` },
    { re: /^Edad calculada:\s*(.+)\s*años$/i, en: (m, n) => `Calculated age: ${n} years` },
    { re: /^VENCE EN (\d+)D$/i, en: (m, n) => `DUE IN ${n}D` },
    { re: /^ATRASADO (\d+)D$/i, en: (m, n) => `OVERDUE ${n}D` },
];

const traducirExacto = (clave) => {
    const exacto = DIRECTO.get(clave);
    if (exacto) return exacto;
    const directo = INDICE.get(normalizarClave(clave));
    if (directo) return directo;
    for (const patron of PATRONES) {
        if (patron.re.test(clave)) {
            return typeof patron.en === 'function'
                ? clave.replace(patron.re, (...args) => patron.en(...args))
                : clave.replace(patron.re, patron.en);
        }
    }
    return null;
};

const CLAVES_SIN_TRADUCIR = new Set(['EN', 'ES', 'OK', 'BJJ', 'GI', 'NOGI', 'IBJJF', 'ADCC']);

export const translateText = (texto, idioma = idiomaRuntime) => {
    if (idioma !== 'en' || typeof texto !== 'string' || !texto.trim()) return texto;

    const espaciosInicio = texto.match(/^\s*/)?.[0] || '';
    const espaciosFin = texto.match(/\s*$/)?.[0] || '';
    const clave = texto.trim();
    if (CLAVES_SIN_TRADUCIR.has(clave)) return texto;
    const traducido = traducirExacto(clave);
    return traducido ? `${espaciosInicio}${traducido}${espaciosFin}` : texto;
};

export const translateWithVars = (texto, vars, idioma = idiomaRuntime) => {
    let salida = translateText(texto, idioma);
    if (vars && typeof vars === 'object') {
        Object.entries(vars).forEach(([clave, valor]) => {
            salida = salida.split(`{${clave}}`).join(String(valor));
        });
    }
    return salida;
};

export const translateSwalOptions = (options) => {
    if (typeof options === 'string') return translateText(options);
    if (!options || typeof options !== 'object') return options;

    const siguientes = { ...options };
    ['title', 'text', 'confirmButtonText', 'cancelButtonText', 'denyButtonText', 'inputPlaceholder', 'footer'].forEach((prop) => {
        if (typeof siguientes[prop] === 'string') {
            siguientes[prop] = translateText(siguientes[prop]);
        }
    });
    if (Array.isArray(siguientes.inputOptions)) {
        siguientes.inputOptions = siguientes.inputOptions.map((opcion) => (
            opcion && typeof opcion === 'object'
                ? { ...opcion, text: translateText(opcion.text || '') }
                : opcion
        ));
    }
    return siguientes;
};

export const mensajeContenidoBloqueado = (tecnica) => {
    if (idiomaRuntime === 'en') {
        return `LOCKED CONTENT\n\n"${tecnica?.nombre || 'This video'}" requires authorization.\nEach course includes one free preview video; access is required for the rest.\n\nWould you like to request access to "${tecnica?.cursoTitulo || ''}" via WhatsApp?`;
    }
    return `CONTENIDO BLOQUEADO\n\n"${tecnica?.nombre || 'Este video'}" requiere autorización.\nCada curso tiene un video de prueba gratuito; para ver el resto necesitas acceso.\n\n¿Deseas solicitar acceso a "${tecnica?.cursoTitulo || ''}" por WhatsApp?`;
};

export const mensajeVideoBloqueado = (titulo) => (
    idiomaRuntime === 'en'
        ? `LOCKED CONTENT\n\n"${titulo || 'This video'}" belongs to a route that has not been released for your account or dojo yet.`
        : `CONTENIDO BLOQUEADO\n\n"${titulo || 'Este video'}" pertenece a una ruta que aún no está liberada para tu cuenta o tu dojo.`
);

export const mensajeSolicitudAcceso = (usuario, curso) => (
    idiomaRuntime === 'en'
        ? `Hi! I'd like to request access to the instructional: ${curso}. My email is: ${usuario?.email || 'No email'}`
        : `Hola! Me gustaría solicitar acceso al instruccional: ${curso}. Mi correo es: ${usuario?.email || 'Sin correo'}`
);
