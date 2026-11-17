import { createContext, useContext } from 'react';

export const LanguageContext = createContext(null);

const contextoPorDefecto = {
    lang: 'es',
    isEnglish: false,
    locale: 'es-MX',
    setLang: () => {},
    toggleLang: () => {},
    t: (texto) => texto,
    tv: (texto) => texto,
};

export const useI18n = () => useContext(LanguageContext) || contextoPorDefecto;
