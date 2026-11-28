# Importar instruccionales desde Google Drive

## 1. Dónde está

**Hub → CONTROL DE ACCESOS → IMPORTAR**

Desde ahí puedes crear un curso completo a partir de:

- Una **carpeta pública** de Google Drive.
- Una lista de **enlaces de videos** (uno por línea).
- Una mezcla de ambos.

## 2. Antes de importar

La carpeta o los archivos deben estar compartidos en Drive como:

**Cualquier persona con el enlace → Lector**

Si no, Google devuelve un error de permisos. La app lo muestra y no crea
registros a medias.

## 3. Flujo

1. Pega la carpeta o los enlaces.
2. Pulsa **ESCANEAR DRIVE**.
3. Revisa la lista:
   - Nombre detectado (editable).
   - Duración detectada.
   - Volumen/carpeta.
4. Completa:
   - **Título del curso**.
   - **Autor / academia**.
   - **Volumen** (si es una sola carpeta o enlaces sueltos).
   - **Acceso**:
     - **Liberar por academia**: eliges una academia ahora o lo dejas para
       después desde **Estructuras → Contenido**. También se puede liberar
       solo a una sede.
     - **Visible para todos los validados**: aparece de inmediato en el Mapa
       y la Búsqueda para todos.
   - **Ejes y etiquetas** (separados por coma) para la búsqueda.
5. Pulsa **IMPORTAR**.

El curso se guarda en Firestore (`cursosVault`) y se suma al índice del Vault
sin editar código ni volver a desplegar.

## 4. Qué pasa después

- Aparece en **Mapa** y **Búsqueda** como un curso normal.
- Sus videos usan el reproductor nativo de Drive, con búsqueda exacta de
  tiempo y marcas globales.
- En **Estructuras → Contenido** puedes liberarlo a una academia o a una sede
  concreta, como cualquier otro curso.
- En **MARCAS** puedes agregarle marcas de tiempo globales.

## 5. Carpetas y volúmenes

- Si la carpeta tiene **subcarpetas**, cada subcarpeta se convierte en un
  volumen.
- Si todos los videos están en la carpeta raíz, se agrupan en un solo volumen
  (puedes cambiarle el nombre antes de importar).
- Se lee **un nivel** de subcarpetas. Para cursos con más niveles, importa cada
  bloque como un curso separado o usa enlaces de archivos.

## 6. Límites y notas

- Solo se admiten archivos de video de Drive (`video/*`). YouTube se puede
  indexar desde el constructor de rutas, no desde este importador.
- Drive debe ser público; el importador no pide contraseñas ni accede a
  archivos privados.
- La app usa la Google Drive API con una clave pública restringida por
  referrer a `jjstudy.vercel.app`. Si cambias de dominio, hay que actualizar
  la restricción de la clave en Google Cloud.
- Si borras un curso importado, los videos **no** se borran de Drive.
- Reimportar un curso crea un ID nuevo. Si estaba liberado a una academia,
  vuelve a liberarlo (o edita el curso en lugar de borrarlo, cuando exista esa
  opción).

## 7. Técnico

- Colección: `cursosVault/{cursoId}`.
- Reglas: lectura para validados, escritura solo admin.
- El índice estático (`src/data/instruccionales.js`) sigue siendo la base; los
  cursos de Firestore se registran con `registrarCursosDinamicos` en
  `src/data/vaultIndex.js`.
- El importador usa `src/utils/driveVideo.js`:
  - `listarVideosDeCarpeta`
  - `obtenerArchivoDrive`
  - `driveMediaUrl`
- La duración se lee de `videoMediaMetadata.durationMillis`.
