import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { CURSOS } from '../data/vaultIndex';
import { generarCodigoAcceso } from '../utils/teamsService';
import { comprimirImagen } from '../utils/imageUtils';
import { useDialogA11y } from '../hooks/useDialogA11y';

const hoyIso = () => new Date().toISOString();
const limpiar = (valor) => String(valor || '').trim();
const nombreAcademia = (aca) => aca?.nombreAcademia || aca?.nombre || 'Academia';
const teamDeAcademia = (aca) => {
  const candidato = limpiar(aca?.teamId);
  if (candidato && !candidato.includes('/') && !candidato.startsWith('http')) return candidato;
  return aca?.id || '';
};

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

const confirmar = (titulo, texto, confirmButtonText = 'Sí, continuar') => Swal.fire({
  title: titulo,
  text: texto,
  icon: 'warning',
  showCancelButton: true,
  background: '#0a0a0a',
  color: '#fff',
  confirmButtonColor: '#d4af37',
  cancelButtonColor: '#333',
  confirmButtonText,
  cancelButtonText: 'Cancelar'
});

const Stat = ({ label, value, icon, color = '#d4af37' }) => (
  <div style={a.stat}>
    <span style={{ ...a.statIcon, color, borderColor: `${color}55` }}>
      <VaultIcon name={icon} size={16} />
    </span>
    <div>
      <strong style={{ ...a.statValue, color }}>{value}</strong>
      <span style={a.statLabel}>{label}</span>
    </div>
  </div>
);

const Campo = ({ label, children, hint, full = false }) => (
  <label style={{ ...a.field, gridColumn: full ? '1 / -1' : undefined }}>
    <span style={a.fieldLabel}>{label}</span>
    {children}
    {hint && <span style={a.hint}>{hint}</span>}
  </label>
);

