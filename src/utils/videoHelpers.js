import { DB_INSTRUCCIONALES } from '../data/instruccionales';

export const getAdjacentVideo = (currentVideo, direction) => {
    if (!currentVideo) return null;

    for (const cursoKey in DB_INSTRUCCIONALES) {
        const curso = DB_INSTRUCCIONALES[cursoKey];
        for (const vol of curso.volumenes) {
            const index = vol.partes.findIndex(p => p.id === currentVideo.id);
            if (index !== -1) {
                const targetIndex = direction === 'next' ? index + 1 : index - 1;
                const nextVideo = vol.partes[targetIndex];
                if (nextVideo) {
                    return { titulo: nextVideo.nombre, id: nextVideo.id };
                }
            }
        }
    }
    return null;
};