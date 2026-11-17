/**
 * Utilidades de imagen para el planeador de clases.
 * Las fotos se guardan como base64 en Firestore, así que se comprimen
 * antes de subirlas para no rebasar el límite de 1 MB por documento.
 */

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

export const comprimirImagen = async (file, {
    maxDimension = 1100,
    quality = 0.72,
    maxBytes = 620000
} = {}) => {
    if (!file) throw new Error('No se seleccionó ninguna imagen.');
    if (!file.type?.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
    if (file.size > 15 * 1024 * 1024) throw new Error('La imagen supera los 15 MB.');

    const dataUrl = await leerArchivo(file);
    const img = await cargarImagen(dataUrl);

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