const AcademiasAdminPage = ({ academias = [], sedes = [], usuarios = [] }) => {
  const [rutas, setRutas] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [clases, setClases] = useState([]);

  const [academiaSelId, setAcademiaSelId] = useState('');
  const [tab, setTab] = useState('resumen');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [formAcademia, setFormAcademia] = useState({
    nombre: '', ciudad: '', nombreSede: '', ownerUid: '', logoBase64: ''
  });
  const [formSede, setFormSede] = useState({ nombre: '', ciudad: '', responsableUid: '' });
  const [formStaff, setFormStaff] = useState({ uid: '', rol: 'instructor', sedeId: '' });
  const [formAjustes, setFormAjustes] = useState({ nombre: '', ciudad: '', ownerUid: '', logoBase64: '' });
  const [busquedaCurso, setBusquedaCurso] = useState('');
  const [contenidoDestino, setContenidoDestino] = useState('');

  const dialogRef = useDialogA11y(Boolean(modal), () => {
    if (!guardando) setModal(null);
  });

  // Contenido y alumnos: el admin puede leerlos todos.
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'rutas'), (snap) => {
        setRutas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => console.warn('rutas', error?.code)),
      onSnapshot(collection(db, 'asignacionesRuta'), (snap) => {
        setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => console.warn('asignaciones', error?.code)),
      onSnapshot(collection(db, 'alumnos'), (snap) => {
        setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => console.warn('alumnos', error?.code)),
      onSnapshot(collection(db, 'clases'), (snap) => {
        setClases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => console.warn('clases', error?.code))
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  useEffect(() => {
    if (!academiaSelId && academias.length) {
      setAcademiaSelId(academias[0].id);
      return;
    }
    if (academiaSelId && !academias.some((aca) => aca.id === academiaSelId)) {
      setAcademiaSelId(academias[0]?.id || '');
    }
  }, [academias, academiaSelId]);

  const academia = useMemo(
    () => academias.find((aca) => aca.id === academiaSelId) || null,
    [academias, academiaSelId]
  );
  const teamId = teamDeAcademia(academia);

  const academiasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return academias;
    return academias.filter((aca) => [
      nombreAcademia(aca), aca.ciudad, aca.nombre, aca.nombreAcademia
    ].some((valor) => String(valor || '').toLowerCase().includes(texto)));
  }, [academias, busqueda]);

  const sedesDeAcademia = useMemo(() => {
    if (!academia) return [];
    return sedes.filter((sede) => (
      sede.academiaId === academia.id ||
      (teamId && sede.teamId === teamId) ||
      (sede.id === academia.id && (sede.academiaId || sede.teamId))
    ));
  }, [sedes, academia, teamId]);

  const sedesHuerfanas = useMemo(() => {
    if (!academias.length) return sedes;
    return sedes.filter((sede) => !academias.some((aca) => (
      sede.academiaId === aca.id || (teamDeAcademia(aca) && sede.teamId === teamDeAcademia(aca))
    )));
  }, [sedes, academias]);

  const staffDeAcademia = useMemo(() => {
    if (!academia) return [];
    return usuarios.filter((u) => (
      u.academiaId === academia.id ||
      (teamId && u.teamId === teamId) ||
      sedesDeAcademia.some((sede) => sede.id === u.sedeId)
    ));
  }, [usuarios, academia, teamId, sedesDeAcademia]);

  const staffSinSede = useMemo(
    () => usuarios.filter((u) => ['profesor', 'instructor'].includes(u.rol) && !u.sedeId),
    [usuarios]
  );

  const alumnosDeSede = (sedeId) => alumnos.filter((alumno) => alumno.sedeId === sedeId).length;
  const clasesDeSede = (sedeId) => clases.filter((clase) => clase.sedeId === sedeId).length;
  const clasesSinSede = useMemo(() => clases.filter((clase) => !clase.sedeId), [clases]);
  const alumnosSinSede = useMemo(() => alumnos.filter((alumno) => !alumno.sedeId), [alumnos]);

  const cursosLiberados = useMemo(
    () => new Set(Array.isArray(academia?.cursos_liberados) ? academia.cursos_liberados : []),
    [academia]
  );

  const rutasLiberadas = useMemo(() => {
    if (!academia) return new Set();
    return new Set(
      asignaciones
        .filter((asignacion) => asignacion.destinoTipo === 'academia' && (
          asignacion.destinoId === academia.id ||
          (teamId && asignacion.destinoTeamId === teamId)
        ))
        .map((asignacion) => asignacion.rutaId)
    );
  }, [asignaciones, academia, teamId]);

  const sedeContenido = useMemo(
    () => sedesDeAcademia.find((sede) => sede.id === contenidoDestino) || null,
    [sedesDeAcademia, contenidoDestino]
  );

  const cursosScope = useMemo(() => new Set(
    sedeContenido
      ? (Array.isArray(sedeContenido.cursos_liberados) ? sedeContenido.cursos_liberados : [])
      : (Array.isArray(academia?.cursos_liberados) ? academia.cursos_liberados : [])
  ), [sedeContenido, academia]);

  const rutasScope = useMemo(() => {
    if (!academia) return new Set();
    if (sedeContenido) {
      return new Set(
        asignaciones
          .filter((asignacion) => asignacion.destinoTipo === 'sede' && asignacion.destinoId === sedeContenido.id)
          .map((asignacion) => asignacion.rutaId)
      );
    }
    return rutasLiberadas;
  }, [asignaciones, academia, sedeContenido, rutasLiberadas]);

  useEffect(() => {
    if (contenidoDestino && !sedesDeAcademia.some((sede) => sede.id === contenidoDestino)) {
      setContenidoDestino('');
    }
  }, [sedesDeAcademia, contenidoDestino]);

  useEffect(() => {
    setContenidoDestino('');
  }, [academia?.id]);

  // Sin useMemo: CURSOS puede crecer cuando se importan cursos desde Firestore.
  const busquedaCursos = (() => {
    const texto = busquedaCurso.trim().toLowerCase();
    if (!texto) return CURSOS;
    return CURSOS.filter((curso) => `${curso.titulo} ${curso.autor}`.toLowerCase().includes(texto));
  })();

  const salud = useMemo(() => {
    const sinTeam = academias.filter((aca) => !limpiar(aca.teamId)).length;
    const sedesSinAcademia = sedesHuerfanas.length;
    const staffSinSedeCount = staffSinSede.length;
    const clasesSinSedeCount = clasesSinSede.length;
    const alumnosSinSedeCount = alumnosSinSede.length;
    const sedesSinCodigo = sedes.filter((sede) => !limpiar(sede.codigoAcceso)).length;
    return {
      sinTeam,
      sedesSinAcademia,
      staffSinSede: staffSinSedeCount,
      clasesSinSede: clasesSinSedeCount,
      alumnosSinSede: alumnosSinSedeCount,
      sedesSinCodigo,
      total: sinTeam + sedesSinAcademia + staffSinSedeCount + clasesSinSedeCount + alumnosSinSedeCount + sedesSinCodigo
    };
  }, [academias, sedesHuerfanas, staffSinSede, clasesSinSede, alumnosSinSede, sedes]);

  const abrirModal = (tipo) => {
    setModal(tipo);
    if (tipo === 'nueva-academia') {
      setFormAcademia({ nombre: '', ciudad: '', nombreSede: '', ownerUid: '', logoBase64: '' });
    }
    if (tipo === 'nueva-sede') {
      setFormSede({ nombre: '', ciudad: academia?.ciudad || '', responsableUid: '' });
    }
    if (tipo === 'staff') {
      setFormStaff({ uid: '', rol: 'instructor', sedeId: sedesDeAcademia[0]?.id || '' });
    }
    if (tipo === 'ajustes' && academia) {
      setFormAjustes({
        nombre: nombreAcademia(academia),
        ciudad: academia.ciudad || '',
        ownerUid: academia.ownerUid || '',
        logoBase64: academia.logoBase64 || academia.logobase64 || ''
      });
    }
  };

  const handleLogoAcademia = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const base64 = await comprimirImagen(file, { maxDimension: 600, quality: 0.76, maxBytes: 380000 });
      setFormAcademia((prev) => ({ ...prev, logoBase64: base64 }));
    } catch (error) {
      notify(error?.message || 'No se pudo procesar el logo.', 'error');
    }
  };

  const handleLogoAjustes = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const base64 = await comprimirImagen(file, { maxDimension: 600, quality: 0.76, maxBytes: 380000 });
      setFormAjustes((prev) => ({ ...prev, logoBase64: base64 }));
    } catch (error) {
      notify(error?.message || 'No se pudo procesar el logo.', 'error');
    }
  };

  const crearAcademia = async () => {
    const nombre = limpiar(formAcademia.nombre);
    if (!nombre) return notify('Escribe el nombre de la sede madre.', 'error');
    setGuardando(true);
    try {
      const acaRef = doc(collection(db, 'academias'));
      const sedeRef = doc(collection(db, 'sedes'));
      const team = acaRef.id;
      const codigo = generarCodigoAcceso(nombre, formAcademia.ciudad);
      const nombreSede = limpiar(formAcademia.nombreSede) || `Sede Principal ${nombre}`;
      const batch = writeBatch(db);

      batch.set(acaRef, {
        nombre: nombre.toUpperCase(),
        nombreAcademia: nombre.toUpperCase(),
        ciudad: limpiar(formAcademia.ciudad),
        logoBase64: formAcademia.logoBase64 || '',
        ownerUid: formAcademia.ownerUid || '',
        teamId: team,
        estado: 'activa',
        cursos_liberados: [],
        fechaCreacion: hoyIso(),
        ultimaActualizacion: hoyIso(),
        timestamp: Date.now()
      });

      batch.set(doc(db, 'teams', team), {
        nombre: nombre.toUpperCase(),
        propietarioUid: formAcademia.ownerUid || '',
        fechaCreacion: hoyIso(),
        activo: true
      });

      batch.set(sedeRef, {
        academiaId: acaRef.id,
        teamId: team,
        nombre: nombreSede,
        nombreSede,
        ciudad: limpiar(formAcademia.ciudad),
        tipo: 'principal',
        codigoAcceso: codigo,
        activa: true,
        fechaCreacion: hoyIso()
      });

      batch.set(doc(db, 'codigosAcceso', codigo), {
        sedeId: sedeRef.id,
        academiaId: acaRef.id,
        teamId: team,
        nombreSede,
        actualizadoEn: hoyIso()
      });

      if (formAcademia.ownerUid) {
        const ownerUser = usuarios.find((u) => u.id === formAcademia.ownerUid);
        const rolOwner = ownerUser?.rol === 'admin' ? 'admin' : 'profesor';
        batch.set(doc(db, 'usuarios', formAcademia.ownerUid), {
          rol: rolOwner,
          academiaId: acaRef.id,
          teamId: team,
          sedeId: sedeRef.id,
          necesitaOnboarding: false,
          fechaActualizacion: hoyIso()
        }, { merge: true });
      }

      await batch.commit();
      setAcademiaSelId(acaRef.id);
      setModal(null);
      notify(`Sede madre "${nombre}" creada`);
    } catch (error) {
      console.error(error);
      notify(`No se pudo crear: ${error.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const crearSede = async () => {
    if (!academia) return;
    const nombre = limpiar(formSede.nombre);
    if (!nombre) return notify('Escribe el nombre de la sede.', 'error');
    setGuardando(true);
    try {
      const sedeRef = doc(collection(db, 'sedes'));
      const team = teamDeAcademia(academia);
      const codigo = generarCodigoAcceso(nombreAcademia(academia), formSede.ciudad);
      const batch = writeBatch(db);

      batch.set(sedeRef, {
        academiaId: academia.id,
        teamId: team,
        nombre,
        nombreSede: nombre,
        ciudad: limpiar(formSede.ciudad),
        tipo: 'afiliada',
        codigoAcceso: codigo,
        activa: true,
        fechaCreacion: hoyIso()
      });

      batch.set(doc(db, 'codigosAcceso', codigo), {
        sedeId: sedeRef.id,
        academiaId: academia.id,
        teamId: team,
        nombreSede: nombre,
        actualizadoEn: hoyIso()
      });

      if (formSede.responsableUid) {
        const responsable = usuarios.find((u) => u.id === formSede.responsableUid);
        const rolResponsable = responsable?.rol === 'admin' ? 'admin' : 'instructor';
        batch.set(doc(db, 'usuarios', formSede.responsableUid), {
          rol: rolResponsable,
          academiaId: academia.id,
          teamId: team,
          sedeId: sedeRef.id,
          necesitaOnboarding: false,
          fechaActualizacion: hoyIso()
        }, { merge: true });
      }

      await batch.commit();
      setModal(null);
      notify(`Sede "${nombre}" agregada a ${nombreAcademia(academia)}`);
    } catch (error) {
      console.error(error);
      notify(`No se pudo crear la sede: ${error.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const asignarStaff = async () => {
    if (!academia || !formStaff.uid) return notify('Selecciona un usuario.', 'error');
    setGuardando(true);
    try {
      const team = teamDeAcademia(academia);
      const sede = sedesDeAcademia.find((item) => item.id === formStaff.sedeId);
      const usuarioAsignado = usuarios.find((u) => u.id === formStaff.uid);
      const rolFinal = usuarioAsignado?.rol === 'admin' ? 'admin' : formStaff.rol;
      await updateDoc(doc(db, 'usuarios', formStaff.uid), {
        rol: rolFinal,
        academiaId: academia.id,
        teamId: team,
        sedeId: formStaff.sedeId || '',
        fechaActualizacion: hoyIso()
      });
      setModal(null);
      notify(`${rolFinal.toUpperCase()} asignado a ${sede?.nombreSede || sede?.nombre || 'la academia'}`);
    } catch (error) {
      console.error(error);
      notify(`No se pudo asignar: ${error.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const quitarStaff = async (user) => {
    if (!academia) return;
    if (user.rol === 'admin') {
      return notify('La cuenta maestra no se puede desvincular desde aquí.', 'error');
    }
    const res = await confirmar(
      '¿Quitar del equipo?',
      `${user.nombre || user.email} dejará de estar vinculado a ${nombreAcademia(academia)}. No se borran sus datos.`,
      'Sí, desvincular'
    );
    if (!res.isConfirmed) return;
    try {
      await updateDoc(doc(db, 'usuarios', user.id), {
        academiaId: '',
        teamId: '',
        sedeId: '',
        fechaActualizacion: hoyIso()
      });
      notify('Usuario desvinculado');
    } catch (error) {
      notify(`No se pudo desvincular: ${error.message}`, 'error');
    }
  };

  const guardarAjustes = async () => {
    if (!academia) return;
    const nombre = limpiar(formAjustes.nombre);
    if (!nombre) return notify('El nombre es obligatorio.', 'error');
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'academias', academia.id), {
        nombre: nombre.toUpperCase(),
        nombreAcademia: nombre.toUpperCase(),
        ciudad: limpiar(formAjustes.ciudad),
        ownerUid: formAjustes.ownerUid || '',
        logoBase64: formAjustes.logoBase64 || '',
        ultimaActualizacion: hoyIso()
      });
      setModal(null);
      notify('Academia actualizada');
    } catch (error) {
      notify(`No se pudo guardar: ${error.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const toggleCurso = async (cursoId) => {
    if (!academia) return;
    const actuales = new Set(
      sedeContenido
        ? (sedeContenido.cursos_liberados || [])
        : (academia.cursos_liberados || [])
    );
    if (actuales.has(cursoId)) actuales.delete(cursoId);
    else actuales.add(cursoId);
    try {
      const ref = sedeContenido
        ? doc(db, 'sedes', sedeContenido.id)
        : doc(db, 'academias', academia.id);
      await updateDoc(ref, {
        cursos_liberados: [...actuales],
        ultimaActualizacion: hoyIso()
      });
    } catch (error) {
      notify(`No se pudo actualizar el acceso: ${error.message}`, 'error');
    }
  };

  const toggleRuta = async (ruta) => {
    if (!academia) return;
    const team = teamDeAcademia(academia);
    const destinoTipo = sedeContenido ? 'sede' : 'academia';
    const destinoId = sedeContenido ? sedeContenido.id : academia.id;
    const destinoNombre = sedeContenido
      ? (sedeContenido.nombreSede || sedeContenido.nombre || 'Sede')
      : nombreAcademia(academia);
    const existente = asignaciones.find((asignacion) => (
      asignacion.rutaId === ruta.id &&
      asignacion.destinoTipo === destinoTipo &&
      asignacion.destinoId === destinoId
    ));
    try {
      if (existente) {
        await deleteDoc(doc(db, 'asignacionesRuta', existente.id));
        notify(`Ruta retirada de ${destinoNombre}`);
      } else {
        await addDoc(collection(db, 'asignacionesRuta'), {
          rutaId: ruta.id,
          rutaNombre: ruta.nombre || 'Ruta',
          destinoTipo,
          destinoId,
          destinoTeamId: team,
          destinoNombre,
          estado: 'activa',
          asignadaPor: auth.currentUser?.uid || '',
          asignadaEn: hoyIso()
        });
        notify(`Ruta liberada a ${destinoNombre}`);
      }
    } catch (error) {
      notify(`No se pudo actualizar la ruta: ${error.message}`, 'error');
    }
  };

  const copiarCodigo = async (sede) => {
    if (!sede?.codigoAcceso) return;
    try {
      await navigator.clipboard.writeText(sede.codigoAcceso);
      notify('Código copiado');
    } catch {
      notify('No se pudo copiar el código.', 'error');
    }
  };

  const regenerarCodigo = async (sede) => {
    if (!academia || !sede) return;
    const res = await confirmar(
      '¿Regenerar código?',
      `El código actual de "${sede.nombreSede || sede.nombre}" dejará de funcionar.`,
      'Sí, regenerar'
    );
    if (!res.isConfirmed) return;
    try {
      const codigo = generarCodigoAcceso(nombreAcademia(academia), sede.ciudad);
      const team = teamDeAcademia(academia);
      const batch = writeBatch(db);
      batch.update(doc(db, 'sedes', sede.id), {
        codigoAcceso: codigo,
        ultimaActualizacion: hoyIso()
      });
      batch.set(doc(db, 'codigosAcceso', codigo), {
        sedeId: sede.id,
        academiaId: academia.id,
        teamId: team,
        nombreSede: sede.nombreSede || sede.nombre || '',
        actualizadoEn: hoyIso()
      });
      if (sede.codigoAcceso && sede.codigoAcceso !== codigo) {
        batch.delete(doc(db, 'codigosAcceso', sede.codigoAcceso));
      }
      await batch.commit();
      notify(`Nuevo código: ${codigo}`);
    } catch (error) {
      notify(`No se pudo regenerar: ${error.message}`, 'error');
    }
  };

  const asignarSedeAAcademia = async (sede) => {
    if (!academia) return;
    const team = teamDeAcademia(academia);
    const res = await confirmar(
      '¿Asignar sede a esta academia?',
      `"${sede.nombreSede || sede.nombre}" pasará a ${nombreAcademia(academia)} y se normalizarán su staff, alumnos y clases.`,
      'Sí, asignar'
    );
    if (!res.isConfirmed) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'sedes', sede.id), {
        academiaId: academia.id,
        teamId: team,
        ultimaActualizacion: hoyIso()
      });
      usuarios.filter((u) => u.sedeId === sede.id).forEach((u) => {
        batch.update(doc(db, 'usuarios', u.id), { academiaId: academia.id, teamId: team });
      });
      alumnos.filter((a) => a.sedeId === sede.id).forEach((a) => {
        batch.update(doc(db, 'alumnos', a.id), { academiaId: academia.id, teamId: team });
      });
      clases.filter((c) => c.sedeId === sede.id).forEach((c) => {
        batch.update(doc(db, 'clases', c.id), { academiaId: academia.id, teamId: team });
      });
      await batch.commit();
      notify('Sede y datos vinculados');
    } catch (error) {
      notify(`No se pudo asignar: ${error.message}`, 'error');
    }
  };

  const normalizarSede = async (sede) => {
    if (!academia) return;
    const team = teamDeAcademia(academia);
    const res = await confirmar(
      '¿Normalizar esta sede?',
      `Se alineará "${sede.nombreSede || sede.nombre}" con ${nombreAcademia(academia)} y se corregirá el team de su staff, alumnos y clases.`,
      'Sí, normalizar'
    );
    if (!res.isConfirmed) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'sedes', sede.id), {
        academiaId: academia.id,
        teamId: team,
        ultimaActualizacion: hoyIso()
      });
      usuarios.filter((u) => u.sedeId === sede.id).forEach((u) => {
        batch.update(doc(db, 'usuarios', u.id), { academiaId: academia.id, teamId: team });
      });
      alumnos.filter((a) => a.sedeId === sede.id).forEach((a) => {
        batch.update(doc(db, 'alumnos', a.id), { academiaId: academia.id, teamId: team });
      });
      clases.filter((c) => c.sedeId === sede.id).forEach((c) => {
        batch.update(doc(db, 'clases', c.id), { academiaId: academia.id, teamId: team });
      });
      await batch.commit();
      notify('Sede normalizada');
    } catch (error) {
      notify(`No se pudo normalizar: ${error.message}`, 'error');
    }
  };

  const normalizarClasesSinSede = async () => {
    const pendientes = clasesSinSede;
    if (!pendientes.length) return notify('No hay clases sin sede.', 'info');
    const res = await confirmar(
      '¿Reparar clases sin sede?',
      `Se intentará asignar ${pendientes.length} clase(s) a la sede de quien las creó.`,
      'Sí, reparar'
    );
    if (!res.isConfirmed) return;
    try {
      const batch = writeBatch(db);
      let count = 0;
      pendientes.forEach((clase) => {
        const creador = usuarios.find((u) => u.id === clase.creadoPor || u.uid === clase.creadoPor);
        if (!creador?.sedeId) return;
        const sede = sedes.find((s) => s.id === creador.sedeId);
        const aca = academias.find((a) => a.id === creador.academiaId) || null;
        batch.update(doc(db, 'clases', clase.id), {
          sedeId: creador.sedeId,
          academiaId: aca?.id || creador.academiaId || sede?.academiaId || '',
          teamId: aca ? teamDeAcademia(aca) : (sede?.teamId || creador.teamId || '')
        });
        count += 1;
      });
      if (!count) return notify('No se pudo inferir la sede de esas clases.', 'error');
      await batch.commit();
      notify(`${count} clase(s) reparadas`);
    } catch (error) {
      notify(`No se pudieron reparar: ${error.message}`, 'error');
    }
  };

  const normalizarAlumnos = async () => {
    const res = await confirmar(
      '¿Normalizar alumnos?',
      'Se asignará a cada alumno la academia/team de su sede. No se mueve a nadie de sede.',
      'Sí, normalizar'
    );
    if (!res.isConfirmed) return;
    try {
      const batch = writeBatch(db);
      let count = 0;
      alumnos.forEach((alumno) => {
        const sede = sedes.find((s) => s.id === alumno.sedeId);
        if (!sede) return;
        const aca = academias.find((a) => a.id === sede.academiaId) || null;
        const team = aca ? teamDeAcademia(aca) : (sede.teamId || '');
        if (!aca && !team) return;
        batch.update(doc(db, 'alumnos', alumno.id), {
          academiaId: aca?.id || sede.academiaId || '',
          teamId: team || ''
        });
        count += 1;
      });
      if (!count) return notify('No hay alumnos que normalizar.', 'info');
      await batch.commit();
      notify(`${count} alumno(s) normalizados`);
    } catch (error) {
      notify(`No se pudieron normalizar: ${error.message}`, 'error');
    }
  };

  const normalizarStaff = async () => {
    const res = await confirmar(
      '¿Normalizar staff?',
      'Se asignará a cada profesor/instructor la academia/team de su sede.',
      'Sí, normalizar'
    );
    if (!res.isConfirmed) return;
    try {
      const batch = writeBatch(db);
      let count = 0;
      usuarios.forEach((user) => {
        if (!['profesor', 'instructor'].includes(user.rol) || !user.sedeId) return;
        const sede = sedes.find((s) => s.id === user.sedeId);
        if (!sede) return;
        const aca = academias.find((a) => a.id === sede.academiaId) || null;
        const team = aca ? teamDeAcademia(aca) : (sede.teamId || '');
        if (!aca && !team) return;
        batch.update(doc(db, 'usuarios', user.id), {
          academiaId: aca?.id || sede.academiaId || '',
          teamId: team || ''
        });
        count += 1;
      });
      if (!count) return notify('No hay staff que normalizar.', 'info');
      await batch.commit();
      notify(`${count} cuenta(s) normalizadas`);
    } catch (error) {
      notify(`No se pudo normalizar: ${error.message}`, 'error');
    }
  };

  const sedesVisibles = sedesDeAcademia;
  const staffConSede = staffDeAcademia.filter((u) => u.sedeId);
  const owner = usuarios.find((u) => u.id === academia?.ownerUid || u.uid === academia?.ownerUid);

  return (
    <div style={a.root}>
      <style>{css}</style>
      <div style={a.header}>
        <div>
          <h2 style={a.title}><VaultIcon name="tree" size={20} /> Academias y sedes</h2>
          <p style={a.subtitle}>
            Cada sede madre controla su contenido y sus sedes. Los alumnos nunca se comparten entre sedes.
          </p>
        </div>
        <button type="button" onClick={() => abrirModal('nueva-academia')} style={a.goldBtn}>
          <VaultIcon name="plus" size={14} /> NUEVA SEDE MADRE
        </button>
      </div>

      <div style={a.toolbar}>
        <div style={a.searchBox}>
          <VaultIcon name="search" size={15} color="#777" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar academia o ciudad..."
            aria-label="Buscar academia"
            style={a.searchInput}
          />
        </div>
        <span style={a.healthPill} className={salud.total ? 'is-warning' : 'is-ok'}>
          {salud.total ? `${salud.total} dato(s) por corregir` : 'Estructura saludable'}
        </span>
      </div>

      <div style={a.layout}>
        <aside style={a.list}>
          {academiasFiltradas.length === 0 && (
            <div style={a.empty}>Aún no hay sedes madre. Crea la primera.</div>
          )}
          {academiasFiltradas.map((aca) => {
            const team = teamDeAcademia(aca);
            const sedesAca = sedes.filter((s) => s.academiaId === aca.id || (team && s.teamId === team));
            const activa = aca.id === academiaSelId;
            const logo = aca.logoBase64 || aca.logobase64;
            const alertas = !limpiar(aca.teamId) + (sedesAca.some((s) => !s.codigoAcceso) ? 1 : 0);
            return (
              <button
                key={aca.id}
                type="button"
                onClick={() => { setAcademiaSelId(aca.id); setTab('resumen'); }}
                style={activa ? a.listCardActive : a.listCard}
              >
                <span style={a.avatar}>
                  {logo ? <img src={logo} alt="" style={a.avatarImg} /> : <VaultIcon name="building" size={19} />}
                </span>
                <span style={a.listInfo}>
                  <strong style={a.listName}>{nombreAcademia(aca)}</strong>
                  <span style={a.listMeta}>{sedesAca.length} sede(s) · {usuarios.filter((u) => u.academiaId === aca.id || (team && u.teamId === team)).length} staff</span>
                </span>
                {alertas > 0 && <span style={a.alertDot} title="Datos por corregir" />}
              </button>
            );
          })}
        </aside>

        <main style={a.main}>
          {!academia ? (
            <div style={a.emptyBig}>
              <VaultIcon name="building" size={42} color="#d4af37" />
              <h3>Selecciona o crea una sede madre</h3>
              <p>Aquí podrás agregar sedes, asignar staff y liberar instruccionales y rutas.</p>
            </div>
          ) : (
            <>
              <div style={a.academyHead}>
                <div style={a.academyIdentity}>
                  <span style={a.avatarBig}>
                    {(academia.logoBase64 || academia.logobase64)
                      ? <img src={academia.logoBase64 || academia.logobase64} alt="" style={a.avatarImg} />
                      : <VaultIcon name="building" size={24} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={a.academyName}>{nombreAcademia(academia)}</h3>
                    <p style={a.academyMeta}>
                      {academia.ciudad || 'Sin ciudad'} · {sedesVisibles.length} sede(s)
                      {owner ? ` · ${owner.nombre || owner.email}` : ''}
                    </p>
                  </div>
                </div>
                <div style={a.headActions}>
                  <button type="button" onClick={() => abrirModal('ajustes')} style={a.ghostBtn}>
                    <VaultIcon name="settings" size={13} /> AJUSTES
                  </button>
                  <button type="button" onClick={() => abrirModal('nueva-sede')} style={a.goldBtn}>
                    <VaultIcon name="plus" size={13} /> AGREGAR SEDE
                  </button>
                </div>
              </div>

              <div style={a.tabs} role="tablist" aria-label="Secciones de la academia">
                {[
                  { id: 'resumen', label: 'Resumen', icon: 'dashboard' },
                  { id: 'sedes', label: 'Sedes', icon: 'dojo' },
                  { id: 'equipo', label: 'Equipo', icon: 'users' },
                  { id: 'contenido', label: 'Contenido', icon: 'layers' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    style={tab === item.id ? a.tabActive : a.tab}
                  >
                    <VaultIcon name={item.icon} size={13} /> {item.label}
                    {item.id === 'sedes' && <span style={a.tabCount}>{sedesVisibles.length}</span>}
                    {item.id === 'equipo' && <span style={a.tabCount}>{staffConSede.length}</span>}
                  </button>
                ))}
              </div>

              {tab === 'resumen' && (
                <div style={a.stack}>
                  <div style={a.statsGrid}>
                    <Stat label="Sedes" value={sedesVisibles.length} icon="dojo" />
                    <Stat label="Staff" value={staffConSede.length} icon="users" color="#8fa8ff" />
                    <Stat label="Alumnos" value={sedesVisibles.reduce((total, sede) => total + alumnosDeSede(sede.id), 0)} icon="user" color="#4CAF50" />
                    <Stat label="Cursos liberados" value={cursosLiberados.size} icon="bookOpen" color="#ffbb33" />
                    <Stat label="Rutas liberadas" value={rutasLiberadas.size} icon="route" color="#d4af37" />
                  </div>

                  {(salud.total > 0 || !limpiar(academia.teamId)) && (
                    <section style={a.panel}>
                      <div style={a.panelHead}>
                        <h4 style={a.panelTitle}><VaultIcon name="alert" size={15} color="#ffbb33" /> Salud de datos</h4>
                        <span style={a.panelMeta}>Repara sin borrar información</span>
                      </div>
                      <div style={a.healthGrid}>
                        {!limpiar(academia.teamId) && (
                          <div style={a.healthRow}>
                            <span>Esta academia no tiene <code>teamId</code>.</span>
                            <span style={a.healthOk}>Se usará su ID como team al crear nuevas sedes.</span>
                          </div>
                        )}
                        {sedesHuerfanas.length > 0 && (
                          <div style={a.healthRow}>
                            <span>{sedesHuerfanas.length} sede(s) sin academia.</span>
                            <button type="button" onClick={() => setTab('sedes')} style={a.linkBtn}>Revisar sedes</button>
                          </div>
                        )}
                        {staffSinSede.length > 0 && (
                          <div style={a.healthRow}>
                            <span>{staffSinSede.length} cuenta(s) de staff sin sede.</span>
                            <button type="button" onClick={() => setTab('equipo')} style={a.linkBtn}>Revisar equipo</button>
                          </div>
                        )}
                        {clasesSinSede.length > 0 && (
                          <div style={a.healthRow}>
                            <span>{clasesSinSede.length} clase(s) sin sede.</span>
                            <button type="button" onClick={normalizarClasesSinSede} style={a.linkBtn}>Reparar con creador</button>
                          </div>
                        )}
                        {alumnosSinSede.length > 0 && (
                          <div style={a.healthRow}>
                            <span>{alumnosSinSede.length} alumno(s) sin sede.</span>
                            <span style={a.healthOk}>Requieren revisión manual.</span>
                          </div>
                        )}
                        <div style={a.healthRow}>
                          <span>Normalizar team/academia de alumnos y staff existentes.</span>
                          <span style={a.healthActions}>
                            <button type="button" onClick={normalizarAlumnos} style={a.linkBtn}>Alumnos</button>
                            <button type="button" onClick={normalizarStaff} style={a.linkBtn}>Staff</button>
                          </span>
                        </div>
                      </div>
                    </section>
                  )}

                  <section style={a.panel}>
                    <div style={a.panelHead}>
                      <h4 style={a.panelTitle}><VaultIcon name="route" size={15} /> Herencia de contenido</h4>
                    </div>
                    <p style={a.helpText}>
                      Lo que liberes en la pestaña <strong>Contenido</strong> se verá automáticamente en
                      {' '}las {sedesVisibles.length} sede(s) de {nombreAcademia(academia)}.
                      Los alumnos y sus datos no se comparten.
                    </p>
                    <div style={a.chipRow}>
                      {sedesVisibles.map((sede) => (
                        <span key={sede.id} style={a.chip}>
                          <VaultIcon name="pin" size={10} /> {sede.nombreSede || sede.nombre}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {tab === 'sedes' && (
                <div style={a.stack}>
                  <div style={a.panelHead}>
                    <h4 style={a.panelTitle}>Sedes de {nombreAcademia(academia)}</h4>
                    <button type="button" onClick={() => abrirModal('nueva-sede')} style={a.goldBtn}>
                      <VaultIcon name="plus" size={13} /> AGREGAR SEDE
                    </button>
                  </div>

                  {sedesVisibles.length === 0 && (
                    <div style={a.empty}>Esta academia aún no tiene sedes.</div>
                  )}

                  {sedesVisibles.map((sede) => (
                    <div key={sede.id} style={a.sedeCard}>
                      <div style={a.sedeHead}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={a.sedeName}>{sede.nombreSede || sede.nombre}</strong>
                          <p style={a.sedeMeta}>
                            {sede.ciudad || 'Sin ciudad'} · {['principal', 'sede_principal'].includes(sede.tipo) ? 'Sede principal' : 'Sede afiliada'}
                            {(sede.academiaId !== academia.id || sede.teamId !== teamId) && (
                              <span style={a.warnInline}> · datos por normalizar</span>
                            )}
                          </p>
                        </div>
                        <span style={sede.codigoAcceso ? a.codeChip : a.codeChipEmpty}>
                          <VaultIcon name="lock" size={10} /> {sede.codigoAcceso || 'Sin código'}
                        </span>
                      </div>
                      <div style={a.sedeStats}>
                        <span><VaultIcon name="user" size={11} /> {alumnosDeSede(sede.id)} alumnos</span>
                        <span><VaultIcon name="users" size={11} /> {usuarios.filter((u) => u.sedeId === sede.id).length} staff</span>
                        <span><VaultIcon name="clipboard" size={11} /> {clasesDeSede(sede.id)} clases</span>
                      </div>
                      <div style={a.sedeActions}>
                        <button type="button" onClick={() => copiarCodigo(sede)} style={a.ghostSmall}>COPIAR CÓDIGO</button>
                        <button type="button" onClick={() => regenerarCodigo(sede)} style={a.ghostSmall}>REGENERAR</button>
                        {(sede.academiaId !== academia.id || sede.teamId !== teamId) && (
                          <button type="button" onClick={() => normalizarSede(sede)} style={a.normalizeBtn}>NORMALIZAR</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {sedesHuerfanas.length > 0 && (
                    <section style={a.panel}>
                      <div style={a.panelHead}>
                        <h4 style={a.panelTitle}><VaultIcon name="alert" size={15} color="#ffbb33" /> Sedes sin academia</h4>
                        <span style={a.panelMeta}>{sedesHuerfanas.length}</span>
                      </div>
                      {sedesHuerfanas.map((sede) => (
                        <div key={sede.id} style={a.healthRow}>
                          <span>{sede.nombreSede || sede.nombre} <small style={a.muted}>({sede.ciudad || 'sin ciudad'})</small></span>
                          <button type="button" onClick={() => asignarSedeAAcademia(sede)} style={a.linkBtn}>
                            Asignar a {nombreAcademia(academia)}
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                </div>
              )}

              {tab === 'equipo' && (
                <div style={a.stack}>
                  <div style={a.panelHead}>
                    <h4 style={a.panelTitle}>Equipo de {nombreAcademia(academia)}</h4>
                    <button type="button" onClick={() => abrirModal('staff')} style={a.goldBtn}>
                      <VaultIcon name="plus" size={13} /> ASIGNAR STAFF
                    </button>
                  </div>

                  {staffDeAcademia.length === 0 && (
                    <div style={a.empty}>Aún no hay staff vinculado.</div>
                  )}

                  {staffDeAcademia.map((user) => {
                    const sede = sedes.find((s) => s.id === user.sedeId);
                    return (
                      <div key={user.id} style={a.staffRow}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={a.staffName}>{user.nombre || user.email}</strong>
                          <p style={a.staffMeta}>
                            {user.rol} · {sede ? (sede.nombreSede || sede.nombre) : 'Sin sede'}
                          </p>
                        </div>
                        <button type="button" onClick={() => quitarStaff(user)} style={a.dangerLink}>QUITAR</button>
                      </div>
                    );
                  })}

                  {staffSinSede.length > 0 && (
                    <section style={a.panel}>
                      <div style={a.panelHead}>
                        <h4 style={a.panelTitle}><VaultIcon name="alert" size={15} color="#ffbb33" /> Staff sin sede</h4>
                        <button type="button" onClick={normalizarStaff} style={a.linkBtn}>Normalizar desde su sede</button>
                      </div>
                      {staffSinSede.map((user) => (
                        <div key={user.id} style={a.healthRow}>
                          <span>{user.nombre || user.email} <small style={a.muted}>({user.rol})</small></span>
                          <button type="button" onClick={() => { setFormStaff({ uid: user.id, rol: user.rol, sedeId: sedesVisibles[0]?.id || '' }); setModal('staff'); }} style={a.linkBtn}>
                            Asignar sede
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                </div>
              )}

              {tab === 'contenido' && (
                <div style={a.stack}>
                  <div style={a.scopeBox}>
                    <span style={a.fieldLabel}>APLICAR CONTENIDO A</span>
                    <select
                      value={contenidoDestino}
                      onChange={(event) => setContenidoDestino(event.target.value)}
                      style={a.input}
                    >
                      <option value="">Toda la academia ({sedesVisibles.length} sedes)</option>
                      {sedesVisibles.map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          Solo {sede.nombreSede || sede.nombre}
                        </option>
                      ))}
                    </select>
                    <p style={a.helpText}>
                      {sedeContenido
                        ? `Lo que marques aquí se verá solo en ${sedeContenido.nombreSede || sedeContenido.nombre}.`
                        : `Lo que marques aquí se hereda a las ${sedesVisibles.length} sedes de ${nombreAcademia(academia)}.`}
                    </p>
                  </div>

                  <div style={a.contentGrid}>
                  <section style={a.panel}>
                    <div style={a.panelHead}>
                      <h4 style={a.panelTitle}><VaultIcon name="bookOpen" size={15} /> Instruccionales</h4>
                      <span style={a.panelMeta}>{cursosScope.size} liberados</span>
                    </div>
                    <div style={a.searchBoxSmall}>
                      <VaultIcon name="search" size={13} color="#777" />
                      <input
                        value={busquedaCurso}
                        onChange={(event) => setBusquedaCurso(event.target.value)}
                        placeholder="Buscar curso..."
                        aria-label="Buscar instruccional"
                        style={a.searchInput}
                      />
                    </div>
                    <div style={a.checkList}>
                      {busquedaCursos.map((curso) => (
                        <label key={curso.id} style={a.checkRow}>
                          <input
                            type="checkbox"
                            checked={cursosScope.has(curso.id)}
                            onChange={() => toggleCurso(curso.id)}
                          />
                          <span style={a.checkText}>
                            <strong>{curso.titulo}</strong>
                            <small>{curso.autor} · {curso.total} videos</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section style={a.panel}>
                    <div style={a.panelHead}>
                      <h4 style={a.panelTitle}><VaultIcon name="route" size={15} /> Rutas de aprendizaje</h4>
                      <span style={a.panelMeta}>{rutasScope.size} liberadas</span>
                    </div>
                    <p style={a.helpText}>
                      {sedeContenido
                        ? `Solo el staff y alumnos de ${sedeContenido.nombreSede || sedeContenido.nombre} verán estas rutas.`
                        : `Se heredan a las ${sedesVisibles.length} sedes de la academia.`}
                    </p>
                    <div style={a.checkList}>
                      {rutas.length === 0 && <div style={a.empty}>Aún no hay rutas creadas.</div>}
                      {rutas.map((ruta) => (
                        <label key={ruta.id} style={a.checkRow}>
                          <input
                            type="checkbox"
                            checked={rutasScope.has(ruta.id)}
                            onChange={() => toggleRuta(ruta)}
                          />
                          <span style={a.checkText}>
                            <strong>{ruta.nombre || 'Ruta sin nombre'}</strong>
                            <small>{ruta.estado === 'publicada' ? 'Publicada' : 'Borrador'} · {(ruta.secciones || []).length} secciones</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {modal && (
        <div style={a.overlay} onClick={() => { if (!guardando) setModal(null); }}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            style={a.modal}
            onClick={(event) => event.stopPropagation()}
          >
            {modal === 'nueva-academia' && (
              <>
                <div style={a.modalHead}>
                  <h3 style={a.modalTitle}>Nueva sede madre</h3>
                  <button type="button" onClick={() => setModal(null)} style={a.iconBtn} aria-label="Cerrar"><VaultIcon name="close" size={16} /></button>
                </div>
                <div style={a.formGrid}>
                  <Campo label="Nombre de la sede madre" full>
                    <input style={a.input} value={formAcademia.nombre} onChange={(e) => setFormAcademia((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. HOLKAN" />
                  </Campo>
                  <Campo label="Ciudad">
                    <input style={a.input} value={formAcademia.ciudad} onChange={(e) => setFormAcademia((p) => ({ ...p, ciudad: e.target.value }))} placeholder="Ej. Xalapa" />
                  </Campo>
                  <Campo label="Nombre de la sede principal">
                    <input style={a.input} value={formAcademia.nombreSede} onChange={(e) => setFormAcademia((p) => ({ ...p, nombreSede: e.target.value }))} placeholder="Ej. HOLKAN Xalapa" />
                  </Campo>
                  <Campo label="Profesor / dueño">
                    <select style={a.input} value={formAcademia.ownerUid} onChange={(e) => setFormAcademia((p) => ({ ...p, ownerUid: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {usuarios.filter((u) => ['profesor', 'admin'].includes(u.rol)).map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Logo" hint="Opcional. Se comprime antes de guardar.">
                    <label style={a.fileBtn}>
                      <VaultIcon name="image" size={13} /> {formAcademia.logoBase64 ? 'Cambiar logo' : 'Subir logo'}
                      <input type="file" accept="image/*" hidden onChange={handleLogoAcademia} />
                    </label>
                  </Campo>
                </div>
                <p style={a.helpText}>
                  Se creará la sede madre, un team, su sede principal y un código de acceso.
                </p>
                <div style={a.modalActions}>
                  <button type="button" onClick={() => setModal(null)} style={a.ghostBtn} disabled={guardando}>CANCELAR</button>
                  <button type="button" onClick={crearAcademia} style={a.goldBtn} disabled={guardando}>
                    {guardando ? 'CREANDO...' : 'CREAR SEDE MADRE'}
                  </button>
                </div>
              </>
            )}

            {modal === 'nueva-sede' && (
              <>
                <div style={a.modalHead}>
                  <h3 style={a.modalTitle}>Agregar sede a {nombreAcademia(academia)}</h3>
                  <button type="button" onClick={() => setModal(null)} style={a.iconBtn} aria-label="Cerrar"><VaultIcon name="close" size={16} /></button>
                </div>
                <div style={a.formGrid}>
                  <Campo label="Nombre de la sede" full>
                    <input style={a.input} value={formSede.nombre} onChange={(e) => setFormSede((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. MAKTUB" />
                  </Campo>
                  <Campo label="Ciudad">
                    <input style={a.input} value={formSede.ciudad} onChange={(e) => setFormSede((p) => ({ ...p, ciudad: e.target.value }))} />
                  </Campo>
                  <Campo label="Responsable (opcional)">
                    <select style={a.input} value={formSede.responsableUid} onChange={(e) => setFormSede((p) => ({ ...p, responsableUid: e.target.value }))}>
                      <option value="">Sin responsable por ahora</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
                    </select>
                  </Campo>
                </div>
                <p style={a.helpText}>Se generará un código de acceso y heredará el contenido de la academia.</p>
                <div style={a.modalActions}>
                  <button type="button" onClick={() => setModal(null)} style={a.ghostBtn} disabled={guardando}>CANCELAR</button>
                  <button type="button" onClick={crearSede} style={a.goldBtn} disabled={guardando}>
                    {guardando ? 'CREANDO...' : 'AGREGAR SEDE'}
                  </button>
                </div>
              </>
            )}

            {modal === 'staff' && (
              <>
                <div style={a.modalHead}>
                  <h3 style={a.modalTitle}>Asignar staff</h3>
                  <button type="button" onClick={() => setModal(null)} style={a.iconBtn} aria-label="Cerrar"><VaultIcon name="close" size={16} /></button>
                </div>
                <div style={a.formGrid}>
                  <Campo label="Usuario" full>
                    <select style={a.input} value={formStaff.uid} onChange={(e) => setFormStaff((p) => ({ ...p, uid: e.target.value }))}>
                      <option value="">Seleccionar usuario...</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email} ({u.rol})</option>)}
                    </select>
                  </Campo>
                  <Campo label="Rol">
                    <select style={a.input} value={formStaff.rol} onChange={(e) => setFormStaff((p) => ({ ...p, rol: e.target.value }))}>
                      <option value="instructor">Instructor</option>
                      <option value="profesor">Profesor</option>
                      <option value="alumno">Alumno</option>
                    </select>
                  </Campo>
                  <Campo label="Sede">
                    <select style={a.input} value={formStaff.sedeId} onChange={(e) => setFormStaff((p) => ({ ...p, sedeId: e.target.value }))}>
                      <option value="">Sin sede</option>
                      {sedesVisibles.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombreSede || sede.nombre}</option>)}
                    </select>
                  </Campo>
                </div>
                <div style={a.modalActions}>
                  <button type="button" onClick={() => setModal(null)} style={a.ghostBtn} disabled={guardando}>CANCELAR</button>
                  <button type="button" onClick={asignarStaff} style={a.goldBtn} disabled={guardando}>
                    {guardando ? 'ASIGNANDO...' : 'ASIGNAR'}
                  </button>
                </div>
              </>
            )}

            {modal === 'ajustes' && (
              <>
                <div style={a.modalHead}>
                  <h3 style={a.modalTitle}>Ajustes de {nombreAcademia(academia)}</h3>
                  <button type="button" onClick={() => setModal(null)} style={a.iconBtn} aria-label="Cerrar"><VaultIcon name="close" size={16} /></button>
                </div>
                <div style={a.formGrid}>
                  <Campo label="Nombre" full>
                    <input style={a.input} value={formAjustes.nombre} onChange={(e) => setFormAjustes((p) => ({ ...p, nombre: e.target.value }))} />
                  </Campo>
                  <Campo label="Ciudad">
                    <input style={a.input} value={formAjustes.ciudad} onChange={(e) => setFormAjustes((p) => ({ ...p, ciudad: e.target.value }))} />
                  </Campo>
                  <Campo label="Dueño / profesor">
                    <select style={a.input} value={formAjustes.ownerUid} onChange={(e) => setFormAjustes((p) => ({ ...p, ownerUid: e.target.value }))}>
                      <option value="">Sin dueño asignado</option>
                      {usuarios.filter((u) => ['profesor', 'admin'].includes(u.rol)).map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Logo" full>
                    <label style={a.fileBtn}>
                      <VaultIcon name="image" size={13} /> {formAjustes.logoBase64 ? 'Cambiar logo' : 'Subir logo'}
                      <input type="file" accept="image/*" hidden onChange={handleLogoAjustes} />
                    </label>
                  </Campo>
                </div>
                <div style={a.modalActions}>
                  <button type="button" onClick={() => setModal(null)} style={a.ghostBtn} disabled={guardando}>CANCELAR</button>
                  <button type="button" onClick={guardarAjustes} style={a.goldBtn} disabled={guardando}>
                    {guardando ? 'GUARDANDO...' : 'GUARDAR'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const css = `
  .is-warning { color: #ffbb33 !important; border-color: rgba(255,187,51,0.4) !important; background: rgba(255,187,51,0.08) !important; }
  .is-ok { color: #4CAF50 !important; border-color: rgba(76,175,80,0.4) !important; background: rgba(76,175,80,0.08) !important; }
`;

const a = {
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#d4af37', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.8px' },
  subtitle: { margin: '4px 0 0', color: '#777', fontSize: '0.7rem', lineHeight: 1.4, maxWidth: '640px' },
  toolbar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: '8px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0 10px', height: '38px' },
  searchBoxSmall: { display: 'flex', alignItems: 'center', gap: '7px', background: '#050505', border: '1px solid #232323', borderRadius: '7px', padding: '0 9px', height: '34px', marginBottom: '8px' },
  searchInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.75rem' },
  healthPill: { border: '1px solid #2a2a2a', borderRadius: '999px', padding: '7px 11px', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px' },
  layout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '14px', alignItems: 'start' },
  list: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 },
  listCard: { display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '9px', padding: '9px', cursor: 'pointer', color: '#fff' },
  listCardActive: { display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', background: 'rgba(212,175,55,0.08)', border: '1px solid #d4af37', borderRadius: '9px', padding: '9px', cursor: 'pointer', color: '#fff' },
  avatar: { width: '34px', height: '34px', borderRadius: '8px', background: '#111', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', color: '#d4af37' },
  avatarBig: { width: '48px', height: '48px', borderRadius: '10px', background: '#111', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', color: '#d4af37' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  listInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  listName: { fontSize: '0.82rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listMeta: { fontSize: '0.6rem', color: '#777' },
  alertDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#ffbb33', flexShrink: 0, boxShadow: '0 0 8px rgba(255,187,51,0.6)' },
  main: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  academyHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '12px' },
  academyIdentity: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  academyName: { margin: 0, color: '#fff', fontSize: '1rem', lineHeight: 1.2 },
  academyMeta: { margin: '2px 0 0', color: '#777', fontSize: '0.64rem' },
  headActions: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: '4px', overflowX: 'auto', borderBottom: '1px solid #1e1e1e', paddingBottom: '2px', scrollbarWidth: 'none' },
  tab: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#777', padding: '8px 10px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(212,175,55,0.08)', border: 'none', borderBottom: '2px solid #d4af37', color: '#d4af37', padding: '8px 10px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '6px 6px 0 0' },
  tabCount: { background: '#1a1a1a', color: '#999', borderRadius: '999px', padding: '1px 5px', fontSize: '0.54rem' },
  stack: { display: 'flex', flexDirection: 'column', gap: '10px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  stat: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '9px', padding: '9px' },
  statIcon: { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { display: 'block', fontSize: '1.15rem', lineHeight: 1.1 },
  statLabel: { display: 'block', color: '#777', fontSize: '0.56rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' },
  panel: { background: '#090909', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '12px' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' },
  panelTitle: { margin: 0, color: '#e5e5e5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' },
  panelMeta: { color: '#666', fontSize: '0.58rem' },
  helpText: { color: '#777', fontSize: '0.66rem', lineHeight: 1.5, margin: '4px 0 8px' },
  healthGrid: { display: 'flex', flexDirection: 'column', gap: '5px' },
  healthRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '6px', padding: '7px 8px', color: '#bbb', fontSize: '0.66rem' },
  healthOk: { color: '#666', fontSize: '0.6rem' },
  healthActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chipRow: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', borderRadius: '999px', padding: '3px 8px', fontSize: '0.58rem' },
  sedeCard: { background: '#0a0a0a', border: '1px solid #202020', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' },
  sedeHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' },
  sedeName: { color: '#fff', fontSize: '0.8rem' },
  sedeMeta: { margin: '2px 0 0', color: '#777', fontSize: '0.6rem' },
  codeChip: { display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '5px', padding: '3px 6px', fontSize: '0.6rem', letterSpacing: '0.5px' },
  codeChipEmpty: { display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.35)', borderRadius: '5px', padding: '3px 6px', fontSize: '0.6rem' },
  sedeStats: { display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#888', fontSize: '0.6rem' },
  sedeActions: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  staffRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '8px 10px' },
  staffName: { color: '#fff', fontSize: '0.78rem' },
  staffMeta: { margin: '2px 0 0', color: '#777', fontSize: '0.6rem', textTransform: 'capitalize' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '10px', alignItems: 'start' },
  scopeBox: { background: '#090909', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '9px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' },
  checkList: { display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#0d0d0d', border: '1px solid #1b1b1b', borderRadius: '6px', padding: '7px 8px', cursor: 'pointer' },
  checkText: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
  empty: { color: '#666', fontSize: '0.7rem', fontStyle: 'italic', padding: '14px', textAlign: 'center', border: '1px dashed #242424', borderRadius: '8px' },
  emptyBig: { textAlign: 'center', padding: '50px 20px', color: '#777', border: '1px dashed #242424', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  goldBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '9px 12px', fontSize: '0.64rem', fontWeight: 800, cursor: 'pointer' },
  ghostBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'transparent', color: '#ccc', border: '1px solid #333', borderRadius: '7px', padding: '8px 11px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' },
  ghostSmall: { background: '#111', border: '1px solid #2a2a2a', color: '#bbb', borderRadius: '5px', padding: '6px 8px', fontSize: '0.58rem', cursor: 'pointer', fontWeight: 700 },
  linkBtn: { background: 'none', border: 'none', color: '#d4af37', fontSize: '0.62rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  dangerLink: { background: 'none', border: 'none', color: '#ff6b6b', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 700 },
  muted: { color: '#666' },
  warnInline: { color: '#ffbb33' },
  normalizeBtn: { background: 'rgba(255,187,51,0.1)', border: '1px solid rgba(255,187,51,0.4)', color: '#ffbb33', borderRadius: '5px', padding: '6px 8px', fontSize: '0.58rem', cursor: 'pointer', fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', boxSizing: 'border-box' },
  modal: { background: '#0a0a0a', border: '1px solid #d4af37', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', padding: '16px', boxSizing: 'border-box' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  modalTitle: { margin: 0, color: '#d4af37', fontSize: '0.95rem' },
  iconBtn: { background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '9px' },
  field: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  fieldLabel: { color: '#888', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '9px', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' },
  hint: { color: '#555', fontSize: '0.56rem' },
  fileBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#111', border: '1px dashed #d4af37', color: '#d4af37', borderRadius: '6px', padding: '9px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }
};

export default AcademiasAdminPage;
