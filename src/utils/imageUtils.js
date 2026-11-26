/**
 * Utilidades de imagen para el planeador de clases.
 * Las fotos se guardan como base64 en Firestore, así que se comprimen
 * antes de subirlas para no rebasar el límite de 1 MB por documento.
 */

const OPCIONES_DEFECTO = {
    maxDimension: 1100,
    quality: 0.72,
    maxBytes: 620000
};

const leerArchivo = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
});

const cargarImagen = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El formato de la imagen no es compatible.'));
    img.src = src;
});

const comprimirDesdeImagen = async (img, opciones = {}) => {
    const { maxDimension, quality, maxBytes } = { ...OPCIONES_DEFECTO, ...opciones };

    let escala = Math.min(1, maxDimension / Math.max(img.width, img.height));
    let calidad = quality;
    let resultado = '';

    // Se intenta bajar calidad y tamaño hasta quedar dentro del límite.
    for (let intento = 0; intento < 6; intento += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resultado = canvas.toDataURL('image/jpeg', calidad);
        if (resultado.length <= maxBytes) return resultado;

        escala *= 0.82;
        calidad = Math.max(0.45, calidad - 0.07);
    }

    throw new Error('La foto sigue siendo muy pesada. Intenta con una imagen más pequeña.');
};

export const comprimirImagen = async (file, opciones = {}) => {
    if (!file) throw new Error('No se seleccionó ninguna imagen.');
    if (!file.type?.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
    if (file.size > 15 * 1024 * 1024) throw new Error('La imagen supera los 15 MB.');

    const dataUrl = await leerArchivo(file);
    const img = await cargarImagen(dataUrl);
    return comprimirDesdeImagen(img, opciones);
};

/**
 * Comprime una imagen que ya está guardada como data URL (por ejemplo,
 * un logo antiguo en Firestore que quedó demasiado pesado).
 */
export const comprimirDataUrl = async (dataUrl, opciones = {}) => {
    const texto = String(dataUrl || '');
    if (!/^data:image\//i.test(texto)) {
        throw new Error('La imagen guardada no es un data URL válido.');
    }
    const img = await cargarImagen(texto);
    return comprimirDesdeImagen(img, opciones);
};
