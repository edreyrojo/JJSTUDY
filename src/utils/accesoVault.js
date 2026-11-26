/**
 * Reglas de acceso al contenido del Vault.
 * Se usan tanto en el Mapa como en la Búsqueda para que un video bloqueado
 * no se pueda abrir desde una ruta distinta.
 *
 * Regla del embudo:
 *   1. El maestro/admin ve todo.
 *   2. Cada curso tiene UN video gratuito: su primera técnica real
 *      (se saltan intro, conceptos, sparring y acondicionamiento).
 *   3. El resto requiere que el curso esté en `usuario.cursos_liberados`.
 *   4. Las rutas de aprendizaje publicadas agregan acceso puntual: una
 *      lección exacta (`ids`) o un curso completo (`cursos`).
 */
import { esVideoGratis } from '../data/vaultIndex';
import { mensajeSolicitudAcceso } from '../i18n/translate';

let ACCESO_DINAMICO = { ids: new Set(), cursos: new Set() };
let CURSOS_ACADEMIA = new Set();

/**
 * Cursos del Vault liberados a la academia (sede madre) del usuario.
 * Se aplican a todas las sedes de esa academia.
 */
export const setCursosAcademia = (cursos = []) => {
  CURSOS_ACADEMIA = new Set((Array.isArray(cursos) ? cursos : []).map((curso) => String(curso)));
};

export const cursosAcademiaActual = () => CURSOS_ACADEMIA;

/**
 * App registra aquí el paquete de acceso de las rutas liberadas para que
 * cualquier superficie (mapa, búsqueda, siguiente/continuar) aplique la misma
 * regla sin tener que pasar props por todos los componentes.
 */
export const setAccesoDinamico = (acceso) => {
  ACCESO_DINAMICO = {
    ids: acceso?.ids instanceof Set ? acceso.ids : new Set(),
    cursos: acceso?.cursos instanceof Set ? acceso.cursos : new Set()
  };
};

export const accesoDinamicoActual = () => ACCESO_DINAMICO;

export const tieneAccesoVideo = (usuario, tecnica, acceso) => {
  if (!usuario || !tecnica) return false;
  if (usuario.rol === 'admin') return true;

  // Cursos liberados a toda la academia (sede madre).
  if (CURSOS_ACADEMIA.has(String(tecnica.cursoId))) return true;

  const extra = acceso || ACCESO_DINAMICO;
  if (extra?.ids?.has?.(tecnica.id)) return true;
  if (extra?.cursos?.has?.(tecnica.cursoId)) return true;

  if (esVideoGratis(tecnica)) return true;
  return Array.isArray(usuario.cursos_liberados) && usuario.cursos_liberados.includes(tecnica.cursoId);
};

/**
 * Los videos dinámicos (Drive/YouTube indexados) no viven en el Vault
 * estático. Solo se abren si están dentro de una ruta liberada.
 */
export const tieneAccesoVideoDinamico = (usuario, video, acceso) => {
  if (!usuario || !video) return false;
  if (usuario.rol === 'admin') return true;

  const extra = acceso || ACCESO_DINAMICO;
  if (extra?.ids?.has?.(video.id)) return true;
  if (video.cursoId && extra?.cursos?.has?.(video.cursoId)) return true;
  return false;
};

export const pedirAcceso = (usuario, cursoId) => {
  const mensaje = mensajeSolicitudAcceso(usuario, cursoId);
  window.open(`https://wa.me/524731632614?text=${encodeURIComponent(mensaje)}`);
};
