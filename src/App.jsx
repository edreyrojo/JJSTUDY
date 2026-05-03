import React, { useState, useEffect } from 'react';

// 1. Conexión principal
import { auth, db } from './firebase';

// 2. Funciones de Autenticación
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
  onSnapshot,
  orderBy,   // <-- VITAL para que Notas no se quede cargando
  deleteDoc, // <-- VITAL para borrar notas
  addDoc,
  arrayUnion
} from 'firebase/firestore';

// 4. Tus otros archivos (Componentes y Páginas)
import GestionAlumnosPage from './components/GestionAlumnosPage';
import PlaneadorClasesPage from './components/PlaneadorClasesPage';
import { DB_INSTRUCCIONALES } from './data/instruccionales';
import MapaPage from './components/MapaPage';
import MiCuenta from './components/MiCuenta';
import NotasHubPage from './components/NotasHubPage';
import EstudioPage from './components/EstudioPage';
import AdminPage from './components/AdminPage';
import BusquedaPage from './components/BusquedaPage';
import LoginPage from './components/LoginPage';
import HubPage from './components/HubPage';
import InstalacionModal from './components/InstalacionModal';
import { getAdjacentVideo } from './utils/videoHelpers';
import TimerPage from './components/TimerPage';

// --- NUEVOS COMPONENTES INTEGRADOS ---
import PanelMaestro from './components/PanelMaestro';
import OnboardingModal from './components/OnboardingModal';

import Swal from 'sweetalert2';

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
      popup: 'gold-border-alert'
    }
  });
};

