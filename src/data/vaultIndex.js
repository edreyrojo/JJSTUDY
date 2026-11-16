/**
 * ÍNDICE DEL VAULT
 * ---------------------------------------------------------------------------
 * Construye UNA sola fuente de verdad normalizada a partir de
 * `instruccionales.js` + `taxonomia.js`.
 *
 * Tanto MapaPage como BusquedaPage consumen este índice, así que la búsqueda,
 * los filtros y los contadores siempre coinciden.
 */
import { DB_INSTRUCCIONALES } from './instruccionales.js';
import {
  CURSOS_META,
  POSICIONES,
  TIPOS,
  POSICION_GENERAL,
  TIPO_GENERAL,
  clasificarVideo,
  normalizar,
} from './taxonomia.js';

const ID_INVALIDO = 'ID_NO_ENCONTRADO';
const esIdValido = (id) => Boolean(id) && String(id).toUpperCase() !== ID_INVALIDO;
const esArchivoNoVideo = (nombre) => /\.(jpe?g|png|webp|gif|bmp|pdf|docx?|xlsx?|pptx?|txt|zip|rar)$/i.test(String(nombre || ''));

const ejesDe = (curso) => {
  if (!curso) return [];
  if (Array.isArray(curso.eje)) return curso.eje.filter(Boolean);
  return curso.eje ? [curso.eje] : [];
};

const ordenPosiciones = [...POSICIONES.map(p => p.nombre), POSICION_GENERAL];
const ordenTipos = [...TIPOS.map(t => t.nombre), TIPO_GENERAL];

// ---------------------------------------------------------------------------
// CONSTRUCCIÓN
// ---------------------------------------------------------------------------
const cursos = [];
const tecnicas = [];

for (const [cursoKey, curso] of Object.entries(DB_INSTRUCCIONALES)) {
  if (!curso || !Array.isArray(curso.volumenes)) continue;

  const meta = CURSOS_META[cursoKey] || {};
  const ejes = ejesDe(curso);
  const cursoObj = {
    id: cursoKey,
    titulo: curso.titulo || cursoKey,
    autor: curso.autor || 'DESCONOCIDO',
    ejes,
    tagsOriginales: Array.isArray(curso.tags) ? curso.tags : [],
    meta,
    volumenes: [],
    total: 0,
  };

  curso.volumenes.forEach((volumen, vIndex) => {
    const partes = (volumen?.partes || [])
      .filter(parte => esIdValido(parte?.id) && !esArchivoNoVideo(parte?.nombre))
      .map((parte, pIndex) => {
        const nombre = String(parte.nombre || 'Técnica sin nombre').trim();
        const cls = clasificarVideo({ cursoKey, curso, volumen, parte });

        const tecnica = {
          id: String(parte.id),
          nombre,
          cursoId: cursoKey,
          cursoTitulo: cursoObj.titulo,
          autor: cursoObj.autor,
          volumenId: volumen?.id || `${cursoKey}-V${vIndex + 1}`,
          volumenNombre: volumen?.nombre || `Volumen ${vIndex + 1}`,
          volumenIndice: vIndex,
          parteIndice: pIndex,
          posicion: cls.posicion,
          tipo: cls.tipo,
          modalidad: cls.modalidad,
          etiquetas: cls.etiquetas,
          confianza: cls.confianza,
          ejes,
          busca: normalizar([
            nombre,
            cursoObj.titulo,
            cursoObj.autor,
            volumen?.nombre,
            cls.posicion,
            cls.tipo,
            cls.modalidad,
            cls.etiquetas.join(' '),
            ejes.join(' '),
          ].filter(Boolean).join(' ')),
        };

        tecnicas.push(tecnica);
        return tecnica;
      });

    if (partes.length > 0) {
      cursoObj.volumenes.push({
        id: volumen?.id || `${cursoKey}-V${vIndex + 1}`,
        nombre: volumen?.nombre || `Volumen ${vIndex + 1}`,
        indice: vIndex,
        partes,
        total: partes.length,
      });
      cursoObj.total += partes.length;
    }
  });

  if (cursoObj.total > 0) cursos.push(cursoObj);
}

