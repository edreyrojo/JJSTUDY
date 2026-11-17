import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { setRuntimeLang, translateText, translateWithVars } from './translate';
import { LanguageContext } from './context';
import { instalarTraduccionSwal } from './swal';
import { iniciarTraduccionDom } from './domTranslator';

const CLAVE_ALMACENAMIENTO = 'lafortuna_lang';

instalarTraduccionSwal();

const leerIdioma = () => {
    try {
        const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
        if (guardado === 'en' || guardado === 'es') return guardado;
        const navegador = typeof navigator !== 'undefined' ? navigator.language : 'es';
        return String(navegador || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
    } catch {
        return 'es';
    }
};

const guardarIdioma = (idioma) => {
    try {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, idioma);
    } catch {
        // localStorage puede estar bloqueado; el idioma sigue funcionando.
    }
};

/**
 * Proveedor global de idioma.
 *
 * Al pasar a inglés se traduce el DOM ya renderizado y se observan los
 * cambios de React. Al volver a español se recarga la app para restaurar el
 * contenido original sin mantener un mapa de cadenas traducidas.
 */
export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(leerIdioma);

    setRuntimeLang(lang);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    useLayoutEffect(() => {
        if (lang !== 'en') return undefined;
        return iniciarTraduccionDom();
    }, [lang]);

    const value = useMemo(() => ({
        lang,
        isEnglish: lang === 'en',
        locale: lang === 'en' ? 'en-US' : 'es-MX',
        setLang: (nuevo) => {
            if (nuevo !== 'en' && nuevo !== 'es') return;
            if (nuevo === lang) return;
            guardarIdioma(nuevo);
            if (nuevo === 'es') {
                window.location.reload();
                return;
            }
            setLangState('en');
        },
        toggleLang: () => {
            const siguiente = lang === 'es' ? 'en' : 'es';
            guardarIdioma(siguiente);
            if (siguiente === 'es') {
                window.location.reload();
                return;
            }
            setLangState('en');
        },
        t: (texto, vars) => translateWithVars(texto, vars, lang),
        tv: (texto) => translateText(texto, lang),
    }), [lang]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
