# Índice del Vault

Este documento explica cómo se organiza, clasifica y busca el contenido de
`src/data/instruccionales.js`. La idea es que **no tengas que etiquetar 1,000
videos a mano**: el sistema deduce posición y tipo, y tú solo corriges casos
puntuales.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `src/data/instruccionales.js` | Tu base original de cursos, volúmenes y videos. No cambia. |
| `src/data/taxonomia.js` | Posiciones, tipos, etiquetas, metadatos por curso y motor de clasificación. |
| `src/data/vaultIndex.js` | Índice plano de videos, facetas, buscador y video gratuito por curso. |
| `src/utils/accesoVault.js` | Regla única de acceso (mapa y búsqueda). |
| `scripts/audit-vault.mjs` | Reporte de calidad: cobertura, datos rotos y casos dudosos. |

## Cómo se clasifica un video

Cada video recibe dos dimensiones principales:

- **POSICIÓN** — dónde ocurre: `MEDIA GUARDIA`, `MONTADA`, `ESPALDA`, `PIERNAS`, etc.
- **TIPO** — qué se enseña: `SUMISIONES`, `PASES`, `SWEEPS`, `ESCAPES`, etc.

Además: `modalidad` (`GI`, `NO GI`, `AMBOS`) y `etiquetas` específicas
(`DARCE`, `LEG DRAG`, `BUGGY CHOKE`, `NEW WAVE`, etc.).

La clasificación va en cascada:

1. Nombre del video (lo más específico).
2. `subcategoria` del video, si existe.
3. Nombre del volumen.
4. Metadatos curados del curso (`CURSOS_META`).
5. `eje` original como último recurso.

Por eso funciona aunque el video se llame solo `Vol 1`: hereda la posición y el
tipo del volumen o del curso.

## Agregar contenido

1. Agrega el curso/volúmenes/videos en `instruccionales.js` como siempre.
2. Si el curso es nuevo, agrega una entrada en `CURSOS_META`
   (`src/data/taxonomia.js`) con `posicion`, `tipo`, `modalidad` y `tags`.
   Esto le da una clasificación base a todos sus videos.
3. Corre `npm run audit:vault` y revisa:
   - Cursos sin metadatos.
   - Videos con baja confianza (nombres genéricos).
   - Ids inválidos o duplicados.

## Corregir un video puntual

En `src/data/taxonomia.js`:

```js
export const OVERRIDES_VIDEO = {
  'ID_DEL_VIDEO_DE_DRIVE': {
    posicion: 'MEDIA GUARDIA',
    tipo: 'PASES',
    modalidad: 'NO GI',
    etiquetas: ['LEG DRAG'],
  },
};
```

Solo se sobrescribe lo que indiques. Las etiquetas del override se suman a las
detectadas automáticamente.

## Corregir un volumen o un curso

En `CURSOS_META`:

```js
'Nombre exacto del curso': {
  posicion: 'GUARDIA',
  tipo: 'PASES',
  modalidad: 'GI',
  tags: ['NEW WAVE', 'PASES'],
  volumenes: {
    'volume 1 fundamental standing skills': {
      posicion: 'DE PIE',
      tipo: 'DERRIBOS',
    },
  },
},
```

La clave de `volumenes` es el nombre del volumen **normalizado**: minúsculas,
sin acentos y con espacios simples.

## Buscador

`buscarTecnicas(termino, filtros)` busca en:

- nombre del video
- curso, autor y volumen
- posición, tipo y modalidad
- etiquetas
- `eje` original

Es insensible a acentos y mayúsculas. Los términos se combinan con `AND`
(`darce media` encuentra videos que tengan ambas palabras).

La página de Búsqueda usa este mismo índice, así que los contadores y filtros
siempre coinciden con el Mapa.

## Acceso al contenido

Regla del embudo (`src/utils/accesoVault.js`):

1. `rol: admin` → acceso total.
2. Cada curso tiene **un video gratuito**: su primera técnica real. Se saltan
   `INTRO`, `CONCEPTOS`, `SPARRING`, `ACONDICIONAMIENTO` y `JUEGOS / DRILLS`.
3. El resto requiere que el curso esté en `usuario.cursos_liberados`
   (lo que liberas desde AdminPage).
4. Si no hay acceso, el video muestra 🔒 y se ofrece solicitar acceso por
   WhatsApp.

Esta regla se aplica en **Mapa** y **Búsqueda**. Antes, la búsqueda permitía
abrir cualquier video sin pasar por el candado; eso ya está cerrado.

## Auditoría

```bash
npm run audit:vault
```

Muestra:

- totales de cursos, volúmenes, videos, autores, posiciones y tipos
- videos por posición / tipo / modalidad
- top de etiquetas
- cursos sin metadatos
- partes sin id, ids inválidos, imágenes/PDF y ids duplicados
- cobertura por curso
- videos de baja confianza para revisar
