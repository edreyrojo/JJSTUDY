// Clave pública de Google Drive API restringida por referrer al dominio de la
// app y por API (solo drive.googleapis.com). No da acceso a archivos privados:
// únicamente permite reproducir con Range los videos que ya son públicos.
//
// Se puede rotar creando otra clave en Google Cloud → API Keys y definiendo
// VITE_DRIVE_API_KEY en Vercel.
const DRIVE_API_KEY = import.meta.env.VITE_DRIVE_API_KEY
  || 'AIzaSyBVR3lq1q2Ti_0PSKz1YfMO7woM8DYPq1U';

/**
 * URL de streaming nativo para un archivo público de Drive.
 * Permite `currentTime`, pausa y búsqueda exacta sin el iframe de Drive.
 */
export const driveMediaUrl = (fileId) => {
  if (!fileId) return '';
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${DRIVE_API_KEY}`;
};

// ---------------------------------------------------------------------------
// LECTURA DE CARPETAS PARA EL IMPORTADOR
// ---------------------------------------------------------------------------
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const CAMPOS_ARCHIVO = 'id,name,mimeType,size,videoMediaMetadata';
const MIME_CARPETA = 'application/vnd.google-apps.folder';

export const extraerDriveFolderId = (valor = '') => {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  const enlace = texto.match(/folders\/([A-Za-z0-9_-]+)/);
  return enlace ? enlace[1] : '';
};

export const formatearDuracionDrive = (milisegundos) => {
  const total = Math.round(Number(milisegundos) / 1000) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const quitarExtension = (nombre = '') =>
  String(nombre).replace(/\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv)$/i, '').trim();

const pedirDrive = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    let detalle = '';
    try {
      const json = await res.json();
      detalle = json?.error?.message || '';
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detalle || `Google Drive respondió ${res.status}`);
  }
  return res.json();
};

const normalizarArchivo = (archivo, carpeta = '') => ({
  id: archivo.id,
  nombre: quitarExtension(archivo.name || 'Video sin título'),
  carpeta,
  duracion: formatearDuracionDrive(archivo.videoMediaMetadata?.durationMillis),
  duracionSeg: Math.round(Number(archivo.videoMediaMetadata?.durationMillis || 0) / 1000),
  tamaño: Number(archivo.size || 0),
});

const listarContenidoCarpeta = async (folderId) => {
  const archivos = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${CAMPOS_ARCHIVO})`,
      pageSize: '1000',
      orderBy: 'name',
      key: DRIVE_API_KEY
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await pedirDrive(`${DRIVE_API}?${params.toString()}`);
    archivos.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return archivos;
};

export const obtenerCarpetaDrive = async (folderId) => {
  const url = `${DRIVE_API}/${encodeURIComponent(folderId)}?fields=id,name,mimeType&key=${DRIVE_API_KEY}`;
  const data = await pedirDrive(url);
  if (data.mimeType !== MIME_CARPETA) {
    throw new Error('El enlace no es una carpeta de Google Drive.');
  }
  return data;
};

export const obtenerArchivoDrive = async (fileId) => {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=${CAMPOS_ARCHIVO}&key=${DRIVE_API_KEY}`;
  const data = await pedirDrive(url);
  if (!String(data.mimeType || '').startsWith('video/')) {
    throw new Error(`"${data.name}" no es un video.`);
  }
  return normalizarArchivo(data);
};

/**
 * Lista videos de una carpeta pública de Drive. Si hay subcarpetas, entra un
 * nivel y usa el nombre de la subcarpeta como volumen del curso.
 */
export const listarVideosDeCarpeta = async (folderId) => {
  const raiz = await obtenerCarpetaDrive(folderId);
  const videos = [];

  const recorrer = async (id, nombreCarpeta, nivel) => {
    const contenido = await listarContenidoCarpeta(id);
    for (const archivo of contenido) {
      if (archivo.mimeType === MIME_CARPETA) {
        if (nivel < 1) {
          await recorrer(archivo.id, archivo.name || nombreCarpeta, nivel + 1);
        }
      } else if (String(archivo.mimeType || '').startsWith('video/')) {
        videos.push(normalizarArchivo(archivo, nombreCarpeta));
      }
    }
  };

  await recorrer(raiz.id, raiz.name || 'Contenido', 0);
  videos.sort((a, b) => (
    a.carpeta.localeCompare(b.carpeta, 'es', { numeric: true })
    || a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
  ));
  return { carpeta: raiz.name || 'Contenido', videos };
};
