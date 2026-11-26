import React, { useState } from 'react';

// 1. Conexión principal
import { auth, db } from './firebase';

// 2. Funciones de Autenticación (Añadido GoogleAuthProvider y signInWithPopup)
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

// 3. Funciones de Firestore
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';

// 4. Tus otros archivos (Componentes y Páginas)
const GestionAlumnosPage = React.lazy(() => import('./components/GestionAlumnosPage'));
const PlaneadorClasesPage = React.lazy(() => import('./components/PlaneadorClasesPage'));
const MapaPage = React.lazy(() => import('./components/MapaPage'));
const MiCuenta = React.lazy(() => import('./components/MiCuenta'));
const NotasHubPage = React.lazy(() => import('./components/NotasHubPage'));
const EstudioPage = React.lazy(() => import('./components/EstudioPage'));
const AdminPage = React.lazy(() => import('./components/AdminPage'));
const BusquedaPage = React.lazy(() => import('./components/BusquedaPage'));
const RutasAdminPage = React.lazy(() => import('./components/RutasAdminPage'));
const RutasAprendizajePage = React.lazy(() => import('./components/RutasAprendizajePage'));
const TimerPage = React.lazy(() => import('./components/TimerPage'));
const PanelMaestro = React.lazy(() => import('./components/PanelMaestro'));

import LoginPage from './components/LoginPage';import HubPage from './components/HubPage';
import InstalacionModal from './components/InstalacionModal';
import { getAdjacentVideo } from './utils/videoHelpers';
import { obtenerTecnica } from './data/vaultIndex';
import { tieneAccesoVideo, tieneAccesoVideoDinamico, pedirAcceso, setAccesoDinamico } from './utils/accesoVault';
import { adyacenteEnRuta, construirAccesoRutas, mapaVideos, rutasParaUsuario } from './utils/rutasAprendizaje';
import { useI18n } from './i18n/context';
import { mensajeContenidoBloqueado, mensajeVideoBloqueado } from './i18n/translate';

// --- NUEVOS COMPONENTES INTEGRADOS ---
import OnboardingModal from './components/OnboardingModal';

import Swal from 'sweetalert2';

const ADMIN_EMAIL = "zamna.ed@gmail.com";

// Traduce los errores de Firebase a mensajes claros para el usuario
const describirErrorAuth = (err) => {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return "Cerraste la ventana de Google antes de completar el acceso.";
    case 'auth/popup-blocked':
      return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.";
    case 'auth/account-exists-with-different-credential':
      return "Ya existe una cuenta con este correo registrada con contraseña. Inicia sesión con tu correo y contraseña.";
    case 'auth/network-request-failed':
      return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    case 'auth/too-many-requests':
      return "Demasiados intentos. Espera un momento e intenta de nuevo.";
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return "Correo o contraseña incorrectos.";
    case 'permission-denied':
      return "Firestore rechazó la operación por permisos. Avisa al profesor/administrador.";
    default:
      return err?.message || "Ocurrió un error inesperado.";
  }
};

// Actualiza tu función notify
const notify = (mensaje, tipo = 'success') => {
  Swal.fire({
    text: mensaje,
    icon: tipo,
    background: '#0a0a0a',
    color: '#fff',
    confirmButtonColor: '#d4af37',
    iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
    border: '1px solid #d4af37',
    customClass: {
      popup: 'gold-border-alert',
      container: 'my-swal-container'
    },
    didOpen: (toast) => {
      toast.parentElement.style.zIndex = '9999';
    }
  });
};

// Lee JSON de localStorage sin dejar la app en pantalla negra si está corrupto.
const leerGuardadoLocal = (clave, porDefecto) => {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch {
    try { localStorage.removeItem(clave); } catch { /* noop */ }
    return porDefecto;
  }
};

