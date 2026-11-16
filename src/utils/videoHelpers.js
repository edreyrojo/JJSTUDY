import { TECNICAS } from '../data/vaultIndex';

/**
 * Devuelve el video anterior/siguiente dentro del MISMO volumen.
 * Usa el índice normalizado, así que ignora separadores, portadas y PDFs.
 */
export const getAdjacentVideo = (currentVideo, direction) => {
    if (!currentVideo) return null;

    const actual = TECNICAS.find(t => t.id === currentVideo.id);
    if (!actual) return null;

    const hermanos = TECNICAS.filter(
        t => t.cursoId === actual.cursoId && t.volumenIndice === actual.volumenIndice
    );
    const posicion = hermanos.indexOf(actual);
    if (posicion === -1) return null;

    const destino = hermanos[posicion + (direction === 'next' ? 1 : -1)];
    return destino ? { titulo: destino.nombre, id: destino.id } : null;
};