// --- 1. CONFIGURACIÓN DE ESTILOS ---
const styles = {
  containerCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  container: { padding: '40px', textAlign: 'center' },
  goldTitle: { color: '#d4af37', letterSpacing: '3px', marginBottom: '30px', textTransform: 'uppercase' },
  card: { backgroundColor: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', width: '300px', textAlign: 'center' },
  input: { width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', outline: 'none' },
  btnGold: { width: '100%', padding: '12px', backgroundColor: '#d4af37', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' },
  btnOutline: { width: '100%', padding: '10px', backgroundColor: 'transparent', border: '1px solid #d4af37', color: '#d4af37', cursor: 'pointer', borderRadius: '4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', maxWidth: '600px', margin: '0 auto' },
  hubBtn: { padding: '40px 20px', backgroundColor: '#111', border: '1px solid #333', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', borderRadius: '8px', transition: '0.3s' },
};

// --- 4. COMPONENTE PRINCIPAL (EXPORT DEFAULT) ---//
export default function App() {
  // --- 1. ESTADOS ---
  const [showInstalar, setShowInstalar] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false); // Estado para el nuevo OnboardingModal
  const [usuario, setUsuario] = React.useState(null);
  const [cargando, setCargando] = React.useState(true);
  const [page, setPage] = useState('login');
  const [userRole, setUserRole] = useState('usuario');
  const [categoriaSel, setCategoriaSel] = useState('DEFENSAS');
  const [autorSel, setAutorSel] = useState(null);
  const [instrSel, setInstrSel] = useState(null);
  const [volSel, setVolSel] = useState(null);
  const [vistos, setVistos] = useState(() => {
    const guardado = localStorage.getItem('lafortuna_vistos');
    return guardado ? JSON.parse(guardado) : [];
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [error, setError] = useState('');
  const [videoActual, setVideoActual] = useState(() => {
    const guardado = localStorage.getItem('lafortuna_last_video');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [academiaIdInput, setAcademiaIdInput] = useState('');

  // --- 2. EFECTO DE AUTENTICACIÓN ---
  // --- 2. EFECTO DE AUTENTICACIÓN (VERSIÓN BLINDADA) ---
  React.useEffect(() => {
    let unsubSnapshot = null; // Referencia para limpiar el escucha de Firestore

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Iniciamos carga para bloquear la UI mientras verificamos
      setCargando(true);

      if (user) {
        // USAMOS onSnapshot: Si el admin te valida o la migración termina, 
        // la App reacciona al instante sin refrescar.
        unsubSnapshot = onSnapshot(doc(db, "usuarios", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();

            // Guardamos el perfil completo en el estado
            setUsuario({
              uid: user.uid,
              email: user.email,
              ...data
            });

            setUserRole(data.rol || 'usuario');
            if (data.vistos) setVistos(data.vistos);

            // Sincronizamos notas localmente
            if (data.notas) {
              localStorage.setItem('lafortuna_notas', JSON.stringify(data.notas));
            }

            // --- EL DOBLE CANDADO ---
            // Solo mostramos Onboarding si tiene la bandera activa Y NO tiene teamId.
            // Si ya tiene teamId (porque tú se lo pusiste en la BD), el modal se oculta solo.
            if (data.necesitaOnboarding === true && !data.teamId) {
              setShowOnboarding(true);
            } else {
              setShowOnboarding(false);
            }

            // REDIRECCIÓN INTELIGENTE
            if (data.validado) {
              setPage(prev => (prev === 'login' || prev === 'espera' ? 'hub' : prev));
            } else {
              setPage('espera');
            }

          } else {
            console.warn("Usuario sin documento en Firestore");
            setUsuario(user);
            setPage('espera');
          }
          setCargando(false); // Quitamos carga dentro del snapshot
        }, (err) => {
          console.error("Error en Firestore Snapshot:", err);
          setCargando(false);
        });

      } else {
        // No hay sesión: limpiamos todo
        if (unsubSnapshot) unsubSnapshot();
        setUsuario(null);
        setPage('login');
        setCargando(false);
      }
    });

    // Limpieza al desmontar el componente
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // --- 3. FUNCIONES DE LÓGICA ---

  const handleLogout = async () => {
    try {
      await auth.signOut();
      // Limpiamos estados de la aplicación
      setVistos([]);
      setVideoActual(null);
      setUsuario(null);
      // Limpiamos persistencia local
      localStorage.removeItem('lafortuna_vistos');
      localStorage.removeItem('lafortuna_last_video');
      localStorage.removeItem('lafortuna_notas');
      // Redirigimos al inicio
      setPage('login');
      console.log("Sesión cerrada y Vault bloqueado 🛡️");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleRegister = async () => {
    try {
      setError('');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Identificación del Admin Maestro
      const isAdmin = email === "zamna.ed@gmail.com";

      // LÓGICA DE ROLES Y VINCULACIÓN:
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
        // Solo guardamos el academiaId si se registró como instructor vinculado
        academiaId: (rolAsignado === 'instructor') ? academiaIdInput.trim() : null,
        validado: isAdmin, // Solo el admin entra directo, los demás esperan validación
        fechaRegistro: new Date().toISOString(),
        necesitaOnboarding: true // Añadido para gestionar el OnboardingModal
      });

      // Feedback personalizado
      if (isAdmin) {
        notify("¡Bienvenido, Ngasi! Acceso total concedido.");
      } else if (rolAsignado === 'instructor') {
        notify("Solicitud de Instructor enviada. El profesor debe validar tu cuenta para vincularte a la sede.");
      } else {
        notify("Solicitud enviada a La Fortuna. Espera a que el profesor valide tu perfil.");
      }

      setPage('login');
      setAcademiaIdInput(''); // Limpiamos el campo del código después del uso

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

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.validado) {
          setUserRole(data.rol);
          setVistos(data.vistos || []);
          setPage('hub');
        } else {
          notify("Tu cuenta aún no ha sido validada por el profesor.");
          handleLogout();
        }
      }
    } catch (err) {
      setError("Credenciales incorrectas o usuario no encontrado.");
    }
  };

  const toggleVisto = async (id) => {
    if (!id) return;

    const nuevaLista = vistos.includes(id)
      ? vistos.filter(v => v !== id)
      : [...vistos, id];

    // 1. Actualización Instantánea (UI local)
    setVistos(nuevaLista);
    localStorage.setItem('lafortuna_vistos', JSON.stringify(nuevaLista));

    // 2. Sincronización con la Nube
    if (auth.currentUser) {
      try {
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        await setDoc(userRef, { vistos: nuevaLista }, { merge: true });
        console.log("Vistos sincronizados en la nube");
      } catch (error) {
        console.error("Error sincronizando vistos:", error);
      }
    }
  };

  const handleEliminarNota = async (notaId) => {
    if (!usuario) return;

    if (!window.confirm("¿Seguro que quieres eliminar esta nota técnica?")) return;

    try {
      const userRef = doc(db, "usuarios", usuario.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const nuevasNotas = { ...data.notas };
        delete nuevasNotas[notaId]; // Eliminamos la nota del objeto

        await updateDoc(userRef, { notas: nuevasNotas });

        // Actualizamos localmente para que la UI responda de inmediato
        setUsuario(prev => ({ ...prev, notas: nuevasNotas }));
        localStorage.setItem('lafortuna_notas', JSON.stringify(nuevasNotas));

        notify("Nota eliminada del Vault.");
      }
    } catch (err) {
      console.error("Error al eliminar nota:", err);
      notify("No se pudo eliminar la nota.");
    }
  };

  // --- FUNCIÓN PARA FINALIZAR EL ONBOARDING ---
  const handleOnboardingComplete = (datosActualizados) => {
    // 1. Actualizamos el estado local del usuario con su nuevo teamId y sedeId
    setUsuario(prev => ({
      ...prev,
      ...datosActualizados
    }));

    // 2. Cerramos el modal
    setShowOnboarding(false);

    notify("¡Bóveda configurada con éxito! Oss.");
  };

  // --- 4. RENDERIZADO DE PÁGINAS ---
  const getContent = () => {
    // 1. Si no hay usuario, directo a Login
    if (!usuario) {
      return (
        <LoginPage
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          nombreCompleto={nombreCompleto} setNombreCompleto={setNombreCompleto}
          onLogin={handleLogin} onRegister={handleRegister} error={error} styles={styles}
        />
      );
    }

    // 2. Si hay usuario pero NO está validado, mostrar Sala de Espera
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

    // 3. SI EL USUARIO ESTÁ VALIDADO: Navegación según Rol
    switch (page) {
      case 'hub':
        return (
          <>
            <HubPage
              usuario={usuario}
              onNavigate={(p) => {
                if (p === 'instalar') setShowInstalar(true);
                else if (p === 'onboarding') setShowOnboarding(true); // Permitir abrirlo manualmente si es necesario
                else setPage(p);
              }}
              onContinue={() => setPage('estudio')}
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
          onSelectVideo={(v) => { setVideoActual(v); localStorage.setItem('lafortuna_last_video', JSON.stringify(v)); setPage('estudio'); }}
          onNavigateToNotes={() => setPage('notas_hub')} onContinue={() => setPage('estudio')} hasSession={!!videoActual} />;

      case 'estudio':
        return (
          <EstudioPage
            video={videoActual}
            onBack={() => setPage('mapa')}
            vistos={vistos}
            toggleVisto={toggleVisto}
            styles={styles}
            getAdjacentVideo={getAdjacentVideo}
            usuario={usuario}
            onNavigateToNotes={() => setPage('notas_hub')}
            onSelectVideo={(v) => {
              setVideoActual(v);
              localStorage.setItem('lafortuna_last_video', JSON.stringify(v));
            }}
          />
        );

      case 'notas_hub':
        return (
          <NotasHubPage
            onBack={() => setPage('hub')}
            eliminarNota={handleEliminarNota}
            onNavigateToVideo={(v) => { setVideoActual(v); setPage('estudio'); }}
            usuario={usuario}
            styles={styles}
          />
        );

      case 'busqueda':
        return (
          <BusquedaPage
            onBack={() => setPage('hub')}
            onSelectVideo={(v) => {
              setVideoActual(v);
              setPage('estudio');
            }}
            styles={styles}
          />
        );

      case 'alumnos':
        if (['admin', 'profesor'].includes(userRole)) {
          return (
            <GestionAlumnosPage
              onBack={() => setPage('hub')}
              styles={styles}
              usuario={usuario}
            />
          );
        }
        return <HubPage onNavigate={setPage} userRole={userRole} onLogout={handleLogout} styles={styles} />;

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

      // --- NUEVA RUTA INTEGRADA ---
      case 'panel_maestro':
        if (['admin', 'profesor'].includes(userRole)) {
          return (
            <PanelMaestro
              usuario={usuario}
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
        height: '100vh',
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
    <div className="App" style={{ backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes float { 0% { transform: translate(0px, 0px); } 50% { transform: translate(0px, -15px); } 100% { transform: translate(0px, 0px); } }
        .floating-node { animation: float 6s ease-in-out infinite; }
      `}</style>

      {getContent()}
    </div>
  );
}