// ---------------------------------------------------------------------------
// ÍNDICES RÁPIDOS
// ---------------------------------------------------------------------------
const tecnicasPorId = new Map();
tecnicas.forEach(t => {
  if (!tecnicasPorId.has(t.id)) tecnicasPorId.set(t.id, []);
  tecnicasPorId.get(t.id).push(t);
});

const cursosPorId = new Map(cursos.map(c => [c.id, c]));

// ---------------------------------------------------------------------------
// FACETAS (valores + contadores)
// ---------------------------------------------------------------------------
const contarFaceta = (lista, obtenerValores) => {
  const mapa = new Map();
  lista.forEach(item => {
    const valores = obtenerValores(item);
    const unicos = [...new Set(valores.filter(Boolean))];
    unicos.forEach(valor => {
      if (!mapa.has(valor)) mapa.set(valor, { valor, videos: 0, cursos: new Set() });
      const f = mapa.get(valor);
      f.videos += 1;
      f.cursos.add(item.cursoId || item.id);
    });
  });
  return [...mapa.values()].map(f => ({ ...f, cursos: f.cursos.size }));
};

const ordenarPorOrden = (lista, orden) => {
  const pos = new Map(orden.map((v, i) => [normalizar(v), i]));
  return lista.sort((a, b) => {
    const ia = pos.has(normalizar(a.valor)) ? pos.get(normalizar(a.valor)) : 999;
    const ib = pos.has(normalizar(b.valor)) ? pos.get(normalizar(b.valor)) : 999;
    return ia - ib || b.videos - a.videos;
  });
};

const autores = [...new Set(cursos.map(c => c.autor))].map(autor => ({
  valor: autor,
  videos: tecnicas.filter(t => t.autor === autor).length,
  cursos: cursos.filter(c => c.autor === autor).length,
})).sort((a, b) => b.videos - a.videos || a.valor.localeCompare(b.valor));

const posiciones = ordenarPorOrden(
  contarFaceta(tecnicas, t => [t.posicion]),
  ordenPosiciones
);

const tipos = ordenarPorOrden(
  contarFaceta(tecnicas, t => [t.tipo]),
  ordenTipos
);

const modalidades = contarFaceta(tecnicas, t => [t.modalidad])
  .sort((a, b) => {
    const orden = ['GI', 'NO GI', 'AMBOS'];
    return orden.indexOf(a.valor) - orden.indexOf(b.valor);
  });

const etiquetas = contarFaceta(tecnicas, t => t.etiquetas)
  .sort((a, b) => b.videos - a.videos || a.valor.localeCompare(b.valor));

export const FACETAS = {
  AUTORES: autores,
  POSICION: posiciones,
  TIPO: tipos,
  MODALIDAD: modalidades,
  ETIQUETAS: etiquetas,
};

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------
const coincideFiltro = (tecnica, filtros) => {
  if (!filtros) return true;
  if (filtros.autor && tecnica.autor !== filtros.autor) return false;
  if (filtros.cursoId && tecnica.cursoId !== filtros.cursoId) return false;
  if (filtros.posicion && tecnica.posicion !== filtros.posicion) return false;
  if (filtros.tipo && tecnica.tipo !== filtros.tipo) return false;
  if (filtros.modalidad && tecnica.modalidad !== filtros.modalidad) return false;
  if (filtros.etiqueta && !tecnica.etiquetas.includes(filtros.etiqueta)) return false;
  return true;
};

const puntuar = (tecnica, terminoNormalizado) => {
  if (!terminoNormalizado) return 0;
  const nombre = normalizar(tecnica.nombre);
  let score = 0;
  if (nombre === terminoNormalizado) score += 100;
  else if (nombre.startsWith(terminoNormalizado)) score += 60;
  else if (nombre.includes(terminoNormalizado)) score += 40;
  if (tecnica.etiquetas.some(e => normalizar(e) === terminoNormalizado)) score += 30;
  if (normalizar(tecnica.posicion) === terminoNormalizado) score += 25;
  if (normalizar(tecnica.tipo) === terminoNormalizado) score += 25;
  if (normalizar(tecnica.autor).includes(terminoNormalizado)) score += 15;
  return score;
};

/**
 * Busca técnicas. Todos los términos deben aparecer (AND).
 * Acepta filtros: { autor, cursoId, posicion, tipo, modalidad, etiqueta }
 */
