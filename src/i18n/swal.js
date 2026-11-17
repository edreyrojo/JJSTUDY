import Swal from 'sweetalert2';
import { translateSwalOptions } from './translate';

let instalado = false;

/**
 * Traduce las alertas de SweetAlert2 sin tocar cada llamada del proyecto.
 * Si la versión instalada no permite reemplazar `fire`, se ignora sin romper
 * la app.
 */
export const instalarTraduccionSwal = () => {
    if (instalado || !Swal || typeof Swal.fire !== 'function') return;

    try {
        const original = Swal.fire.bind(Swal);
        Swal.fire = (...args) => {
            if (args.length === 0) return original(...args);

            if (typeof args[0] === 'string') {
                const [titulo, texto, icono] = args;
                return original(
                    translateSwalOptions(titulo),
                    typeof texto === 'string' ? translateSwalOptions(texto) : texto,
                    icono
                );
            }

            return original(translateSwalOptions(args[0]), ...args.slice(1));
        };
        instalado = true;
    } catch (error) {
        console.warn('No se pudo instalar la traducción de SweetAlert:', error);
    }
};
