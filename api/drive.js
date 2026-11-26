import { Readable } from 'node:stream';

// Proxy de solo lectura para reproducir videos públicos de Drive dentro del
// reproductor nativo del navegador. Drive responde con CORP: same-site, lo que
// impide usar <video src="https://drive.usercontent..."> directamente.
// Este endpoint sirve el contenido desde nuestro propio dominio y conserva el
// soporte de Range para que el video pueda buscar y pausar con precisión.

const CHUNK = 4 * 1024 * 1024;
const ID_VALIDO = /^[A-Za-z0-9_-]{10,}$/;

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!ID_VALIDO.test(id)) {
    res.status(400).json({ error: 'ID de video inválido' });
    return;
  }

  const range = String(req.headers.range || '');
  let start = 0;
  let end = CHUNK - 1;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match) {
    if (match[1]) start = Number.parseInt(match[1], 10);
    if (match[2]) {
      end = Math.min(Number.parseInt(match[2], 10), start + CHUNK - 1);
    } else {
      end = start + CHUNK - 1;
    }
  }

  try {
    const upstream = await fetch(
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
      {
        headers: {
          Range: `bytes=${start}-${end}`,
          'User-Agent': 'Mozilla/5.0 (compatible; LaFortunaVault/1.0)'
        },
        redirect: 'follow'
      }
    );

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Drive respondió ${upstream.status}` });
      return;
    }

    const contentRange = upstream.headers.get('content-range') || '';
    const total = contentRange.includes('/') ? contentRange.split('/').pop() : '';
    const contentLength = upstream.headers.get('content-length') || String(end - start + 1);

    res.status(206);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', contentLength);
    if (total) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    } else if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (req.method === 'HEAD' || !upstream.body) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error reproduciendo video de Drive:', error);
    if (!res.headersSent) {
      res.status(502).json({ error: 'No se pudo obtener el video' });
    } else {
      res.end();
    }
  }
}
