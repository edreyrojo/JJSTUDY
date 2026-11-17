import { translateText } from './translate';

const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];
const ETIQUETAS_IGNORADAS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

const traducirTexto = (nodo) => {
    if (!nodo || nodo.nodeType !== 3) return;
    const original = nodo.nodeValue;
    if (!original || !original.trim()) return;
    const traducido = translateText(original);
    if (traducido !== original) nodo.nodeValue = traducido;
};

const traducirAtributos = (elemento) => {
    if (!elemento || elemento.nodeType !== 1) return;
    if (ETIQUETAS_IGNORADAS.has(elemento.tagName)) return;
    if (elemento.closest?.('[data-no-i18n]')) return;

    ATRIBUTOS.forEach((atributo) => {
        const valor = elemento.getAttribute(atributo);
        if (!valor) return;
        const traducido = translateText(valor);
        if (traducido !== valor) elemento.setAttribute(atributo, traducido);
    });
};

export const traducirSubarbol = (raiz) => {
    if (!raiz) return;

    if (raiz.nodeType === 3) {
        traducirTexto(raiz);
        return;
    }
    if (raiz.nodeType !== 1) return;
    if (ETIQUETAS_IGNORADAS.has(raiz.tagName)) return;
    if (raiz.closest?.('[data-no-i18n]')) return;

    traducirAtributos(raiz);

    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let nodo = caminante.nextNode();
    while (nodo) {
        const padre = nodo.parentElement;
        if (padre && !ETIQUETAS_IGNORADAS.has(padre.tagName)) {
            traducirTexto(nodo);
        }
        nodo = caminante.nextNode();
    }

    raiz.querySelectorAll?.('*').forEach(traducirAtributos);
};

/**
 * Traduce el DOM ya renderizado y sigue los cambios de React con un
 * MutationObserver. No modifica el runtime de React ni duplica dependencias.
 */
export const iniciarTraduccionDom = () => {
    if (typeof document === 'undefined') return () => {};

    traducirSubarbol(document.body);

    const observador = new MutationObserver((mutaciones) => {
        mutaciones.forEach((mutacion) => {
            if (mutacion.type === 'characterData') {
                traducirTexto(mutacion.target);
                return;
            }
            if (mutacion.type === 'attributes') {
                traducirAtributos(mutacion.target);
                return;
            }
            mutacion.addedNodes.forEach((nodo) => traducirSubarbol(nodo));
        });
    });

    observador.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATRIBUTOS,
    });

    return () => observador.disconnect();
};
