import { useEffect, useRef } from 'react';

const FOCUSABLES = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

// Pila de diálogos abiertos: solo el superior responde a Escape/Tab.
const pila = [];

const visibles = (nodo) => Boolean(nodo && nodo.getClientRects().length);

/**
 * Accesibilidad básica para modales:
 * - Escape cierra (si hay onClose).
 * - El foco entra al modal y no se escapa con Tab.
 * - Bloquea el scroll del body.
 * - Devuelve el foco al elemento que abrió el modal.
 */
export const useDialogA11y = (open, onClose) => {
    const ref = useRef(null);
    const closeRef = useRef(onClose);

    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;

        const token = {};
        pila.push(token);
        const anterior = document.activeElement;
        const nodo = ref.current;
        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const enfocarPrimero = () => {
            if (!nodo) return;
            const focusables = [...nodo.querySelectorAll(FOCUSABLES)].filter(visibles);
            (focusables[0] || nodo).focus?.();
        };
        const timer = setTimeout(enfocarPrimero, 40);

        const onKeyDown = (event) => {
            if (pila[pila.length - 1] !== token) return;

            if (event.key === 'Escape') {
                if (typeof closeRef.current !== 'function') return;
                event.preventDefault();
                event.stopPropagation();
                closeRef.current();
                return;
            }

            if (event.key !== 'Tab' || !nodo) return;
            const focusables = [...nodo.querySelectorAll(FOCUSABLES)].filter(visibles);
            if (focusables.length === 0) {
                event.preventDefault();
                nodo.focus?.();
                return;
            }
            const primero = focusables[0];
            const ultimo = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === primero) {
                event.preventDefault();
                ultimo.focus();
            } else if (!event.shiftKey && document.activeElement === ultimo) {
                event.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', onKeyDown, true);
            const indice = pila.indexOf(token);
            if (indice !== -1) pila.splice(indice, 1);
            document.body.style.overflow = overflowAnterior;
            anterior?.focus?.();
        };
    }, [open]);

    return ref;
};