// --- 1. CONFIGURACIÓN DE ESTILOS ---
const styles = {
  containerCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'var(--app-vh)' },
  container: { padding: '40px', textAlign: 'center' },
  goldTitle: { color: '#d4af37', letterSpacing: '3px', marginBottom: '30px', textTransform: 'uppercase' },
  card: { backgroundColor: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', width: '300px', textAlign: 'center' },
  input: { width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', outline: 'none' },
  btnGold: { width: '100%', padding: '12px', backgroundColor: '#d4af37', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' },
  btnOutline: { width: '100%', padding: '10px', backgroundColor: 'transparent', border: '1px solid #d4af37', color: '#d4af37', cursor: 'pointer', borderRadius: '4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', maxWidth: '600px', margin: '0 auto' },
  hubBtn: { padding: '40px 20px', backgroundColor: '#111', border: '1px solid #333', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', borderRadius: '8px', transition: '0.3s' },
};

// Fallback mientras se descarga una página bajo demanda.
const CargandoPagina = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: '#0a0a0a',
    color: '#d4af37'
  }}>
    <style>{`
      .spinner-mini {
        width: 38px; height: 38px;
        border: 3px solid #1a1a1a;
        border-top: 3px solid #d4af37;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
    <div className="spinner-mini" />
    <span style={{ fontSize: '0.7rem', letterSpacing: '3px' }}>CARGANDO...</span>
  </div>
);

// --- 4. COMPONENTE PRINCIPAL (EXPORT DEFAULT) ---//
export default function App() {
  // --- 1. ESTADOS ---
  const { t } = useI18n();
  const [academiaData, setAcademiaData] = useState(null);
  const [showInstalar, setShowInstalar] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [usuario, setUsuario] = React.useState(null);
  const [cargando, setCargando] = React.useState(true);
  const [page, setPage] = useState('login');
  const [sedeGestionSel, setSedeGestionSel] = useState(null);
  const [userRole, setUserRole] = useState('usuario');
  const [categoriaSel, setCategoriaSel] = useState('AUTORES');
  const [autorSel, setAutorSel] = useState(null);
  const [instrSel, setInstrSel] = useState(null);
  const [volSel, setVolSel] = useState(null);
  const [vistos, setVistos] = useState(() => leerGuardadoLocal('lafortuna_vistos', []));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [error, setError] = useState('');
  const [videoActual, setVideoActual] = useState(() => leerGuardadoLocal('lafortuna_last_video', null));
  const [academiaIdInput, setAcademiaIdInput] = useState('');
  const [rutasData, setRutasData] = useState({ rutas: [], videos: [], asignaciones: [] });

  // --- 2. EFECTO DE AUTENTICACIÓN (VERSIÓN BLINDADA) ---
  React.useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCargando(true);

      if (user) {
        if (unsubSnapshot) unsubSnapshot();

        unsubSnapshot = onSnapshot(doc(db, "usuarios", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();

            setUsuario({ uid: user.uid, email: user.email, ...data });
            setUserRole(data.rol || 'usuario');

            if (data.teamId) {
              const q = query(collection(db, "sedes"), where("teamId", "==", data.teamId));
              getDocs(q).then((querySnapshot) => {
                if (!querySnapshot.empty) {
                  setAcademiaData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
                } else {
                  setAcademiaData(null);
                }
              }).catch(err => console.error("Error cargando sede:", err));
            } else {
              setAcademiaData(null);
            }

            if (data.vistos) {
              setVistos(data.vistos);
              localStorage.setItem('lafortuna_vistos', JSON.stringify(data.vistos));
            }
            if (data.notas) {
              localStorage.setItem('lafortuna_notas', JSON.stringify(data.notas));
            }

            const necesitaOnboarding = data.necesitaOnboarding === true
              && !data.teamId
              && ['profesor', 'instructor'].includes(data.rol);
            setShowOnboarding(necesitaOnboarding);

            if (data.validado) {
              setPage(prev => (['login', 'espera'].includes(prev) ? 'hub' : prev));
            } else {
              setPage('espera');
            }
          } else {
            console.warn("Usuario sin documento en Firestore");
            setPage('espera');
          }
          setCargando(false);
        }, (err) => {
          console.error("Error crítico en Snapshot de usuario:", err);
          setCargando(false);
        });
      } else {
        if (unsubSnapshot) unsubSnapshot();
        setUsuario(null);
        setPage('login');
        setCargando(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // --- 2.b RUTAS, VIDEOS DINÁMICOS Y ASIGNACIONES ---
  // Una sola fuente de lectura para que mapa, búsqueda, Hub y reproductor
  // apliquen el mismo acceso que el constructor del administrador.
  React.useEffect(() => {
    if (!usuario?.uid || !usuario?.validado) {
      setRutasData({ rutas: [], videos: [], asignaciones: [] });
      return undefined;
    }

    const manejar = (campo) => (snap) => {
      setRutasData((prev) => ({
        ...prev,
        [campo]: snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      }));
    };
    const silencioso = (error) => {
      if (error?.code !== 'permission-denied') {
        console.warn('No se pudo cargar una colección de rutas:', error?.code || error);
      }
    };

    const unsubs = [
      onSnapshot(collection(db, 'rutas'), manejar('rutas'), silencioso),
      onSnapshot(collection(db, 'videos'), manejar('videos'), silencioso),
      onSnapshot(collection(db, 'asignacionesRuta'), manejar('asignaciones'), silencioso)
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [usuario?.uid, usuario?.validado]);

  // --- 3. FUNCIONES DE LÓGICA ---

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setVistos([]);
      setVideoActual(null);
      setUsuario(null);
      setSedeGestionSel(null);
      localStorage.removeItem('lafortuna_vistos');
      localStorage.removeItem('lafortuna_last_video');
      localStorage.removeItem('lafortuna_notas');
      setPage('login');
      console.log("Sesión cerrada y Vault bloqueado");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleRegister = async () => {
    try {
      setError('');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const isAdmin = email === "zamna.ed@gmail.com";
      let rolAsignado = 'alumno';
      if (isAdmin) {
        rolAsignado = 'admin';
      } else if (academiaIdInput && academiaIdInput.trim() !== "") {
        rolAsignado = 'instructor';
      }

      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        email: user.email,
        nombre: nombreCompleto,
        rol: rolAsignado,
        validado: isAdmin,
        fechaRegistro: new Date().toISOString(),
        // El código de academia solo sirve para solicitar rol de instructor.
        // La vinculación real se hace después con un código verificado.
        necesitaOnboarding: !isAdmin && rolAsignado === 'instructor'
      });

      if (isAdmin) {
        notify("¡Bienvenido, Ngasi! Acceso total concedido.");
      } else if (rolAsignado === 'instructor') {
        notify("Solicitud de Instructor enviada. El profesor debe validar tu cuenta.");
      } else {
        notify("Solicitud enviada a La Fortuna. Espera validación.");
      }

      setPage('login');
      setAcademiaIdInput('');
    } catch (err) {
      setError("Error al registrar: " + err.message);
    }
  };

  const handleLogin = async () => {
    try {
      setError('');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));

      if (!userDoc.exists()) {
        setError("No encontramos tu solicitud de acceso. Regístrate primero o entra con Google.");
        await auth.signOut();
        return;
      }

      const data = userDoc.data();
      if (!data.validado) {
        // onAuthStateChanged ya muestra la pantalla "SOLICITUD ENVIADA"
        notify("Tu cuenta aún no ha sido validada por el profesor.");
        return;
      }

      setUserRole(data.rol || 'alumno');
      setVistos(data.vistos || []);
    } catch (err) {
      console.error("Error en login con email:", err);
      setError("No se pudo iniciar sesión: " + describirErrorAuth(err));
    }
  };

  // --- INICIO DE SESIÓN CON GOOGLE (REGISTRO + FUSIÓN DE CUENTAS) ---
  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isAdmin = user.email === ADMIN_EMAIL;

      const userRef = doc(db, "usuarios", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        notify("¡Bienvenido de vuelta!");
        return;
      }

      // Buscamos una cuenta previa con el mismo correo para recuperar su progreso.
      // Si las reglas no permiten la consulta, NO bloqueamos el registro:
      // el usuario nuevo debe poder crear su solicitud de todos modos.
      let datosPrevios = null;
      try {
        const q = query(collection(db, "usuarios"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          datosPrevios = querySnapshot.docs[0].data();
        }
      } catch (lookupErr) {
        console.warn("No se pudo buscar una cuenta previa por correo:", lookupErr);
      }

      const rolPrevio = datosPrevios?.rol;
      const rolFinal = isAdmin
        ? 'admin'
        : (['profesor', 'instructor'].includes(rolPrevio) ? rolPrevio : 'alumno');
      const esStaffPrevio = ['profesor', 'instructor'].includes(rolFinal);

      // Copiamos solo progreso y datos personales. NUNCA rol, validado,
      // cursos liberados, equipo ni sede: eso lo autoriza un administrador.
      const CAMPOS_HEREDABLES = [
        'nombre', 'fotoBase64', 'cinturon', 'grados', 'bio', 'edad', 'ciudad',
        'pesoCategoria', 'especialidad', 'tiempoEntrenando', 'genero',
        'telefono', 'emergencia', 'tipoSangre', 'instagram', 'tallaGi',
        'notas', 'vistos'
      ];
      const heredado = {};
      if (datosPrevios) {
        CAMPOS_HEREDABLES.forEach((campo) => {
          if (datosPrevios[campo] !== undefined) heredado[campo] = datosPrevios[campo];
        });
      }

      // La cuenta nace PENDIENTE (o queda pendiente si venía de otro método).
      // El maestro la autoriza desde AdminPage → AUTORIZAR.
      await setDoc(userRef, {
        ...heredado,
        uid: user.uid,
        email: user.email,
        nombre: heredado.nombre || user.displayName || user.email.split('@')[0],
        rol: rolFinal,
        validado: isAdmin,
        fechaRegistro: datosPrevios?.fechaRegistro || new Date().toISOString(),
        fechaUltimoAcceso: new Date().toISOString(),
        necesitaOnboarding: !isAdmin && esStaffPrevio
      });

      if (isAdmin) {
        notify("¡Bienvenido, Ngasi! Acceso total concedido vía Google.");
      } else if (datosPrevios) {
        notify(esStaffPrevio
          ? "Recuperamos tu progreso. Un administrador debe asignarte equipo y sede."
          : "Recuperamos tu progreso anterior. Tu cuenta queda pendiente de validación del profesor.");
      } else {
        notify("Registro con Google exitoso. Espera a que el profesor valide tu perfil.");
      }
    } catch (err) {
      console.error("Error en Google Login:", err);
      const mensaje = "No se pudo iniciar sesión con Google: " + describirErrorAuth(err);
      setError(mensaje);
      notify(mensaje, "error");

      // Si Google autenticó pero Firestore falló, cerramos la sesión para no
      // dejar al usuario a medias (autenticado pero sin perfil).
      if (auth.currentUser && err?.code === 'permission-denied') {
        try { await auth.signOut(); } catch { /* noop */ }
      }
    }
  };

  // --- CONTROL CENTRAL DE ACCESO A VIDEOS ---
  // Cualquier ruta (mapa, búsqueda, notas o "siguiente" dentro del estudio)
  // pasa por aquí. Así el candado no se puede saltar.
  const accesoRutas = React.useMemo(
    () => construirAccesoRutas(usuario, rutasData),
    [usuario, rutasData]
  );
  const videosPorId = React.useMemo(() => mapaVideos(rutasData.videos), [rutasData.videos]);
  const rutasLiberadas = React.useMemo(
    () => rutasParaUsuario(usuario, rutasData.rutas, rutasData.asignaciones),
    [usuario, rutasData]
  );

  React.useEffect(() => {
    setAccesoDinamico(accesoRutas);
  }, [accesoRutas]);

  const getAdjacent = (video, direction) => {
    if (video?.rutaId) {
      return adyacenteEnRuta(video, direction, rutasData.rutas, videosPorId);
    }
    return getAdjacentVideo(video, direction);
  };

  const handleSelectVideo = (v) => {
    if (!v) return;
    const origen = v.origen || (page === 'estudio' ? videoActual?.origen : page) || 'mapa';
    const tecnica = obtenerTecnica(v.id);

    if (tecnica) {
      if (!tieneAccesoVideo(usuario, tecnica, accesoRutas)) {
        if (window.confirm(mensajeContenidoBloqueado(tecnica))) {
          pedirAcceso(usuario, tecnica.cursoTitulo);
        }
        return;
      }
      const seleccionado = { ...v, origen };
      setVideoActual(seleccionado);
      localStorage.setItem('lafortuna_last_video', JSON.stringify(seleccionado));
      setPage('estudio');
      return;
    }

    const dinamico = v.fuente ? v : videosPorId.get(v.id) || null;
    if (!tieneAccesoVideoDinamico(usuario, dinamico || v, accesoRutas)) {
      window.alert(mensajeVideoBloqueado(v.titulo || dinamico?.nombre));
      return;
    }

    const enriquecido = {
      ...(dinamico || {}),
      ...v,
      titulo: v.titulo || dinamico?.nombre || 'Video',
      fuente: dinamico?.fuente || v.fuente || 'drive',
      driveId: dinamico?.driveId || v.driveId || '',
      youtubeId: dinamico?.youtubeId || v.youtubeId || '',
      origen
    };
    setVideoActual(enriquecido);
    localStorage.setItem('lafortuna_last_video', JSON.stringify(enriquecido));
    setPage('estudio');
  };

  const handleContinue = () => {
    if (videoActual) handleSelectVideo(videoActual);
  };

  const toggleVisto = async (id) => {    if (!id) return;

    const nuevaLista = vistos.includes(id)
      ? vistos.filter(v => v !== id)
      : [...vistos, id];

    setVistos(nuevaLista);
    localStorage.setItem('lafortuna_vistos', JSON.stringify(nuevaLista));

    if (auth.currentUser) {
      try {
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        await setDoc(userRef, { vistos: nuevaLista }, { merge: true });
      } catch (error) {
        console.error("Error sincronizando vistos:", error);
      }
    }
  };

  const handleEliminarNota = async (notaId) => {
    if (!usuario) return;
    if (!window.confirm(t('¿Seguro que quieres eliminar esta nota técnica?'))) return;

    try {
      const userRef = doc(db, "usuarios", usuario.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const nuevasNotas = { ...data.notas };
        delete nuevasNotas[notaId];

        await updateDoc(userRef, { notas: nuevasNotas });
        setUsuario(prev => ({ ...prev, notas: nuevasNotas }));
        localStorage.setItem('lafortuna_notas', JSON.stringify(nuevasNotas));
        notify("Nota eliminada del Vault.");
      }
    } catch (err) {
      console.error("Error al eliminar nota:", err);
      notify("No se pudo eliminar la nota.");
    }
  };

  const handleOnboardingComplete = (resultado) => {
    setShowOnboarding(false);
    setUsuario((prevUsuario) => ({
      ...prevUsuario,
      teamId: resultado.teamId,
      sedeId: resultado.sedeId,
      academiaId: resultado.academiaId || resultado.teamId,
      necesitaOnboarding: false
    }));
  };

  // --- 4. RENDERIZADO DE PÁGINAS ---
  const getContent = () => {
    if (!usuario) {
      return (
        <LoginPage
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          nombreCompleto={nombreCompleto} setNombreCompleto={setNombreCompleto}
          onLogin={handleLogin} onRegister={handleRegister} 
          onGoogleLogin={handleGoogleLogin} // <-- Pasamos la función de Google aquí
          error={error} styles={styles}
          academiaIdInput={academiaIdInput}
          setAcademiaIdInput={setAcademiaIdInput}
        />
      );
    }

    if (!usuario.validado) {
      return (
        <div style={{ ...styles.containerCenter, padding: '20px', background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)' }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '400px', border: '1px solid #d4af37' }}>
            <h2 style={styles.goldTitle}>SOLICITUD ENVIADA</h2>
            <p style={{ color: '#fff' }}>Hola <span style={{ color: '#d4af37' }}>{usuario.nombre || 'Guerrero'}</span>,</p>
            <p style={{ color: '#ccc', fontSize: '0.9rem' }}>Tu cuenta está en proceso de validación.</p>
            <button onClick={handleLogout} style={{ ...styles.btnOutline, marginTop: '20px' }}>CERRAR SESIÓN</button>
          </div>
        </div>
      );
    }

    switch (page) {
      case 'hub':
        return (
          <>
            <HubPage
              usuario={usuario}
              onNavigate={(p) => {
                if (p === 'instalar') setShowInstalar(true);
                else if (p === 'onboarding') setShowOnboarding(true);
                else {
                  if (p === 'alumnos') setSedeGestionSel(null);
                  setPage(p);
                }
              }}
              onContinue={handleContinue}
              hasSession={!!videoActual}
              userRole={userRole}
              onLogout={handleLogout}
              styles={styles}
            />
            <InstalacionModal
              isOpen={showInstalar}
              onClose={() => setShowInstalar(false)}
            />
            {showOnboarding && (
              <OnboardingModal
                usuario={usuario}
                styles={styles}
                onComplete={handleOnboardingComplete}
              />
            )}
          </>
        );

      case 'mapa':
        return <MapaPage onBack={() => setPage('hub')} vistos={vistos} usuario={usuario}
          styles={styles}
          categoriaSel={categoriaSel} setCategoriaSel={setCategoriaSel}
          autorSel={autorSel} setAutorSel={setAutorSel}
          instrSel={instrSel} setInstrSel={setInstrSel}
          volSel={volSel} setVolSel={setVolSel}
          rutasLiberadas={rutasLiberadas}
          accesoRutas={accesoRutas}
          onOpenRutas={() => setPage('rutas_aprendizaje')}
          onSelectVideo={handleSelectVideo}
          onNavigateToNotes={() => setPage('notas_hub')} onContinue={handleContinue} hasSession={!!videoActual} />;

      case 'estudio':
        return (
          <EstudioPage
            video={videoActual}
            onBack={() => setPage(videoActual?.origen || 'mapa')}
            vistos={vistos}
            toggleVisto={toggleVisto}
            styles={styles}
            getAdjacentVideo={getAdjacent}
            usuario={usuario}
            accesoRutas={accesoRutas}
            onNavigateToNotes={() => setPage('notas_hub')}
            onSelectVideo={handleSelectVideo}
          />
        );

      case 'notas_hub':
        return (
          <NotasHubPage
            onBack={() => setPage('hub')}
            eliminarNota={handleEliminarNota}
            onNavigateToVideo={handleSelectVideo}
            usuario={usuario}
            styles={styles}
          />
        );

      case 'busqueda':
        return (
          <BusquedaPage
            onBack={() => setPage('hub')}
            onSelectVideo={handleSelectVideo}
            usuario={usuario}
            vistos={vistos}
            videosIndexados={rutasData.videos}
            accesoRutas={accesoRutas}
            styles={styles}
          />
        );

      case 'rutas_aprendizaje':
        return (
          <RutasAprendizajePage
            onBack={() => setPage('hub')}
            usuario={usuario}
            vistos={vistos}
            rutas={rutasData.rutas}
            videos={rutasData.videos}
            asignaciones={rutasData.asignaciones}
            onSelectVideo={handleSelectVideo}
            onOpenBuilder={() => setPage('rutas_admin')}
            onOpenMapa={() => setPage('mapa')}
          />
        );

      case 'rutas_admin':
        if (userRole === 'admin') {
          return <RutasAdminPage onBack={() => setPage('hub')} usuario={usuario} />;
        }
        return (
          <HubPage
            usuario={usuario}
            onNavigate={setPage}
            userRole={userRole}
            onLogout={handleLogout}
            styles={styles}
          />
        );

      case 'alumnos':
        if (['admin', 'profesor', 'instructor'].includes(userRole)) {
          return (
            <GestionAlumnosPage
              onBack={() => { setSedeGestionSel(null); setPage('hub'); }}
              styles={styles}
              usuario={usuario}
              sedeActual={sedeGestionSel || (usuario?.sedeId ? null : academiaData)}
            />
          );
        }
        return <HubPage usuario={usuario} onNavigate={setPage} userRole={userRole} onLogout={handleLogout} styles={styles} />;

      case 'planeador':
        if (['admin', 'profesor', 'instructor'].includes(userRole)) {
          return (
            <PlaneadorClasesPage
              onBack={() => setPage('hub')}
              styles={styles}
              usuario={usuario}
            />
          );
        }
        return <HubPage usuario={usuario} onNavigate={setPage} userRole={userRole} onLogout={handleLogout} styles={styles} />;

      case 'mi_cuenta':
        return (
          <MiCuenta
            usuario={usuario}
            sedeActual={academiaData}
            notify={notify}
            onBack={() => setPage('hub')}
            styles={styles}
          />
        );

      case 'timer':
        return (
          <TimerPage
            onBack={() => setPage('hub')}
            styles={styles}
          />
        );

      case 'panel_maestro':
        if (['admin', 'profesor'].includes(userRole)) {
          return (
            <PanelMaestro
              usuario={usuario}
              teamData={academiaData}
              sedeData={academiaData}
              onVerSede={(sede) => {
                setSedeGestionSel(sede || null);
                setPage('alumnos');
              }}
              onBack={() => setPage('hub')}
              styles={styles}
            />
          );
        }
        return <HubPage usuario={usuario} onNavigate={setPage} userRole={userRole} onLogout={handleLogout} styles={styles} />;

      case 'admin':
        if (userRole === 'admin') {
          return <AdminPage onBack={() => setPage('hub')} />;
        }
        return (
          <HubPage
            usuario={usuario}
            onNavigate={setPage}
            userRole={userRole}
            onLogout={handleLogout}
            styles={styles}
          />
        );

      default:
        return (
          <HubPage
            usuario={usuario}
            onNavigate={setPage}
            userRole={userRole}
            onLogout={handleLogout}
            styles={styles}
          />
        );
    }
  };

  // --- 5. RENDER FINAL ---
  if (cargando) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: 'var(--app-vh)',
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        zIndex: 9999,
        margin: 0,
        padding: 0
      }}>
        <div className="spinner"></div>
        <h2 style={{
          color: '#d4af37',
          marginTop: '25px',
          fontSize: 'clamp(0.8rem, 2vw, 1.2rem)',
          letterSpacing: '4px',
          fontWeight: '300',
          textAlign: 'center'
        }}>
          ACCEDIENDO AL VAULT
        </h2>

        <style>{`
          .spinner { 
            width: 50px; 
            height: 50px; 
            border: 3px solid #1a1a1a; 
            border-top: 3px solid #d4af37; 
            border-radius: 50%; 
            animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; 
          }
          @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="App" style={{ backgroundColor: '#0a0a0a', color: '#fff', minHeight: 'var(--app-vh)', width: '100vw', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes float { 
          0% { transform: translate(0px, 0px); } 
          50% { transform: translate(0px, -10px); } 
          100% { transform: translate(0px, 0px); } 
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .floating-node { animation: float 6s ease-in-out infinite; }
        .page-transition { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="page-transition" key={page}>
        <React.Suspense fallback={<CargandoPagina />}>
          {getContent()}
        </React.Suspense>
      </div>
    </div>
  );
}