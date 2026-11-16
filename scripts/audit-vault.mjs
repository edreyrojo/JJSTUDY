/**
 * AUDITORÍA DEL ÍNDICE DEL VAULT
 * Ejecuta:  npm run audit:vault
 *
 * Revisa la calidad de la clasificación y detecta datos rotos o genéricos.
 */
import { DB_INSTRUCCIONALES } from '../src/data/instruccionales.js';
import { CURSOS, TECNICAS, FACETAS, ESTADISTICAS } from '../src/data/vaultIndex.js';
import { CURSOS_META } from '../src/data/taxonomia.js';

const linea = (t = '') => console.log(t);
const titulo = (t) => { linea(); linea('='.repeat(72)); linea(t); linea('='.repeat(72)); };

titulo('RESUMEN');
linea(`Cursos:        ${ESTADISTICAS.cursos}`);
linea(`Volúmenes:     ${ESTADISTICAS.volumenes}`);
linea(`Videos:        ${ESTADISTICAS.videos}`);
linea(`Autores:       ${ESTADISTICAS.autores}`);
linea(`Posiciones:    ${ESTADISTICAS.posiciones}`);
linea(`Tipos:         ${ESTADISTICAS.tipos}`);
linea(`Etiquetas:     ${ESTADISTICAS.etiquetas}`);

titulo('VIDEOS POR POSICIÓN');
FACETAS.POSICION.forEach(f => linea(`${String(f.videos).padStart(4)}  ${f.valor} (${f.cursos} cursos)`));

titulo('VIDEOS POR TIPO');
FACETAS.TIPO.forEach(f => linea(`${String(f.videos).padStart(4)}  ${f.valor} (${f.cursos} cursos)`));

titulo('VIDEOS POR MODALIDAD');
FACETAS.MODALIDAD.forEach(f => linea(`${String(f.videos).padStart(4)}  ${f.valor}`));

titulo('TOP ETIQUETAS');
FACETAS.ETIQUETAS.slice(0, 30).forEach(f => linea(`${String(f.videos).padStart(4)}  ${f.valor}`));

titulo('CURSOS SIN METADATOS CURADOS');
const sinMeta = Object.keys(DB_INSTRUCCIONALES).filter(k => !CURSOS_META[k]);
linea(sinMeta.length ? sinMeta.join('\n') : 'Todos los cursos tienen metadatos.');

titulo('DATOS ROTOS');
let sinId = 0, idsInvalidos = 0, imagenes = 0;
const ids = new Map();
for (const [cursoKey, curso] of Object.entries(DB_INSTRUCCIONALES)) {
  (curso.volumenes || []).forEach(vol => (vol.partes || []).forEach(parte => {
    if (!parte.id) {
      sinId++;
      linea(`SIN ID      | ${cursoKey} | ${vol.nombre} | ${JSON.stringify(parte.nombre)}`);
    } else if (String(parte.id).toUpperCase() === 'ID_NO_ENCONTRADO') {
      idsInvalidos++;
      linea(`ID INVALIDO | ${cursoKey} | ${vol.nombre} | ${JSON.stringify(parte.nombre)}`);
    } else if (/\.(jpe?g|png|webp|gif|bmp|pdf|docx?|xlsx?|pptx?|txt|zip|rar)$/i.test(String(parte.nombre || ''))) {
      imagenes++;
      linea(`ARCHIVO      | ${cursoKey} | ${vol.nombre} | ${JSON.stringify(parte.nombre)}`);
    }
    if (parte.id) {
      if (!ids.has(parte.id)) ids.set(parte.id, []);
      ids.get(parte.id).push(`${cursoKey} / ${vol.nombre} / ${parte.nombre}`);
    }
  }));
}
const duplicados = [...ids.entries()].filter(([, v]) => v.length > 1);
linea(`\nPartes sin id: ${sinId}`);
linea(`Ids inválidos (ID_NO_ENCONTRADO): ${idsInvalidos}`);
linea(`Imágenes/documentos excluidos: ${imagenes}`);
linea(`Ids duplicados: ${duplicados.length}`);
duplicados.forEach(([id, usos]) => {
  linea(`  ${id}`);
  usos.forEach(u => linea(`    - ${u}`));
});

titulo('CURSOS: COBERTURA Y CLASIFICACIÓN');
for (const curso of CURSOS) {
  const pos = new Map();
  const tip = new Map();
  curso.volumenes.flatMap(v => v.partes).forEach(t => {
    pos.set(t.posicion, (pos.get(t.posicion) || 0) + 1);
    tip.set(t.tipo, (tip.get(t.tipo) || 0) + 1);
  });
  const fmt = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
  linea(`\n${curso.titulo} (${curso.total} videos)`);
  linea(`  Autor: ${curso.autor}`);
  linea(`  Pos: ${fmt(pos)}`);
  linea(`  Tipo: ${fmt(tip)}`);
}

titulo('MUESTRA: VIDEOS CON BAJA CONFIANZA (posible nombre genérico)');
const bajos = TECNICAS.filter(t => t.confianza <= 0.45);
linea(`Total: ${bajos.length} de ${TECNICAS.length} (${Math.round(bajos.length / TECNICAS.length * 100)}%)`);
const porCurso = new Map();
bajos.forEach(t => {
  if (!porCurso.has(t.cursoId)) porCurso.set(t.cursoId, []);
  porCurso.get(t.cursoId).push(t);
});
[...porCurso.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 12)
  .forEach(([cursoId, lista]) => {
    linea(`\n${cursoId} (${lista.length})`);
    lista.slice(0, 6).forEach(t => linea(`  - ${t.nombre}  → ${t.posicion} / ${t.tipo}`));
  });

titulo('MUESTRA: PRIMEROS 40 VIDEOS CLASIFICADOS');
TECNICAS.slice(0, 40).forEach(t => {
  linea(`${t.cursoTitulo} | ${t.volumenNombre} | ${t.nombre}`);
  linea(`   → ${t.posicion} / ${t.tipo} / ${t.modalidad} / [${t.etiquetas.join(', ')}]`);
});
