import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { CURSOS, tecnicasDeCurso } from '../data/vaultIndex';
import { normalizar } from '../data/taxonomia';

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

const formatearTiempo = (segundos) => {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const parsearTiempo = (texto) => {
  const limpio = String(texto || '').trim();
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(limpio)) return null;
  const partes = limpio.split(':').map(Number);
  if (partes.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  return partes[0] * 3600 + partes[1] * 60 + partes[2];
};

const MarcasVideoAdminPage = () => {
  const [marcas, setMarcas] = useState([]);
  const [cursoId, setCursoId] = useState(CURSOS[0]?.id || '');
  const [busquedaVideo, setBusquedaVideo] = useState('');
  const [videoSelId, setVideoSelId] = useState('');
  const [form, setForm] = useState({ tiempo: '', titulo: '', descripcion: '' });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [previewStart, setPreviewStart] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'marcasVideo'),
      (snap) => setMarcas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error('No se pudieron cargar las marcas:', error);
        notify('No se pudieron cargar las marcas globales.', 'error');
      }
    );
    return () => unsub();
  }, []);

  const tecnicasCurso = useMemo(() => tecnicasDeCurso(cursoId), [cursoId]);

  useEffect(() => {
    if (!tecnicasCurso.length) {
      setVideoSelId('');
      return;
    }
    if (!tecnicasCurso.some((t) => t.id === videoSelId)) {
      setVideoSelId(tecnicasCurso[0].id);
    }
  }, [tecnicasCurso, videoSelId]);

  const videosFiltrados = useMemo(() => {
    const texto = normalizar(busquedaVideo);
    const base = texto
      ? tecnicasCurso.filter((t) => normalizar(`${t.nombre} ${t.volumenNombre}`).includes(texto))
      : tecnicasCurso;
    return base.slice(0, 120);
  }, [tecnicasCurso, busquedaVideo]);

  const videoSel = tecnicasCurso.find((t) => t.id === videoSelId) || null;
  const cursoSel = CURSOS.find((c) => c.id === cursoId) || null;

  // Los instruccionales del Vault son archivos de Drive y se reproducen con el
  // visor oficial embebido. Los videos de YouTube usan su propio embed.
  const esYoutube = /^[A-Za-z0-9_-]{11}$/.test(String(videoSel?.id || ''));
  const drivePreview = videoSel
    ? `https://drive.google.com/file/d/${videoSel.id}/preview${previewStart > 0 ? `?t=${previewStart}s` : ''}`
    : '';
  const youtubeSrc = videoSel
    ? `https://www.youtube.com/embed/${videoSel.id}?rel=0&modestbranding=1&playsinline=1${previewStart > 0 ? `&start=${previewStart}` : ''}`
    : '';
  const previewSrc = esYoutube ? youtubeSrc : drivePreview;

  useEffect(() => {
    setPreviewStart(0);
  }, [videoSelId]);

  const marcasVideo = useMemo(
    () => marcas
      .filter((marca) => marca.videoId === videoSelId)
      .sort((a, b) => Number(a.segundos) - Number(b.segundos)),
    [marcas, videoSelId]
  );

  const limpiarForm = () => {
    setForm({ tiempo: '', titulo: '', descripcion: '' });
    setEditandoId(null);
  };

  const verEnVideo = (segundos) => {
    const valor = Number(segundos);
    if (!Number.isFinite(valor) || valor < 0) return;
    setPreviewStart(Math.floor(valor));
  };

  const usarTiempoEscrito = () => {
    const segundos = parsearTiempo(form.tiempo);
    if (segundos === null) {
      return notify('Escribe un tiempo válido, por ejemplo 03:45.', 'error');
    }
    verEnVideo(segundos);
    notify(`Video en ${formatearTiempo(segundos)}`);
  };

  const ajustarTiempo = (delta) => {
    const base = parsearTiempo(form.tiempo) ?? previewStart;
    const siguiente = Math.max(0, Math.round(base) + delta);
    setForm((prev) => ({ ...prev, tiempo: formatearTiempo(siguiente) }));
  };

  const guardar = async () => {
    if (!videoSel) return notify('Selecciona un video.', 'error');
    const segundos = parsearTiempo(form.tiempo);
    if (segundos === null) return notify('Usa un tiempo válido, por ejemplo 03:45 o 1:02:10.', 'error');
    const titulo = form.titulo.trim();
    if (!titulo) return notify('Escribe un título para la marca.', 'error');

    setGuardando(true);
    try {
      const payload = {
        videoId: videoSel.id,
        cursoId,
        cursoTitulo: cursoSel?.titulo || '',
        videoTitulo: videoSel.nombre,
        tiempo: formatearTiempo(segundos),
        segundos,
        titulo,
        descripcion: form.descripcion.trim(),
        actualizadoEn: new Date().toISOString()
      };
      if (editandoId) {
        await updateDoc(doc(db, 'marcasVideo', editandoId), payload);
        notify('Marca actualizada');
      } else {
        await addDoc(collection(db, 'marcasVideo'), {
          ...payload,
          creadoPor: auth.currentUser?.uid || '',
          creadoEn: new Date().toISOString()
        });
        notify('Marca global creada');
      }
      limpiarForm();
    } catch (error) {
      console.error(error);
      notify(`No se pudo guardar: ${error.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (marca) => {
    setEditandoId(marca.id);
    setForm({
      tiempo: marca.tiempo || formatearTiempo(marca.segundos),
      titulo: marca.titulo || '',
      descripcion: marca.descripcion || ''
    });
  };

  const eliminar = async (marca) => {
    const res = await Swal.fire({
      title: '¿Eliminar marca?',
      text: 'Los usuarios dejarán de ver esta marca en el video.',
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
      await deleteDoc(doc(db, 'marcasVideo', marca.id));
      if (editandoId === marca.id) limpiarForm();
      notify('Marca eliminada');
    } catch (error) {
      notify(`No se pudo eliminar: ${error.message}`, 'error');
    }
  };

  return (
    <div style={m.root}>
      <div style={m.header}>
        <div>
          <h2 style={m.title}><VaultIcon name="clock" size={20} /> Marcas de tiempo globales</h2>
          <p style={m.subtitle}>
            Estas marcas las ve todo usuario que abra el instruccional. Son independientes
            de las notas privadas de cada alumno.
          </p>
        </div>
        <span style={m.counter}>{marcas.length} marcas en total</span>
      </div>

      <div style={m.layout}>
        <aside style={m.panel}>
          <label style={m.label}>CURSO</label>
          <select value={cursoId} onChange={(e) => { setCursoId(e.target.value); setBusquedaVideo(''); }} style={m.input}>
            {CURSOS.map((curso) => (
              <option key={curso.id} value={curso.id}>{curso.titulo} · {curso.autor}</option>
            ))}
          </select>

          <label style={{ ...m.label, marginTop: '10px' }}>VIDEO</label>
          <div style={m.searchBox}>
            <VaultIcon name="search" size={13} color="#777" />
            <input
              value={busquedaVideo}
              onChange={(e) => setBusquedaVideo(e.target.value)}
              placeholder="Buscar video..."
              aria-label="Buscar video del curso"
              style={m.searchInput}
            />
          </div>
          <div style={m.videoList}>
            {videosFiltrados.map((tecnica) => (
              <button
                key={tecnica.id}
                type="button"
                onClick={() => { setVideoSelId(tecnica.id); limpiarForm(); }}
                style={tecnica.id === videoSelId ? m.videoActive : m.videoItem}
              >
                <span style={m.videoName}>{tecnica.nombre}</span>
                <span style={m.videoMeta}>{tecnica.volumenNombre}</span>
                {marcas.some((marca) => marca.videoId === tecnica.id) && (
                  <span style={m.videoBadge}>{marcas.filter((marca) => marca.videoId === tecnica.id).length}</span>
                )}
              </button>
            ))}
            {videosFiltrados.length === 0 && <p style={m.empty}>Sin videos con ese filtro.</p>}
          </div>
        </aside>

        <main style={m.main}>
          {!videoSel ? (
            <div style={m.emptyBig}>
              <VaultIcon name="bookOpen" size={38} color="#d4af37" />
              <p>Selecciona un curso y un video.</p>
            </div>
          ) : (
            <>
              <div style={m.videoHead}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={m.videoTitle}>{videoSel.nombre}</h3>
                  <p style={m.videoSub}>{cursoSel?.titulo} · {videoSel.volumenNombre}</p>
                </div>
                <a
                  href={esYoutube
                    ? `https://www.youtube.com/watch?v=${videoSel.id}`
                    : `https://drive.google.com/file/d/${videoSel.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  style={m.linkBtn}
                >
                  <VaultIcon name="external" size={12} /> ABRIR EN {esYoutube ? 'YOUTUBE' : 'DRIVE'}
                </a>
              </div>

              <div style={m.playerBox}>
                <iframe
                  key={`${videoSel.id}-${previewStart}`}
                  src={previewSrc}
                  title={videoSel.nombre}
                  style={m.playerFrame}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />

                <div style={m.playerBar}>
                  <span style={m.playerClock}>
                    <VaultIcon name="clock" size={12} />
                    REPRODUCTOR: <strong>{videoSel.nombre}</strong>
                  </span>
                  <div style={m.playerActions}>
                    <button type="button" onClick={() => setPreviewStart(0)} style={m.secondaryBtn}>
                      REINICIAR
                    </button>
                    <button type="button" onClick={usarTiempoEscrito} style={m.goldBtn}>
                      <VaultIcon name="pin" size={13} /> IR AL TIEMPO ESCRITO
                    </button>
                  </div>
                </div>

                <p style={m.playerNote}>
                  Reproduce el video y pausa en el momento exacto. Mira el tiempo que muestra
                  el reproductor, escríbelo abajo y pulsa <strong>IR AL TIEMPO ESCRITO</strong> para
                  confirmarlo. {esYoutube ? 'En YouTube también puedes copiar el minuto actual.' : ''}
                </p>
              </div>

              <section style={m.panel}>
                <div style={m.panelHead}>
                  <h4 style={m.panelTitle}><VaultIcon name="pin" size={14} /> Marcas de este video</h4>
                  <span style={m.panelMeta}>{marcasVideo.length}</span>
                </div>
                {marcasVideo.length === 0 && (
                  <p style={m.empty}>Aún no hay marcas globales para este video.</p>
                )}
                <div style={m.markerList}>
                  {marcasVideo.map((marca) => (
                    <div key={marca.id} style={m.markerRow}>
                      <button
                        type="button"
                        onClick={() => verEnVideo(marca.segundos)}
                        style={m.timeChip}
                        title="Ir a este momento del video"
                      >
                        {marca.tiempo || formatearTiempo(marca.segundos)}
                      </button>
                      <div style={m.markerText}>
                        <strong>{marca.titulo}</strong>
                        {marca.descripcion && <small>{marca.descripcion}</small>}
                      </div>
                      <div style={m.markerActions}>
                        <button type="button" onClick={() => editar(marca)} style={m.iconBtn} title="Editar">
                          <VaultIcon name="edit" size={13} />
                        </button>
                        <button type="button" onClick={() => eliminar(marca)} style={m.iconBtnDanger} title="Eliminar">
                          <VaultIcon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={m.panel}>
                <div style={m.panelHead}>
                  <h4 style={m.panelTitle}>
                    <VaultIcon name={editandoId ? 'edit' : 'plus'} size={14} />
                    {editandoId ? 'Editar marca' : 'Nueva marca'}
                  </h4>
                  {editandoId && (
                    <button type="button" onClick={limpiarForm} style={m.linkBtn}>CANCELAR EDICIÓN</button>
                  )}
                </div>
                <div style={m.formGrid}>
                  <label style={m.field}>
                    <span style={m.label}>TIEMPO</span>
                    <input
                      value={form.tiempo}
                      onChange={(e) => setForm((prev) => ({ ...prev, tiempo: e.target.value }))}
                      placeholder="03:45"
                      inputMode="numeric"
                      style={{ ...m.input, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }}
                    />
                    <div style={m.nudgeRow}>
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => ajustarTiempo(delta)}
                          style={m.nudgeBtn}
                          title={`${delta > 0 ? 'Sumar' : 'Restar'} ${Math.abs(delta)} segundos`}
                        >
                          {delta > 0 ? `+${delta}s` : `${delta}s`}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label style={{ ...m.field, gridColumn: 'span 2' }}>
                    <span style={m.label}>TÍTULO</span>
                    <input
                      value={form.titulo}
                      onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                      placeholder="Ej. Entrada al triangulo"
                      maxLength={90}
                      style={m.input}
                    />
                  </label>
                  <label style={{ ...m.field, gridColumn: '1 / -1' }}>
                    <span style={m.label}>DESCRIPCIÓN (OPCIONAL)</span>
                    <textarea
                      value={form.descripcion}
                      onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                      placeholder="Detalle o corrección clave..."
                      rows={2}
                      style={m.textarea}
                    />
                  </label>
                </div>
                <div style={m.formActions}>
                  <p style={m.hint}>Pausa el video en el momento exacto, escribe el tiempo y guarda. Los usuarios lo verán al abrirlo.</p>
                  <button type="button" onClick={guardar} disabled={guardando} style={m.goldBtn}>
                    <VaultIcon name={guardando ? 'clock' : 'check'} size={13} />
                    {guardando ? 'GUARDANDO...' : (editandoId ? 'GUARDAR CAMBIOS' : 'CREAR MARCA')}
                  </button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const m = {
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#d4af37', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' },
  subtitle: { margin: '4px 0 0', color: '#777', fontSize: '0.7rem', lineHeight: 1.45, maxWidth: '680px' },
  counter: { border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37', borderRadius: '999px', padding: '6px 12px', fontSize: '0.62rem', fontWeight: 800 },
  layout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '12px', alignItems: 'start' },
  panel: { background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '12px' },
  main: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { display: 'block', color: '#888', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
  input: { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '9px', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '9px', fontSize: '0.78rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '7px', background: '#050505', border: '1px solid #232323', borderRadius: '7px', padding: '0 9px', height: '34px', marginBottom: '7px' },
  searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.75rem' },
  videoList: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' },
  videoItem: { display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left', background: '#0d0d0d', border: '1px solid #1d1d1d', borderRadius: '7px', padding: '7px 8px', color: '#fff', cursor: 'pointer', position: 'relative' },
  videoActive: { display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left', background: 'rgba(212,175,55,0.08)', border: '1px solid #d4af37', borderRadius: '7px', padding: '7px 8px', color: '#fff', cursor: 'pointer', position: 'relative' },
  videoName: { fontSize: '0.72rem', lineHeight: 1.25, paddingRight: '24px' },
  videoMeta: { fontSize: '0.56rem', color: '#777' },
  videoBadge: { position: 'absolute', top: '6px', right: '6px', background: '#d4af37', color: '#000', borderRadius: '50%', width: '17px', height: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.56rem', fontWeight: 800 },
  videoHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '12px' },
  playerBox: { background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  playerFrame: { width: '100%', aspectRatio: '16 / 9', maxHeight: '440px', border: 'none', background: '#000', display: 'block' },
  playerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '9px 11px', borderTop: '1px solid #1c1c1c' },
  playerClock: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#999', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.4px' },
  playerActions: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: '7px', padding: '8px 10px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' },
  playerNote: { margin: 0, padding: '0 11px 10px', color: '#777', fontSize: '0.62rem', lineHeight: 1.4 },
  videoTitle: { margin: 0, color: '#fff', fontSize: '0.95rem', lineHeight: 1.25 },
  videoSub: { margin: '3px 0 0', color: '#777', fontSize: '0.62rem' },
  linkBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', borderRadius: '6px', padding: '7px 9px', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' },
  panelTitle: { margin: 0, color: '#e5e5e5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' },
  panelMeta: { color: '#666', fontSize: '0.58rem' },
  markerList: { display: 'flex', flexDirection: 'column', gap: '4px' },
  markerRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '7px', padding: '7px 8px' },
  timeChip: { background: '#d4af37', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 7px', fontSize: '0.62rem', fontWeight: 800, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit' },
  markerText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  markerActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  iconBtn: { background: '#111', border: '1px solid #2a2a2a', color: '#d4af37', borderRadius: '5px', padding: '6px', display: 'flex', cursor: 'pointer' },
  iconBtnDanger: { background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: '5px', padding: '6px', display: 'flex', cursor: 'pointer' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  nudgeRow: { display: 'flex', gap: '3px', marginTop: '3px' },
  nudgeBtn: { flex: 1, background: '#0d0d0d', border: '1px solid #262626', color: '#999', borderRadius: '4px', padding: '4px 0', fontSize: '0.55rem', fontWeight: 700, cursor: 'pointer' },
  formActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  hint: { color: '#666', fontSize: '0.6rem', margin: 0, lineHeight: 1.4 },
  goldBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '9px 12px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer' },
  empty: { color: '#666', fontSize: '0.7rem', fontStyle: 'italic', padding: '14px', textAlign: 'center' },
  emptyBig: { textAlign: 'center', padding: '50px 20px', color: '#777', border: '1px dashed #242424', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }
};

export default MarcasVideoAdminPage;
