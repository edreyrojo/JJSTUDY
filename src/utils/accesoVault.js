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
 */
import { esVideoGratis } from '../data/vaultIndex';

export const tieneAccesoVideo = (usuario, tecnica) => {
  if (!usuario || !tecnica) return false;
  if (usuario.rol === 'admin') return true;
  if (esVideoGratis(tecnica)) return true;
  return Array.isArray(usuario.cursos_liberados) && usuario.cursos_liberados.includes(tecnica.cursoId);
};

export const pedirAcceso = (usuario, cursoId) => {
  const mensaje = `Hola! Me gustaría solicitar acceso al instruccional: ${cursoId}. Mi correo es: ${usuario?.email || 'Sin correo'}`;
  window.open(`https://wa.me/524731632614?text=${encodeURIComponent(mensaje)}`);
};