export const buscarTecnicas = (termino = '', filtros = {}) => {
  const tokens = normalizar(termino).split(' ').filter(Boolean);
  const base = tecnicas.filter(t => coincideFiltro(t, filtros));

  if (tokens.length === 0) return base;

  return base
    .filter(t => tokens.every(tok => t.busca.includes(tok)))
    .map(t => ({ ...t, _score: tokens.reduce((s, tok) => s + puntuar(t, tok), 0) }))
    .sort((a, b) => b._score - a._score || a.nombre.localeCompare(b.nombre));
};

export const tecnicasDeCurso = (cursoId) => cursosPorId.get(cursoId)?.volumenes.flatMap(v => v.partes) || [];

export const cursosParaFiltro = (dimension, valor) => {
  if (!valor) return cursos;
  if (dimension === 'AUTORES') {
    return cursos
      .filter(c => c.autor === valor)
      .map(c => ({ ...c, coincidencias: c.total }));
  }

  return cursos
    .map(curso => {
      const coincidencias = tecnicas.filter(t => {
        if (t.cursoId !== curso.id) return false;
        if (dimension === 'POSICION') return t.posicion === valor;
        if (dimension === 'TIPO') return t.tipo === valor;
        if (dimension === 'MODALIDAD') return t.modalidad === valor;
        if (dimension === 'ETIQUETAS') return t.etiquetas.includes(valor);
        return false;
      });
      return coincidencias.length ? { ...curso, coincidencias: coincidencias.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.coincidencias - a.coincidencias || a.titulo.localeCompare(b.titulo));
};

export const tecnicasParaFiltro = (dimension, valor) => {
  if (!valor) return tecnicas;
  if (dimension === 'AUTORES') return tecnicas.filter(t => t.autor === valor);
  if (dimension === 'POSICION') return tecnicas.filter(t => t.posicion === valor);
  if (dimension === 'TIPO') return tecnicas.filter(t => t.tipo === valor);
  if (dimension === 'MODALIDAD') return tecnicas.filter(t => t.modalidad === valor);
  if (dimension === 'ETIQUETAS') return tecnicas.filter(t => t.etiquetas.includes(valor));
  return tecnicas;
};

export const obtenerTecnica = (id) => tecnicasPorId.get(String(id))?.[0] || null;
export const obtenerCurso = (id) => cursosPorId.get(id) || null;

// ---------------------------------------------------------------------------
// VIDEO GRATUITO POR CURSO
// No es el primero del volumen: es la primera TÉCNICA real del curso.
// Se saltan intros, trailers, conceptos, sparring y acondicionamiento para que
// el usuario pruebe contenido de valor y luego solicite el acceso completo.
// ---------------------------------------------------------------------------
const TIPOS_TECNICOS = new Set([
    'SUMISIONES', 'PASES', 'SWEEPS', 'ESCAPES', 'DERRIBOS', 'CONTROLES',
    'TOMAS DE ESPALDA', 'LEG LOCKS', 'ENTRADAS', 'RETENCIÓN', 'TÉCNICA',
]);
const TIPOS_NO_INTRO = new Set(['INTRO', 'CONCEPTOS']);

export const PRIMER_VIDEO_GRATIS = new Map();
cursos.forEach(curso => {
    const lista = curso.volumenes.flatMap(v => v.partes);
    const elegido =
        lista.find(t => TIPOS_TECNICOS.has(t.tipo)) ||
        lista.find(t => !TIPOS_NO_INTRO.has(t.tipo)) ||
        lista[0];
    if (elegido) PRIMER_VIDEO_GRATIS.set(curso.id, elegido.id);
});

export const esVideoGratis = (tecnica) =>
    Boolean(tecnica) && PRIMER_VIDEO_GRATIS.get(tecnica.cursoId) === tecnica.id;

export const ESTADISTICAS = {
  cursos: cursos.length,
  volumenes: cursos.reduce((n, c) => n + c.volumenes.length, 0),
  videos: tecnicas.length,
  autores: autores.length,
  posiciones: posiciones.length,
  tipos: tipos.length,
  etiquetas: etiquetas.length,
};

export { cursos as CURSOS, tecnicas as TECNICAS };
