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
