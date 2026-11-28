import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import {
  extraerDriveFolderId,
  listarVideosDeCarpeta,
  obtenerArchivoDrive
} from '../utils/driveVideo';
import { extraerDriveId } from '../utils/rutasAprendizaje';

const notify = (texto, icono = 'success') => Swal.fire({
  text: texto,
  icon: icono,
  background: '#0a0a0a',
  color: '#fff',
  confirmButtonColor: '#d4af37',
  iconColor: icono === 'success' ? '#4CAF50' : '#ff6b6b',
  timer: icono === 'success' ? 1800 : undefined,
  timerProgressBar: icono === 'success',
  showConfirmButton: icono !== 'success'
});

const hoyIso = () => new Date().toISOString();

const separarLista = (texto = '') => String(texto)
  .split(',')
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

const totalVideosDeCurso = (curso) => (Array.isArray(curso?.volumenes) ? curso.volumenes : [])
  .reduce((total, volumen) => total + (Array.isArray(volumen?.partes) ? volumen.partes.length : 0), 0);

const ImportarVaultPage = () => {
  const [links, setLinks] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [carpetaRaiz, setCarpetaRaiz] = useState('');
  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [ejes, setEjes] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [volumenNombre, setVolumenNombre] = useState('Contenido');
  const [acceso, setAcceso] = useState('academia');
  const [academiaDestino, setAcademiaDestino] = useState('');
  const [academias, setAcademias] = useState([]);
  const [videos, setVideos] = useState([]);
  const [importando, setImportando] = useState(false);
  const [cursos, setCursos] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'cursosVault'),
      (snap) => setCursos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error('No se pudieron cargar los cursos importados:', error);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'academias'),
      (snap) => setAcademias(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error('No se pudieron cargar las academias:', error)
    );
    return () => unsub();
  }, []);

  const seleccionados = useMemo(
    () => videos.filter((video) => video.incluido),
    [videos]
  );

  const volumenesDetectados = useMemo(() => {
    const grupos = new Map();
    seleccionados.forEach((video) => {
      const nombre = (video.carpeta && video.carpeta !== carpetaRaiz)
        ? video.carpeta
        : (volumenNombre.trim() || 'Contenido');
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre).push(video);
    });
    return [...grupos.entries()];
  }, [seleccionados, volumenNombre, carpetaRaiz]);

  const actualizarVideo = (id, cambios) => {
    setVideos((prev) => prev.map((video) => (
      video.id === id ? { ...video, ...cambios } : video
    )));
  };

  const escanear = async () => {
    const lineas = links.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
    if (lineas.length === 0) {
      return notify('Pega al menos un enlace de carpeta o de video de Drive.', 'error');
    }

    setEscaneando(true);
    const encontrados = [];
    const errores = [];
    let carpetaPrincipal = '';

    try {
      for (const linea of lineas) {
        try {
          const carpetaId = extraerDriveFolderId(linea);
          if (carpetaId) {
            const { carpeta, videos: videosCarpeta } = await listarVideosDeCarpeta(carpetaId);
            if (!carpetaPrincipal) carpetaPrincipal = carpeta;
            encontrados.push(...videosCarpeta);
            continue;
          }

          const archivoId = extraerDriveId(linea)
            || (/^[A-Za-z0-9_-]{10,}$/.test(linea) ? linea : '');
          if (archivoId) {
            const archivo = await obtenerArchivoDrive(archivoId);
            encontrados.push({ ...archivo, carpeta: '' });
            continue;
          }

          errores.push(linea);
        } catch (error) {
          errores.push(`${linea} → ${error.message}`);
        }
      }

      const unicos = new Map();
      encontrados.forEach((video) => {
        if (video?.id && !unicos.has(video.id)) {
          unicos.set(video.id, { ...video, incluido: true });
        }
      });
      const lista = [...unicos.values()].sort((a, b) => (
        (a.carpeta || '').localeCompare(b.carpeta || '', 'es', { numeric: true })
        || a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
      ));

      setVideos(lista);
      setCarpetaRaiz(carpetaPrincipal);
      if (!titulo && carpetaPrincipal) setTitulo(carpetaPrincipal);
      if (!autor) setAutor('La Fortuna');
      if (lista.length === 0) {
        notify('No se encontraron videos en esos enlaces.', 'error');
      } else {
        notify(`${lista.length} video(s) encontrados`);
      }
      if (errores.length > 0) {
        console.warn('Enlaces no procesados:', errores);
        notify(
          `${errores.length} enlace(s) no se pudieron leer. Revisa que la carpeta sea pública ("Cualquier persona con el enlace").`,
          'error'
        );
      }
    } finally {
      setEscaneando(false);
    }
  };

  const importar = async () => {
    const nombreCurso = titulo.trim();
    if (!nombreCurso) return notify('Escribe el título del curso.', 'error');
    if (seleccionados.length === 0) return notify('Selecciona al menos un video.', 'error');

    const grupos = new Map();
    seleccionados.forEach((video) => {
      const nombre = (video.carpeta && video.carpeta !== carpetaRaiz)
        ? video.carpeta
        : (volumenNombre.trim() || 'Contenido');
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre).push(video);
    });

    const volumenes = [...grupos.entries()].map(([nombre, lista], indice) => ({
      id: `V${indice + 1}`,
      nombre,
      partes: lista.map((video) => ({
        id: video.id,
        nombre: video.nombre,
        duracion: video.duracion || '',
        subcategoria: ''
      }))
    }));

    setImportando(true);
    try {
      const cursoRef = doc(collection(db, 'cursosVault'));
      await setDoc(cursoRef, {
        titulo: nombreCurso,
        autor: autor.trim() || 'La Fortuna',
        ejes: separarLista(ejes),
        tags: separarLista(etiquetas),
        acceso: acceso === 'todos' ? 'todos' : 'academia',
        origen: carpetaRaiz ? 'drive-carpeta' : 'drive-enlaces',
        volumenes,
        creadoPor: auth.currentUser?.uid || '',
        creadoEn: hoyIso(),
        actualizadoEn: hoyIso()
      });

      if (acceso === 'academia' && academiaDestino) {
        await updateDoc(doc(db, 'academias', academiaDestino), {
          cursos_liberados: arrayUnion(cursoRef.id),
          ultimaActualizacion: hoyIso()
        });
      }

      notify(
        academiaDestino && acceso === 'academia'
          ? 'Curso agregado y liberado a la academia'
          : 'Curso agregado al Vault'
      );
      setLinks('');
      setVideos([]);
      setCarpetaRaiz('');
      setTitulo('');
      setEjes('');
      setEtiquetas('');
      setVolumenNombre('Contenido');
      setAcceso('academia');
      setAcademiaDestino('');
      setAutor('');
    } catch (error) {
      console.error(error);
      notify(
        error?.code === 'permission-denied'
          ? 'No tienes permiso para importar cursos.'
          : `No se pudo importar: ${error.message}`,
        'error'
      );
    } finally {
      setImportando(false);
    }
  };

  const eliminarCurso = async (curso) => {
    const res = await Swal.fire({
      title: '¿Eliminar curso?',
      text: `${curso.titulo} dejará de aparecer en el Vault. Los videos seguirán en Drive.`,
      icon: 'warning',
      showCancelButton: true,
      background: '#0a0a0a',
      color: '#fff',
      confirmButtonColor: '#ff6b6b',
      cancelButtonColor: '#333',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    try {
      await deleteDoc(doc(db, 'cursosVault', curso.id));
      notify('Curso eliminado');
    } catch (error) {
      notify(`No se pudo eliminar: ${error.message}`, 'error');
    }
  };

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}><VaultIcon name="bookOpen" size={20} /> Importar instruccionales</h2>
          <p style={s.subtitle}>
            Pega una carpeta pública de Google Drive o varios enlaces de videos.
            La app lee los nombres y la duración automáticamente.
          </p>
        </div>
        <span style={s.counter}>{cursos.length} curso(s) importado(s)</span>
      </div>

      <div style={s.layout}>
        <section style={s.panel}>
          <h3 style={s.panelTitle}><VaultIcon name="link" size={15} /> 1. Enlaces de Drive</h3>
          <p style={s.help}>
            Un enlace por línea. Ejemplos: carpeta <code>/drive/folders/...</code> o video
            <code> /file/d/...</code>. La carpeta debe estar compartida como
            <strong> “Cualquier persona con el enlace”</strong>.
          </p>
          <textarea
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            placeholder={'https://drive.google.com/drive/folders/ABC123...\nhttps://drive.google.com/file/d/XYZ789.../view'}
            rows={5}
            style={s.textarea}
          />
          <div style={s.actions}>
            <button type="button" onClick={escanear} disabled={escaneando} style={s.goldBtn}>
              <VaultIcon name={escaneando ? 'clock' : 'search'} size={13} />
              {escaneando ? 'ESCANEANDO...' : 'ESCANEAR DRIVE'}
            </button>
            {videos.length > 0 && (
              <span style={s.meta}>{videos.length} video(s) · {seleccionados.length} seleccionado(s)</span>
            )}
          </div>

          {videos.length > 0 && (
            <>
              <div style={s.separator} />
              <h3 style={s.panelTitle}><VaultIcon name="bookOpen" size={15} /> 2. Datos del curso</h3>
              <div style={s.formGrid}>
                <label style={s.field}>
                  <span style={s.label}>TÍTULO DEL CURSO</span>
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Seminario de defensa personal" style={s.input} />
                </label>
                <label style={s.field}>
                  <span style={s.label}>AUTOR / ACADEMIA</span>
                  <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="La Fortuna" style={s.input} />
                </label>
                <label style={s.field}>
                  <span style={s.label}>VOLUMEN (SI ES UNA SOLA CARPETA)</span>
                  <input value={volumenNombre} onChange={(e) => setVolumenNombre(e.target.value)} placeholder="Contenido" style={s.input} />
                </label>
                <label style={s.field}>
                  <span style={s.label}>ACCESO</span>
                  <select value={acceso} onChange={(e) => setAcceso(e.target.value)} style={s.input}>
                    <option value="academia">Liberar por academia (manual)</option>
                    <option value="todos">Visible para todos los validados</option>
                  </select>
                </label>
                {acceso === 'academia' && (
                  <label style={s.field}>
                    <span style={s.label}>LIBERAR A ACADEMIA (OPCIONAL)</span>
                    <select value={academiaDestino} onChange={(e) => setAcademiaDestino(e.target.value)} style={s.input}>
                      <option value="">Liberar después</option>
                      {academias.map((aca) => (
                        <option key={aca.id} value={aca.id}>
                          {aca.nombreAcademia || aca.nombre || 'Academia'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={s.field}>
                  <span style={s.label}>EJES (SEPARADOS POR COMA)</span>
                  <input value={ejes} onChange={(e) => setEjes(e.target.value)} placeholder="NO GI, ESCAPES" style={s.input} />
                </label>
                <label style={s.field}>
                  <span style={s.label}>ETIQUETAS (SEPARADAS POR COMA)</span>
                  <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="SEMINARIO, DEFENSA PERSONAL" style={s.input} />
                </label>
              </div>
              <p style={s.help}>
                {acceso === 'academia'
                  ? 'Puedes liberarlo ahora a una academia o después en Estructuras → Contenido (también por sede).'
                  : 'Todos los usuarios validados podrán abrirlo desde el Mapa y la Búsqueda.'}
              </p>
            </>
          )}
        </section>

        <section style={s.panel}>
          <h3 style={s.panelTitle}><VaultIcon name="drive" size={15} /> 3. Videos detectados</h3>
          {videos.length === 0 ? (
            <div style={s.empty}>
              <VaultIcon name="folder" size={34} color="#d4af37" />
              <p>Escanea una carpeta o pega enlaces para ver los videos aquí.</p>
            </div>
          ) : (
            <>
              {volumenesDetectados.map(([nombre, lista]) => (
                <div key={nombre} style={s.volume}>
                  <div style={s.volumeHead}>
                    <strong>{nombre}</strong>
                    <span>{lista.length} video(s)</span>
                  </div>
                  {lista.map((video) => (
                    <div key={video.id} style={s.videoRow}>
                      <input
                        type="checkbox"
                        checked={video.incluido}
                        onChange={(e) => actualizarVideo(video.id, { incluido: e.target.checked })}
                        aria-label={`Incluir ${video.nombre}`}
                      />
                      <input
                        value={video.nombre}
                        onChange={(e) => actualizarVideo(video.id, { nombre: e.target.value })}
                        style={s.videoName}
                        aria-label="Nombre del video"
                      />
                      <span style={s.videoTime}>{video.duracion || '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={s.actions}>
                <button type="button" onClick={importar} disabled={importando || seleccionados.length === 0} style={s.goldBtn}>
                  <VaultIcon name={importando ? 'clock' : 'check'} size={13} />
                  {importando ? 'IMPORTANDO...' : `IMPORTAR ${seleccionados.length} VIDEO(S)`}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <section style={{ ...s.panel, marginTop: '12px' }}>
        <div style={s.listHead}>
          <h3 style={s.panelTitle}><VaultIcon name="bookOpen" size={15} /> Cursos importados</h3>
          <span style={s.meta}>{cursos.length}</span>
        </div>
        {cursos.length === 0 && <p style={s.help}>Aún no has importado cursos.</p>}
        <div style={s.courseList}>
          {cursos.map((curso) => (
            <div key={curso.id} style={s.courseRow}>
              <div style={s.courseInfo}>
                <strong>{curso.titulo}</strong>
                <small>
                  {curso.autor || 'Sin autor'} · {totalVideosDeCurso(curso)} video(s) ·
                  {' '}{curso.acceso === 'todos' ? 'Todos los validados' : 'Liberable por academia'}
                </small>
              </div>
              <button type="button" onClick={() => eliminarCurso(curso)} style={s.trashBtn} title="Eliminar curso">
                <VaultIcon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
        <p style={s.help}>
          Los cursos importados aparecen en el Mapa y la Búsqueda. Si eliges
          “Liberable por academia”, adminístralos en Estructuras → Contenido.
        </p>
      </section>
    </div>
  );
};

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: '12px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#d4af37', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' },
  subtitle: { margin: '4px 0 0', color: '#777', fontSize: '0.7rem', lineHeight: 1.45, maxWidth: '720px' },
  counter: { border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37', borderRadius: '999px', padding: '6px 12px', fontSize: '0.62rem', fontWeight: 800 },
  layout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: '12px', alignItems: 'start' },
  panel: { background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '12px' },
  panelTitle: { margin: '0 0 8px', color: '#e5e5e5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' },
  help: { margin: '4px 0 8px', color: '#777', fontSize: '0.65rem', lineHeight: 1.45 },
  textarea: { width: '100%', minHeight: '110px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '9px', fontSize: '0.72rem', lineHeight: 1.45, outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  actions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '9px' },
  goldBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '9px 12px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer' },
  meta: { color: '#777', fontSize: '0.62rem' },
  separator: { height: '1px', background: '#1e1e1e', margin: '13px 0' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  label: { color: '#888', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.5px' },
  input: { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '8px', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' },
  empty: { textAlign: 'center', padding: '38px 16px', color: '#777', border: '1px dashed #242424', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', fontSize: '0.7rem' },
  volume: { border: '1px solid #1e1e1e', borderRadius: '8px', padding: '8px', marginBottom: '8px', background: '#070707' },
  volumeHead: { display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#d4af37', fontSize: '0.67rem', marginBottom: '6px' },
  videoRow: { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 0', borderTop: '1px solid #151515' },
  videoName: { flex: 1, minWidth: 0, background: '#0b0b0b', border: '1px solid #242424', color: '#ddd', borderRadius: '5px', padding: '6px 7px', fontSize: '0.68rem', outline: 'none' },
  videoTime: { color: '#888', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  listHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  courseList: { display: 'flex', flexDirection: 'column', gap: '5px' },
  courseRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '7px', padding: '8px 9px' },
  courseInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  trashBtn: { background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: '5px', padding: '6px', display: 'flex', cursor: 'pointer', flexShrink: 0 }
};

export default ImportarVaultPage;
