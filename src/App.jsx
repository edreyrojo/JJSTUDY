import React, { useState } from 'react';
// Importa la conexión que creamos en firebase.js
import { auth, db } from './firebase'; 
// Importa las funciones específicas de Autenticación
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, onAuthStateChanged 
} from 'firebase/auth';
// Importa las funciones específicas de la Base de Datos (Firestore)
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc 
} from 'firebase/firestore';
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
const BusquedaPage = ({ onBack, onSelectVideo }) => {
  const [termino, setTermino] = React.useState("");

  // Aplanamos la DB para buscar en todos los videos de todos los cursos
  const todasLasTecnicas = React.useMemo(() => {
  return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
    DB_INSTRUCCIONALES[cursoKey].volumenes.flatMap(vol =>
      vol.partes.map(parte => {
        let sub = parte.subcategoria || ""; // Si ya tiene en la DB, lo respetamos
        const n = parte.nombre.toLowerCase();
        const cursoNom = cursoKey.toLowerCase();
        
        if (!sub) {
          const esCursoDefensa = cursoNom.includes('pillars of defense') || cursoNom.includes('escapes');

          // 1. FILTRO DE DEFENSAS
          if (n.includes('escape') || n.includes('defensa') || n.includes('defense') || n.includes('counter') || esCursoDefensa) {
            if (n.includes('mount') || n.includes('montada')) sub = "ESCAPES MONTADA";
            else if (n.includes('side') || n.includes('lateral')) sub = "ESCAPES LATERAL";
            else if (n.includes('back') || n.includes('espalda')) sub = "DEFENSA ESPALDA";
            else if (n.includes('leg lock') || n.includes('heel hook')) sub = "DEFENSA LEG LOCKS";
            else if (n.includes('triang')) sub = "DEFENSA TRIANGULO";
            else if (n.includes('arm bar') || n.includes('armbar') || n.includes('joint lock') || n.includes('armlock')) sub = "DEFENSA ARM BAR";
            else if (n.includes('darce') || n.includes('guillotine') || n.includes('choke') || n.includes('strangle')) sub = "DEFENSA STRANGLES";
            else sub = "RE-GUARDIA"; 
          } 
          // 2. FILTRO DE DERRIBOS (Ahora sí está afuera del if anterior)
          else if (n.includes('takedown') || n.includes('take down') || n.includes('standing') || n.includes('derribo') || cursoNom.includes('feet to floor')) {
            sub = "DERRIBOS";
          }
          // 3. POSICIONES DE CONTROL
          else if (n.includes('side control') || n.includes('lateral') || n.includes('100 kilos')) sub = "CONTROL LATERAL";
          else if (n.includes('half guard') || n.includes('media guardia') || n.includes('z-guard')) sub = "MEDIA GUARDIA";
          else if (n.includes('closed guard') || n.includes('guardia cerrada')) sub = "GUARDIA CERRADA";
          else if (n.includes('mount') || n.includes('montada')) sub = "MONTADA";
          else if (n.includes('back') || n.includes('espalda') || n.includes('rear mount')) sub = "ESPALDA";
          else if (n.includes('turtle') || n.includes('tortuga')) sub = "TORTUGA";
          // 4. SISTEMAS ESPECÍFICOS (Re-agregados)
          else if (n.includes('berimbolo') || n.includes('bolo')) sub = "BERIMBOLO";
          else if (n.includes('buggy')) sub = "BUGGY CHOKE";
          else if (n.includes('crucifix') || n.includes('crucifijo')) sub = "CRUCIFIX";
          else if (n.includes('octopus')) sub = "OCTOPUS GUARD";
        }

        return { ...parte, subcategoria: sub, curso: cursoKey, volNombre: vol.nombre };
      })
    )
  );
}, [DB_INSTRUCCIONALES]);// [] significa que solo se calcula una vez al cargar la app

  const resultados = todasLasTecnicas.filter(t =>
    t.nombre.toLowerCase().includes(termino.toLowerCase())
  );

  return (
    <div style={{ padding: '40px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      <button onClick={onBack} style={styles.btnOutline}>← VOLVER AL HUB</button>

      <h2 style={{ color: '#d4af37', marginTop: '20px', fontSize: '1.5rem' }}>BUSCADOR DE TÉCNICAS</h2>

      <input
        type="text"
        placeholder="Buscar técnica (ej: Sweep, Guard, Kimur...)"
        autoFocus
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: '#111',
          border: '1px solid #d4af37',
          color: '#fff',
          borderRadius: '8px',
          margin: '20px 0',
          fontSize: '1rem'
        }}
        onChange={(e) => setTermino(e.target.value)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '70vh' }}>
        {resultados.length > 0 ? (
          resultados.map((t, i) => (
            <div
              key={i}
              onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })}
              style={{
                padding: '15px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #222',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'border-color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#d4af37'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
            >
              <div style={{ color: '#d4af37', fontWeight: 'bold' }}>{t.nombre}</div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                {t.curso} • {t.volNombre}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
            No se encontraron técnicas con ese nombre.
          </div>
        )}
      </div>
    </div>
  );
};
// Importamos las herramientas de Firestore necesarias (Asegúrate de tenerlas arriba en App.jsx)
const cargarDatosDesdeFirebase = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "usuarios", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      
      // Sincronizamos Vistos
      if (data.vistos) {
        setVistos(data.vistos);
        localStorage.setItem('lafortuna_vistos', JSON.stringify(data.vistos));
      }
      
      // Sincronizamos Notas (Si ya las tienes en Firebase)
      if (data.notas) {
        // Aquí podrías cargar tus notas globales si decides moverlas a Firebase luego
      }
    }
  } catch (error) {
    console.error("Error cargando datos de nube:", error);
  }
};
const AdminPage = ({ onBack }) => {
  const [solicitudes, setSolicitudes] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);

  // Función para traer usuarios pendientes de la nube
  const obtenerPendientes = async () => {
    try {
      setCargando(true);
      const q = query(collection(db, "usuarios"), where("validado", "==", false));
      const querySnapshot = await getDocs(q);
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSolicitudes(lista);
    } catch (error) {
      console.error("Error al obtener pendientes:", error);
    } finally {
      setCargando(false);
    }
  };

  React.useEffect(() => {
  const deshacerEscucha = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // 1. Obtenemos el documento del usuario desde Firestore
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 2. ACTUALIZAMOS EL PERFIL COMPLETO (Admin incluido)
        // Esto soluciona que el menú de admin no cargue
        setUsuario({
          uid: user.uid,
          email: user.email,
          ...userData // Aquí vienen los permisos de admin
        });

        // 3. SINCRONIZACIÓN DE NOTAS
        // Si hay notas en la nube, actualizamos el localStorage para que coincidan
        if (userData.notas) {
          const notasActuales = JSON.parse(localStorage.getItem('lafortuna_notas') || '{}');
          const nuevasNotas = { ...notasActuales, ...userData.notas };
          localStorage.setItem('lafortuna_notas', JSON.stringify(nuevasNotas));
        }
      } else {
        // Si el usuario es nuevo y no tiene doc en Firestore todavía
        setUsuario(user);
      }
    } else {
      setUsuario(null);
    }
  });
  return () => deshacerEscucha();
}, []);

  // Función para validar (Cambia el estado en Firebase)
  const validarUsuario = async (uid) => {
    try {
      const userRef = doc(db, "usuarios", uid);
      await updateDoc(userRef, { validado: true });
      alert("Acceso concedido. El usuario ya puede entrar al Vault.");
      obtenerPendientes(); // Recargamos la lista
    } catch (error) {
      alert("Error al validar: " + error.message);
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h2 style={styles.goldTitle}>CONTROL DE ACCESOS: LA FORTUNA</h2>
        <button onClick={onBack} style={styles.btnOutline}>VOLVER AL HUB</button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ color: '#d4af37', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          SOLICITUDES PENDIENTES 
          <span>{solicitudes.length}</span>
        </h3>
        
        {cargando ? (
          <p style={{ color: '#d4af37', textAlign: 'center', marginTop: '20px' }}>Consultando la base de datos...</p>
        ) : solicitudes.length === 0 ? (
          <p style={{ color: '#666', marginTop: '20px', textAlign: 'center' }}>No hay nuevos practicantes esperando acceso.</p>
        ) : (
          solicitudes.map(s => (
            <div key={s.id} style={{ 
              backgroundColor: '#0a0a0a', 
              padding: '20px', 
              borderRadius: '8px', 
              border: '1px solid #222', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>{s.nombre || "Sin nombre"}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.email}</div>
                <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '5px' }}>ID: {s.uid}</div>
              </div>
              <button 
                onClick={() => validarUsuario(s.uid)}
                style={{ ...styles.btnGold, width: 'auto', padding: '12px 25px', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                AUTORIZAR ENTRADA
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
const mapStyles = {
  layout: { display: 'flex', height: '100vh', backgroundColor: '#050505', overflow: 'hidden' },
  sidebar: { width: '250px', borderRight: '1px solid #222', padding: '20px', backgroundColor: '#0a0a0a' },
  sideItem: { padding: '12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px' },
  mapArea: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  canvas: { position: 'relative', width: '800px', height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  svgLayer: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' },
  mainNode: { width: '140px', height: '140px', borderRadius: '50%', border: '4px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 5, fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' },
  subNodeFloating: { position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', textAlign: 'center', backgroundColor: '#111', cursor: 'pointer', zIndex: 6, padding: '10px', transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
};

// --- 2. BASE DE DATOS DE INSTRUCCIONALES ---
const DB_INSTRUCCIONALES = {
  'Octopus Guard 2.0': {
    titulo: "Octopus Guard 2.0",
    autor: "Craig Jones",
    volumenes: [
      {
        id: "V1",
        nombre: "Volumen 1",
        partes: [
          { nombre: "1. Craig The King Jones and Hey She's Hotter", id: "1YtOMvRtLKnFjjMHZWhEFefcdYitHfVkv", subcategoria: ""},
          { nombre: "2. Half Guard Vs Side Control", id: "1ybiHRszC99FbUqpYcQHfqCx7AmbN9gae" },
          { nombre: "3. Jiu Jitsu VS Wrestling Cross Face", id: "1AB9Q8Sd69IO-rMm2OscTbYB7ISC_NnaZ" },
          { nombre: "4. Side Control Is Not Real", id: "1ZVumoCDF8ApauLjcQ0dCjPPH48i1pfr5", subcategoria: "SIDE CONTROL" },
          { nombre: "5. The Only Grips You'll Ever Need", id: "13R72QxQ4OWV8cKUr5feCXyFXP-Iozey0" },
          { nombre: "6. Piss Like A Dog", id: "1gjPSTKkD35WbG-dYLUTmX3IuycZKail3" },
          { nombre: "7. The Modern Technical Get The FUCK Up", id: "12qLgOC-bprnZPsr57pSrqJXEO31c9Ka2" },
        ]
      },
      {
        id: "V2",
        nombre: "Volumen 2",
        partes: [
          { nombre: "1. Sweep Them Off Their Feet", id: "1QIJ-4XTOxwTuARm6Eu66XqA1-o2CS0GF" },
          { nombre: "2. Get Them When They're Vulnerable", id: "1SbnyAc_MTjwkpCba0Q4Dc_r0g0rzhUNN" },
          { nombre: "3. Why You're Fat? And Yo Makikomi Roll Still Don't Work", id: "10ysfzDOouJKathuO3LHfoh1T5SYl9NGC" },
          { nombre: "4. Switch Hipper Counter", id: "1DdEEJocA_SXndkXN8dBe2Yu3hHxdcgwm" },
          { nombre: "5. Dealing with reverse Side Control", id: "1Zy995FOixUw6ifxKq0N3f-3TRumwWpwT" },
          { nombre: "6. Darce Chokes Are Fake", id: "1rRogu_0eT19nLljUTwLmPSjBZP2FBOI6" },
          { nombre: "7. The Infamous Darce Counter Back Take", id: "164fqqWT-xHOlx5uo5lBQEIxn87-spHjl" },
          { nombre: "8. Teach Me How To Buggy - Off The Darce", id: "13gYty50_grPZl0zEbGP951v7X70ugPlw" },
        ]
      },
      {
        id: "V3",
        nombre: "Volumen 3",
        partes: [
          { nombre: "1. Wrist Ride Buggy", id: "1F8wkYTwy9F5RRPvQWgDSlsrZ9MQcZwgD" },
          { nombre: "2. Vintage Buggy", id: "1Hj4ejDDar4AdZ-uWfMmpr4JAeuBr0PXF" },
          { nombre: "3. Buggy Choke To Ghost Darce", id: "1wa5KSMMZiupmoLDXyRCIJFSHJBbleLqh" },
          { nombre: "4. Front Head Ain't No Thang", id: "1rLxiOH2NSy4FVPBlByqIcityoQyqlOhC" },
          { nombre: "5. Darce Grip Break", id: "1sjgpOvbhP1Cy7RKs6BSwHOosMFww4B4-" },
          { nombre: "6. Peak Out Counter To Darce", id: "1j-y70vyDYGX9qOQvzJTL0IBbww8r33yd" },
          { nombre: "7. Don't Forget Their Legs", id: "1Xrc5-nrGWrhTbbO9-fkv8TnnYnYqlCSJ" },
          { nombre: "8. Turtle Over Wrap", id: "1q-Z9_B_LoPb3xiRxbdAbMRPgTcjCWoP2" },
          { nombre: "9. Turtle Over Wrap: Armbar And Triangle", id: "1V1dsV2db5Wi_NBWFjdHqwPlv8dbzflL3" },
        ]
      }, // Se pueden llenar igual
      {
        id: "V4", nombre: "Volumen 4", partes: [
          { nombre: "1. Turtle Overwrap: Leg Attacks", id: "1j__Ubl8Nr8mH5GWHnWlTq1BndimvJC6n" },
          { nombre: "2. Crucifix = Fireman's Carry", id: "1OvxJY9GYF3LGiwuXHyEn3Wz4OkeCMIJN" },
          { nombre: "3. Crucifixed", id: "1uit9PDcpQ0v0cotowyCD_g90KpSHWsG8" },
          { nombre: "4. Turtle Tilts", id: "16_uuohYZXDRHNkrvzthy3JeKKw-hoq2_" },
          { nombre: "5. Always Be On That Lean", id: "1EKBt79Emfa40MynUkBRy7HeI1KRxt499" },
          { nombre: "6. The Jo Chen Counter", id: "1gk1VhR7GWABBLJeLW3JvJDY6pUBWS0l4" },
          { nombre: "7. Runaway (Feat Priit)", id: "1dxwzlcwUlVdD3xxA-mCmfo-Tm7xojNTA" },
        ]
      }
    ]
  },
  'OCTOPUS GUARD': {
    titulo: "OCTOPUS GUARD",
    autor: "Craig Jones",
    volumenes: [
      {
        nombre: "Volumen 1, 2 y 3",
        partes: [
          { nombre: "VOLUMEN 1", id: "" },
          { nombre: "Intro", id: "11kefNVCQSi9Q9b-d4An0z90Y9OJObpJg" },
          { nombre: "VOLUMEN 2", id: "" },
          { nombre: "Ko Soto Sweep", id: "18NHT3_wXZEVJvwBHK5Rn2sCPVP3o_bsg" },
          { nombre: "VOLUMEN 3", id: "" },
          { nombre: "Octopus Buggy", id: "1-Tk9fTO3qQyHPu_kWBgyfDPKvugBxzNS" },
        ]
      },
    ]
  },
  'How To Pass Quickly': {
    titulo: "How To Pass Quickly",
    autor: "Craig Jones",
    volumenes: [
      {
        nombre: "Volumenes",
        partes: [
          { nombre: "Intro", id: "1E7VNVAzlqH-Ha5z1_7EjRQZUW7fgDX6f" },
        ]
      },
      {
        nombre: "Volumen 2",
        partes: [
          { nombre: "Ko Soto Sweep", id: "1QhjQJbFjqnR9y0vA5rxfsHPeq35FBEwj" },
        ]
      },
    ]
  },
  'Get Off My Legs Gringo': {
    titulo: "Get Off My Legs Gringo",
    autor: "Craig Jones",
    volumenes: [
      {
        nombre: "Volumen 1",
        partes: [
          { nombre: "Intro", id: "1xu_1Y55WqCVME3JNpXIvS7ZI1HwSLeST" },
        ]
      },
      {
        nombre: "Volumen 2",
        partes: [
          { nombre: "Volumen 2", id: "1GiziMlYiEuGCpDD2FGkWoO-3-vqkRWyt" },
        ]
      },
      {
        nombre: "Volumen 3",
        partes: [
          { nombre: "volumen 3", id: "1g-rmaQs_WhTlCgwsjZXfOhBR_s12mZkF" },
        ]
      },
      {
        nombre: "Volumen 4",
        partes: [
          { nombre: "Volumen 4", id: "1ASXOjkBxS-iAStwa7Um29zyCHA5of38W" },
        ]
      },
      {
        nombre: "Volumen 5",
        partes: [
          { nombre: "volumen 5", id: "1PqLYfHDInO7GS-0b4sQ1XXUgP3Kd3hpM" },
        ]
      },
      {
        nombre: "Volumen 6",
        partes: [
          { nombre: "Volumen 6", id: "1tFpqYz7VRolXsmfASZCWg2HmL4e83y9N" },
        ]
      },
    ]
  },
  ' Xanadu Back Takes': {
    titulo: "Xanadu Back Takes",
    autor: "Levi Jones-Leary",
    volumenes: [
      {
        nombre: "Volumen 1",
        partes: [
          { nombre: "Guard retention - Sit up guard to foot on bicep", id: "1XC35pCXmN33_fc3-MsRRsy5h24MM92tS" },
        ]
      },
      {
        nombre: "Volumen 2",
        partes: [
          { nombre: "Outside De la riva - Omoplata from collar sleeve", id: "1pY72e63hBwMAdXtJfPW4fy94DdoKtcmU" },
        ]
      },
      {
        nombre: "Volumen 3",
        partes: [
          { nombre: "Berimbolo", id: "1yR8yQa5o9U2TZPh1jRdGYYCPUosaGKzf" },
        ]
      },
      {
        nombre: "Volumen 4",
        partes: [
          { nombre: "Xanadu guard - Back take option 1 from low hip position", id: "1lPBA_JYhH5vHueuUatz_Aez-tj8Mq8l_" },
        ]
      }
    ]
  },
  'Xanadu Guard': {
    titulo: "Xanadu Guard",
    autor: "Levi Jones-Leary",
    volumenes: [
      {
        nombre: "Volumen 1",
        partes: [
          { nombre: "0.- Intro", id: "1t5c5OZNPYWQiDeXMRxL9_J-RvdHd8e6s" },
          { nombre: "01 Fundamental Open Guard Positioning", id: "1KU0gVQxs5J08EqK2dDckvIAU9zsYI2Gg" },
          { nombre: "02 Framing VS Pulling - Upper Body Positioning", id: "1m0CNdAJBmVZVERP7cLRYsRClEniPfxqL" },
          { nombre: "03 Countering The Bull Fighter Pass With The Kiss Of The Dragon", id: "1OtDJ48OF1Gu3cJvtxKcl0wp0FEYifSZc" },
          { nombre: "04 Countering The Kneecut Pass With The Kiss Of The Dragon", id: "1aWW6RzGJ_7QOhZhgf6n2Pa7a5QMxQ3Kh" },
          { nombre: "05 Entering The De La Riva From Sit Up Guard ", id: "1btwYSCiVAZG0RudXKqqowPSAKsMBGs61" },
          { nombre: "06 Taking The Back From The De La Riva Guard", id: "19w0_bnaYSWQ-RZ_SC5oi085fxObxLSyZ" },
          { nombre: "07 Attacking The Berimbolo When Opponent Puts Their Hips On The Mat", id: "1VleGt1_HN20vBa6I8M3sMf3V-pYRqzjX" },
          { nombre: "08 Attacking Xanadu Guard Off The Berimbolo", id: "1emtOYjI0zQ1q5uw6fS11Nc2AAg02Aray" },
          { nombre: "09 Attacking Xanadu Guard When Opponent Turtles", id: "183hYGbdkTPTzQrL5u_gofhfxSbXrnhNb" },
          { nombre: "10 Entering Xanadu Guard From The Body X", id: "1pJvdtHltZcfJRwZ4g6MilweJDvYxFztC" },
          { nombre: "11 Kiss Of The Dragon To Xanadu Guard", id: "1wFZ-aTbxpIMMh6WvsNcS5pDyzS59Y7Tx" },
          { nombre: "12 Back Take When Opponent Postures From Xanadu Guard", id: "1ZlMNCr3RY8lIAN7orFqSr5c4tNqY0zQ6" },
          { nombre: "13 Crucifix When Opponent Stays Turtled From Xanadu Guard", id: "1afQJI4tbLLX1CfkVSXDJuF4-DGNdJUA5" },
          { nombre: "14 Back Take When Opponent Steps Over Head", id: "1uJrIeAZZDbldfzWDMKrgOuyz49TDYjdk" },
          { nombre: "15 What To Do When Opponent Steps Over Head And Rolls Through", id: "1tbyOxIHKrNhGEta42x8YErUo_9DKEgbF" },
          { nombre: "16 Tarikoplata From The Crucifix Position", id: "1_a2FqbZAUZ1LmFjofvVPZ12xK3gBVdEa" },
          { nombre: "17 Rolling Omoplata From The Crucifix", id: "1WXHnQuKhq_R6INlRJ6u4RV0D9J6xjPq_" },
          { nombre: "18 Xanadu Guard To Barataplata", id: "1-2CLYTXt3VnKaNupsU7NMvlJWUqcZwvw" },
          { nombre: "19 Entering Xanadu Guard From The Top", id: "1YH8UgzvgQgorfd5AEPozK9CCsAYU5kdt" },
          { nombre: "20 Reverse Xanadu Guard To North South", id: "178wgTadDMsxUS357VZMWOyGHcHTpP5A_" },
          { nombre: "21 Reverse Xanadu Guard To Crucifix", id: "1RPT7hRB5-RJh3l-9iYmvG_VSr1CQA7XR" },
          { nombre: "22 - Reverse Xanadu Guard To Berimbolo", id: "1ljB1A6ex7fo7zLLNFOncqcdr66cnYfOq" },
          { nombre: "23 Body X Back Take Controlling Near Side Leg", id: "19yirfk5J5LL8n-E3Gs2xaWr6KJ58U2qr" },
          { nombre: "24 Body X To K Guard Back Take", id: "1mtXUtt07O4p9GZ8L5lpFgAy7UZNvjO7Z" },
          { nombre: "25 Body X Near Side Leg To Xanadu Guard", id: "1LxVm6x4acJQW_7h_rLCgnZgQ2--tt6RU" },
          { nombre: "26 K Guard To Xanadu Guard", id: "1YANfcOO2QDCtCf05xfQEG4IhEWFWSKDS" },
          { nombre: "27 Xanadu Guard Dealing With Opponent Jumping To The Other Side", id: "17dabGUY_9aFY2hYJEYkhEa8Ej9ZfKvRR" },
          { nombre: "28 Outro", id: "1hxmm1YLOmmKv1GZ_usO3VKTcs4uPKVHw" },
        ]
      },
    ]
  },
  'LEG DRAG': {
    titulo: "LEG DRAG",
    autor: "Levi Jones-Leary",
    volumenes: [
      {
        nombre: "V1.- OVER VIEW",
        partes: [
          { nombre: "1 - Intro to Course", id: "1vnSXnoHm9Oyaw8U0r9ETeOru_ITz1EFy" },
          { nombre: "2 - What is the Leg Drag", id: "1hDW7_Vp8M_toahNTkfXFR5b7kN1hHM6f" },
          { nombre: "3 - Overview of Options", id: "1z8wC9zU4ql0GetkrbST73dezIXsny3C8" },
          { nombre: "4 - How They Defend", id: "1PQ4-C2U6dgxwSd1qCI5f6Slu76Xra825" },
          { nombre: "5 - A Basic Leg Drag", id: "1aARo2X91cg-wl7jvlqtDvuUhW9bJmX2K" },
        ]
      },
      {
        nombre: "V2.- ENTRIES",
        partes: [
          { nombre: "1 - The Need to Set Up Your Entry", id: "1MMZaT3xQTBYdnr1CWSEeWj6EmL2k3Pjh" },
          { nombre: "2 - Turn Their Hips to the Side", id: "1vZBUyiZ2IjScJ__YCNE0W2bjovgs7AoF" },
          { nombre: "3 - Creating a Balled Up Posture", id: "1vRLAIDe0qLfcLfKK2FuYv0urKwKzs5s1" },
          { nombre: "4 - Leg Drag and the Stack", id: "1yT4HEg_gC41kO2JVv3F7zhK-1umJrJQL" },
          { nombre: "5 - Efficacy of Entries from Square Hips", id: "15zRdHPBcWBRkdEMEP4OEZaN2RU1vUZJY" },
          { nombre: "1 - C Grip Leg Drag", id: "1RsBePWZnW9RN0BRWR2fE3xLrXxePomLU" },
          { nombre: "2 - Toreando to Leg Drag", id: "1ca2kPfHG-_nGTvQXpHjOc4--2tVqfkwV" },
          { nombre: "3 - Headquarters or Smash Pass to Leg Drag", id: "1PxehW7mCDRLo__Sxr7Fosoyb3mYVsBDK" },
          { nombre: "4 - Thow-by", id: "1u9k7UEgQ5RxPt-2hyotPio_cQNnEpj25" },
          { nombre: "5 - Toreando Changing Sides", id: "1JHxB5w3f1iCl9t1tOmLbyEYW6s-i_icE" },
          { nombre: "6 - Toreando to Headquarters Leg Drag", id: "13l9_vOuyBgY4UKjrIIdO6Xpph0Z__iQB" },
          { nombre: "7 - C-Grip Changing Sides", id: "1gkz4JeJWvkuyAmCh1XjdN82a6xlaovKJ" },
          { nombre: "8 - Knee Cut to Leg Drag", id: "1V5Gbqnp-acDATkFRL2Ry5T2GwPPC5oNB" },
          { nombre: "9 - Discussing Modifications to the Knee Cut Entry", id: "1I3lqCXMRqmKbE1RIF07h6QLD88-J40x6" },
          { nombre: "10 - Summary of Entries Turning the Hips", id: "1WwsQ_E4dAUAaOqi4OYDnJQ2fIZ0v9Uth" },
          { nombre: "1 - Double Ankle Stack to Leg Drag", id: "1P7Hja-sm5lzHqlcGzHc2QxFXamysOkGP" },
          { nombre: "2 - Forearm Deflect Stack", id: "1TJQVg5FYuk-FD2P1Gsz0wWsgp3q0W7DI" },
          { nombre: "3 - Tire Flip", id: "1aV7ozvDnnxJUzscssd98NFubz46rRfLE" },
          { nombre: "4 - North South to Leg Drag", id: "1mczlVLv1a_iCv2vqX0jBFfXc7aBoDd1H" },
          { nombre: "5 - Turtle and Leg Entries to Leg Drag", id: "1L6J8PmL05_-2ZIhClGuFfGkJVij3F3Hq" },
          { nombre: "6 - Summary - Stacking to Enter the Leg Drag", id: "1Mr6ITQyE4tMZ2QR7YFNFODhzotfKtBvb" },
          { nombre: "1 - 50 50 Entry", id: "1CNdFfZmy84g1_3zDaD1VEN555HhzJrUY" },
          { nombre: "2 - Outside Ashi", id: "1DdLnHySTt_f2cUacttvodP48aLEq-ENy" },
          { nombre: "3 - Crab Ride Gi", id: "1AAarBw1d9qStmWXk6x-gR9t8r08kV9XM" },
          { nombre: "4 - Crab Ride No Gi", id: "1gvFVxw35fWLCiCNsif_dZ1JFP2XhWyzE" },
        ]
      },
      {
        nombre: "V3.- FINISHING THE LEG DRAG",
        partes: [
          { nombre: "1 - Concepts", id: "" },
          { nombre: "1 - Line of the Foot Line of the Knee", id: "1tXfm-STqyY6boV54NsRwdwIJl8u7lpsw" },
          { nombre: "2 - Weight Off the Frames", id: "19Bcs1RWZLZX16SvJv6hKrbmwvN2x-xhN" },
          { nombre: "3 - Keep Them Facing Away", id: "1yY-hm9TzCGt8V4QHDcGBzwN6MeVh3jLE" },
          { nombre: "4 - Weight on Their Shoulder", id: "1eAXgLLIfAJBWnlyYpY7GJkzi56bwPxMS" },
          { nombre: "5 - Line of Foot High Pummel Line of Knee", id: "1fc3XBdgiFSQ2XaGIaMPl2AFEKiYrXDSA" },
          { nombre: "6 - Constant Stacking Pressure", id: "1i3420LLlIVW6XapWVlnogwVfRUmfLgeM" },
          { nombre: "7 - Position of the Trail Leg", id: "1mp3n6MItnHqH_5W9LGfgTPOgvPlNYKKV" },
          { nombre: "8 - Elbows Tight", id: "1ufRQ7Yx3orxCK3UdY7lzwS4vvS1tH3lN" },
          { nombre: "9 - Controlling the Upper Body Before the Pass", id: "1edOgSillDGaBXU7xNdLP788QOH87VPXN" },
          { nombre: "10 - Palms Up", id: "1nfggmCCVTFCbd1ZCPkLH7HkXocoX-Wwb" },
          { nombre: "11 - Summarising the Role of Each Limb", id: "1AgWFvMTBqmWl1ak4IaO0R1R5Itc3kOQ8" },
          { nombre: "12 - Gi vs No-Gi", id: "1Egl-owdSW-oLhJ1Q7wIHlfsrCnqvSjK8" },
          { nombre: "13 - Connect to their Bottom Leg", id: "1Opednm738FhxY7Nu0nv6dJaSnmknztp8" },
          { nombre: "2 - Finishing", id: "" },
          { nombre: "1 - Finishing the Leg Drag Gi", id: "1QEGfgQRFx-V1CZxKZwwg_yInTLtN3U4r" },
          { nombre: "2 - Finishing the Leg Drag No-Gi", id: "1n5ZI7jAKHvUyfFRAB9aWuHIsaLLH8hBe" },
          { nombre: "3 - Winning Upper Body Control", id: "1LjOUoDXU4raldBc-gZgT1jZqBCk0EO7b" },
          { nombre: "", id: "" },
          { nombre: "", id: "" },
          { nombre: "", id: "" },
        ]
      },
      {
        nombre: "V4.- FOLLOW UPS AND TROUBLESHOOTING",
        partes: [
          { nombre: "1 - Following Up with Other Passes", id: "" },
          { nombre: "1 - Follow-Ups", id: "1AuhkhNAte-CEOfe3dmv4gCv2C5XxXm1U" },
          { nombre: "2 - Knee Cut", id: "1GhaZn77VWHhCIM-8-E8M7UA0yrJ4lcAF" },
          { nombre: "3 - Inside Heel Hook Leg Drag Combo", id: "1fwTwNMtd4ph0miSjcTuHJjnYUj-ceeJ8" },
          { nombre: "4 - To North South", id: "1enji92WIvV-kqrcMY_V0GwzftYCIxcFa" },
          { nombre: "2 - Mid Stage Leg Drag Troubleshooting", id: "" },
          { nombre: "2 - Hip Escape Option 2", id: "1_bTDaAUChMO6TLI_pHL-3S3zXQ2zJV10" },
          { nombre: "3 - Hip Escape Option 3", id: "1f7wBLnUu6Gi2pLgtODe0nz8Upf8pzQVG" },
          { nombre: "4 - High Pummel", id: "1Q5pepA17XIWwlKajoWqeZxUFw3MhKlz_" },
          { nombre: "5 - Gangorra Granby Roll", id: "1FNLC09JjHtgj-SYuml85gjHb_6IFDpjG" },
          { nombre: "6 - Hammerdown", id: "1R8-3Ou7kNOX3RyCPgX8uQqVAarv9RwNF" },
          { nombre: "7 - Troubleshooting When the Hips Face Away", id: "1KOCBuESH8vVBliVaOE4kw_KgrYCCDQ1q" },
          { nombre: "8 - They Step on You", id: "1OhwxrZgVizzdtXE47l7DrE60u8aUC9vC" },
          { nombre: "9 - K Guard Entry", id: "1TrV0sSz1VCLlrCzz0dOH29Kpbfn9t4EJ" },
          { nombre: "10 - Mini Pummel to Outside Ashi", id: "1AFBN-YLrMkW3shpeI_5ImSie5wNtsYYj" },
          { nombre: "11 - Back Roll", id: "1Nc1fCxhylkW_ToAjT4n-f_oL6-GOaFOM" },
          { nombre: "3 - End Stage Leg Drag Troubleshooting", id: "" },
          { nombre: "1 - Troubleshooting Their Options", id: "1tXLl1SPGl-kfp72ooKvCl7taNq8qLjp_" },
          { nombre: "2 - Sit Up Escapes", id: "10fVOrU4hiT3GAEnnQ8uXKh64hKlZq-T8" },
          { nombre: "3 - They Hug Your Leg", id: "1cDTmN8uMDNQ4KAEQJO21P4HIMg6iYlQ_" },
          { nombre: "4 - They Hook Your Leg", id: "1VE0tHWt1Dg7x0sssByiLI-XeN5nGyx0R" },
          { nombre: "5 - They Hip Escape", id: "1JMTREvlinOqbBRf4ZZRTFj2QzsFzixMZ" },
        ]
      },
      {
        nombre: "V5.- CONCLUSION AND NARRATED ROLLING",
        partes: [
          { nombre: "1 - Summary of Finishing the Leg Drag", id: "1PLkOEngnqcJVkw5Q4mXfoDNH4XFSRc7q" },
          { nombre: "2 - Drills", id: "1_11ZhEdKDd1P-0j-4-FOIq2ekNNvf5C7" },
          { nombre: "3 - Narrated Rolling By Levi", id: "1ei9xj3P_6jfm1U0ZF1ie_5YDhOACXtT5" },
          { nombre: "4 - Live Clips of Lachlan Using the Leg Drag", id: "11eZcWKEpbzPL9zau8Vcchi2EGs1E-ZrC" },
        ]
      },
    ]
  },
  'Crucifix - Levi Jones-Leary - Submeta': {
    titulo: "CRUCIFIX",
    autor: "Levi Jones-Leary",
    volumenes: [
      {
        id: "1 · Intro to Course",
        nombre: "1 · Intro to Course",
        partes: [
          { nombre: "1. Intro To The Course", id: "1ONEpr-njjaYIaEu-FO7iNmApuSfyrfDV" },
          { nombre: "2. What Will Be Covered", id: "1fqvh-nhDyPbVN0iwZKY-coSLB5XouOCE" },
          { nombre: "", id: "" },
          { nombre: "", id: "" },
        ]
      },
      {
        id: "2 · Entries",
        nombre: "2 · Entries",
        partes: [
          { nombre: "1. Catch Them in Transition", id: "1CkqzUcpkWJzSnhxHByES6ZbIvTjqMIqG" },
          { nombre: "2. Front Headlock to Crucifix", id: "1YlEZJwi80gUxZvz1j738zCayWhA5zv0v" },
          { nombre: "3. From Turtle", id: "1GQj5bBoruIWBBxayOm3VjLLBq5i5G2Wg" },
          { nombre: "4. Side Control", id: "1dweSaaEu_I5VPhTZ7OIQTKn5MDZ3mcJs" },
          { nombre: "5. Side Control - Xanadu", id: "1mkoRppyDMBsIBLFm665BbNicbHQ2buo_" },
          { nombre: "6. From Back Control", id: "1E4EbQRS0iVuOobZe4N3p_wDUrZXykzjQ" },
        ]
      },
      {
        id: "3 · Concepts",
        nombre: "3 · Concepts",
        partes: [
          { nombre: "1. Control Both Shoulders", id: "1anBQRrHwwVYiRymX6yBYCQ-bHNc5ERa5" },
          { nombre: "2. Face Your Hips In", id: "1hIUJgqIlFV2nIefp5woYRQ_8VywuFRkt" },
          { nombre: "3. Staying In The Crucifix Turtle", id: "1Jd07xEO_H3txFKnYA5cfxrYXPmcpfsE3" },
          { nombre: "4. Controlling The Arm With Your Legs", id: "1zub7m0yqCsPU7AVnyQtANbCTYiHEyKs_" },
          { nombre: "5. Seatbelt & Kimura Grips", id: "1jSID9cVjxxX-gUyvb6xdIf6TCAa7e8R6" },
        ]
      },
      {
        id: "4 · Finishes",
        nombre: "4 · Finishes",
        partes: [
          { nombre: "1. Single Hand Choke", id: "1o30WaGWy9GqjwkO0z9H1wH3PNQuK87vy" },
          { nombre: "2. Linking The Single Hand Choke and Reverse Triangle", id: "167-_818GcXiSJwZ2T1Bq83F8IzcABGkG" },
          { nombre: "3. Kimura", id: "1CNlD6qvbpbzYVgt9i_Z4JLFFM93ZVbMn" },
          { nombre: "4. Tarikoplata", id: "1FKvBAN_i_YGTkthWogOevnNuGwc5BDMU" },
          { nombre: "5. Reverse Omoplata", id: "1Itp-SWc_v8BhNZHuRnLMsloov8rtQKpE" },
        ]
      },
      {
        id: "5 · Troubleshooting",
        nombre: "5 · Troubleshooting",
        partes: [
          { nombre: "1. They Free Their Arm From Your Legs", id: "16WOMaYWgBBylBDJ7Op-K3X32gKH_0q95" },
          { nombre: "2. You Lose The Near Arm", id: "1nKnFVxT75MYALL1TjJR4uuVmc2wut7VQ" },
          { nombre: "3. They Square Your Hips Up", id: "1jEUvtNE-OA6PK5G6f6bVURCksa0KBott" },
          { nombre: "4. Their Shoulders Drop To The Mat", id: "1sPMhZnKy1LU7nneY9-LMR4cL2swTR5lj" },
        ]
      },
      {
        id: "6 · Summary & Narrated Rolls",
        nombre: "6 · Summary & Narrated Rolls",
        partes: [
          { nombre: "1. Summary", id: "1zXKtqL1hji_uW-TshGjpkUHAsBFNmSpB" },
          { nombre: "2. Drills", id: "1K1GBMn0QpV0kPTCiktsicJpXCvJD-KF1" },
          { nombre: "3. Narrated Rolling", id: "1xw_wdahgJrWrhi0unDqUcMbyeW3jIai1" },
        ]
      },
    ]
  },
  'OTROS': {
    titulo: "OTROS",
    autor: "Levi Jones-Leary",
    volumenes: [
      {
        id: "VARIOS",
        nombre: "VARIOS",
        partes: [
          { nombre: "Fix My Game With Levi Jones-Leary Berimbolos 101 & Sneaky Shoulder Locks.MP4mp4", id: "1MI8rTG1cwMf4CRctYjOvxRydZ1NrIs4v" },
          { nombre: "Guard Retention for Dummies Course by Levi Jones-Leary", id: "10GOsodW5HCFHYwe_NVRz4cqzN2T4G-Jq" },
          { nombre: "Levi Jones-Leary Teaches His Favorite Berimbolo", id: "1-HGrwbwqgc78DpVbAk_i52OnSC4cp-vC" },
        ]
      },
    ]
  },
  'How To Beat Bigger Guys: Guard': {
    titulo: "How To Beat Bigger Guys: Guard",
    autor: "Bruno Malfacine",
    volumenes: [
      {
        nombre: "Guard 1",
        partes: [
          { nombre: "How To Beat Bigger Guys Guard 1", id: "1H7V8WsAATTWnBx4s1xuUw0jsyU7RubKT" },
        ]
      },
      {
        nombre: "Guard 2",
        partes: [
          { nombre: "How To Beat Bigger Guys Guard 2", id: "1S9bjqY9hNhqS-jK8jkhZ_V1gx3QuVVbS" },
        ]
      },
      {
        nombre: "Guard 3",
        partes: [
          { nombre: "How To Beat Bigger Guys Guard 3", id: "16X-rDiLfXCcQypyC60x6oHuo8pR5GFJq" },
        ]
      },
      {
        nombre: "Guard 4",
        partes: [
          { nombre: "How To Beat Bigger Guys Guard 4", id: "1tHwoUMtNrD8c51XejWdGlJNJmFD0iPP-" },
        ]
      },
    ]
  },
  'How To Beat Bigger Guys: HalfGuard': {
    titulo: "How To Beat Bigger Guys: HalfGuard",
    autor: "Bruno Malfacine",
    volumenes: [
      {
        id: "How To Beat Bigger Guys: HalfGuard 1",
        nombre: "Volumen 1",
        partes: [
          { nombre: "HalfGuard Vol1.mp4", id: "1hy11gDXcx8m62hFVQAiUhcafFFgcunLZ" },
        ]
      },
      {
        id: "How To Beat Bigger Guys: HalfGuard 2",
        nombre: "Volumen 2",
        partes: [
          { nombre: "HalfGuard Vol 2.mp4", id: "10QCGlwak8u41rjWO5mMqpiwavMI1QcBm" },
        ]
      },
      {
        id: "How To Beat Bigger Guys: HalfGuard 3",
        nombre: "Volumen 3",
        partes: [
          { nombre: "HalfGuard Vol 3.mp4", id: "1yP3RvwRSy6FZswBCKKca9b4r5RrrTQJs" },
        ]
      },
      {
        id: "How To Beat Bigger Guys: HalfGuard 4",
        nombre: "Volumen 4",
        partes: [
          { nombre: "HalfGuard Vol 4.mp4", id: "1dP1PDQ_ck27chQh0mGnoHLUoB_jCCCXo" },
        ]
      },
    ]
  },
  'How To Beat Bigger Guys: Open Guard': {
    titulo: "How To Beat Bigger Guys: Open Guard",
    autor: "Bruno Malfacine",
    volumenes: [
      {
        id: "BrunoMalfacinePassingVol1",
        nombre: "BrunoMalfacinePassingVol1.mp4",
        partes: [
          { nombre: "BrunoMalfacinePassingVol1.mp4", id: "1oW6ljHyuBd-YmimhhxRkFIP7weqYaWob" },
        ]
      },
      {
        id: "BrunoMalfacinePassingVol2",
        nombre: "BrunoMalfacinePassingVol2",
        partes: [
          { nombre: "BrunoMalfacinePassingVol2.mp4", id: "1GuvkL-DdaDVuOEglGn8fvmDUwJQV1jGj" },
        ]
      },
      {
        id: "BrunoMalfacinePassingVol3",
        nombre: "BrunoMalfacinePassingVol3",
        partes: [
          { nombre: "BrunoMalfacinePassingVol3.mp4", id: "17rGdCmAorgF9YTcO96qzRCHR496MPqd0" },
        ]
      },
      {
        id: "BrunoMalfacinePassingVol4",
        nombre: "BrunoMalfacinePassingVol4",
        partes: [
          { nombre: "BrunoMalfacinePassingVol4.mp4", id: "1JYuDVRQAAhDwWgQfDbMhCwC0zPBYqZ3X" },
        ]
      },
    ]
  },
  'Buggy Choke The World From Everywhere': {
    titulo: "Buggy Choke The World From Everywhere",
    autor: "Paulo Marmund",
    volumenes: [
      {
        id: "V1",
        nombre: "Volumen 1",
        partes: [
          { nombre: "PauloMarmundVol1", id: "15jN-ahgr-W3zQZqMFbXWS7BbofxpN246" },
        ]
      },
      {
        id: "V1",
        nombre: "Volumen 2",
        partes: [
          { nombre: "PauloMarmundVol2", id: "1uGVDNr3c2UP6EsIvIhxYlE-kp-2scSx3" },
        ]
      },
      {
        id: "V1",
        nombre: "Volumen 3",
        partes: [
          { nombre: "PauloMarmundVol3", id: "1nMsh7-HKDeu9pi1hpxPvb9Jkltua8kVQ" },
        ]
      },
      {
        id: "V1",
        nombre: "Volumen 4",
        partes: [
          { nombre: "PauloMarmundVol4", id: "1zhIpQ9MMKTmqaS9kjFrYL1-Y6BH2rfwC" },
        ]
      },
    ]
  },
  'RICKSON GRACIE ACADEMY': {
    titulo: "RICKSON GRACIE ACADEMY",
    autor: "Gracies",
    volumenes: [
      {
        id: "Weight Distribution",
        nombre: "Weight Distribution",
        partes: [
          { nombre: "01 Weight Distribution, First Lesson", id: "1kQDpLoryPnzYkNBIwH2bH6-gTjqbjoC8" },
          { nombre: "02 Weight Distribution, Second Lesson", id: "1XvqaSlTeXa0lmnl2pGQPjOYtmIvx0kpK" },
          { nombre: "03 Weight Distribution, Third Lesson", id: "16EwGMIHzY-evkia8z1loqD7gipuRadhG" },
          { nombre: "04 Weight Distribution Fourth Class", id: "1Ny19sW_kHXTVck2sg5aNFDLdIA59HJgk" },
          { nombre: "05 Weight Distribution, Fifth Lesson", id: "1U_Wh2Qw9qHCfHhG8yeYbZ9BB70zL2foP" },
          { nombre: "06 Weight Distribution, Sixth Lesson", id: "1Kd27-__w7b9UwpoghMYeYOgsQR1pDx07" },
        ]
      },
      {
        id: "Base",
        nombre: "Base",
        partes: [
          { nombre: "01 BASE lesson one - Introduction", id: "1ed6sDz4ikI3kZO8PG1XnR8gFSVA8BD5r" },
          { nombre: "02 BASE Lesson two - Base and Movement", id: "19HlN9_akcv-xgvAUtMnMOTNCrwbBEbsP" },
          { nombre: "03 BASE lesson three - Action and Reaction", id: "1rBYmezL2kG1P5XePqG93jnpklOUylSre" },
          { nombre: "04 Introduction to Jiu Jitsu", id: "1h-rwAL8Y3XrpTdq4oYTIFf_KbzaA_Tku" },
        ]
      },
      {
        id: "Breathing",
        nombre: "Breathing",
        partes: [
          { nombre: "01 Breathing lesson one", id: "1r7crqO2ak4v-anSs9e-3UFer0zPz3qnu" },
          { nombre: "02 Breathing lesson two", id: "1x-9R33hBjU2OjoytxAIh_7v6hzv3-zN9" },
          { nombre: "03 Breathing Lesson 3 OK", id: "1pZeUCfGG6bc6DexlTpPHG_efgeuIS7SV" },
          { nombre: "04 Breathing Exercises Standing Up", id: "1SNqn6tMfBE4hYig8yD7ZTVBIdzPijNsC" },
          { nombre: "05 Breathing Exercises on the ground", id: "1LSf48H-h-QYB_rws9YuyejQcK8etOjOT" },
        ]
      },
      {
        id: "Connection",
        nombre: "Connection",
        partes: [
          { nombre: "01 CONNECTION First Lesson", id: "12622G_kzFDs7wR6Zpvc_kDtLG4uTlFJ8" },
          { nombre: "02 Connection, Second Lesson", id: "1T22Jw44cqH0RBOYGwRVBaAP1iqtSK3a5" },
          { nombre: "03 Connection,Third Lesson", id: "1sC5ZvDWg-SvFhMstgpTsoARZzX4JmCWu" },
          { nombre: "04 Connection, Fourth Lesson", id: "1muF8RD-yB1ogbcVnbzuCVZsqhcMzVXFY" },
          { nombre: "05 Connection, Fifth Lesson", id: "1JVN-Th-SN7M5YI4TUbVw1M4ylPLMFFan" },
          { nombre: "06 Connection, Sixth Lesson", id: "1hi_u3iiaKH18164p79O6c8x7r5n1HwCe" },
          { nombre: "07 Connection, Seventh Lesson", id: "1WB2yfM8HfpfL09I7Cv9nBN1MIZ8WMVE8" },
          { nombre: "08 Connection, Eighth Lesson", id: "104d3oex9J0Z0Jb4DXZC8QFWJIx3S7sYJ" },
          { nombre: "09 Connection, Ninth Lesson", id: "1pmNPsWeyG4dhdmsqNxGKPEUTN45hDSAK" },
          { nombre: "10 Connection, Tenth Lesson", id: "1jV2lJDMkDYPut2APlchURlOwzJOS_dMH" },
        ]
      },
      {
        id: "Empowerment",
        nombre: "Empowerment",
        partes: [
          { nombre: "01 Empowerment Base 1.0", id: "1o_f5pe1R7OgPiz7Nuh_UPbnHT67dXVcA" },
          { nombre: "02 Empowerment Striking 1.0", id: "1X-X3j5D-uR5cgo68kmNrZIdHDdyD7c0a" },
          { nombre: "03 Empowerment Core 1", id: "1fMqh1MG1aVzTZj5I179dzZjgLuYG_XSa" },
          { nombre: "04 Empowerment Circuit 1.0", id: "1jlJfgEs6PBTgz7r6EkFi0pQRaQnuwjQZ" },
          { nombre: "05 Empowerment BASE 2.0", id: "1oaUqfsdT-yPEdUvkiQu9G9YZ6k-XHAce" },
          { nombre: "06 Empowerment BASE 2.1", id: "1hKB7IrLUfnbgQ9NtgSApzoB11A13yQk7" },
          { nombre: "07 Empowerment Pocket Knife", id: "1onELrcOMkOFhNJhdV2daf82KMr_nSqrS" },
          { nombre: "08 Empowerment Remark", id: "1vPOLq4065E7fE9zKUF1jhqsFCe52ZtG3" },
          { nombre: "09 Empowerment Tools", id: "1jesJzwAF8UBmqF0Pv9LMDocf1Ww-RHXO" },
          { nombre: "10 Empowerment Takedown 10", id: "1b4-58JPbhY9mApUYnhl_-XpG9aHe1C4n" },
          { nombre: "11 Empowerment Resistance Band", id: "1Y-c8Gtrnm0YMQx8vvUXyXYs_25b743sc" },
          { nombre: "12 Empowerment Striking 20", id: "12EFKQFbilDkUBWJlFCG4d5iu3u-5s2g1" },
          { nombre: "13 Empowerment BASE 3.0", id: "1hIlOb6TaIzGYfBddojiRcAFV6pwO7Y7P" },
          { nombre: "14 Empowerment Neck 10", id: "16r0qw2cZ43IJZRlBiYK15PeGsXbTeQix" },
          { nombre: "15 Empowerment Takedown 2.0", id: "1W0GvkCY76MQIHgxHTne0uNyvnN1fjRIM" },
          { nombre: "16 Empowerment BASE 4.0", id: "1X0iTNe5AH7ifmaq3H6kBAfMh70J6iRyQ" },
          { nombre: "17 Empowerment Blocking 1.0", id: "1Oo0mJPKMFIrbGbzqxBRWpxraIhWwcLU5" },
          { nombre: "18 Empowerment Base 5.0", id: "15dKsHxad2sGSZYhv-vlqKTDxWT5jcYEV" },
          { nombre: "19 Empowerment Core 2", id: "1i2VmyFOwyxDK6t-D8vHqfDXPuNnfpCQU" },
          { nombre: "20 Empowerment Striking 3.0", id: "168dHhgqx87fYeMsOW_kVgekQueVZWexW" },
          { nombre: "21 Empowerment breathing", id: "1VqpSedAkDduVG9WLL9lQX9vAY5hl2gpT" },
          { nombre: "22 Empowerment Striking 40", id: "1HchRjvvvQrHM-mUA6QyuPvLLUC8iomA7" },
          { nombre: "23 Empowerment Neck 20", id: "1deu5TjRhmpWeKjwUVJTqHTWJigiN3XsW" },
          { nombre: "24 Empowerment Striking 5.0", id: "1_DaEsv2gPEIfuDMRg-B15CIsP-nGOStQ" },
          { nombre: "25 Empowerment Base 6.0", id: "1jWqLPnJFj9Azhz3byGLLpxF-MIQbklnc" },
          { nombre: "26 Empowerment Base 6.1", id: "1Zq5sGYv8grlXgz9sDsWOcsprMjxGfEYk" },
          { nombre: "27 Empowerment Breathing 2.0", id: "1sNvcVaYK60RJzQnHfRUCBhb5ETiOAHv9" },
          { nombre: "28 Empowerment Striking 5.1", id: "1-IOxyNBLK37mhf9m20Fj1p8yMC_00egg" },
          { nombre: "29 Empowerment Base 7.0", id: "1WZq2k4pIqE_lcpi5aIrfg0jTSNPizFl1" },
          { nombre: "30 Empowerment Tug of War", id: "1Vdkl24NCELLqzpC27esS9-iJS1W2L0Ln" },
          { nombre: "31 Empowerment Blockin 2.0", id: "16sk94HQ5Q5rNLbTFMiGGywYgbbx_Vv-_" },
          { nombre: "32 TRX", id: "1DZlNX1Kb0raEulSKrOcqYnraiFBroxCm" },
          { nombre: "33 Empowerment Bear Hug", id: "1BWbxBOGbjh04fnEzgBZ7NUPhq-O5W8bn" },
          { nombre: "34 Empowerment Base 7.1", id: "1jWglXgxWAtZCLEPm9T18UALOzayvlOu5" },
          { nombre: "35 Mobility 01", id: "10FtCjx1mHaUgLKsrECrEl7PLNXlXTsZP" },
          { nombre: "36 Mobility 02", id: "1spscDRdub2GXfqb0rpbHHm5Vex2tMOEX" },
          { nombre: "37 Mobility 03", id: "17KOQFxfA_5ZVtWviBc7tNEOfBJ7mZTst" },
          { nombre: "38 Mobility 04", id: "1Ddlls_O_hAz3ol3H5kl1doHehPdltZmA" },
          { nombre: "39 Mobility 05", id: "1g08040qgwcehqNYdWJcLav61QG6o6bLR" },
          { nombre: "40 Mobility 06", id: "1J6MACZFrCgOv5X7XOO_d54uU9kRp1KVc" },
          { nombre: "41 Mobility 07", id: "1x8Fe8s0oE7VjDRFCqRFGcsZAX1IdPe8G" },
          { nombre: "42 Mobility 08", id: "1dvxHZmgbGZqWnn90MlsJfJ9MrGeb0NHO" },
          { nombre: "43 Mobility 09", id: "1dCOO4B7Pn0-DjYWN3fYtvZ0JFbXJVRR9" },
          { nombre: "44 Mobility 10", id: "1QYdDas6mQ3aP3Ro5k7w2rds2U_um-X7F" },
        ]
      },
      {
        id: "Fundamentals",
        nombre: "Fundamentals",
        partes: [
          { nombre: "01 Fundamentals, First Lesson", id: "115UmQU1QtEsQefTMwUOm7X146g6o-zwo" },
          { nombre: "02 Fundamentals, Second Lesson", id: "1AeYA9nYQzCr0UHFN7WOmPBZz1gqeU94b" },
          { nombre: "03 Fundamentals, Third Lesson", id: "1bG7eL2SJNxvcale8NSCXSNFNlbSkZqgg" },
          { nombre: "04 Fundamentals, Fourth Lesson", id: "1DdqGEEKxYqBDZUG2k6GZl4G7T9ym494y" },
          { nombre: "05 Fundamentals, Fifth Lesson", id: "1K88luZhHr0oDcxjMRrDMHv269hej_z9O" },
          { nombre: "06 Master''s Tip Guard Part One", id: "1PULyFc3_gNk1Ol9P6xEfmOKAAKXHdee-" },
          { nombre: "07 Master''s Tip Guard part 2", id: "19rWsI3Hk59zqC6_0NcFROuZwVgN3pi0k" },
          { nombre: "08 Master''s Tip Guard part 3", id: "1mpCYv067nVoNFi8LuAtxNrT35W6WNqyd" },
          { nombre: "09 Master''s Tip Guard part 4", id: "1I6JK6OAjuS_lwQMHDR0pTEOMt6RKoA7r" },
          { nombre: "10 V01 Warm up in base", id: "1cOFfTasb_7gFUAskpfNVwwOMVCRn-Mjp" },
          { nombre: "11 V02 Take down", id: "1kWkGtQPthxI2zHP_j0ZK8ICjAjTyIfop" },
          { nombre: "12 V03 Take down progression", id: "1ptIhetKe3I-IqYWwp7kT-Xghr50dQ2Gs" },
          { nombre: "13 V04 Strike against the wall", id: "1cqEkHqkTu0M6Qwe2TDKy6mrLBCM0APcZ" },
          { nombre: "14 V05 Mount", id: "1LGI14yNpkdIQnVnON9k2Wn1oWti2b_jU" },
          { nombre: "15 V06 Mount Drill to take the back", id: "1l_4hmnxs4m-6LEwI5RNaFCH3QsiwFz9h" },
          { nombre: "16 V07 Side kick defensive", id: "1NB-aAIdDlv-MkLDClw9xefjZzgefLRvf" },
          { nombre: "17 V08 Side kick offensive", id: "12YGbrtQA6sieEtQLiF8LBXTPY1IWGOO6" },
          { nombre: "18 V09 Clingh, base and take down", id: "1hrmUqGy_KcrJtrtsSXiVr_H1R78QO93-" },
          { nombre: "19 V10 Upa and hip escape", id: "1dHQnf37D-IqmW8n1Iu7K878-4R9n8xm8" },
        ]
      },
      {
        id: "Masters Tips",
        nombre: "Masters Tips",
        partes: [
          { nombre: "01 How to tape and ice your injuries – part 1", id: "1_YED0rI-zVJSrjDJxen93sFiQaoPZQoU" },
          { nombre: "02 How to tape and ice your injuries – part 2", id: "1iPbsSaMpyE21WsSh0F0btpMgAN2383-R" },
          { nombre: "03 Master Tip - How to proceed in your practice", id: "1Di7F7tXZDpm61XTyScQM-pCVaBeenFEN" },
          { nombre: "04 Mater Tip - Connection in the guard", id: "1qidAQtE7vS6SZ1UnGj-lVjf9oP-r8x45" },
          { nombre: "05 Being comfortable in an uncomfortable situation - Mount", id: "1L96qG081lB5YkGIaxNVgTqGxkBJmm3-1" },
          { nombre: "06 Masters Tip Side Control", id: "1kcLk36ZA4-MCjTNLUMp20uJDHDUxB2CQ" },
          { nombre: "07 Masters Tip - Guard top position", id: "1Z8iJzdMxDqXZ3TlGzqVc4HJ6EFG-fZCU" },
          { nombre: "08 Masters Tip - Guard Bottom Position", id: "194PTNNGoa2jbVK7YqyrVK-bMhsrQ3yq9" },
          { nombre: "09 Masters Tip Back", id: "1E1ZFhYjSxqsU35Vnk2WajsbU3hKbDShX" },
          { nombre: "10 Tips knee on the belly", id: "1nZdmvkHpTNpEoC-fOAglMV8ARtXwvUmY" },
          { nombre: "11 Tips - armbar release", id: "1YpUugNm68oycvYMmnaoeKCuklQ6EYAhJ" },
          { nombre: "12 Tips - Choke from the guard", id: "1zDivsNTezd-mLIuEyokXgu0X-Yz9vRtE" },
          { nombre: "13 Being comfortable under pressure - cross side sholdwer pressure", id: "1yB3o4ZaQFerelKDJg7iR_w6FZolsUiqj" },
          { nombre: "14 Tips head lock 1", id: "1_6W4r0wpKoqf5gAV77ejStoN3idVVq7X" },
          { nombre: "15 Tips head lock 2", id: "12f-B-vlLZUoz3jf4ENdMnvDDsc7Po_GO" },
          { nombre: "16 Tips head lock 3", id: "1RWtZjjtItj7whzYi5FZtxmLJKHeYDw4k" },
          { nombre: "17 Tips americanas Warning chapter one", id: "13O_7zRXwhDr3-nFSC9hX_m9mFAFGLjrz" },
          { nombre: "18 Tips americanas chapter two", id: "1243igiVr8LKJjGTbQwrfXRhZt_oDKshU" },
          { nombre: "19 Tips americana chapter three", id: "1nekFKkUUsdO6c7Smu3kl678FSpDnNYSH" },
        ]
      },
      {
        id: "Self Defense Unit",
        nombre: "Self Defense Unit",
        partes: [
          { nombre: "01 Intro 01 Introduction from rickson.academy", id: "1mQxgSQPaYxVbVIgAdZ8I73AnUg7iLDbc" },
          { nombre: "02 Guide 02 How to Practice", id: "1bv7OQil_emZ6xnpBh92L6Xhrfy3phdgX" },
          { nombre: "03 BASE HD", id: "1diYVqKTuQyWSVBIUhn8CEIVBy32Klwj0" },
          { nombre: "04 Base 02 beyond the mats", id: "1wFdebXu1m8pH8cx4imIgrA0M_uR0Hv0W" },
          { nombre: "05 TWO HAND CHOKE OK", id: "1y28KYBvHkX31d5YrXgicFJcRD1T-Mk1x" },
          { nombre: "06 UPA ESCAPE OK", id: "1iJ7gd4np5dQyXcWa6t0FMM2v9C_ONx9G" },
          { nombre: "07 Enter The Weapons", id: "1yD1F9y8bgFPIm54aJwFLQY0QqpXg5Ell" },
          { nombre: "08 Developing the fundamentals through Self Defense", id: "1r37hnKsb1_7vkNNma9Q4k04hPuuR2DOg" },
          { nombre: "09 Knife Defense, underhand", id: "11-sU6jl62dvdSwtVd8k6GiQ5EpCZfmWb" },
          { nombre: "10 Club defense, overhead, close range", id: "11bqS5YbNGxdAU6gXVD6IfoIhREYgyFMg" },
          { nombre: "11 Headlock defense, attacker bent over", id: "1_vvN6eQfu11bfGZMFzfdxoLgVp4LiXA0" },
          { nombre: "12 Side headlock escape using hook and arm frame", id: "109hfSAV6ut72gJjhUHrSKx8KiOkMQo9O" },
          { nombre: "13 Finger pointing threat or single-hand neck grab defense", id: "1ZaVwewLDpl9KPfU1N8rBzTpujsrnJHKG" },
          { nombre: "14 Front bear hug over arms defense", id: "1_pk97CgsJ7978RjmGGXBNiJwnAfdmzFv" },
          { nombre: "15 Single-hand collar grab and chest-push defense, wrist fold", id: "1uVLoAJFhziLcMmDjgtV-LXzo5oJYPb-H" },
          { nombre: "16 Sucker punch, slap defense", id: "1t3XurAAvILuX9Y3U6O2ZI4wTuuyZRGQo" },
          { nombre: "17 Straight armlock and elbow lock from side mount", id: "1DxJAVupDBpQdfLVEuOO1qQHQTFFrlbA6" },
          { nombre: "18 Straight ankle lock", id: "1S46ySDKqftrtlWkAU6y6FX9Uk5c4Hpwr" },
          { nombre: "19 Technical stand up", id: "1vPm5wHkCnY8a7SbmnQ_JfVah5U6ksyKo" },
          { nombre: "20 Ankle sweep from the guard", id: "1FN_vBwQmIWpp-xdjiZlCV-yIW9YTrt-s" },
          { nombre: "21 Armlock belly down", id: "1SwNgEugrRV5TdvjNg9WKzmmG0Cuvv9M6" },
          { nombre: "22 Escaping the elbow pressure", id: "1Y5BVTYgh3lEQZ3n227ZUQZ6On7dusjE3" },
          { nombre: "23 Choke from the mount", id: "1_D-HcJu3hHMa_7f_oCqkAFcbKhktKjsF" },
          { nombre: "24 SCISSOR SWEEP", id: "1g8dJwX6Q6ZBPqETPCKmAKu6cFmrzNjA_" },
          { nombre: "25 Chest Push Defense", id: "1IngLKunTIb_9-Fq9vkbkljrUy2yZ4CWu" },
          { nombre: "26 Kimura from north south", id: "1DtDmakNWgI7QnDSY_lMPBNeNCNz3HdEJ" },
          { nombre: "27 Wrist Grip", id: "1LmpHrjwL2Vx8vapXF9sNGTCzP4we0nvI" },
          { nombre: "28 Toe hold", id: "1xGaq3k5oPo6UWFvMFVRmX8HgTx09zLBy" },
          { nombre: "29 Spin armbar from side control", id: "14_mncI5a69s13XwO9T3HoSRUufoTMJvM" },
          { nombre: "30 Side headlock escape arm trapped", id: "1AzVyk9dGyoSDMMh_ZHzvZn3mJ5of0ZC9" },
          { nombre: "31 AMERICANA FROM MOUNT", id: "19ODo-Aa81tuIbcayR7ZQODBHY3JI4V5l" },
        ]
      },
      {
        id: "Strategy",
        nombre: "Strategy",
        partes: [
          { nombre: "01 Strategy Part One", id: "1DLTIGrM-ymVbOxMi_gYOV9GcDxGOuQIr" },
          { nombre: "02 Strategy Part Two", id: "1rmlLJuMUorPqIfuweiTRbrlQDjftAe4B" },
          { nombre: "03 Strategy Bonus", id: "1j20omGPigW1Pej5D0ETNghiIbue7dekm" },
        ]
      },
      {
        id: "Timing",
        nombre: "Timing",
        partes: [
          { nombre: "01 Timing, First Lesson", id: "1Uvg7TNu-5XYRnbQ1UnYMFIFu92VJuuWF" },
          { nombre: "02 Timing, Second Lesson", id: "1yUrKeb8IQ89Zigwmc27_z4wJ_BMyDvTt" },
        ]
      },
    ]
  },
  'Jiu-Jitsu For Old Guys': {
    titulo: "Jiu-Jitsu For Old Guys",
    autor: "Bernardo Faria",
    volumenes: [
      {
        id: "Jiu-JitsuForOldGuys",
        nombre: "Volumen 1",
        partes: [
          { nombre: "Over-Under Pressure Passing System 1", id: "1Xi-QRE9ikmIfYR62x3MBMlLudXprpc28" },
          { nombre: "Over-Under Pressure Passing System 2", id: "1QPTnEMHHLdPSjppTo-aGpAO0rI0ulcJm" },
          { nombre: "Over-Under Pressure Passing System 3", id: "1xSjnycwk-o2b68rXoQAOmid76LviFv60" },
          { nombre: "Over-Under Pressure Passing System 4", id: "1A_rSrMLTiNvj_6GrS3QI1ax7t71o_4sE" },
        ]
      },
    ]
  },
  'Mastering The Twister': {
    titulo: "Mastering The Twister",
    autor: "Eddie Bravo",
    volumenes: [
      {
        id: "Mastering the Twister Eddie Bravo",
        nombre: "Mastering the Twister",
        partes: [
          { nombre: "Mastering The Twister", id: "1fynP5-iG_yjInzoXHyNHC31K1aiQ__IB" },
        ]
      },
      {
        id: "The Twister Eddie Bravo - The Movie",
        nombre: "The Twister the movie",
        partes: [
          { nombre: "Eddie Bravo - The Twister", id: "1XFT2f9IYXZmupL-RCbX13rrNl_Qdf76-" },]
      },
    ]
  },
  'LOCK DOWN': {
    titulo: "titulo",
    autor: "Eddie Bravo",
    volumenes: [
      {
        id: "LOCKDOWN",
        nombre: "THE LOTUS LOCKDOWN",
        partes: [
          { nombre: "the lotus lockdown", id: "1CfCfeSH4qsr8rFFumHn9jTms1AxZBiup" },
        ]
      },
    ]
  },
  'The RubberGuard': {
    titulo: "titulo",
    autor: "Eddie Bravo",
    volumenes: [
      {
        id: "Mastering the Rubber Guard",
        nombre: "Mastering the Rubber Guard",
        partes: [
          { nombre: "Mastering the Rubber Guard-Eddie Bravo-Disc 1", id: "1vgrPZTpOpdR7K_LlHZTvu3kmvhRidSFG" },
          { nombre: "Mastering the Rubber Guard-Eddie Bravo-Disc 2", id: "1EOU8ukzp8xtCyJJMWnwWLvRwO8_FKw-a" },
          { nombre: "Mastering the Rubber Guard-Eddie Bravo-Disc 3", id: "1pZ08D2RwEiaWke-RIupZMaN6rx4l5spG" },
        ]
      },
      {
        id: "The Ultimate Rubber Guard",
        nombre: "The Ultimate Rubber Guard",
        partes: [
          { nombre: "The Ultimate Rubber Guard by Eddie Bravo Vol 1", id: "16Zsv89uPzdZtwWnbXzr7Iysnu6SdSesv" },
          { nombre: "The Ultimate Rubber Guard by Eddie Bravo Vol 2", id: "1g0_sCsIng7vuqroliiJlrOw6XXrBMGbg" },
          { nombre: "The Ultimate Rubber Guard by Eddie Bravo Vol 3", id: "1BQ-PoXLRWbg_RTo85nzHH8FZqS4Zz6pu" },
          { nombre: "The Ultimate Rubber Guard by Eddie Bravo Vol 4", id: "1Vg-cOCanUItnKjyDFOlxtRHXj_5HNLKN" },
        ]
      },
    ]
  },
  'Other': {
    titulo: "Getting Swole as A Grappler by Gordon Ryan",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "Getting Swole as A Grappler",
        nombre: "Getting Swole as A Grappler",
        partes: [
          { nombre: "Getting Swole as A Grappler Vol 1", id: "1SaVx-ryeLwOusMs1jcIMXdoeOWX2h_bq" },
          { nombre: "Getting Swole as A Grappler Vol 2", id: "1lV1Ct9JYkTyMrdnSJ1d8v-j2JC032c-7" },
          { nombre: "Getting Swole as A Grappler Vol 3", id: "1EbKEufRu7F7VTq63LSYP8TmfRfkhgzf6" },
        ]
      },
      {
        id: "The Sport of Kings High Performance Mindset For Grappling",
        nombre: "The Sport of Kings High Performance Mindset For Grappling",
        partes: [
          { nombre: "High Performance Mindset Vol.1", id: "1_f_WXLhZHyvcyDPEtVrDs8iHl7sG1Bct" },
          { nombre: "High Performance Mindset Vol.2", id: "1bnm7UCYfHvEgluPlkRVd8I8dvgQezHgQ" },
          { nombre: "High Performance Mindset Vol.3", id: "18UyyR_kWZJgYlVAKUedEGBVSU1rtWQXe" },
          { nombre: "High Performance Mindset Vol.4", id: "1PYLGOOyVapEZIa0vKrd4DP1eEMfacg8n" },
        ]
      },
    ]
  },

  'Passing': {
    titulo: "Passing",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "High Percentage Gi Passes",
        nombre: "High Percentage Gi Passes",
        partes: [
          { nombre: "HighPercentageGiPassesbyGordonRyan1", id: "1L_kc2LkzXX58un8o8vIGQurBbpzDdTDa" },
          { nombre: "HighPercentageGiPassesbyGordonRyan2", id: "1ZnYClGCu9EH2zGZIOkHR_zSGdK_TAL32" },
        ]
      },
      {
        id: "They Shall Not Pass",
        nombre: "They Shall Not Pass",
        partes: [
          { nombre: "They Shall Not Pass 1", id: "1de1ium51sxKz8uI-GajEzADc6j2Cmstw" },
          { nombre: "They Shall Not Pass 2", id: "1H2yHW7fxrEJyv6Px_26ztB0dAKsIOJiE" },
          { nombre: "They Shall Not Pass 3", id: "1bLwMgjN82n1Zbs0SEMsQPLp_JcOR12v2" },
          { nombre: "They Shall Not Pass 4", id: "1EMgPzVRcvBHck-5dzniA4VbuO_40Ui_X" },
          { nombre: "They Shall Not Pass 5", id: "1Wv64gw97taXHPrgBAanLTQoyoENMjoTJ" },
          { nombre: "They Shall Not Pass 6", id: "1Awao58gC0KT1uyAyJov3c_aP9ztcgmRf" },
          { nombre: "They Shall Not Pass 7", id: "15FFdt6sDWHPW-W79tsT6b4-v6VNoBK43" },
          { nombre: "They Shall Not Pass 8", id: "1zXq_mjiSh_cfN56lYj5xi-XdvuWioEUt" },
          { nombre: "They Shall Not Pass Cover 1.jpg", id: "1hKFBGhyhAYWUwimyr5mtmc2LsWzRZmw5" },
          { nombre: "They Shall Not Pass Cover 2.jpg", id: "1T4UQFaGsfPJ_m3Lw3v0Jo76_SKDGDYzM" },
          { nombre: "They Shall Not Pass Cover 3.jpg", id: "ID_NO_ENCONTRADO" },
        ]
      },
    ]
  },
  'Pillars Of Defense': {
    titulo: "Pillars Of Defense",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "The Pillars Of Defense_ Back Escapes By Gordon Ryan",
        nombre: "Back Escapes",
        partes: [
          { nombre: "1. Systematically Escaping the Back", id: "1cbyL-r4iJK5nxIjNNwDQksu4rQtXxi4I" },
          { nombre: "2. Systematically Escaping the Back", id: "1-hCqKKI0mkHXgue0ASZG0t6Zp8_-yfXl" },
          { nombre: "3. Systematically Escaping the Back", id: "16aa4j9hFP0LKtWVPKIH-1Ul6MDm__KVO" },
          { nombre: "4. Systematically Escaping the Back", id: "1cOXdfXR7eUzYzQlYff4kEEDH7ti1v2cW" },
          { nombre: "5. Systematically Escaping the Back", id: "1qqFksD0XzaAjO1hqB52Fvjfmss0PJS_5" },
          { nombre: "6. Systematically Escaping the Back", id: "1bBjgjJ0kQXvYXrsF7dxa833JnGLSJGKP" },
          { nombre: "7. Systematically Escaping the Back", id: "1hum4OKeAX24w915E5yppQok4mF1BIJlS" },
          { nombre: "8. Systematically Escaping the Back", id: "1-IU84m-gzbR1TMgCXLJiPnnd_aBHXE33" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Leg Lock Escapes And Counter Locks By Gordon Ryan",
        nombre: "Leg Lock Escapes And Counter Locks",
        partes: [
          { nombre: "LegLock Escapes and CounterLocks 1", id: "14Gi_UfOiu-ezpPi3UJbzgDcdf2I64aQS" },
          { nombre: "LegLock Escapes and CounterLocks 2", id: "1FzcNv96plpkoRfcktWdi7YqA4zvMlCPM" },
          { nombre: "LegLock Escapes and CounterLocks 3", id: "1cH-LeMAQF0jft0eRPtCB7hYGv0NkCAeT" },
          { nombre: "LegLock Escapes and CounterLocks 4", id: "1_qS4YQmqSpz-YDdjafQinzHAAHD-ljGB" },
          { nombre: "LegLock Escapes and CounterLocks 5", id: "1WZfsssanZXZEu9tlNX4p6c0i2M2vo_I2" },
          { nombre: "LegLock Escapes and CounterLocks 6", id: "1iIe9ORSZHSFWMRSOHmz5qPDxZSG-Mh3T" },
          { nombre: "LegLock Escapes and CounterLocks 7", id: "1UbY0rT_0pSwFg4_woPf0UWiy_KQ9jHqa" },
          { nombre: "LegLock Escapes and CounterLocks 8", id: "1NJqBdwoWzgLxf1N5hMR7wC92Dr3sjjiW" },
          { nombre: "LegLock Escapes and CounterLocks 9", id: "1AdqvyxD3fPr8ehkOixSFTCSyhnBDS7_q" },
          { nombre: "LegLock Escapes and CounterLocks 10", id: "1o03s3RVXqspTPbWMxnIggPju78CCU3UL" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Leg Locks To Back Takes By Gordon Ryan",
        nombre: "Leg Locks To Back Takes",
        partes: [
          { nombre: "Leg Locks To Back Takes 1", id: "1cwTU9po2-_r5VHZTFqCxU7l00x6DWIqC" },
          { nombre: "Leg Locks To Back Takes 2", id: "1-a00Hcs2Iqy0gTcNSJZ9frin47U3WK1V" },
          { nombre: "Leg Locks To Back Takes 3", id: "11t_5r0vnCtc-1oYX7SjKlqnsPjCNECSl" },
          { nombre: "Leg Locks To Back Takes 4", id: "1uhJB6yVTKvx7E_1RYBRxsgngVmJN2wtv" },
          { nombre: "Leg Locks To Back Takes 5", id: "1MQ-_8yhX33A81u1o4rFQTfeQ5wP4oiQA" },
          { nombre: "Leg Locks To Back Takes 6", id: "1SH7y_Mi9zIAI66N20EVJWRCa_GPSAGiq" },
          { nombre: "Leg Locks To Back Takes 7", id: "1eKCjULxamXT-j-x5TL6TWuD6DuIRevkm" },
          { nombre: "Leg Locks To Back Takes 8", id: "1lTOtlNqQV75jta1yb-hJKKFk6K0QWYLX" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Leg Locks To Guard Passing By Gordon Ryan",
        nombre: "Leg Locks To Guard Passing",
        partes: [
          { nombre: "Leg Locks To Guard Passing Vol 1", id: "1CNNZ5fKfhA5PVdaxQfdNgJJXe4EZNBte" },
          { nombre: "Leg Locks To Guard Passing Vol 2", id: "1FHhV0IsuP9oYCRUzsb0HLIeh-SJH3lup" },
          { nombre: "Leg Locks To Guard Passing Vol 3", id: "1RQio8YwbEv3sRpBRYwgs0ACQPwt0b9BF" },
          { nombre: "Leg Locks To Guard Passing Vol 4", id: "1UUEBvMt9ajVwvQOVzcm-_OvYmAUNsfZO" },
          { nombre: "Leg Locks To Guard Passing Vol 5", id: "1uxVJFqd0Zoj4ezqHUTCsKeLa6kL54I9H" },
          { nombre: "Leg Locks To Guard Passing Vol 6", id: "18i1Qsu2iVrATAoYMfBPg4gVYUn0fdr3N" },
          { nombre: "Leg Locks To Guard Passing Vol 7", id: "17x1AiRndlPm-KzNp8DJAT67QzsuGnLoq" },
          { nombre: "Leg Locks To Guard Passing Vol 8", id: "1HNQhiEiEd54wBdhkZJnkfJw0OB3gftrt" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Pin Escapes - Defensive To Offensive Cycles By Gordon Ryan",
        nombre: "Pin Escapes - Defensive To Offensive Cycles",
        partes: [
          { nombre: "Part 1", id: "1Ca4Ys2EfoLr3xOe8-J1wGwenmecUhEIu" },
          { nombre: "Part 2", id: "1_oA37cWlitHyISyUa0TDy8RhXRVbPu0K" },
          { nombre: "Part 3", id: "1E0WLqz6azpFrs3ZVuOdRC5XG4qzerAXJ" },
          { nombre: "Part 4", id: "1GqfxAPglyATJD4BduHtRYJam3GGFuDGv" },
          { nombre: "Part 5", id: "1OlaVLV0Fq-quQEmEeBVwvH3AiWD-LZE8" },
          { nombre: "Part 6", id: "1boqCP_jmREFAm43ahLxuv4Y1i0GVYFCM" },
          { nombre: "Part 7", id: "1PE8E8IUFC6YRl2PtaJ8hl4naGu0i7WX9" },
          { nombre: "Part 8", id: "1iTH4jkvfadG-jMeTsRvIIy2Wnz1y0zCV" },
          { nombre: "Part 9", id: "1elieqsZgBBiuqp_CRjWecH21foPL8xZR" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Strangle Escapes By Gordon Ryan",
        nombre: "Strangle Escapes",
        partes: [
          { nombre: "Part 1", id: "10YkMhuXJSVqprqOxpnfvp0uJAtllzTvD" },
          { nombre: "Part 2", id: "1m187LjWlAU1RRhJhHN7Gu0cSRIEvnG9p" },
          { nombre: "Part 3", id: "12asZLdbU-NxkeOuLFo5b7PoZtGn2ANar" },
          { nombre: "Part 4", id: "1QJlat7ZJ_CujIVSDYQyvAATXrqxi2fXe" },
          { nombre: "Part 5", id: "1SATmZV0yhbPeeSoaZuND5wUUiSfsl7m1" },
          { nombre: "Part 6", id: "1iZsdEM1ol5CMaxNuGOcCpW5P2qwoi9ri" },
          { nombre: "Part 7", id: "1opjZ6gqMkINb_lXdcKYgEyhrBVaQRQic" },
          { nombre: "Part 8", id: "13M1Z4WI21-11dAP_AJSBh25lM6Oq_orK" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Turtle & Front Headlock Escapes By Gordon Ryan",
        nombre: "Turtle & Front Headlock Escapes",
        partes: [
          { nombre: "Part 1", id: "1tb5O1ApmOgKlA1yGhdsdWeAtuh1-NPAF" },
          { nombre: "Part 2", id: "1oDwtKwjWn7XPwe8AA1Mhix9R7CMwGP6C" },
          { nombre: "Part 3", id: "1183PZasagaSuRoavX2PRc65cWA0CHM1g" },
          { nombre: "Part 4", id: "1hnTgUz5Xob8YS7xRwZZ3fCnHCu3ixuzz" },
          { nombre: "Part 5", id: "1QpgdM_iBuJm5nOZBIVnpJXRbhvbbKUSh" },
          { nombre: "Part 6", id: "1afyf_iG-ZzpRsiZ53TlPsqnsw6MsHoWa" },
          { nombre: "Part 7", id: "1ErEoSJyISHimpZXP2hZVkMvUHwS5l2Os" },
          { nombre: "Part 8", id: "1Pbp_InSQu6ejRZJT2l8NYF9lASL9HkWP" },
        ]
      },
      {
        id: "The Pillars Of Defense_ Upper Body Joint Lock Escapes By Gordon Ryan",
        nombre: "Upper Body Joint Lock Escapes",
        partes: [
          { nombre: "Part 1", id: "1ZGFXehajT4qGdW3at_OPjXJbfqARxcWs" },
          { nombre: "Part 2", id: "1HeLY9j37uhcowQgb6_wp9cOcJIEZ6O_d" },
          { nombre: "Part 3", id: "1KqlRh8-rJ_xFWLbGLST-RNLarEHnvsdf" },
          { nombre: "Part 4", id: "1emHtbsD0PbgKmytsjvalClSml0fZJz_7" },
          { nombre: "Part 5", id: "1MZufR9uS7-1cfeZXKrKAGk0TAf9hv2VC" },
          { nombre: "Part 6", id: "1v8nlqX0oUsSWWppIMDceJzwp9VIpnhPp" },
          { nombre: "Part 7", id: "11Oi3efBVxZ19bc9uyeuBUSx0PVMTjAqe" },
          { nombre: "Part 8", id: "1ymyBm0rRcXzLRm85OG6hcF8FYX8hRMG4" },
          { nombre: "Part 9", id: "1CSNIcqZela1oKOzkfO-A85zsDY6P3g_W" },
        ]
      },
    ]
  },
  'Systematically Attacking From': {
    titulo: "Systematically Attacking From",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "Systematically Attacking From Closed Guard By Gordon Ryan (formerly ‘Systemizing closed guard’)",
        nombre: "Closed Guard",
        partes: [
          { nombre: "Vol 1", id: "1IvOCZBnumksxjLUqwPlx6xyqf5546akg" },
          { nombre: "Vol 2", id: "1pA9wqXuI_PLoXHjkoLLmBcEonyZvMv7j" },
          { nombre: "Vol 3", id: "1yKIEL4tS7tD_ahF4DjTDQlfl_cIUcxrj" },
          { nombre: "Vol 4", id: "1-ZLvZ53Ci2w_ucsPyEO4n19nVGhin0Uc" },
          { nombre: "Vol 5", id: "13WoHjUfnfkxwS4N-TuJstCWH0QN728Nu" },
          { nombre: "Vol 6", id: "16goML3ejLV4eZxFuPmEPS1SLy0VBMWci" },
          { nombre: "Vol 7", id: "1CYAlVv3yp1i2dmr6wMo9e3je2bgk0uwa" },
        ]
      },
      {
        id: "Systematically Attacking From Half Guard By Gordon Ryan",
        nombre: "Half Guard",
        partes: [
          { nombre: "Attacking From Half Guard 1", id: "16gQp1zhQqSSeXTo0Ob5VgalsiQfFiz8n" },
          { nombre: "Attacking From Half Guard 2", id: "1Y3wMZuPpTGBNEAqPWicCiN2L_XFArSlz" },
          { nombre: " Attacking From Half Guard 3", id: "1-OVxm5OmUUn5vXDQ1o4xg35qbxVwLWG_" },
          { nombre: "Attacking From Half Guard 4", id: "1Vppy_JeDhFR14fP8l1lFCHAXBDkG0AfA" },
          { nombre: "Attacking From Half Guard 5", id: "1IfaAMDqL4GFtzfY7pO15U6FOzHcT6XQl" },
          { nombre: "Attacking From Half Guard 6", id: "1n1lwxyiiCnau3NO9xB96zgytUB2GLdh3" },
          { nombre: "Attacking From Half Guard 7", id: "18lGMwhp2rb5MmG38WlcJeQRySZTbf6hg" },
          { nombre: "Attacking From Half Guard 8", id: "1RHpTvPzYQHeg53x2x6LsXldDEqsK8_gO" },
        ]
      },
      {
        id: "Systematically Attacking From Open Guard Seated Position By Gordon Ryan",
        nombre: "Open Guard Seated Position",
        partes: [
          { nombre: "Volume1", id: "1BsMplKzek0gBiC2Cg4LZaZqTm8fVORut" },
          { nombre: "Volume2", id: "1UsSQbsdLhKPqiO5jdqsssX42CijGtZIr" },
          { nombre: "Volume3", id: "1f2qi0WhTKNQYRIQghP7Es1Ojs9J0cmz3" },
          { nombre: "Volume4", id: "1gvhf2LxpxHzGR5fQEzLJ4WGczeFs79Es" },
          { nombre: "Volume5", id: "1VUs7VmM0HnmEKzs8SBDVG2mWcQ2Bmh1_" },
          { nombre: "Volume6", id: "1d3tsFHA-JO-3Tt_qMX2Xi2cGPF9X--08" },
          { nombre: "Volume7", id: "1YfnIKDDsp0tfruEBnOSHY1pUyrP0pD2I" },
          { nombre: "Volume8", id: "1Q74d-lq5XQJOKIzrXlw4RoBDm_mAkyAA" },
        ]
      },
      {
        id: "Systematically Attacking From Open Guard Supine Position By Gordon Ryan",
        nombre: "Open Guard Supine Position",
        partes: [
          { nombre: "Vol1", id: "1_K-Wr7bRImdveAGpe2IU3BanHhrcqMp9" },
          { nombre: "Vol2", id: "1TJU57s2M_NNdxZXE87Oy1rXGCrcQ7rME" },
          { nombre: "Vol3", id: "19ChYNCSPUpLTo8d0qBP0s_IwpcKLaSpv" },
          { nombre: "Vol4", id: "1ENGzIaj7jJRZmhPpRkVFJ3HygpxKdBRp" },
          { nombre: "Vol5", id: "1Mny_T-KqwAUi2vD6oKHMGl3y1Y7ZU7Hi" },
          { nombre: "Vol6", id: "1aUud1floqaVmBmMLj1P-elC4PpKG-PpH" },
          { nombre: "Vol7", id: "1joVih2TsZYcMvadQOvEJW4OaK3_25qRi" },
          { nombre: "Vol8", id: "1YJqNdJtbvUTgymfao3YY7iQNYP8qL9ZJ" },
        ]
      },
      {
        id: "Systematically Attacking From Top Pins_ Mount By Gordon Ryan",
        nombre: "Top Pins_ Mount",
        partes: [
          { nombre: "Vol1", id: "1oOipC9TrSHPr2bCzcMv5ynMUKuzynlHq" },
          { nombre: "Vol2", id: "1B4GlYbZE6nlOGNgqLsjujz4gNuT3C6pQ" },
          { nombre: "Vol3", id: "1njxU8bXqpTubuIW5EirAlfvXti9xYow3" },
          { nombre: "Vol4", id: "1KboghqRJXOrKjh92dEhawbtk-mQxHpIy" },
          { nombre: "Vol5", id: "1FJxQIvt-zMmO2hO0XkoMxSeAUfWfOFUz" },
          { nombre: "Vol6", id: "1EysvFqAehvFalFB_WTzp5np3tlU0uN8Z" },
          { nombre: "Vol7-Rolling", id: "16scxVo0sI8Wkx9YTo9xrX71eoMwDg36v" },
          { nombre: "Vol8-CommentaryMOUNT", id: "14wqJYw6XaZ-8tn7oLfi5xu1aGFkJLWiQ" },
        ]
      },
      {
        id: "Systematically Attacking From Top Pins_ Side Control & North South By Gordon Ryan",
        nombre: "Top Pins_ Side Control & North South",
        partes: [
          { nombre: "Vol1", id: "1GK8kbmYR7LY38y2lNYhhaorHM6FiQZX4" },
          { nombre: "Vol2", id: "1WSmI_Y3psdruDRp554J-Z4oJpLqpoyHT" },
          { nombre: "Vol3", id: "1-bckOk7E5Icl4WzC0GQlAtyvK1nxbNvS" },
          { nombre: "Vol4", id: "1C66ts7bx2i2alJKR48RczhWQAa_EkkyE" },
          { nombre: "Vol5", id: "1w_vUk2HJI3kLvac0XRberno3AbP6MmgF" },
          { nombre: "Vol6", id: "1tUdq-79yM_Fh3GyvDwdOPnKLUktfnJ01" },
          { nombre: "Vol7Rolling", id: "1w3Yydmr_B9xIknlw6ze-kIJfrpVjnNPD" },
        ]
      },
    ]
  },
  'Systematically Attacking The': {
    titulo: "Systematically Attacking The",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "Systematically Attacking The Arm Bar By Gordon Ryan",
        nombre: "The Arm Bar",
        partes: [
          { nombre: "vol1", id: "1dAQuC4PeN87_IG8XHm9SnFCsb24_zWHF" },
          { nombre: "Vol2", id: "1S7GrgvNaxV660ISabkidHiBET785dEe8" },
          { nombre: "Vol3", id: "1WXkKq-z5XC-woRC7OPBJghv813GR68so" },
          { nombre: "Vol4", id: "13r6H31jmE0pJZOxDbxd8VPB4nvSMDZSZ" },
          { nombre: "Vol5", id: "1vAWCSh70qW3DOs4tE2C24I8S245zdSOu" },
          { nombre: "Vol6", id: "1_waACGJUnfEyglwenx4tulztdEu8SLlx" },
          { nombre: "Vol7", id: "1Ei-qt3lq40cXDfaLTNgTsHoJGYm5w4wO" },
          { nombre: "Vol8", id: "ID_NO_ENCONTRADO" },
        ]
      },
      {
        id: "Systematically Attacking The Back By Gordon Ryan",
        nombre: "The Back",
        partes: [
          { nombre: "1", id: "1ug3-A8cmTt8mOS7uiOdrf2e_YgfKtshd" },
          { nombre: "2", id: "1tvIASvfE9mIJF9ssRWHPEu91om9cADgS" },
          { nombre: "3", id: "1JvGxzXSaUXQlKC0xWTF9ei2OAjuvaNYc" },
          { nombre: "4", id: "1h3k5n-jJDeAZr68fPrVexlimCopsfqR3" },
          { nombre: "5", id: "1J7YGldNIBOFQH68bUfrzaoWYMpMWIW84" },
          { nombre: "6", id: "1H3FVPBZ9yq4T_YWT5lUrdkEGTXNtYGZ6" },
          { nombre: "7", id: "1obgZIH_zKLq8LbtR0XroNLbrutTSZ6yl" },
          { nombre: "8", id: "1LXM3tXW7dglNrzcisV85NglyRlT6C0AJ" },
        ]
      },
      {
        id: "Systematically Attacking The Guard 1.0 By Gordon Ryan",
        nombre: "The Guard 1.0",
        partes: [
          { nombre: "Vol 1", id: "1btfdFEAzqGhsi1uYuqnqfX04SEWzXcCq" },
          { nombre: "Vol 2", id: "19VX4i0JvD_eDwxjpYoU8xZOE09v2HuhG" },
          { nombre: "Vol 3", id: "1rLEUDL7CTODDcJlcV2EXt_syRZa8FImd" },
          { nombre: "Vol 4", id: "1Oeq7L20X5NfALUrEx02rO2BXHmX61H9i" },
          { nombre: "Vol 5", id: "1dlVsrrHwGzd9e3MkG8NwksqHApIURp47" },
          { nombre: "Vol 6", id: "1zhF_VMsx2fo5e1ImHE4z9rCzQ_kp_vGj" },
          { nombre: "Vol 7", id: "1X8xWpKEFh_p3ujhdSumCIF6065TLxaaT" },
          { nombre: "Vol 8", id: "1uK1DGhmMVttNBWjNW95J6nQVJQDTTKBV" },
        ]
      },
      {
        id: "Systematically Attacking The Guard 2.0 By Gordon Ryan",
        nombre: "The Guard 2.0",
        partes: [
          { nombre: "Part 1", id: "1s1zchA0jcbnQ2Rzxfip2J3XTVGmEEN7A" },
          { nombre: "Part 2", id: "1bXRTwBPyPPLQqKEWiy7dRHiROunWlOub" },
          { nombre: "Part 3", id: "1bTU6bpUZCAQPu4YJaeSH-0s_wSuua0Vq" },
          { nombre: "Part 4", id: "1kqbofWwOG4kRYM4elvvPPYixLB1Rk-vq" },
          { nombre: "Part 5", id: "10HLYfCDl_q3UKeJSZS22X2lGZqJIs0rJ" },
          { nombre: "Part 6", id: "1lSh2BRcgnHunNFe6kw33X_2EaWbW--F4" },
          { nombre: "Part 7", id: "1wMRAEKSrZ0tR3XoifZ-4GzICstamCMt-" },
          { nombre: "Part 8", id: "1e5fCIRZHmc3eCVhATzCRMaRYDeZTEJ1x" },
        ]
      },
      {
        id: "Systematically Attacking The Guard Body Lock Study By Gordon Ryan",
        nombre: "The Guard Body Lock Study",
        partes: [
          { nombre: "The Guard Body Lock Study 1", id: "1mte2iO--nkqyEgsjRy9ocSfu6yPlOkaZ" },
          { nombre: "The Guard Body Lock Study 2", id: "1-BXiJSAchaUFzD-P3mTcORYw2pMpXOfe" },
          { nombre: "The Guard Body Lock Study 3", id: "1L5RbwD-oaIa7Lv65vPuQHyq0bRdyY0Vi" },
          { nombre: "The Guard Body Lock Study 4", id: "1m1tfJdb9YYkQvwWSTPRTGVcBctGk38Is" },
          { nombre: "The Guard Body Lock Study 5", id: "18ILYayba3Jb7qy8Hvu8wlQBapdp3-8J7" },
          { nombre: "The Guard Body Lock Study 6", id: "1ho5VkRIsy3bgrnKbT8k73CooqSDU-KEp" },
          { nombre: "The Guard Body Lock Study 7", id: "1mt6M3QvVAuiIHYmN4bXIG0R7c-9MmOwM" },
          { nombre: "The Guard Body Lock Study 8", id: "1071yr8OSXmJ2Bk_lbKq4XRYjPHi3KDqI" },
          { nombre: "The Guard Body Lock Study 9", id: "1gtJ-QD6nm8BHdUODHyWrjCuxC55i2eHO" },
          { nombre: "The Guard Body Lock Study 10", id: "1k6ANtfl_k_iipFgynxQsF_eX_9pVzN0r" },
        ]
      },
      {
        id: "Systematically Attacking The Guard_ Half Guard Passing By Gordon Ryan",
        nombre: "The Guard_ Half Guard Passing",
        partes: [
          { nombre: "Half Guard Passing 1", id: "1b5JpcCENgwv_MHiwkCL2YTzNlPdghPkZ" },
          { nombre: "Half Guard Passing 2", id: "1m4L6_cCX9pyqPsa3AROI9KdkkYOUfy1-" },
          { nombre: "Half Guard Passing 3", id: "1qcmdMA1goQGUES32NOfJvNWZEkkCSJBk" },
          { nombre: "Half Guard Passing 4", id: "1yOznutpJdBSM7ql9zAV0H0bb5e1P0o5W" },
          { nombre: "Half Guard Passing 5", id: "1_2DNqFIglTSkwQ4g5Tj8s4-JpJdEJOjY" },
          { nombre: "Half Guard Passing 6", id: "1xIKDk25EMeszJ-W40CSeCd8nTptznXki" },
          { nombre: "Half Guard Passing 7", id: "1fuuliSjPcOs9wWbwBTAaLVNVAfKjH_9r" },
          { nombre: "Half Guard Passing 8", id: "1vB-Ly34Ei2s1c1QmcX3Gli5c9_pIlhl8" },
          { nombre: "Half Guard Passing 9", id: "1uoXR3yIwjS6gocMrD40zjuJGTqy5-lRk" },
          { nombre: "Half Guard Passing 10", id: "1rmgdi0Cg_8PywJIZnYpnAuGrcCzJ9D0x" },
        ]
      },
      {
        id: "Systematically Attacking The Legs By Gordon Ryan",
        nombre: "The Legs",
        partes: [
          { nombre: "Volume 1", id: "1bn3G-SxW7JOdk65cvv4NSVeWoiTcMQL9" },
          { nombre: "Volume 2", id: "1EAyB0ufHYUbh7yT77bu5Vs7YBWdbSD8g" },
          { nombre: "Volume 3", id: "1bGlb56ND-ZAZWAeTKVPrl-a3uCHwuQNF" },
          { nombre: "Volume 4", id: "1kFxCHAb48e1AR9uVPapKMfaL76-xEC5Z" },
          { nombre: "Volume 5", id: "1kYieZo9UbuydkCUFt2-sQnRtpx--nQZZ" },
          { nombre: "Volume 6", id: "1dVS8stFPrHjOz5mESE_minD0WlxXjgxu" },
          { nombre: "Volume 7", id: "16ObF67-oHdLJyBMPuIfyMTN87Z1J5bsv" },
          { nombre: "Volume 8", id: "1PydJQi8QIieLQdYflFfjVf4QthQImpTA" },
        ]
      },
      {
        id: "Systematically Attacking The Scrimmage： Securing The Score",
        nombre: "The Scrimmage： Securing The Score",
        partes: [
          { nombre: "01 - Securing The Score Part 1", id: "1WsxFLhQvop17R2wKKIX9Fx1ePzGMmL4R" },
          { nombre: "02 - Securing The Score Part 2", id: "1ibC6fqd0tJf9UBNZyvl2zID8rYfBr1DK" },
          { nombre: "03 - Securing The Score Part 3", id: "1KR2Fq5TFGCvuyxaYzM3iTlLbqqm4bjIy" },
          { nombre: "04 - Securing The Score Part 4", id: "1zwDn5ZFlO9NRHtjWDLpjtFNBGXQE_mAi" },
          { nombre: "05 - Securing The Score Part 5", id: "1hych0KC3mNMAi4dgE88dg9qQqQ51rXSt" },
          { nombre: "06 - Securing The Score Part 6", id: "1QSjH_OQ4wTSJa0eG9IHaLLGTVYsEp221" },
          { nombre: "07 - Securing The Score Part 7", id: "1EjjRbVW9aEQaIwzNgeATZN6zwbKBOltj" },
          { nombre: "08 - Securing The Score Part 8", id: "1HjoJJO-sai9HWnLhN2eA0xxnn8ziNt2N" },
          { nombre: "09 - Securing The Score Part 9", id: "1z6ijU6-UPghOxbVmdvOIRQpOMeH-aTE2" },
          { nombre: "10 - Securing The Score Part 10", id: "1RwlYTu3DoMOTuL2fjQLnoB2942XOs2fL" },
        ]
      },
      {
        id: "Systematically Attacking The Turtle Position By Gordon Ryan",
        nombre: "The Turtle Position",
        partes: [
          { nombre: "Vol 1", id: "1YIh82zw7pftmJIrmSIdQBbrtsx-RUBWV" },
          { nombre: "Vol 2", id: "1SKKVf-PlH3W8L9OT900mZpOylhOzrJHV" },
          { nombre: "Vol 3", id: "1K6WC0CzAiarT4EP2CmSMkZ9VI9_9kJ1J" },
          { nombre: "Vol 4", id: "1voJ2t4S4jXF17UM911ynBnJVi_j_ocS5" },
          { nombre: "Vol 5", id: "1ga6F83QG_XkS3-Ly7xSPMonUiWEtnkxf" },
          { nombre: "Vol 6", id: "10mcxHhL1TH_Q8CRAHwM12WRef_ap9J3n" },
          { nombre: "Vol 7", id: "1BuY7e0FuJbpAAhC7v3jf7W5bLpUcD4-1" },
          { nombre: "Vol 8", id: "1P4Xt8rLRSeeSh-gqFUOCSH96Stmlv15-" },
        ]
      },
    ]
  },
  'My Evolution Your Revolution': {
    titulo: "My Evolution Your Revolution",
    autor: "Gordon Ryan",
    volumenes: [
      {
        id: "My Evolution Your Revolution ADCC 2017",
        nombre: "My Evolution Your Revolution ADCC 2017",
        partes: [
          { nombre: "Part 1", id: "1OHScH7uu09ftZEAR85TKrTG_hULQuE9b" },
          { nombre: "Part 2", id: "1zU5r6bKQamOVMSG4S2ig70uiVSGAeSV-" },
          { nombre: "Part 3", id: "14A48PQN_DwOxSj0jkQ4NTjg-EdRklgNQ" },
          { nombre: "Part 4", id: "1p8fLbpBYu0A4HxVSX0UMd6lCLvvEJCHQ" },
          { nombre: "Part 5", id: "13_tRWSVPGOYp6aC0qT6ieWA3popyjygI" },
          { nombre: "Part 6", id: "1yqtrilCOltc4VaxfpFAnzBqhl0tze5up" },
          { nombre: "Part 7", id: "1Mza3Aq-rImExC1ms8oWvZbWaEJb1oIV1" },
          { nombre: "Part 8", id: "1hJ9Bg_6K0jJCfTOhihHZTgMrDNhgRv25" },
        ]
      },
      {
        id: "My Evolution Your Revolution ADCC 2019",
        nombre: "My Evolution Your Revolution ADCC 2019",
        partes: [
          { nombre: "Part 1", id: "10f15n86sEhNQLBsDjaoPC272gQdxLKOb" },
          { nombre: "Part 2", id: "1CwE9k2PX-TmfUaVOnBtInLKA9fIfjKcr" },
          { nombre: "Part 3", id: "1iFXIyhD7Kg_0QkokWqX2bMx476-qgzkH" },
          { nombre: "Part 4", id: "1BGN8ntX050WjCKeMgrS-tpMjZ-uuFypx" },
          { nombre: "Part 5", id: "17G7rmeZaOvr1jRXIjl_GmNk7IxBSrmAi" },
          { nombre: "Part 6", id: "1I5JpI4yMYbtq8ZvxvTFafrmMKCa6f2pk" },
          { nombre: "Part 7", id: "1-Bc7AqXVPEkiaQ1vkDVIS4DHUyZDKswc" },
          { nombre: "Part 8", id: "1KzY7BSu4wWbCjajsw92Y5IW7ImF5t5qZ" },
        ]
      },
      {
        id: "My Evolution Your Revolution ADCC 2022",
        nombre: "My Evolution Your Revolution ADCC 2022",
        partes: [
          { nombre: "ADCC 2022 - Vol1 - HEIKKI JUSSILA", id: "1ZD4NeP1wOX2MiQJWZAKSFmi1zHA_YvgZ" },
          { nombre: "ADCC 2022 - Vol2 - VICTOR HUGO", id: "1kAcHcOBkt-9ckiKM_ROUIcDx2jrBTVt8" },
          { nombre: "ADCC 2022 - Vol3 - ROOSEVELT SOUSA", id: "1Id-KYjAHZ7wpUxkaXiixtiJZLRcLMyW7" },
          { nombre: "ADCC 2022 - Vol4 - NICKY ROD", id: "1isb-F7Mo_elrGzXSApXMizBNhchp1ugY" },
          { nombre: "ADCC 2022 - Vol5 - ANDRE GALVAO", id: "1akmuNUki_VClgjy9mRIuB8woKedbeGuu" },
        ]
      },
    ]
  },
  'TRIPOD PASSING JOZEF CHEN': {
    titulo: "TRIPOD PASSING JOZEF CHEN",
    autor: "Jozef Chen",
    volumenes: [
      {
        id: "TRIPOD PASSING JOZEF CHEN",
        nombre: "TRIPOD PASSING",
        partes: [
          { nombre: "Tripod Passing by Jozef Chen1", id: "1QGUnhHoRTvhIElvEt32095t57tmW9Kfz" },
          { nombre: "Tripod Passing by Jozef Chen2", id: "1pPp718yoGD2KwSspVHUDmNGNWuRGFdCQ" },
          { nombre: "Tripod Passing by Jozef Chen3", id: "1o3yV89qXAUW-nlGmIodmOmfnbNptJSMy" },
          { nombre: "Tripod Passing by Jozef Chen4", id: "116CAjxPKBtZQBLilu2vrqbG1CEvTRbVm" },
          { nombre: "Tripod Passing by Jozef Chen5", id: "1awiKAq1rrCk2y6Z6vtVTBPnvY9i20Y4r" },
          { nombre: "Tripod Passing by Jozef Chen6", id: "1XVQ_bFmj6QfL39eWku3Gar6FY8ZuE9_T" },
        ]
      },
    ]
  },
  'AOJ K Guard Masterclass by Cole Abate': {
    titulo: "K Guard Masterclass",
    autor: "Cole Abate",
    volumenes: [
      {
        id: "AOJ K Guard Masterclass by Cole Abate",
        nombre: "K Guard Masterclass",
        partes: [
          { nombre: "01.Official Trailer - K Guard Masterclass from Cole Abate", id: "1qjScXG0lZrErSpiXYA9zIFvJJN3sVtwW" },
          { nombre: "02.Introduction to the Series", id: "1igqXxHKeusav6qAHFNj3rUI71RyuX8Br" },
          { nombre: "03.K Guard Fundamentals", id: "1TTqznuzT4JfDD9kjAsOBMHlZZ_4UZmAT" },
          { nombre: "04.Off Balancing a Standing Opponent", id: "1X8MUPcVncoDKNDcT4COhSqY4J9fdWcJH" },
          { nombre: "05.Off Balancing a Kneeling Opponent", id: "1tZn45ey0uB8VX0Bq4AaKLTDHP1z9_nVG" },
          { nombre: "06.Entering the K Guard Versus Knee Slide (Feat Gui Mendes)", id: "1bnuAzEmk1T806LOPlWPg_drImyvOw_1-" },
          { nombre: "07.Entering The K Guard Versus Outside Passing (Toreando Pass)", id: "1eqGbFGlP_jmBSL7S_UDyeLvDXNXJtB4l" },
          { nombre: "08.Entering the K Guard Versus the Longstep Pass", id: "140jYjirdIIVglRNmCmlX8Z9BrlW7eYtC" },
          { nombre: "09.Entering the K Guard Versus the Stack Pass", id: "1WzCClbZsQqtyD1kpB1hlB306-4CFnIcQ" },
          { nombre: "10.Sweeping Using the K Guard", id: "1838VbVstmF6z2VOY3_jm3KNXWecFFh0Z" },
          { nombre: "11.Submissions from the K Guard", id: "1Rty5cGAhcQhpguGdjOMM2js6rQbzAjq5" },
          { nombre: "12.Private Lesson with Mick And Rai", id: "1wbw11TAn7um9k33T-Wooc8CvCS0fC9k9" },
        ]
      },
    ]
  },
  'AOJ Duck Under Masterclass by Cole Abate': {
    titulo: "AOJ Duck Under Masterclass",
    autor: "Cole Abate",
    volumenes: [
      {
        id: "Duck Under Masterclass",
        nombre: "1-Fundamentals",
        partes: [
          { nombre: "01.Duck Under Masterclass Trailer", id: "1Piy-xh_mfFRq7w3_6B-uMTuvYeqeyf4D" },
          { nombre: "02.What Is the Duck Under Pass", id: "1cBOBTRC9-GBYatxBhk0v-wIWPbFVfX9S" },
          { nombre: "03.Duck Under Fundamentals", id: "1KMZTq_X4QNSTgnn6A9OSI5IFLUKmAjxT" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "2-Finishes",
        partes: [
          { nombre: "04.Duck Under Finish with The Cross Collar", id: "1TkVRBCfdKETHUYkXQ4wZvpMEStK54mfa" },
          { nombre: "05.Finishing with the Long Step Pass", id: "1nNvl71omnSfQXcXY4e4E12es7MIeT7cK" },
          { nombre: "06.Duck Under Finish with The Leg Drag Pass", id: "1AAdoVs8Piw1lHv6ugGOKjSAAUadyc7aR" },
          { nombre: "07.Duck Under Finish with Trapping The Head", id: "1xJ1zcJopGcNAMRoZQwTcwIm8_Ew5ZKNI" },
          { nombre: "08.Duck Under Finish with The Stack Pass", id: "1LEcbOwZV6gwFh3-3SSzZ6TfoublkasJd" },
          { nombre: "09.Duck Under Finish with the Back Roll Pass", id: "1DV0jh1BAEYc_O3lbv6x0wfMRnOv38Ry7" },
          { nombre: "10.Duck Under Finish with The Stacking Leg Drag", id: "1bP5pug4AAj7TfgyhPLIPr9Z-APwVrB9r" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "3-Back Takes",
        partes: [
          { nombre: "11.Backtake Variation (Berimbolo)", id: "1xPIuSMUbaS71hjYwzm0SI0UJb7vfkpK8" },
          { nombre: "12.Backtake Variation (Twister Hook)", id: "1Z_QuACrW6zgVkpgG0q-g8fgO35wOh1ki" },
          { nombre: "13.Backtake Variation (Sitout With Hook)", id: "1LUkoahokggvGFLKsEY9gMndaEsS0Ld58" },
          { nombre: "14.Backtake Variation (Slide Underneath)", id: "1d7fggLVWNOSaLYMk6HYXTIJw6iz0z5qe" },
          { nombre: "15.Backtake Variation (Versus Sitting Up)", id: "170G-XIVNzvHE8ad1Ure4XISNkmmdIwby" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "4-Submissions",
        partes: [
          { nombre: "16.Armbar From The Duck Under (Part 01)", id: "1fj1h7bwOHR-7U7vbhiIvaelFuI0Pxeay" },
          { nombre: "17.Armbar From The Duck Under (Part 02)", id: "1PPbdQnhsQh4SD2cZFJ6eQt5a8JisMPwQ" },
          { nombre: "18.Head And Arm From The Duck Under", id: "1AR7chxUW-MbzIv-rUkodOjD3e5dDhxMe" },
          { nombre: "19.Submissions From Applying More Pressure", id: "1ycrSGlN0iC6OXjP3bZRr0CUBxwcZF0qP" },
          { nombre: "20.Nearside Armbar From Duck Under", id: "1YaYByTPf6_HjMzgw7QwiGz3H6cbn2K2p" },
          { nombre: "21.Estima Footlock From The Duck Under", id: "1iwZHN-Sv3aFnN3Ifw00jukkJ85uogU1e" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "5-De La Riva Entries",
        partes: [
          { nombre: "22.Elbow Tuck To Duck Under", id: "1cKRZVecOTCWWYyhngNasdkoh5dAn-Cxm" },
          { nombre: "23.Squat Stance To Duck Under", id: "1WxSGfmSaaRB00Ep3p86-zeMCh5D9YaK4" },
          { nombre: "24.Back Step To Duck Under", id: "1762vLs0zh5FI5WYNrnue5lVfVvfcvMIK" },
          { nombre: "25.Shin Slide To Duck Under", id: "1g0L4MXXLFkBgjyNSg7Sb4T7yHaGFjI-J" },
          { nombre: "26.Trapping The Head Versus DLR Underhook", id: "1c1iME4TJ7D09GMeTtLSxxNHeDSKPYMGI" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "6-Lasso Guard Entries",
        partes: [
          { nombre: "27.C Grip To the Duck Under", id: "1nENiwEgdi_yVum9mSLhzeFQxMRCQ5LHx" },
          { nombre: "28.C Grip To Opposite Side Duck Under", id: "1F00CW_bNcqp9c2JoVCMcPkjXX40H90Hg" },
          { nombre: "29.Escaping The Double Lasso To Duck Under", id: "1mESwlpupia5JtjavToaeNggfbEfKiPEw" },
          { nombre: "30.Countering The Inversion With The Duck Under", id: "1SWuHk4oPf6xTeSiKd0qyAjpz447N1Xlv" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "7-K Guard Entries",
        partes: [
          { nombre: "31.Versus The K Guard", id: "14hEyZP6WHCU8nezwFVwIOcZyF7I7oIk8" },
          { nombre: "32.Versus The K Guard (Opponent On Their Side)", id: "1Y4p_FEZmfs6tCsnUVDSi3UgTrv8h1ztD" },
          { nombre: "33.Versus The K Guard (Late Stage)", id: "1u1fStjDPlhWD2A61c3VPur3pxmWx3z33" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "8-X Guard Entries",
        partes: [
          { nombre: "Detalles", id: "1aib0kHggo3k1PU0I3QZ9JcS7cLCt_6PN" },
          { nombre: "35.Passing Over The Head To Duck Under", id: "1CiBWY2hbceeS50luN83CkmrDAfanWO19" },
        ]
      },
      {
        id: "Duck Under Masterclass",
        nombre: "9-Open Guard Entries",
        partes: [
          { nombre: "36.Toreando Pass To The Duck Under", id: "1aiu-G3ebi_MIhM0NHMXL3wsNnDFxGL4_" },
          { nombre: "37.Leg Drag To The Duck Under", id: "1MZ_YlvCXBLT-yT6KoR7Zy-JYRhBFIwd_" },
          { nombre: "38.Cross Grip To The Duck Under", id: "1kAbbunI1ZWnklTwiKEYGBT19ZB9nrya_" },
          { nombre: "39.Longstep To The Duck Under", id: "1qjgcGY_5ub20CYMniQuDpmf-8soI_Dch" },
          { nombre: "40.Knee Slide To Duck Under", id: "1DZzH_sA1830CsYlki6DMcQBAQCy_34I7" },
          { nombre: "41.Going Over The Head To Duck Under", id: "1-DOHuDm3znnuntYaTHcwbYlnHdzQblL0" },
        ]
      },
    ]
  },
  'Enter The System': {
    titulo: "ARM BAR",
    autor: "John Danaher",
    volumenes: [
      {
        id: "Enter The System Arm Bar - John Danaher",
        nombre: "Arm Bar",
        partes: [
          { nombre: "Vol 1", id: "1azWKqQcjL-WBYBvJwZH2pG9NYDxwLdkb" },
          { nombre: "Vol 2", id: "1akyfNalJrMqWUMEy4j4fsy4j29G2_MPp" },
          { nombre: "Vol 3", id: "1wrRTjYRnKRbnM9-2__WOWjmSl3s5T66U" },
          { nombre: "Vol 4", id: "13CSxmOBAD3-8Yi1OrFq9zu_mqDQrDWQH" },
          { nombre: "Vol 5", id: "1N6AIsgkKbgSMz1QHF6NhTV2f5EPk_xwc" },
          { nombre: "Vol 6", id: "1Qfa9CHNUR4OXBp0nD-zKnMJqEH1dgplG" },
          { nombre: "Vol 7", id: "1JyOngZbsw3Kk285yJ3TmXL62VO2RrSog" },
          { nombre: "Vol 8", id: "1uJG_yT-CpnT-bW3cNAk6FMM0fzi8W0gX" },
        ]
      },
      {
        id: "Enter The System Back Attacks - John Danaher",
        nombre: "Back Attacks",
        partes: [
          { nombre: "Vol 1 - Straitjacket System", id: "1EOF9OGSLed2kUu474u81dnQElCmhAEDd" },
          { nombre: "Vol 2 10 Critical Principles", id: "1qJAgZvGq6duTVNqCaKKvcuNxI4h0MzbD" },
          { nombre: "Vol 3 Workings of Straitjacket System", id: "1PYz98yAo8wFVHeGeFzaWeZE83Yd70BmD" },
          { nombre: "Vol 4 Workings of Straitjacket System 2", id: "1yjISDzUS9M0Pej1nAMvhb72AUvsPpFia" },
          { nombre: "Vol 5 Auxiliary Systems", id: "1kRWIO33YKquR8Ra_NoMgFb35PwoGtUmV" },
          { nombre: "Vol 6 Auxiliary Systems2", id: "1Apr4CB4s_4lRhGBQzOm7gkhOXokQdEgd" },
          { nombre: "Vol 7 Establishing Hooks and Rear Mount", id: "1SWj1bU1aqrDl4GfCzx8274Z3lmKVsWbp" },
          { nombre: "Vol 8 Establishing Hooks and Rear Mount 2", id: "1eZxHPxfTPKQy0lFZLrEvkbh-pL36MVHM" },
        ]
      },
      {
        id: "Enter The System Arm Bar - John Danaher",
        nombre: "Front Headlock",
        partes: [
          { nombre: "Vol 1", id: "1RDMnSJn5TPtoAWd6x18uH2OLBhitoshd" },
          { nombre: "Vol 2", id: "1Jn7lFCmH-omt3KdHx-6zr_Q0YbUpjcX7" },
          { nombre: "Vol 3", id: "1TBCwS1aCZWBda_TVhb5tBHrOLgfZGl8A" },
          { nombre: "Vol 4", id: "1e0aygjoHHVX7KiZHa2xeKe27Z76SF81Y" },
          { nombre: "Vol 5", id: "1VJAT5ANjbKRCacvao5_1oJL-bSjkqnpl" },
          { nombre: "Vol 6", id: "1VDTG0Qp6gLMjB7prBHjVTEIdmH005FIm" },
          { nombre: "Vol 7", id: "1NvlfUzXoMIMvmNtFUmPe6qWDP92C3a4X" },
          { nombre: "Vol 8", id: "1L89GpUI2LcS1u_F6ZrI8inzfub4WX-c5" },
        ]
      },
      {
        id: "Enter The System Arm Bar - John Danaher",
        nombre: "Kimura",
        partes: [
          { nombre: "Vol 1", id: "1XM4aIZns7oYWhixWJ5bUXhzHAPpbAVSj" },
          { nombre: "Vol 2", id: "1lKjRLpaDkqk-vzcBZ7j9kE-qnVb3gmBD" },
          { nombre: "Vol 3", id: "1iqFvJGOdYL46ciCcV0_j6cnr0bEqb6wR" },
          { nombre: "Vol 4", id: "1rzfBJZyYQfIc2e0vAIhOBzZiYDAvj2O5" },
          { nombre: "Vol 5", id: "1lS9LUXG38bbgAtnhqahTlIKcx-xjrHSx" },
          { nombre: "Vol 6", id: "1nq8xDuHuyQmIzfS3UUYFKKYiNugzlP2L" },
          { nombre: "Vol 7", id: "1dBk687xNfGnDbD9-9akxacidOL7bz2AU" },
          { nombre: "Vol 8", id: "1jcQQ3cqX9CHOxWBGC7t1-BGi2gqsbXG_" },
        ]
      },
      {
        id: "Enter The System Arm Bar - John Danaher",
        nombre: "Leglocks",
        partes: [
          { nombre: "Vol. 1", id: "142VhzSyuNQ3mZi6ag0Q6w-rhUOem7C6v" },
          { nombre: "Vol. 2", id: "141PS489_Ll_hhuOGIJhkpZfHEKdFpQM6" },
          { nombre: "Vol. 3", id: "15SPrg3vBBECf2S4ydjwYcoEnylR0V-JZ" },
          { nombre: "Vol. 4", id: "1eHbHTaWsB6jCh6tnbJlCokEdDZp1M5dp" },
          { nombre: "Vol. 5", id: "1orHVFyfk5jOycwQ_TXLltHF4IP3CNrGa" },
          { nombre: "Vol. 6", id: "1SGewXmkS-goUP6X0BcHnALJeOp881J97" },
          { nombre: "Vol. 7", id: "1VoqSCDwt06UBpAguQr1gTwkCxIY1EBgH" },
          { nombre: "Vol. 8", id: "1dE3gWRGOkNPAW4lcJ0fuG2Ncf8dguNQT" },
        ]
      },
      {
        id: "Enter The System Arm Bar - John Danaher",
        nombre: "Triangles",
        partes: [
          { nombre: "Vol 1", id: "1nFD5S_ViIR5ODq0uTAkfJ1EZusOUHikn" },
          { nombre: "Vol 2 Front Triangle", id: "14jHc37-mcjf6q1cLDZBVHi9G0i1tSxzD" },
          { nombre: "Vol 3 Front Triangles", id: "1GdcYnUTF3RH9VaT5gMQN27Tu_KCatkbm" },
          { nombre: "Vol 4 Front Triangles", id: "1RlKLr-cJ6LdjKcgefOAG9XIN04BaSDjj" },
          { nombre: "Vol 5 Opposite side Triangle", id: "1ly4OIePw-6zcoDantXLh7-YGqigjjcRZ" },
          { nombre: "Vol 6 Rear Triangle", id: "1aWTCWgg0onaw4b81d6HztdH2HaoAtkgi" },
          { nombre: "Vol 7 Side Triangle", id: "1iat7uvJ0OVd-igDLlEiIYjbyotkB0g4-" },
          { nombre: "Vol 8 Reverse Triangles", id: "1kbQvoshM94FTBRQz_jPEk67HxUwNyFej" },
        ]
      },
    ]
  },
  'Go Further Faster': {
    titulo: "Go Further Faster",
    autor: "John Danaher",
    volumenes: [
      {
        id: "Go Further Faster Closed Guard by John Danaher",
        nombre: "Closed Guard",
        partes: [
          { nombre: "Vol 1", id: "1_WzWExVDPmop5Si6vPhFxf0xKCIGrNiX" },
          { nombre: "Vol 2", id: "13rAlNEX1CFcyH9G70q9HpsG3QnvUBAm8" },
          { nombre: "Vol 3", id: "17oD33tpxGgdcKMAXIYoeSi0x-1s_fDvq" },
          { nombre: "Vol 4", id: "1vjFM1rk-P60LTIuiezXAkrb5Db4M4rH2" },
          { nombre: "Vol 5", id: "1ujThLghUpjq3zHc-yxRnEgcJOnyl1kAX" },
          { nombre: "Vol 6", id: "1XpmKkFOG9IE9c587Q4bxskEP3H6ltwYg" },
          { nombre: "Vol 7", id: "1v2_Go2lGjfz7TPsj7YfS1d8Zml42Ubny" },
          { nombre: "Vol 8", id: "1q1RcZlCyMOQnkd9qAi1LwsAeLG2por03" },
        ]
      },
      {
        id: "Go Further Faster Escapes by John Danaher",
        nombre: "Escapes",
        partes: [
          { nombre: "Gi Fundamentals - Escapes Vol 1", id: "1GcASPtwHQb9NA47mQVixHNbFV-PDlBmO" },
          { nombre: "Gi Fundamentals - Escapes Vol 2", id: "19AiK2KT0jvuaZruAQcEUcEEMr29bHqDY" },
          { nombre: "Gi Fundamentals - Escapes Vol 3", id: "14plCupK-Xu5ovy38hfWpJDxOSfvYGz4n" },
          { nombre: "Gi Fundamentals - Escapes Vol 4", id: "1wz_-Uc6QRsSMSlmKru8jjauilN5su3rZ" },
          { nombre: "Gi Fundamentals - Escapes Vol 5", id: "1sosFePh76aNfg5jWMdFApyR0HBqCcSSX" },
          { nombre: "Gi Fundamentals - Escapes Vol 6", id: "19gJaP7ktBhHVjpC0iGxjaLsv-7qtla3R" },
          { nombre: "Gi Fundamentals - Escapes Vol 7", id: "1YY1XPWjNuhpPUKeigGc6H2U5qNcqEVMa" },
          { nombre: "Gi Fundamentals - Escapes Vol 8", id: "1Rfnn8C5z3ftOCVIdWxsHXNBIqeFoNHfy" },
        ]
      },
      {
        id: "Go Further Faster Guard Retention by John Danaher",
        nombre: "Guard Retention",
        partes: [
          { nombre: "Gi Fundamentals Guard Retention Vol 1", id: "18QK-BWVHH6zI92f66ERbIR1A72lQrNgb" },
          { nombre: "Gi Fundamentals Guard Retention Vol 2", id: "1TgRKCc6Claqdx7g32fVLBc8a79KnbMuW" },
          { nombre: "Gi Fundamentals Guard Retention Vol 3", id: "1xWC0F86pqREG8vWbvE0COmFtSdFXnySW" },
          { nombre: "Gi Fundamentals Guard Retention Vol 4", id: "1ZrTZx3lKpvkps90eDpeYiRn6Dna2bUlv" },
          { nombre: "Gi Fundamentals Guard Retention Vol 5", id: "1gLzy1CFI6QdQmr-lYA3GVQcStXjj6vA8" },
          { nombre: "Gi Fundamentals Guard Retention Vol 6", id: "1tFxcb1QCahl0azMjwnLzr-NDVDVTObwl" },
          { nombre: "Gi Fundamentals Guard Retention Vol 7", id: "1uEzuHJW2m3y-_joCIwKtJDDxAF3JNNsj" },
          { nombre: "Gi Fundamentals Guard Retention Vol 8", id: "1pu2wULD-E4QdIwMfPJBT-eWVHOLXWYEt" },
        ]
      },
      {
        id: "Go Further Faster Half Guard by John Danaher",
        nombre: "Half Guard",
        partes: [
          { nombre: "Vol 1", id: "1b6h_fOipM6RmDANBII_fQEV_EaWqbQMi" },
          { nombre: "Vol 2", id: "1BkSzvLLyFiz9Mp0cReRtv7dHn1ZFtZBQ" },
          { nombre: "Vol 3", id: "ID_NO_ENCONTRADO" },
          { nombre: "Vol 4", id: "1Abvu5LQG4EwG0DaWiMSq6CFeG9MUq37L" },
          { nombre: "Vol 5", id: "1v3K3icK7exCSQwNs0rFGUcdF2c8R4XFG" },
          { nombre: "Vol 6", id: "1v1o-rAw8U8CfvW7Kaa3i46pucgeil3nK" },
          { nombre: "Vol 7", id: "1hHjpMz77Gj5BzjgcSINPh2gIIoBMGjUm" },
          { nombre: "Vol 8", id: "1bvoqC0Kis8C7__CvN27K5RP_Jordz5Du" },
        ]
      },
      {
        id: "Go Further Faster Half Guard Passing and Dynamic Pins by John Danaher",
        nombre: "Half Guard Passing and Dynamic Pins",
        partes: [
          { nombre: "DynamicPins01", id: "1VF1dlyzCkrqmmF-1Q3nbvBCjdIKp9_N0" },
          { nombre: "DynamicPins02", id: "1pgWdqFotwgScfL9ahYf3XwYb7-MiEKAs" },
          { nombre: "DynamicPins03", id: "12TYMah67jG5Onm7fIM4TBqMla9CS395x" },
          { nombre: "DynamicPins04", id: "1l-Z0S9LlBopclipH5BZH-RkVrTKcCvFV" },
          { nombre: "DynamicPins05", id: "12oojzfuN3KLx4qO1kYsp11fm6GaBLtxX" },
          { nombre: "DynamicPins06", id: "1hOnnRaOBcC5it_vEs3D7L2eXpEICz5Ik" },
          { nombre: "DynamicPins07", id: "1utZyX9Tk6JBd396xWeeLdtuns1dh0cMk" },
          { nombre: "DynamicPins08", id: "1WnNtzZ3q20Rvy0p8GAl9fJZV4XCrX2Wc" },
        ]
      },
      {
        id: "Go Further Faster Open Guard by John Danaher",
        nombre: "Open Guard",
        partes: [
          { nombre: "Vol 1", id: "1XKwSoUELgZWS-4E7LfO5FKAwikdvjjXo" },
          { nombre: "Vol 2", id: "15EQwL7b26BcSs8YOYQdvDha6Pu6xuTNN" },
          { nombre: "Vol 3", id: "1-Q_ELBt51rpHNUZXqLxpq8b5uFPSsCaq" },
          { nombre: "Vol 4", id: "1nXC9lUN7IIHiIQgKKyVRWyTa7sgwPyCc" },
          { nombre: "Vol 5", id: "1gSCNtwc9v09zdpjBhUakYqtgh_caKU16" },
          { nombre: "Vol 6", id: "1C8uoUajW-pM72-S08eA_vl4AhRRpBtAD" },
          { nombre: "Vol 7", id: "1bgN4-ahcYbAv5fyUNVAwjqDhAayXKBuA" },
          { nombre: "Vol 8", id: "1Pl11fqkBo7RPC1B_92GhYxdpS7BrU66J" },
        ]
      },
      {
        id: "Go Further Faster Passing the Guard by John Danaher",
        nombre: "Passing the Guard",
        partes: [
          { nombre: "Vol 1", id: "1pBtyg9YGpSHAvnhkc4ChIpo9OnjE7_NB" },
          { nombre: "Vol 2 ", id: "1_Y-VpBHwfnqNtzwi_tqEGV5wVpouinvC" },
          { nombre: "Vol 3", id: "1qXrKyT-WKy3h_z3vWwaN-HeAJkTTrevL" },
          { nombre: "Vol 4", id: "1QwXg9065tWEcY07Rhx5IT8Noph8i0Bnz" },
          { nombre: "Vol 5", id: "10LWlO7wjiP_DzRmCG6jF2iu7aNhsmK_5" },
          { nombre: "Vol 6", id: "1NChkXL24OIcEXgHD2_DWNn5mYuS91Zvn" },
          { nombre: "Vol 7", id: "13k3X82arn6X5flr9iGO_K0SK5L32cRN9" },
          { nombre: "Vol 8", id: "1wZn_pu45cCk1Abl8yIoplDRMXSVFxibn" },
        ]
      },
      {
        id: "Go Further Faster Strangles Turtle Breakdowns by John Danaher",
        nombre: "Strangles Turtle Breakdowns",
        partes: [
          { nombre: "VOL1", id: "1Ddaqqa0f4hEEjrTnbkJbTsVp_1Rb_ePD" },
          { nombre: "VOL2", id: "1tz0CU1FBmu9t8DoUM9KayUPPlhz40_8u" },
          { nombre: "VOL3", id: "1NbmFmrmdqIgupUyRnuzPp8vK06XgV3FX" },
          { nombre: "VOL4", id: "1LhLsmMygRYIioCksVDkYHOEyvV9VDIuW" },
          { nombre: "VOL5", id: "1NZXCXiDalM8_iS0SSEC3cuNCiM3JxRMJ" },
          { nombre: "VOL6", id: "1BONQJKwvQtjoqkMC_LTrptcTcEZkvu27" },
          { nombre: "VOL7", id: "1zhH8NncEJFn4NLw1AnnyvZrSYWDoixWm" },
          { nombre: "VOL8", id: "1_-v3MLINmDgkQClJveeqzL5Td5SNxCFV" },
        ]
      },
    ]
  },
  'GI': {
    titulo: "Ageless Jiu Jitsu_ Bottom Game Gi",
    autor: "John Danaher",
    volumenes: [
      {
        id: "Ageless Jiu Jitsu_ Bottom Game Gi By John Danaher",
        nombre: "Ageless Jiu Jitsu_ Bottom Game Gi",
        partes: [
          { nombre: "I", id: "1Vge68NLWBkulAFvD0My57BjFN3hxWs4u" },
          { nombre: "II", id: "1CLaGTBiXAI6VYkgzDVzmFyKN0KfhREEF" },
          { nombre: "III", id: "18pXUh20x3OBMLZiaQClkwg6Cy82C6Gfw" },
          { nombre: "IV", id: "1BQ1wrjJnfXhq8pPulH_GMo203ibotF-D" },
          { nombre: "V", id: "1JWgA0zYbN6PFqCIDLlB-OWNjWVrz5FQ7" },
          { nombre: "VI", id: "1FTj96-6GidFynHCX2juIAnPlgnukFIzh" },
          { nombre: "VII", id: "ID_NO_ENCONTRADO" },
        ]
      },
      {
        id: "Ageless Jiu Jitsu_ Top Game Gi By John Danaher",
        nombre: "Ageless Jiu Jitsu_ Top Game Gi",
        partes: [
          { nombre: "I", id: "1bBqabohIOhAJERV-txE84xvB6z74nwte" },
          { nombre: "II", id: "1GdqyqvXcB6bTjC0lK5LMfEOs3kcj0RJU" },
          { nombre: "III", id: "19uqLUqeyLqEc1vek82vf52inqUvsxASg" },
          { nombre: "IV", id: "1OHGIBWJS5pnpys38ZwHeL4ZhNNEZWeYF" },
          { nombre: "V", id: "1CdCcbVr6MIa3U1-t1mnNPPDbyBlcHa3R" },
          { nombre: "VI", id: "1jfBMUssViOywyhtIF814UsvTuOcHWLbZ" },
          { nombre: "VII", id: "1kEBYv5S7iCTMfJ-x2eEMilNAfU63do6s" },
          { nombre: "VIII", id: "1J0mlkOLk7k7SHLzQkGmnsRCM47sc3kAY" },
        ]
      },
    ]
  },
  'NO GI': {
    titulo: "Ageless Jiu Jitsu_ Bottom Game NoGi",
    autor: "John Danaher",
    volumenes: [
      {
        id: "Ageless Jiu Jitsu_ Bottom Game NoGi By John Danaher",
        nombre: "Ageless Jiu Jitsu_ Bottom Game NoGi",
        partes: [
          { nombre: "I", id: "1F0S7CS5IovBy-TvlQYkyGqTDpC2509nF" },
          { nombre: "II", id: "1HkzdA4Q7_JayDt2s3-hN5ehDPauO6U_7" },
          { nombre: "III", id: "1QwrrX_9bnkXQGKuswPfgkH_krRGgvNQb" },
          { nombre: "IV", id: "1aUyodpm0-owEWAMmZwgkCBzHM8zFnRjq" },
          { nombre: "V", id: "1uKjPyhHhGF_Mdb8eGGbwtnYAonjweqDC" },
          { nombre: "VI", id: "1X9JyL_BTZZj2fPnh6A9blvvAEyTSMZwO" },
          { nombre: "VII", id: "1RWcwpAqJLRHNnL73N7QyTg3F1mK58Ybu" },
          { nombre: "VIII", id: "1DF3Q5sE4zKp56nR_EtexWldPpTtoRJb0" },
        ]
      },
      {
        id: "Ageless Jiu Jitsu_ Bottom Game NoGi By John Danaher",
        nombre: "Ageless Jiu Jitsu_ Top Game NoGi",
        partes: [
          { nombre: "I", id: "14jya-HgPpnNHagCEEaMQQRuCYgOs3u3Z" },
          { nombre: "II", id: "1lEp7gEmYDTEAWlZzecAVcwLthl2Mryd6" },
          { nombre: "III", id: "1YlSYunIAykGkfOGE08kR40qXAUbAc_YE" },
          { nombre: "IV", id: "1SWKVhEryrN0YPgdpr8UzlTnybr4DxU1O" },
          { nombre: "V", id: "1XGEqLc0mGGdcVYME_97Xa7N9-Kb4KKoi" },
          { nombre: "VI", id: "1bK9aY3H3dFl-hojMs6uNb6tDg7MH0634" },
          { nombre: "VII", id: "1qxi7MjvlaMVW2wK_jNCf6LDHZCbqcPfZ" },
          { nombre: "VIII", id: "1F2SPqdkxIJSCK-D_qWxXlz6EJwJqnh1C" },
        ]
      },
    ]
  },
  'Feet to Floor': {
    titulo: "Feet To Floor ; Volume 1 Fundamental Standing Skills",
    autor: "John Danaher",
    volumenes: [
      {
        id: "Feet To Floor ; Volume 1 Fundamental Standing Skills",
        nombre: "Volume 1 Fundamental Standing Skills",
        partes: [
          { nombre: "I", id: "1_4khnlMz4WNV6uqOKaJ6xCEIou7CustE" },
          { nombre: "II", id: "1ApDuGgIxXs-MveDeORcFr2qvXalWMFNI" },
          { nombre: "III", id: "13njpAZIvGKw7Hf61Dlp3agUqOBbNrmdp" },
          { nombre: "IV", id: "1ZvGMYQKV7AvzyBlGiUkAKqueScpUpPnl" },
          { nombre: "V", id: "1VmuBxvABwxGKoHnuogJTlQDpG1P7Vgd7" },
          { nombre: "VI", id: "1jsj5E5WUmgi_j6f9MYQIVf0fM5RVOhGR" },
          { nombre: "VII", id: "1uYX5ch7ZktLk4quIjC37vlZEYsEZ02YB" },
          { nombre: "VIII", id: "1eWkKudAQHhPYsDYpq2CViWd7xmzylB15" },
        ]
      },
    ]
  },
  'Youtube': {
    titulo: "videos",
    autor: "John Danaher",
    volumenes: [
      {
        id: "YOUTUBE DANAHER",
        nombre: "YOUTUBE",
        partes: [
          { nombre: "3 Submissions Every BJJ Black Belt Should Know by Craig Jones, Bernardo Faria & John Danaher", id: "1sv2AuN4aZHwAjQA4y23btZhUQQRpALQc" },
          { nombre: "Georges St. Pierres's Coach John Danaher on Jiu Jitsu and grappling", id: "14bNpcClh65TiMocSLD3C2FWtoFsTxXUl" },
          { nombre: "John Danaher - The Philosophy Of Martial Arts- The Man Who Inspired Me To Learn Brazilian Jiu Jitsu -  - 2020-06-06 12-16-10", id: "1MT5A49L_vqPkFcqhToPBd-Ox9arefjDg" },
          { nombre: "John Danaher- Coaching High Performance Jiu-Jitsu __ BJJ Hacks in NYC", id: "1BLrjfMupwOrQY9oiy2ItXaEBo59avl08" },
          { nombre: "JRE MMA Show #11 with John Danaher", id: "1KH6iuPb76bI--p0803YZEoMmtB9xzfzG" },
          { nombre: "Roger Gracie & John Danaher- Zoom Conversation", id: "1SAHLVOQ6fmw1V3bRuhNNdT29yjt9-jHk" },
          { nombre: "The Importance Of BJJ Fundamentals by John Danaher", id: "1t0UqOZQGeqccCjNmomuE7YjEQ24c1DL6" },
          { nombre: "Understanding Jiu Jitsu by John Danaher, Bernardo Faria & Gordon Ryan", id: "1u0mdPadU4Ebofou-PGZ6thRdUFsZ6TRM" },
        ]
      },
    ]
  },
  'Gracie Combatives 2.0': {
    titulo: "Gracie Combatives 2.0",
    autor: "Gracies",
    volumenes: [
      {
        id: "Gracie Combatives 2.0",
        nombre: "Gracie Combatives 2.0",
        partes: [
          { nombre: "Gracie Combatives 2.0 Intro Class", id: "1YrdcAG62t-Kfj-xJGA463eguORGizZ9F" },
          { nombre: "Gracie_Combatives_2.0_Official_Handbook.pdf", id: "122C4Z9qhfRwtxZ0zYsAPjfQZ-RfPAjad" },
          { nombre: "Lesson 1 Trap & Roll Escape", id: "1wgzBjSzSfGtjrHhO-hsDj4JzJmlrEdXc" },
          { nombre: "Lesson 2 Americana Armlock", id: "1eofVwx3U9uJQtp4X_NWaAwFH9wHI5xT0" },
          { nombre: "Lesson 3 Positional Control (Mount)", id: "1UoNuBcCB99JF2n5bnwohQnqoD58H2F02" },
          { nombre: "Lesson 4 Take The Back (Mount)", id: "1NSvtJc1Jd4Cm1z5SEr8GyIKLeA4bAE0I" },
          { nombre: "Lesson 5 Rear Naked Choke", id: "1-DSZa-7jA6MPIJGszFU20TeAbUJDGJtQ" },
          { nombre: "Lesson 6 Leg Hook Takedown", id: "15v1RzrfZbBiEndagwPnTr3ROupmo83sM" },
          { nombre: "Lesson 7 Clinch (Aggressive Opponent)", id: "1CG52cYpaNEdLiRIOSDV-Qj5ywjOtTiE5" },
          { nombre: "Lesson 8 Punch Block Series (Stages 1-4)", id: "1dKgf5RhQSF23HIJ9286sDdPRpdTGUSV7" },
          { nombre: "Lesson 9 Armbar (Mount)", id: "1urKGja7sYADKaPJHlCXkON6gX536_prp" },
          { nombre: "Lesson 10 Triangle Choke", id: "1FAErCEsN9wMmsU3YrgyzvmW-QelvV9Jb" },
          { nombre: "Lesson 11 Elevator Sweep", id: "1Wj4dp_QceXwa6eJ-zftz4-NW5yBr1fzE" },
          { nombre: "Lesson 12 Elbow Escape (Mount)", id: "1GgHaxS79E5xnPfHJxdNw6kbnf9IKPVMs" },
          { nombre: "Lesson 13 Positional Control (Side Mount)", id: "1jHEsC2m4wx20OXL3RfNIvb2DCz9pvZGB" },
          { nombre: "Lesson 14 Body Fold Takedown", id: "1iMJ-AkaPNi3D9nH8KGl5FEiykltFWbto" },
          { nombre: "Lesson 15 Clinch (Conservative Opponent)", id: "1v4EUm4PrqgCC0xcJyURas88gq1H64MFV" },
          { nombre: "Lesson 16 Headlock Counters", id: "1QRl97HznR7jbXhKVqzrgKoQX-gC90gtf" },
          { nombre: "Lesson 18 Headlock Escape 1", id: "1yd1dCkPiDC97qu_SKXSyZ_IyBIjkKIcu" },
          { nombre: "Lesson 19 Armbar (Guard)", id: "1DVO7fSwseS7yuTAfGxqgbX9-j9tCRsoL" },
          { nombre: "Lesson 20 Double Ankle Sweep", id: "1VgjqNNs1MpLwSU_Q_6S579mOrjxkU5fM" },
          { nombre: "Lesson 21 Pull Guard", id: "1X1xBcgIeabtcp5VAvcEDZhFhIMm3pyh-" },
          { nombre: "Lesson 22 Headlock Escape 2", id: "1YwgqEXzCcFEw1Oj8i5Xd2iAFtsVCntmT" },
          { nombre: "Lesson 23 Guillotine Choke", id: "17y0drCUP742D2JoXdoRGNHlSbVM6J7gF" },
          { nombre: "Lesson 24 Shrimp Escape", id: "1yV2urL7Aw7Avnp6f53VIS3Q2bIwdJV90" },
          { nombre: "Lesson 25 Kimura Armlock", id: "1jtPeU_wi-TmkxjpC0rUdPVp1xz24Z7GY" },
          { nombre: "Lesson 26 Standing Headlock Defense", id: "1PsXxEVOT5It_OjZKFABrlKEkBvtbXSJJ" },
          { nombre: "Lesson 27 Punch Block Series (Stage 5)", id: "1ukZxPM4Xcowlkvuhp2ndZ9N61p1-qUCi" },
          { nombre: "Lesson 28 Hook Sweep", id: "1Dsrs0RbSY6ld0gy7kwMCJypRszRgN_5O" },
          { nombre: "Lesson 29 Rear Takedown", id: "1sRrUntViObxTdcMtJoaUvPhIOeW2-RM-" },
          { nombre: "Lesson 30 Haymaker Punch Defense", id: "1XLlDH6PRdBeGCyNrlaklagGaqz55luVw" },
          { nombre: "Lesson 31 Take The Back (Guard)", id: "1Vc4kxU6iVsKMOWFZY3l-7UBDcEAZSlk-" },
          { nombre: "Lesson 32 Guillotine Defense", id: "1QQrgPbXpSRi-_0Og7KjtK__u62pIZyKM" },
          { nombre: "Lesson 33 Elbow Escape (Side Mount)", id: "1V5I8J3e08IeV1rtt3-yO6bGjTmJmdDjC" },
          { nombre: "Lesson 34 Standing Armbar", id: "1zB2xvQE3k_6XSe7gYpNJ9pW-L4Yn71Ev" },
          { nombre: "Lesson 35 Twisting Arm Control", id: "15lXTieosq-Kl7JcekmqFZ6zwdhg0YcM_" },
          { nombre: "Lesson 36 Double Underhook Pass", id: "16YRNtozgEu27S1d8AMl0dy98WIuMCIAO" },
        ]
      },
      {
        id: "Gracie Combatives 2.0",
        nombre: "Drills Gracie Combatives Test",
        partes: [
          { nombre: "Gc Test - Drill 0 Introduction", id: "1rq4GIXBuEY6ev_G5krWvwEF9eTt2Ulkv" },
          { nombre: "Gc Test – Drill 1 Mount Techniques", id: "11IimuVoUsjoek_DjADca41vfTMyY0aGh" },
          { nombre: "Gc Test – Drill 2 Guard Techniques", id: "10RzGOr0qSwAWFLNc-UrtScx46WxdgcQK" },
          { nombre: "Gc Test – Drill 3 Side Mount Techniques", id: "1cjXTPo4mE-sPKgRzb4qyPoxm9Ik3JiFw" },
          { nombre: "Gc Test – Drill 4 Standing Techniques", id: "1LkPADjvc7B_Tg2gFft0U5J-8YxcmhR35" },
          { nombre: "Gc Test – Drill 5 Freestyle Fight Simulation", id: "1CpavgexhLJSU7ct0R4kxeTZvZAAGJNDd" },
        ]
      },
    ]
  },
  'Task Based Games to Rapidly Improve your Jiu-jitsu by Kit Dale': {
    titulo: "Task Based Games to Rapidly Improve your Jiu-jitsu",
    autor: "Kit Dale",
    categorias: ["DERRIBOS", "JUEGOS"],
    volumenes: [
      {
        id: "Control Games",
        nombre: "Control Games",
        partes: [
          { nombre: "Control Games_ Balance games for passing", id: "1QTHbzUHxqPflKquUhOufcW6JvtWejsXw" },
          { nombre: "Control Games_ Breaking their balance from Guard", id: "1I5IrRgZLqokDFIFWNWPdY1MqEIYr7xBf" },
          { nombre: "Control Games_ Cradle position on Top", id: "1nUW4jBrvYGt_HMCHv82yP09K8bjrqBgx" },
          { nombre: "Control Games_ Grip Breaking Games", id: "1BYE_rOGEEzR8nUSFITSS0aUw6QmLruB6" },
          { nombre: "Control Games_ Knee on belly", id: "1rb3RaUnTVN7DFz0apquydxCjUa0JfOeL" },
          { nombre: "Control Games_ Mount Control", id: "1vKNpE-yTnLaKeW-gTpYNEyZQQy707f6h" },
          { nombre: "Control Games_ Passing", id: "1oG0Pya6ndU7tml6-gNV-xNwXsmlaW7HB" },
          { nombre: "Control Games_ Play Guard without using legs", id: "1dq0tXxH6f24Ll26u88BzW3Kxd5sgFD5D" },
          { nombre: "Control Games_ Play Guards without using hands", id: "1esgyiuvLs29Xgd2vQm5IBXiyvIbL8xmk" },
          { nombre: "Control Games_ Side Control", id: "1eJcJJCP1qREevoOBb1fAhF-76Frhz9uU" },
          { nombre: "Control Games_ Two for two", id: "17uwDvlDan0-gNfM3icMc8leHxduiMpjU" },
          { nombre: "Control Games_ Wrist Control", id: "1_Cqu4FG8M4L7XKgcXiMFOFK6vjmnS6J2" },
        ]
      },
      {
        id: "How To Use These Games",
        nombre: "How To Use These Games",
        partes: [
          { nombre: "How to use these games", id: "12ZHtP6pdKax8M-jhaHUmbci3W_3vjuB9" },
        ]
      },
      {
        id: "Hyper Specific Task Based Games",
        nombre: "Hyper Specific Task Based Games",
        partes: [
          { nombre: "Attacking with the Fishing-pole Grip", id: "1uY1iAHDpCxZ9uGY5iXBhWOcPcTNHCyX0" },
          { nombre: "Controlling the fishing-pole Grip from Standing", id: "1oD8i0iF0hCceLpa8-2Zd6PTkTZVraz8E" },
          { nombre: "Controlling the Fishing-pole Grip from Z-guard", id: "1Cag99QfMUS6IQrCCEYXSsJB0XUDnXo0T" },
          { nombre: "Double-unders from Butterfly Guard", id: "1poFFihbH0RnEy7C7NlZ2i-yysTUtyIsd" },
          { nombre: "Finishing the Arm-drag from Butterfly guard", id: "117ATYCe5KNjzD15FcKWc4_zOiwGHZi56" },
          { nombre: "Half Guard First Point or Submit", id: "1bF5HT2S1IzS5DtD2xGfl7en3FfsNjANe" },
          { nombre: "Keep Half-guard VS Escape Half-guard", id: "1vwQEx-7qHGzbUA2Ukb7d3GTN8-N01g81" },
          { nombre: "Knee-Cut Passing with Underhook", id: "1KL66ULc8v6fKFYvfFxUihVY34UXMBwYr" },
          { nombre: "Obtaining Control Position from Standing", id: "1e8dZT27sjECTcMKeUxO9nwkJ8bUDAtgH" },
          { nombre: "Passing with Body-lock", id: "1T7jl8zUsgqV2kIwBXbWIrCLhSbljno40" },
          { nombre: "Passing with Double Underhooks", id: "1djVhKPi6Vs05N8N1FIP-IaHdRnPBo59t" },
          { nombre: "Passing with the Underhook", id: "1ggP4hcKXKWz2Pe8M6WWC1-2gyMOObjuq" },
          { nombre: "Winning the Double Under-hook from Standing", id: "1ZjCMShzPLhbLrRKBhMYhebb5f0yYD-yw" },
        ]
      },
      {
        id: "Positional Sparring Games",
        nombre: "Positional Sparring Games",
        partes: [
          { nombre: "How to Create New Games", id: "1KcGC76zc-dMam0L-_FWKwRzHkT1z6cOy" },
          { nombre: "Double-unders", id: "1uYvuYm9s6URonMUI3Wi2YGFZwfg3Z7HK" },
          { nombre: "Half Butterfly Guard", id: "1bSewXjJE3CZlBVw4XzecIFQkTxelBS0w" },
          { nombre: "Half-Guard", id: "1ueO8sxq-KfW8T3CaVIVn-89KAXjfMlDQ" },
          { nombre: "Inside De La Riva", id: "1vQ2tkyGbYZ-ANLmQwJEtZdNwzgbhAYHu" },
          { nombre: "K-guard", id: "1Kklpa4_pFwy79EWhns3AzX5g8pJBRF2t" },
          { nombre: "Open the Closed Guard", id: "1KVsvi9ObU8li0desKPrqCZ6N-i-gYyqz" },
          { nombre: "Outside De La Riva", id: "1MhpP09H6R4VqxlDfxGVtB8AgshytBvNg" },
          { nombre: "Single-leg X", id: "10IOypg4Gauhz3Tg-BzjaM3BKAFc0lcFc" },
          { nombre: "X-Guard", id: "1B_OLcLmtGkIoZ6mtHCatUH6AXD5vhNPP" },
          { nombre: "Z-guard", id: "1W6sy8Zau2Mnt3R2Fp7kg5dLsLvZWLZ7s" },
        ]
      },
      {
        id: "Positional Sparring Games from Stand-up",
        nombre: "Positional Sparring Games from Stand-up",
        partes: [
          { nombre: "Control and maintain Body-lock", id: "1GJmxmQ8_rHl7Lj06pTE59e5c9YseFoX8" },
          { nombre: "Control and maintain Double underhook", id: "1hHNp3rfuRY1SS1xA1RbVc6_dPPia57KT" },
          { nombre: "Control and maintain Low under-hook", id: "1sioxZ3QuV1N8Otbm7yjbzQV3ADNf2cc4" },
          { nombre: "Control and maintain Under-hook", id: "11qqI-ljNu2WHITwolvVzMh_U4XebOCSD" },
          { nombre: "Control Single-leg", id: "10DNWyi2s92mCHyXYGHc9HbVSnJAsjfuw" },
          { nombre: "Double-leg Control", id: "1FJFnct706t7iKYm-poiRVBd9yaGt6oc9" },
          { nombre: "Positional Sparring from Stand-up", id: "1HnDJGkdYypXWHJUmFXHrf2hSUtFXxoAc" },
          { nombre: "Collar-tie and Inside Bicep Control", id: "1nnK0zaSbKjrC81_XDpcLOOC2H_cTsTQf" },
          { nombre: "Control and Maintain Reverse Body-Lock", id: "1vi9NpsDt3kmW-YwrTVYji2xzlMPInR3q" },
          { nombre: "Russian Two on One", id: "1gtnte32JzcsGDWgbLqLJdGo_DhgoN--I" },
          { nombre: "Waist and Bicep grip Reversed", id: "1woJCzbRV7fInE7SrjmKc6eN-T6Obyes7" },
          { nombre: "Double Outside Bicep Control", id: "16jDKUe7Hz9HCPY2ZQAoekVyUapR6cvu0" },
          { nombre: "Double Inside Bicep Control", id: "1djo3nNWbfWsGxpfg4GFBR_Jjvx3DI-aN" },
        ]
      },
      {
        id: "Sponsors",
        nombre: "Sponsors",
        partes: [
          { nombre: "Sponsors", id: "1pX3FgSbeYpRbhuWJQmV8OrzzKnYk-rxM" },
        ]
      },
      {
        id: "Submission Games",
        nombre: "Submission Games",
        partes: [
          { nombre: "Submission Game_ Kimura", id: "1xzXy2J0EdRINNG-k2A4jwb65IGweAc69" },
          { nombre: "Submission Games_ Armbar from Top", id: "1NEtTRsoTFblnQGT_VWUm1EeemuWmTSML" },
          { nombre: "Submission Games_ Guillotine", id: "1ri-J5DDD2rhYaLSM5wNAxOipfjyIu0bw" },
          { nombre: "Submission Games_ Rear-naked Choke", id: "1_YHDbvNrMQPURb6uVmPRr4ycZVc_IZJq" },
          { nombre: "Submission Games_ Triangle", id: "1uDQh9s-_DW9R4DumKKbLyCoBQgz7xaOV" },
        ]
      },
      {
        id: "Welcome to these Task Based Games",
        nombre: "Welcome to these Task Based Games",
        partes: [
          { nombre: "Welcome", id: "1WqAlAjAFuaiN9grOfuvcpNFtf7B6U0rA" },
        ]
      },
    ]
  },
  'jiu jitsu Games': {
    titulo: "jiu jitsu Games",
    autor: "Kyvanng, Bodega Jiu-Jitsu",
    categorias: ["DERRIBOS", "JUEGOS"],
    volumenes: [
      {
        id: "Volumen 1",
        nombre: "Volumen 1",
        partes: [
          { nombre: "1.1 QUARTER GUARD GAME", id: "1RNTQdcCiIF3qd8IymbybZ1k4W5wHEwOK" },
          { nombre: "1.2 Standing double underhook game", id: "1ZJJqLVKx7Dwk7FmSvxegfcgWUeYTuZvK" },
          { nombre: "1.3 Standing connected game 2 part win condition", id: "1RXaMty8e-O2dv1RZVgfIpws3PPVR5KF-" },
          { nombre: "1.4 Closed guard (with arm across)", id: "1qoYZOCueve-19I82JsgwEBtyLAsuunhQ" },
          { nombre: "1.5 half guard game (souders game)", id: "1PnzckHabmKjVzBu3LBCCOHfqxU16cS1T" },
          { nombre: "1.6 Chest to back game  (no hooks or grips)", id: "1j5KkF4u_uFKm-Ku9loAN0rwOKzBP6c7S" },
          { nombre: "1.7 Chest to back game (no hooks)", id: "1sItg9ND9gl2ZnGu0Iudpnyb3VAfl29KN" },
          { nombre: "1.8 three-quarters Mount escape game", id: "1G4_kwBbWF3RWGsOq557Pp76QgtFKqbUr" },
          { nombre: "1.9 three-quarters mount continued", id: "1SXvf45RmMFbSWDR5xIlbfsxkP02SmGg5" },
          { nombre: "1.10 Full Mount escape game", id: "1NMS6wanBWkjhWmDsAC5RYanNmlFCT2lg" },
        ]
      },
      {
        id: "Volumen 2",
        nombre: "Volumen 2",
        partes: [
          { nombre: "2.1 RDLR game", id: "1NLFuj8ZvP17ultzcTw7jn_cGGOXPMc-m" },
          { nombre: "2.2 Feet off the ground game", id: "1X5e81kUng2SX95QMXFbjuaEALnn487zd" },
          { nombre: "2.3 Rear naked choke game", id: "1MoxmMdabde2HfFcM2YcOPnO3KLz9xGgt" },
          { nombre: "2.4 No hands guard retention game", id: "1C3_xgEr5sBWjZKKvYBliNYRlgREfTxYj" },
          { nombre: "2.5 Just sit up game", id: "1Ry1Nd9h8DNWCEDHGXR3HSVghFGhEYTJu" },
          { nombre: "2.6 Body lock leveled game", id: "1xhNJzV4NbWzKQ4Gp3JsMTkyHydW7b-mu" },
          { nombre: "2.7 Standing body lock to single leg game", id: "1e00amnpuFQXW1t3TX6AMUUdChPCnI6bQ" },
          { nombre: "2.8 Dirty feet game", id: "1XfkMHzojboZZ-TTvnHsUAGSB6-ZHnGYX" },
          { nombre: "2.9 Double knees down single leg situation", id: "1ZLA389AiMUgKHY1lKj1A4lVsC3RxWTD9" },
          { nombre: "2.10 Closed guard situation", id: "1LzebXxCd7AjJmJVUrNFUau_NukaiAaRb" },
          { nombre: "2.11 Butterfly guard w double under hooks.", id: "1GlUeRgZ8Sloy94pP4pku9qjcX0BDeZuI" },
          { nombre: "2.12 Circle game limited", id: "1X80isihw51hB5YQx_B3JlZ5bIXPvHJCW" },
          { nombre: "2.13 Leg locks 50 50 maintain condition game", id: "1S5Ip_aaXp_CVh212bHITu-8tS6ZkIy0a" },
          { nombre: "2.14 Mount three quarters game - escaping focus", id: "11qnQhO5PA7TvWQeTKgy2LmIJ87dBKxpA" },
          { nombre: "2.15 Back Control Arm isolation tip", id: "15zArMmAwXitvsCMQG7B3eyK99K7NAXKl" },
          { nombre: "2.16 Inside space game from bottom mount", id: "1M5U34P_Zw3ccFH8GDrBfTC0f3VXPPSRv" },
          { nombre: "2.17 Leg entanglement 50 50 with win condition", id: "1X_ayIaLPdktSP3Mpq_ejx-jwg8DehaE-" },
          { nombre: "2.18 Back Control arm trapped situation", id: "1R1NnvTkOmPwbmmpukC_m4tWIC4dOsnlH" },
          { nombre: "2.19 Back attacks rear triangle precursor", id: "1A_IqFP9Bf4UWFg595qvQrQ0Pes781b7G" },
          { nombre: "2.20 Back attacks rear diamond game", id: "112kZGcIoKTZ0_YZOKGntJTzl1lnfh4-N" },
        ]
      },
      {
        id: "Volumen 3",
        nombre: "Volumen 3",
        partes: [
          { nombre: "3.1 Butterfly guard arm drag game", id: "1wWCmd3c1is9WikfL40okDTZCmFmga41m" },
          { nombre: "3.2 Posting Concept", id: "1aQkVT9Z8v0_FLGgD_sHl49HS2CKui36l" },
          { nombre: "3.3 John Danaher mat return game", id: "1FA2JhAPWT6swi-rI2HIi9QJqxNzbzOnT" },
          { nombre: "3.4 Mounted triangle game", id: "1BilwimiseH9K0ukKCN3iHAOWRYBlV95i" },
          { nombre: "3.5 Gianni Grippo Q&A", id: "1MPoCDYWmfNxyteIVU3NF-jjHZZtEpBY2" },
          { nombre: "3.6 Diamond to figure 4", id: "1wHHlp42_a0hEe_wDz5g-h9Dp0CMSa5MM" },
          { nombre: "3.7 Fundamental Game Keep them on their back", id: "1zR5GT3f_5pgGqSFAxjfEUmIYC8-nryQW" },
          { nombre: "3.8 Fundamental Game Closed Guard posture control game", id: "1E4K1UD0u1jsOTSoRbjp5b6DSBOfenBlq" },
          { nombre: "3.9 Hip Control Leg Drag Game", id: "12Gb1SmI7PH04CuDUtzFcmOXsAY70h1zI" },
          { nombre: "3.10 Level Change Game", id: "1sGSqo3z515eX7j5wsIr7H9GW7HeNA7-k" },
          { nombre: "3.11 Front Head Lock Game", id: "1EkOnivPenRQR2T7DWiWRFuCJ_JFSzoy2" },
          { nombre: "3.12 Anaconda Finishing Game", id: "1H_S9BEv449ov97jt5aoTcTQ8tupem1KA" },
          { nombre: "3.13 Circles Game", id: "10pKQ3v9OHYpJJgKqHFCa6EsxuKEUYR80" },
          { nombre: "3.14 Circles Games  Class adjustment and tips", id: "15CbYtv1e__GyE4K4_FyVpWJ0UlI9-eCs" },

        ]
      },
      {
        id: "Volumen 4",
        nombre: "Volumen 4",
        partes: [
          { nombre: "4.1 Q&A with Andrew Tackett Pt.1", id: "1xLNg9QxCECJFIU_aCytVQZHCOAieWmJG" },
          { nombre: "4.2 Q&A with Andrew Tackett pt.2", id: "1w-EWS5iAr_iMwAmpJ2s4LlElWQXR_F4P" },
          { nombre: "4.3 Q&A with Andrew Tackett pt.3", id: "14a_iAeeG0MjFc0ZtVaRfpk9kbLJ6FORS" },
          { nombre: "4.4 Q&A with Andrew Tackett pt.4", id: "1gAIWbI66287RRE-IATO5DJ3gCTRQ4_8v" },
          { nombre: "4.5 Standing Single Leg lift game", id: "1pVKdk4hNhCwUSXos8PAIHYOitd0fP_gP" },
          { nombre: "4.6 Darce Finishing Game", id: "1Hf_x6Ry183AZqFk-1IG4jjya1FL88ZFo" },
          { nombre: "4.7 Guillotine finishing game", id: "1fQRAyeCDvjwlGjlAlezGkUyw9X_CSPph" },
          { nombre: "4.8 Passing Knee Shield Game", id: "1EROJWY8EwPbfKAeHmPk79HeDH9JHJsNA" },
          { nombre: "4.9 Kimura - Breaking and back taking", id: "1CktixNFJf6bZSkX5q-1Y9BH0Hax1Kk9U" },
          { nombre: "4.10 New Guy Game Plan Pt.1", id: "126TP1FfRKfHRLXWpcKPHtcOILNWtiKku" },
          { nombre: "4.11 New Guy Game Plan Pt.2", id: "10GRJ7pMnQBhcvkwHJ5_iILB7iICTE3Vb" },
          { nombre: "4.12 New Guy Game Plan Pt.3", id: "1CyAy3SRG73_yQhnu0O1DWzLyCePmmB8Y" },
          { nombre: "4.13 New Guy Game Plan Pt.4", id: "1ghheujaMLBqo8oiBXBPf1UUnmwLxYw0K" },
          { nombre: "4.14 New Guy Game Plan Pt.5", id: "1mRRUWvzSGAHUI1QXbEM0KSLUu0AGIdKF" },

        ]
      },
      {
        id: "Volumen 5",
        nombre: "Volumen 5",
        partes: [
          { nombre: "5.1 Arm bar escape based game", id: "1QDkvMQlndrbwNX7rtLdmioAFRU0XKUrW" },
          { nombre: "5.2 Chest to back game", id: "17G0I0NjIlG4RYh_6D4DRw2xq-QKiZvl8" },
          { nombre: "5.3 Full Class 12 2 2025 Pt.1", id: "1SjIV2Jm3BsN0EsTmyA0OjR1wyIsZpYJS" },
          { nombre: "5.4 Full Class 12 2 2025 Pt.2", id: "1TSsn_XFjHBhSlwP427JoqwQYSHCQZ-CB" },
          { nombre: "5.5 Full Class 12 2 2025 Pt.3", id: "1zis9vf31ExNSnFP_nqxo850hRoPysstQ" },
          { nombre: "5.6 Full Class 12 2 2025 Pt.4", id: "1k5Y_qtSJBwQFFAXfxs_qr9klJmpvXE0P" },
          { nombre: "5.7 Full Class 12 2 2025 Pt.5", id: "1TRwI8Mpfyvwzj0qdiLkAzdVJS8rnMFR4" },
          { nombre: "5.8 Full Class 12 2 2025 Pt.6", id: "1FEaV1LbMZv8663VM2k2datYtJUwKCxat" },

        ]
      },
      {
        id: "Volumen 6",
        nombre: "Volumen 6",
        partes: [
          { nombre: "6.1 KIDS Circles Game Ltd", id: "1jzVPcwJYFjW3Vem7TPvxGMcja9BIPIxU" },
          { nombre: "6.2 BCJJ Seminar Pt 1", id: "1XhTx5Pgbt_6YdGDAryBUEn0PJPxCO9ql" },
          { nombre: "6.3 BCJJ Seminar Pt 2", id: "1cyY1_pc5Td_m7VOZNEfz_uKOgP40TztD" },
          { nombre: "6.4 BCJJ Seminar Pt 3", id: "1yQRHZWDF6dnuWgocft11G8l2fozytnyV" },
          { nombre: "6.5 BCJJ Seminar Pt 4", id: "1W2oa_6Uhtks7Owvube39e5Z_dYxV4CeT" },
          { nombre: "6.6 BCJJ Seminar Pt 5", id: "1vC4Ok50_fk_3h438bWDfmqX_aomc1KE7" },
          { nombre: "6.7 Full Class Front Head Lock Pt 1", id: "1krvt0_4EmCG4Af6qNAzhovYOJjWi10U5" },
          { nombre: "6.8 Full Class Front Head Lock Pt 2", id: "1zc2kOySReMmJboMqPfYdTrjE18nYZnF4" },
          { nombre: "6.9 Full Class Front Head Lock Pt 3", id: "16BzB-_tfH9EaGga9aThG_7sXxF9REXWf" },
          { nombre: "6.10 SUPERCUT Front Headlock Class Games", id: "1TjoG7yWWe576QhNE60L_7BBtS1XAJgp0" },
          { nombre: "6.11 Genesis c2b leg locks pt 1", id: "1iz7FuH6NO5QvSjBog5cxTKR5aF8PA5ea" },
          { nombre: "6.12 Genesis c2b leg locks pt 2", id: "1C4l64XuqWR5yxF22NPykA2fVhQrY1nfx" },
          { nombre: "6.13 Genesis c2b leg locks pt 3", id: "1BSWNK7cZdErGY8QD0Rj6xJxBFIz9bA_o" },
          { nombre: "6.14 Genesis c2b leg locks pt 4", id: "1zYU1SYAu1FnWVBIAtTrBz2d6dEZSKjcE" },
          { nombre: "6.14 Genesis c2b leg locks pt 5", id: "17J1T-kitTLGgyw_xbaiPyU7cT-QT3mAL" },
          { nombre: "6.15 Genesis c2b leg locks pt 6", id: "138MCL9ufJibEYSWEiKF5ztJf571nZZr2" },
        ]
      },
      {
        id: "Volumen 7",
        nombre: "Volumen 7",
        partes: [
          { nombre: "7.1 Kyvann Greg Souders on Invariants", id: "1r81yecBiAgpANjW-NbrMtJhGAqWw9hHp" },
          { nombre: "7.2 Kyvann Greg Souders on Invariants pt 2", id: "1aHPYKBOAmztQYGeuffijGv4TKVX2AV0h" },
          { nombre: "7.3 Kyvann Greg Souders on Invariants 3", id: "1mIfzVV_ZnnRYtatLovdJnwdj0EiXoqE-" },

        ]
      },
      {
        id: "Volumen 8",
        nombre: "Volumen 8",
        partes: [
          { nombre: "8.1 Back Triangle Escape Analysis", id: "17cN_ZhFXTxEUettJ7aEoRUyvm-AaiABP" },
          { nombre: "8.2 Full Class C2b figure four", id: "13BsUgzawJ1wxUxq3EGbNiZTm87-EsZ4M" },
          { nombre: "8.3 Full Class C2b figure four", id: "14-FQMhArVtGNjLoq_a7gwPSvbAYIyOC4" },
          { nombre: "8.4 Front Head lock - Precursor to anaconda darce", id: "1p6DE7bxddSl3MUHnnPcFlG1Uw7oLtkxh" },
          { nombre: "8.5 Front head lock to figure 4", id: "1BR1gQIsOUHkc19wKHwHGsA0gz49qv2AW" },
          { nombre: "8.6 Butterfly Guard Game", id: "1o5B2h2tQ7qzbpg-i4jqKijbviinJazAt" },
          { nombre: "8.9 ATX Gianni Grippo Seminar 1", id: "1Km_T_2yYXHd8s_sSSBoSrh7jBR7Ku2eL" },
          { nombre: "8.10 ATX Gianni Grippo Seminar 2", id: "1_gVSHKKKXMalJlyn5m31QUbK8v1b0nNP" },
          { nombre: "8.11 ATX Gianni Grippo Seminar 3", id: "1rryr0xXYxaNLTFj-FfeVCmw3At-ZnBhm" },

        ]
      },
      {
        id: "Volumen 9",
        nombre: "Volumen 9",
        partes: [
          { nombre: "9.1 Warm up Game Toe Touch", id: "1rm5UDrI7ydr9jX9UkyRlRiazY9yWfJfc" },
          { nombre: "9.2 S Mount Control Game", id: "1eqdjzLUDfDUdAgWAjJPcz8_c-zPjpz56" },
          { nombre: "9.3 Mount Double Underhook game", id: "12tSJbo7K0Q3aiZ_X7bD5q8ZJDe8uNcDc" },
          { nombre: "9.4 S- Mount Armbar Game", id: "1cPM_3DbKb9Ou6TVhz7soRxgiloSnFe9m" },
          { nombre: "9.5 SUPERCUT Feb. Week 3, c2c armlocks", id: "1d4cs5gyDkjqprX8UBvvhLIJIAcqbUY8o" },
          { nombre: "9.6 Passing Game Precusor forcing halfguard", id: "1S3AvHAmwS3wN8Gyo20DH_LahGVHOKyVV" },
          { nombre: "9.7 Wrestling - Single Leg Control", id: "1YtVdArv37vMPlt5vHS-tkD7ybhgLSQQV" },
          { nombre: "9.8 Wrestling- Single leg to Hips hands", id: "1_p-Wsp7gI7iGDRhI-hGFhXkfD7YbmpC_" },
          { nombre: "9.9 Wrestling- Up-Down Game", id: "1UQiQILyNRFh1T5di_40xqZTpPedSlo2_" },
          { nombre: "9.10 Wrestling - Toe Touch Game", id: "168X7xs5-ythqJ2tpTvzYuZMIhvLvooX8" },
        ]
      },
      {
        id: "Volumen 10",
        nombre: "Volumen 10",
        partes: [
          { nombre: "10.1 Zombie Seminar Setting Expectations", id: "10mdgIzNpWdjMZ-5uhyRT5WTiBBa19PcE" },
          { nombre: "10.2 Zombie Seminar Setting Expecations 2", id: "1XGXC9VtQZCrOYdReEWxfFg4se2znp1g9" },
          { nombre: "10.3 Zombie Seminar- Focus on the Task 3", id: "10-I-LTxcw7QgHB0W_l5BNgIE2JRqRwV0" },
          { nombre: "10.4 Zombie Seminar - Circles Seated Vs. Standing pt 4", id: "1ZYbs3mBbYJSh0RCz37OYoOe5rHuWP9DO" },
          { nombre: "10.5 Zombie Seminar Under or behind elbows 5", id: "1LYRzWnl8cl_iQddvjmm5-qO1wbtIW8lg" },
          { nombre: "10.6 Zombie Seminar- How we develop Skill 6", id: "1eimAZFckjHnZWQ_YDEAhaJFbplFvtbFL" },
          { nombre: "10.7 Zombie Seminar- Pros and Cons to CLA - 7", id: "1Ts-mcYfu9SaQkfoF8DsjtfQK1S9nU18n" },
          { nombre: "10.8 Breaking Down Turtle", id: "1RzsjNxt1YeF_B8ZMhbXNVfHyOLP08uyi" },
          { nombre: "10.9 Dorsal Kimura (figure 4 game)", id: "1WMaKQNrVDVq6T0DAHRKQfoM4ozAW1DR_" },
          { nombre: "10.10 Diagonal Control Game", id: "1mNvTJPonCuCATJj4b9zGZmWCKKqU-g3m" },

        ]
      },
      {
        id: "Volumen 11",
        nombre: "Volumen 11",
        partes: [
          { nombre: "11.1 Side Triangle Game (Yoko)", id: "1RROd8PBYO8OBLTGkIGZ96KP3HhwdcbWX" },
          { nombre: "11.2 SUPERCUT C2B - twisting arm", id: "1-H2ul6h9-BYPGpzRU3eDjepvQTvRaV9F" },
          { nombre: "11.3 Closed Guard Posture Game", id: "16lBbdHOEx894vcLvhx-6QYRziisFKZY-" },
          { nombre: "11.4 SUPERCUT- C2C", id: "1VVIvCFf3inufWUIM2PorB2pBhVmfXZH0" },
          { nombre: "11.5 Side Control Fundamentals", id: "1b9SYIhgES_F-18fPCF0-kqbt9FV0BluN" },
          { nombre: "11.6 Single Leg Warm Up", id: "1jQa41dR9Hq_yZigKPR27JcuJTaU7eUuu" },
        ]
      },
    ]
  },
  'name': {
    titulo: "name",
    autor: "Autor",
    categorias: ["DERRIBOS", "JUEGOS"],
    volumenes: [
      {
        id: "Volumen",
        nombre: "Volumen",
        partes: [

        ]
      },
    ]
  },
};
// Coloca esto antes de los componentes de página
const getAdjacentVideo = (currentVideo, direction) => {
  for (const cursoKey in DB_INSTRUCCIONALES) {
    const curso = DB_INSTRUCCIONALES[cursoKey];
    for (const vol of curso.volumenes) {
      const index = vol.partes.findIndex(p => p.id === currentVideo.id);
      if (index !== -1) {
        const targetIndex = direction === 'next' ? index + 1 : index - 1;
        const nextVideo = vol.partes[targetIndex];
        if (nextVideo) {
          return { titulo: nextVideo.nombre, id: nextVideo.id };
        }
      }
    }
  }
  return null;
};

// --- 3. SUB-COMPONENTES ---

const LoginPage = ({ 
  onLogin, onRegister, 
  email, setEmail, 
  password, setPassword, 
  nombreCompleto, setNombreCompleto,
  error 
}) => {
  const [esRegistro, setEsRegistro] = React.useState(false);

  return (
    <div style={{...styles.containerCenter, background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)',
      padding: '20px', // Espacio de seguridad para que no toque los bordes del cel
      boxSizing: 'border-box',
      minHeight: '100vh'}}>
      <div style={{ marginBottom: '30px', textAlign: 'center', width: '100%' }}>
         <h1 style={{
           ...styles.goldTitle, 
           fontSize: 'clamp(2rem, 8vw, 3rem)', // Se ajusta según el ancho de pantalla
           letterSpacing: '5px',
           margin: '0'
         }}>LA FORTUNA</h1>
         <p style={{color: '#d4af37', fontSize: '0.8rem', marginTop: '-10px'}}>BRAZILIAN JIU JITSU VAULT</p>
      </div>

      <div style={{...styles.card, width: '350px', border: '1px solid #d4af37',padding: '25px',
        boxSizing: 'border-box'}}>
        <h2 style={{color: '#fff', fontSize: '1.2rem', marginBottom: '20px'}}>
          {esRegistro ? 'SOLICITAR ACCESO' : 'INICIAR SESIÓN'}
        </h2>

        {error && <p style={{color: '#ff4444', fontSize: '0.8rem'}}>{error}</p>}

        {esRegistro && (
          <input 
            type="text" 
            placeholder="Nombre completo" 
            style={styles.input} 
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
          />
        )}

        <input 
          type="text" 
          placeholder="Email" 
          style={styles.input} 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <input 
          type="password" 
          placeholder="Contraseña" 
          style={styles.input} 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
  <input type="checkbox" id="recordar" defaultChecked style={{ accentColor: '#d4af37' }} />
  <label htmlFor="recordar" style={{ color: '#666', fontSize: '0.75rem' }}>Mantener sesión iniciada</label>
</div>
        <button 
          style={{...styles.btnGold, marginTop: '10px'}} 
          onClick={esRegistro ? onRegister : onLogin}
        >
          {esRegistro ? 'ENVIAR SOLICITUD' : 'ENTRAR'}
        </button>

        <button 
          onClick={() => setEsRegistro(!esRegistro)}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.8rem', cursor: 'pointer', marginTop: '15px' }}
        >
          {esRegistro ? '¿Ya tienes cuenta? Entra' : '¿Eres nuevo? Solicita acceso'}
        </button>
      </div>
    </div>
  );
};
// 1. CONSTANTES MAESTRAS (Fuera del componente para que siempre estén disponibles)
const SUB_POSICIONES = [
  'GUARDIA CERRADA', 'MEDIA GUARDIA', 'GUARDIA ABIERTA', 'PASES', 
  'CONTROL LATERAL', 'MONTADA', 'ESPALDA', 'NORTE-SUR'
];

const SUB_DEFENSAS = [
  'ESCAPES MONTADA', 'ESCAPES LATERAL', 'DEFENSA ESPALDA', 'RE-GUARDIA',
  'DEFENSA LEG LOCKS', 'DEFENSA TRIANGULO', 'DEFENSA ARM BAR', 'DEFENSA STRANGLES'
];

const MapaPage = ({
  onBack, onSelectVideo, onNavigateToNotes, onContinue, hasSession,
  categoriaSel, setCategoriaSel,
  autorSel, setAutorSel,
  instrSel, setInstrSel,
  volSel, setVolSel,
  vistos = []
}) => {
  // 1. ESTADOS
  const [terminoBusqueda, setTerminoBusqueda] = React.useState("");
  const [esMovil, setEsMovil] = React.useState(window.innerWidth < 768);

  // 2. EFECTOS
  React.useEffect(() => {
    const handleResize = () => setEsMovil(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. EL CAZADOR DE TÉCNICAS (Primero declaramos la variable)
  const todasLasTecnicas = React.useMemo(() => {
    return Object.keys(DB_INSTRUCCIONALES).flatMap(cursoKey =>
      DB_INSTRUCCIONALES[cursoKey].volumenes.flatMap(vol =>
        vol.partes.map(parte => {
          let sub = parte.subcategoria || "";
          const n = parte.nombre.toLowerCase();
          const cursoNom = cursoKey.toLowerCase();
          
          if (!sub) {
            const esCursoDefensa = cursoNom.includes('pillars') || cursoNom.includes('escapes') || cursoNom.includes('retention');

            // --- FILTRO DE DEFENSAS ---
            if (n.includes('escape') || n.includes('defensa') || n.includes('defense') || n.includes('counter') || esCursoDefensa) {
              if (n.includes('mount') || n.includes('montada')) sub = "ESCAPES MONTADA";
              else if (n.includes('side') || n.includes('lateral')) sub = "ESCAPES LATERAL";
              else if (n.includes('back') || n.includes('espalda')) sub = "DEFENSA ESPALDA";
              else if (n.includes('leg lock') || n.includes('heel hook')) sub = "DEFENSA LEG LOCKS";
              else if (n.includes('triang')) sub = "DEFENSA TRIANGULO";
              else if (n.includes('arm bar') || n.includes('armbar') || n.includes('joint lock') || n.includes('armlock')) sub = "DEFENSA ARM BAR";
              else if (n.includes('darce') || n.includes('guillotine') || n.includes('choke')) sub = "DEFENSA STRANGLES";
              else sub = "RE-GUARDIA"; 
            } 
            // --- FILTRO DE DERRIBOS ---
            else if (n.includes('takedown') || n.includes('take down') || n.includes('standing') || n.includes('derribo') || cursoNom.includes('feet to floor')) {
              sub = "DERRIBOS";
            }
            // --- POSICIONES ---
            else if (n.includes('side control') || n.includes('lateral') || n.includes('100 kilos')) sub = "CONTROL LATERAL";
            else if (n.includes('half guard') || n.includes('media guardia')) sub = "MEDIA GUARDIA";
            else if (n.includes('closed guard') || n.includes('guardia cerrada')) sub = "GUARDIA CERRADA";
            else if (n.includes('mount') || n.includes('montada')) sub = "MONTADA";
            else if (n.includes('back') || n.includes('espalda')) sub = "ESPALDA";
            else if (n.includes('north south') || n.includes('norte sur')) sub = "NORTE-SUR";
          }

          return { ...parte, subcategoria: sub, curso: cursoKey, volNombre: vol.nombre };
        })
      )
    );
  }, []);

  // 4. CHEQUEO DE CONSOLA (Ahora sí, después de definir la variable)
  const chequeoArmBar = todasLasTecnicas.filter(t => t.subcategoria === "DEFENSA ARM BAR");
  console.log("Videos en DEFENSA ARM BAR encontrados:", chequeoArmBar.length);

  // 5. RESULTADOS DE BÚSQUEDA
  const resultadosBusqueda = terminoBusqueda
    ? todasLasTecnicas.filter(t => t.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase())).slice(0, 10)
    : [];

  // 6. LÓGICA DE NODOS
  let nodosAMostrar = [];
  let tituloCentral = "";

  if (volSel) {
    nodosAMostrar = volSel?.partes?.map(p => ({ nombre: p.nombre, type: 'parte', id: p.id })) || [];
    tituloCentral = volSel?.nombre || "";
  } else if (instrSel) {
    const cursoData = DB_INSTRUCCIONALES[instrSel];
    nodosAMostrar = cursoData?.volumenes?.map(v => ({ nombre: v.nombre, type: 'volumen', raw: v })) || [];
    tituloCentral = instrSel;
  } else if (autorSel) {
    nodosAMostrar = Object.keys(DB_INSTRUCCIONALES).filter(key => DB_INSTRUCCIONALES[key].autor === autorSel).map(key => ({ nombre: key, id: key, type: 'curso' }));
    tituloCentral = autorSel;
  } else if (categoriaSel) {
    tituloCentral = categoriaSel;

    if (categoriaSel === 'POSICIÓN' || categoriaSel === 'DEFENSAS') {
      const lista = categoriaSel === 'POSICIÓN' ? SUB_POSICIONES : SUB_DEFENSAS;
      nodosAMostrar = lista.map(item => ({ nombre: item, type: 'subcategoria' }));
    } 
    else if (SUB_POSICIONES.includes(categoriaSel) || SUB_DEFENSAS.includes(categoriaSel)) {
      // FILTRO CRÍTICO: Usamos trim() para limpiar espacios
      nodosAMostrar = todasLasTecnicas
        .filter(t => t.subcategoria.trim() === categoriaSel.trim())
        .map(t => ({ nombre: t.nombre, id: t.id, type: 'parte' }));
    }
    else if (categoriaSel === 'DERRIBOS') {
      nodosAMostrar = todasLasTecnicas.filter(t => t.subcategoria === "DERRIBOS").map(t => ({ nombre: t.nombre, id: t.id, type: 'parte' }));
    }
    else if (categoriaSel === 'AUTORES') {
      const autores = ['Craig Jones', 'Eddie Bravo', 'John Danaher', 'Levi Jones-Leary', 'Bernardo Faria', 'Bruno Malfacine', 'Josef Chen', 'Paulo Marmund', 'Gordon Ryan'];
      nodosAMostrar = autores.map(a => ({ nombre: a, type: 'autor' }));
    } else {
      const cursosFiltrados = Object.keys(DB_INSTRUCCIONALES).filter(key => DB_INSTRUCCIONALES[key].categorias?.includes(categoriaSel));
      nodosAMostrar = cursosFiltrados.map(key => ({ id: key, nombre: DB_INSTRUCCIONALES[key].titulo, type: 'curso' }));
    } 
  }

  // ... (Siguen handleNodeClick, irAtras y el return del Aside/Main igual que antes)
  // 7. FUNCIONES DE INTERACCIÓN
  const handleNodeClick = (nodo) => {
    if (nodo.type === 'subcategoria') setCategoriaSel(nodo.nombre);
    else if (nodo.type === 'autor') setAutorSel(nodo.nombre);
    else if (nodo.type === 'curso') setInstrSel(nodo.id || nodo.nombre);
    else if (nodo.type === 'volumen') setVolSel(nodo.raw);
    else if (nodo.type === 'parte') onSelectVideo({ titulo: nodo.nombre, id: nodo.id });
  };

  const irAtras = () => {
    if (SUB_POSICIONES.includes(categoriaSel)) setCategoriaSel('POSICIÓN');
    else if (SUB_DEFENSAS.includes(categoriaSel)) setCategoriaSel('DEFENSAS');
    else if (volSel) setVolSel(null);
    else if (instrSel) setInstrSel(null);
    else if (autorSel) setAutorSel(null);
    else onBack();
  };

  // 8. RENDERIZADO
  return (
    <div style={{ ...mapStyles.layout, flexDirection: esMovil ? 'column' : 'row' }}>
      <aside style={{
  ...mapStyles.sidebar,
  width: esMovil ? '100%' : '250px',
  height: esMovil ? 'auto' : '100vh',
  position: esMovil ? 'relative' : 'fixed',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  zIndex: 100,
  padding: '15px',
  boxSizing: 'border-box'
}}>
  {/* FILA 1: NAVEGACIÓN */}
  <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
    <button 
      onClick={irAtras} 
      style={{ ...styles.btnOutline, flex: '0 0 40px', padding: '10px 0' }}
    > 
      ←
    </button>
    <button 
      onClick={onContinue} 
      disabled={!hasSession}
      style={{ 
        ...styles.btnGold, 
        flex: 1, 
        fontSize: '0.65rem', 
        opacity: hasSession ? 1 : 0.5 
      }}
    >
      {esMovil ? 'CONTINUAR' : '▶ CONTINUAR SESIÓN'}
    </button>
    <button onClick={onNavigateToNotes} style={{ ...styles.btnOutline, flex: 1, fontSize: '0.6rem', borderColor: '#d4af37' }}>BITÁCORA</button>
  </div>

  {/* FILA 2: BÚSQUEDA */}
  <div style={{ width: '100%' }}>
    <input
      type="text"
      placeholder="Buscar técnica..."
      value={terminoBusqueda}
      onChange={(e) => setTerminoBusqueda(e.target.value)}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#111',
        border: '1px solid #d4af37',
        color: '#fff',
        borderRadius: '5px',
        fontSize: '0.85rem',
        outline: 'none',
        boxSizing: 'border-box'
      }}
    />
  </div>

  {/* FILA 3: CATEGORÍAS (Híbrido PC/Móvil) */}
  <div style={{ marginTop: esMovil ? '0' : '20px' }}>
    {!esMovil && <h3 style={{ color: '#d4af37', marginBottom: '15px', fontSize: '0.9rem' }}>FILTRAR POR</h3>}
    
    <div style={{ 
      display: 'flex', 
      flexDirection: esMovil ? 'row' : 'column',
      overflowX: esMovil ? 'auto' : 'visible',
      gap: '8px',
      scrollbarWidth: 'none'
    }}>
      {['DEFENSAS', 'POSICIÓN', 'DERRIBOS', 'AUTORES', 'JUEGOS'].map(cat => {
        // Lógica para mantener encendido el botón si estamos en una subcategoría
        const estaActivo = categoriaSel === cat || 
          (cat === 'POSICIÓN' && SUB_POSICIONES.includes(categoriaSel)) ||
          (cat === 'DEFENSAS' && SUB_DEFENSAS.includes(categoriaSel));

        return (
          <div 
            key={cat}
            onClick={() => { 
              setCategoriaSel(cat); 
              setAutorSel(null); 
              setInstrSel(null); 
              setVolSel(null); 
              setTerminoBusqueda(""); 
            }}
            style={{ 
              ...mapStyles.sideItem, 
              backgroundColor: estaActivo ? '#d4af37' : '#111', 
              color: estaActivo ? '#000' : '#fff',
              border: '1px solid #d4af37',
              whiteSpace: 'nowrap',
              padding: esMovil ? '8px 15px' : '12px',
              borderRadius: esMovil ? '20px' : '5px',
              fontSize: esMovil ? '0.65rem' : '0.85rem',
              cursor: 'pointer'
            }}
          >
            {cat}
          </div>
        );
      })}
    </div>
  </div>
</aside>

      <main style={{ 
  ...mapStyles.mapArea, 
  flex: 1, 
  display: 'flex', 
  flexDirection: 'column', 
  justifyContent: esMovil ? 'flex-start' : 'center', // Alinea arriba en móvil
  alignItems: 'center',
  paddingTop: esMovil ? '0px' : '20px',
  overflow: 'hidden' 
}}>
  <div style={{ 
    ...mapStyles.canvas, 
    // Ajustamos el scale y añadimos marginTop negativo para subirlo
    transform: esMovil ? 'scale(0.7)' : 'scale(1)', 
    marginTop: esMovil ? '0px' : '0px', 
    transformOrigin: 'top center', // Cambiamos el origen para que escale hacia arriba
    transition: 'all 0.3s ease'
  }}>
    {terminoBusqueda ? (
      <div style={{ zIndex: 10, width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '20px' }}>
        <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '20px' }}>RESULTADOS</h2>
        {resultadosBusqueda.map((t, i) => (
          <div key={i} onClick={() => onSelectVideo({ titulo: t.nombre, id: t.id })} style={{ padding: '15px', backgroundColor: '#0a0a0a', border: `1px solid ${vistos?.includes(t.id) ? '#4CAF50' : '#222'}`, margin: '8px 0', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ color: vistos?.includes(t.id) ? '#4CAF50' : '#d4af37', fontWeight: 'bold' }}>{vistos?.includes(t.id) ? '✅ ' : ''}{t.nombre}</div>
            <div style={{ fontSize: '0.65rem', color: '#666' }}>{t.curso} • {t.volNombre}</div>
          </div>
        ))}
      </div>
    ) : (
      <>
        <svg style={mapStyles.svgLayer}>
          {nodosAMostrar.map((n, i) => {
            const total = nodosAMostrar.length;
            const angle = (i * (360 / total)) * (Math.PI / 180);
            return (
              <line key={i} x1="50%" y1="50%" x2={`${50 + (Math.cos(angle) * 35)}%`} y2={`${50 + (Math.sin(angle) * 35)}%`} stroke={vistos?.includes(n.id) ? '#4CAF50' : '#d4af37'} strokeWidth="1" opacity="0.2" className="floating-node" style={{ animationDelay: `${i * -0.8}s`, animationDuration: `${5 + (i % 3)}s` }} />
            );
          })}
        </svg>

        <div style={mapStyles.mainNode}>{tituloCentral}</div>

        {nodosAMostrar.map((n, i) => {
          const total = nodosAMostrar.length;
          const radio = 260;
          const angle = (i * (360 / total)) * (Math.PI / 180);
          const x = Math.cos(angle) * radio;
          const y = Math.sin(angle) * radio;
          const visto = n.type === 'parte' ? vistos?.includes(n.id) : n.raw?.partes?.every(p => vistos?.includes(p.id));

          return (
            <div key={i} 
                 onClick={() => handleNodeClick(n)} 
                 className="floating-node" 
                 style={{ 
                   ...mapStyles.subNodeFloating, 
                   left: `calc(50% + ${x}px - 55px)`, 
                   top: `calc(50% + ${y}px - 55px)`, 
                   animationDelay: `${i * -0.8}s`, 
                   animationDuration: `${5 + (i % 3)}s`, 
                   borderColor: visto ? '#4CAF50' : '#d4af37', 
                   color: visto ? '#4CAF50' : '#fff', 
                   cursor: 'pointer',
                   // Reducimos el tamaño de los nodos en móvil para que no se amontonen
                   fontSize: esMovil ? '0.6rem' : '0.75rem',
                   width: esMovil ? '80px' : '100px',
                   height: esMovil ? '80px' : '100px'
                 }}>
              {visto ? '✅ ' : ''}{n.nombre}
            </div>
          );
        })}
      </>
    )}
  </div>
</main>
    </div>
  );
};
const EstudioPage = ({ video, onBack, onSelectVideo, onNavigateToNotes, vistos = [], toggleVisto }) => {
  const [nota, setNota] = useState("");

React.useEffect(() => {
  if (!video?.id) return;
  
  // 1. Primero intentamos cargar de Firebase si hay usuario
  const cargarNotasSincronizadas = async () => {
    let notaFinal = "";
    
    // Prioridad 1: Firebase
    if (auth.currentUser) {
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists() && docSnap.data().notas?.[video.id]) {
        notaFinal = docSnap.data().notas[video.id];
      }
    }
    
    // Prioridad 2: Si no hubo nada en Firebase, buscamos en LocalStorage
    if (!notaFinal) {
      const notasLocales = JSON.parse(localStorage.getItem('lafortuna_notas') || '{}');
      notaFinal = notasLocales[video.id] || "";
    }
    
    setNota(notaFinal);
  };

  cargarNotasSincronizadas();
}, [video?.id]);

  const [timestamp, setTimestamp] = useState("");
  const [tiempoActivo, setTiempoActivo] = useState("");
  const [nombreMarcador, setNombreMarcador] = useState("");
  
  // --- SENSOR DE MÓVIL ---
  const [esMovil, setEsMovil] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handleResize = () => setEsMovil(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const insertarMarcaDeTiempo = () => {
    if (!timestamp.trim()) {
      alert("Por favor pon un minuto (ej: 02:45)");
      return;
    }
    const etiqueta = nombreMarcador.trim() || "Punto de interés";
    const nuevaMarca = `\n[${timestamp.trim()} - ${etiqueta}] `;
    setNota(nota + nuevaMarca);
    setTimestamp("");
    setNombreMarcador("");
  };

  const isCompletado = vistos.includes(video?.id);

  const guardar = async () => {
    if (!video?.id) return;
    const ahora = new Date().toLocaleString();
    const dataNota = { texto: nota, videoId: video.id, fecha: ahora };
    localStorage.setItem(`nota_${video.titulo}`, JSON.stringify(dataNota));
    const notasLocales = JSON.parse(localStorage.getItem('lafortuna_notas') || '{}');
    notasLocales[video.id] = nota;
    localStorage.setItem('lafortuna_notas', JSON.stringify(notasLocales));

    if (auth.currentUser) {
      try {
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        await setDoc(userRef, { notas: { [video.id]: nota } }, { merge: true });
      } catch (err) { console.error("Error al subir:", err); }
    }
    alert(`Bitácora actualizada: ${ahora}`);
  };

  const videoSiguiente = getAdjacentVideo(video, 'next');
  const videoAnterior = getAdjacentVideo(video, 'prev');

  const saltarATiempo = (minutoTexto) => {
    const coincidencia = minutoTexto.match(/(\d+):(\d+)/);
    if (coincidencia) {
      const segundos = parseInt(coincidencia[1]) * 60 + parseInt(coincidencia[2]);
      setTiempoActivo(segundos);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: esMovil ? 'column' : 'row', 
      height: '100vh', 
      width: '100vw', 
      backgroundColor: '#000', 
      color: '#fff',
      overflow: 'hidden'
    }}>

      {/* SECCIÓN IZQUIERDA: VIDEO Y NAVEGACIÓN SUPERIOR */}
      <div style={{ 
        flex: esMovil ? 'none' : 3, 
        display: 'flex', 
        flexDirection: 'column', 
        borderRight: esMovil ? 'none' : '1px solid #222',
        borderBottom: esMovil ? '1px solid #222' : 'none',
        height: esMovil ? 'auto' : '100%' 
      }}>
        
        {/* HEADER DE ESTUDIO */}
        <div style={{
          padding: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          minHeight: '60px'
        }}>
          <button onClick={() => videoAnterior && onSelectVideo(videoAnterior)} 
                  style={{ ...styles.btnOutline, width: '45px', padding: '10px 0', opacity: videoAnterior ? 1 : 0.2 }} disabled={!videoAnterior}>←</button>
          
          <div style={{ textAlign: 'center', flex: 1, padding: '0 10px', overflow: 'hidden' }}>
            <h2 style={{ 
              fontSize: esMovil ? '0.8rem' : '1rem', 
              color: '#d4af37', 
              margin: 0, 
              whiteSpace: 'nowrap', 
              textOverflow: 'ellipsis', 
              overflow: 'hidden',
              fontWeight: 'bold'
            }}>
              {video?.titulo}
            </h2>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.65rem', textDecoration: 'underline', cursor: 'pointer' }}>
              CERRAR ESTUDIO
            </button>
          </div>

          <button onClick={() => videoSiguiente && onSelectVideo(videoSiguiente)} 
                  style={{ ...styles.btnGold, width: '45px', padding: '10px 0', opacity: videoSiguiente ? 1 : 0.2 }} disabled={!videoSiguiente}>→</button>
        </div>

        {/* CONTENEDOR VIDEO (RESPONSIVE) */}
        <div style={{ 
          width: '100%', 
          aspectRatio: '16/9', 
          backgroundColor: '#000',
          position: 'relative',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <iframe
            key={`${video?.id}-${tiempoActivo}`}
            src={`https://drive.google.com/file/d/${video?.id}/preview${tiempoActivo ? `?t=${tiempoActivo}` : ''}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          ></iframe>
        </div>
      </div>

      {/* SECCIÓN DERECHA: BITÁCORA TÉCNICA (SCROLLABLE) */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px', 
        backgroundColor: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: esMovil ? 'none' : '-5px 0 15px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ color: '#d4af37', fontSize: '1rem', margin: 0, letterSpacing: '1px' }}>BITÁCORA TÉCNICA</h3>
          <span style={{ fontSize: '0.6rem', color: '#666' }}>ID: {video?.id?.substring(0,6)}</span>
        </div>
        
        {/* PANEL DE MARCADORES */}
        <div style={{ backgroundColor: '#181818', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #222' }}>
          <input 
            type="text" placeholder="¿Qué viste? (ej. Escape de cadera)" value={nombreMarcador}
            onChange={(e) => setNombreMarcador(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '5px', fontSize: '0.8rem', marginBottom: '8px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" placeholder="Min:Seg" value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              style={{ flex: 1, backgroundColor: '#0a0a0a', border: '1px solid #333', color: '#d4af37', textAlign: 'center', borderRadius: '5px', fontWeight: 'bold' }}
            />
            <button onClick={insertarMarcaDeTiempo} style={{ ...styles.btnGold, flex: 1.5, fontSize: '0.75rem', fontWeight: 'bold' }}>+ GUARDAR TIEMPO</button>
          </div>
        </div>

        {/* BOTONES DE TIEMPO RÁPIDOS */}
        <div style={{ 
          display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '15px', scrollbarWidth: 'none'
        }}>
          {(nota.match(/\[\d+:\d+ - .*?\]/g) || []).map((marca, i) => {
            const partes = marca.replace('[', '').replace(']', '').split(' - ');
            return (
              <button key={i} onClick={() => saltarATiempo(partes[0])} 
                style={{ fontSize: '0.65rem', padding: '10px 14px', backgroundColor: '#d4af3722', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                📍 {partes[1]}
              </button>
            );
          })}
        </div>

        {/* ÁREA DE TEXTO */}
        <textarea
          value={nota} onChange={(e) => setNota(e.target.value)}
          placeholder="Escribe tus observaciones detalladas aquí..."
          style={{ 
            flex: 'none', 
            height: esMovil ? '180px' : '350px', 
            backgroundColor: '#0a0a0a', 
            color: '#ddd', 
            padding: '15px', 
            borderRadius: '8px', 
            border: '1px solid #333', 
            marginBottom: '20px', 
            fontSize: '0.9rem',
            lineHeight: '1.5',
            outline: 'none',
            resize: 'none'
          }}
        />

        {/* ACCIONES FINALES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>
          <button style={{ ...styles.btnGold, padding: '15px', fontWeight: 'bold', letterSpacing: '1px' }} onClick={guardar}>
            💾 ACTUALIZAR BITÁCORA
          </button>
          <button onClick={() => toggleVisto(video?.id)} 
                  style={{ 
                    ...styles.btnOutline, 
                    borderColor: isCompletado ? '#4CAF50' : '#444', 
                    color: isCompletado ? '#4CAF50' : '#fff', 
                    padding: '15px',
                    backgroundColor: isCompletado ? '#4CAF5011' : 'transparent'
                  }}>
            {isCompletado ? 'TÉCNICA COMPLETADA ✅' : 'MARCAR COMO VISTA'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HUB Y NOTAS ---
// 1. AÑADIMOS 'userRole' aquí para que el componente lo reconozca
const handleLogout = async () => {
  try {
    await auth.signOut();
    // Limpiamos estados locales para que la siguiente persona no vea tus datos
    setVistos([]);
    localStorage.removeItem('lafortuna_vistos');
    localStorage.removeItem('lafortuna_last_video');
    setPage('login');
    alert("Sesión cerrada correctamente.");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
};
const HubPage = ({ onNavigate, onContinue, hasSession, userRole, onLogout }) => (
  <div style={styles.container}>
    <button 
      onClick={onLogout} 
      style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: '1px solid #444', color: '#666', padding: '5px 10px', borderRadius: '5px', fontSize: '0.7rem', cursor: 'pointer' }}
    >
      CERRAR SESIÓN
    </button>
    <h1 style={styles.goldTitle}>HUB DE ESTUDIO</h1>
    <div style={styles.grid}>
      <button style={{ ...styles.hubBtn, opacity: hasSession ? 1 : 0.5 }} onClick={onContinue}>1. CONTINUAR SESIÓN</button>
      <button style={styles.hubBtn} onClick={() => onNavigate('mapa')}>2. ESTUDIAR (MAPA)</button>
      <button style={styles.hubBtn} onClick={() => onNavigate('notas_hub')}>3. NOTAS</button>
      <button style={styles.hubBtn} onClick={() => onNavigate('busqueda')}>4. BUSCAR TÉCNICA</button>
      
      {/* BOTÓN SECRETO PARA TI */}
      {userRole === 'admin' && (
        <button 
          style={{ ...styles.hubBtn, border: '2px solid #d4af37', marginTop: '20px', gridColumn: 'span 2' }} 
          onClick={() => onNavigate('admin')}
        >
          ⚙️ ADMINISTRAR ACCESOS
        </button>
      )} 
      {/* Quitamos el ";" que estaba después del </button> y cerramos con ")}" */}

    </div>
  </div>
);
const NotasHubPage = ({ onBack, onNavigateToVideo }) => {
  // Estado local para manejar las notas y que se actualice al borrar
  const [notas, setNotas] = React.useState([]);

  const cargarNotas = () => {
    const lista = Object.keys(localStorage)
      .filter(k => k.startsWith('nota_'))
      .map(k => {
        const rawData = localStorage.getItem(k);
        let contenido = { texto: "", videoId: "" };
        try { contenido = JSON.parse(rawData); }
        catch (e) { contenido = { texto: rawData, videoId: null }; }
        return {
          titulo: k.replace('nota_', ''),
          texto: contenido.texto,
          videoId: contenido.videoId,
          fecha: contenido.fecha, // <--- Nueva propiedad
          key: k
        };
      });
    setNotas(lista);
  };

  React.useEffect(() => { cargarNotas(); }, []);

  const eliminarNota = (key) => {
    if (window.confirm("¿Seguro que quieres eliminar esta nota técnica?")) {
      localStorage.removeItem(key);
      cargarNotas(); // Recargar la lista
    }
  };

  return (
    <div style={{ padding: '40px', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto' }}>← VOLVER</button>
        <h2 style={styles.goldTitle}>MI VAULT DE NOTAS</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>
        {notas.map((n) => (
          <div key={n.key} style={{ ...styles.card, width: 'auto', textAlign: 'left', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 style={{ color: '#d4af37', margin: 0 }}>{n.titulo}</h4>
              {n.fecha && <small style={{ color: '#666', fontSize: '0.65rem' }}>{n.fecha}</small>}
              <button
                onClick={() => eliminarNota(n.key)}
                style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#aaa', margin: '15px 0', flexGrow: 1, whiteSpace: 'pre-wrap' }}>
              {n.texto}
            </p>
            {n.videoId && (
              <button
                onClick={() => onNavigateToVideo({ titulo: n.titulo, id: n.videoId })}
                style={{ ...styles.btnGold, padding: '8px', fontSize: '0.8rem' }}
              >
                IR A LA TÉCNICA →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 4. COMPONENTE PRINCIPAL (EXPORT DEFAULT) ---
export default function App() {
  const [page, setPage] = useState('login');
  const [userRole, setUserRole] = useState('usuario'); // Por defecto usuario hasta que loguee
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
  const [usuario, setUsuario] = useState(null);
  React.useEffect(() => {
  // Este es el "escucha" oficial de Firebase
  const deshacerEscucha = onAuthStateChanged(auth, (user) => {
    if (user) {
      // Si Firebase encuentra al usuario, lo ponemos en el estado
      setUsuario(user);
      
      // Cargamos sus datos (vistos, notas, etc)
      cargarDatosDesdeFirebase(user.uid);

      // ¡IMPORTANTE!: Si estamos en la página de login, lo mandamos al Hub
      // Esto evita que el refresh te deje atrapado en el login
      setPage('hub'); 
    } else {
      setUsuario(null);
      setPage('login');
    }
  });

  return () => deshacerEscucha(); // Limpieza al cerrar
}, []);
  const cargarDatosDesdeFirebase = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.vistos) {
          setVistos(data.vistos); // Ahora sí funcionará
        }
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const toggleVisto = async (id) => {
  if (!id) return;
  
  const nuevaLista = vistos.includes(id)
    ? vistos.filter(v => v !== id)
    : [...vistos, id];
    
  // 1. Actualizamos interfaz de inmediato
  setVistos(nuevaLista);
  localStorage.setItem('lafortuna_vistos', JSON.stringify(nuevaLista));

  // 2. Guardamos en Firebase para que te siga a otros dispositivos
  if (auth.currentUser) {
    try {
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(userRef, { vistos: nuevaLista });
    } catch (error) {
      console.error("Error sincronizando vistos:", error);
    }
  }
};

  // --- 1. LAS FUNCIONES QUE FALTABAN (LOGICA FIREBASE) ---

  const handleRegister = async () => {
    try {
      setError('');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // REGLA DE ADMIN PARA ZAMNA
      const isAdmin = email === "zamna.ed@gmail.com"; 

      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        email: user.email,
        nombre: nombreCompleto,
        rol: isAdmin ? 'admin' : 'usuario',
        validado: isAdmin ? true : false,
        fechaRegistro: new Date().toISOString()
      });

      alert(isAdmin ? "¡Bienvenido, Zamna! Cuenta de Admin lista." : "Solicitud enviada. Espera validación.");
      setPage('login');
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
        
        // --- NUEVO: Cargamos su progreso de la nube ---
        await cargarDatosDesdeFirebase(user.uid);
        
        setPage('hub');
      } else {
        alert("Tu cuenta aún no ha sido validada.");
        auth.signOut();
      }
    }
  } catch (err) {
    setError("Credenciales incorrectas.");
  }
};
  // --- 2. RENDERIZADO DE PÁGINAS ---

  const renderPage = () => {
    switch (page) {
      case 'login':
        return (
          <LoginPage 
            email={email} setEmail={setEmail} 
            password={password} setPassword={setPassword} 
            nombreCompleto={nombreCompleto} setNombreCompleto={setNombreCompleto}
            onLogin={handleLogin} 
            onRegister={handleRegister} 
            error={error}
          />
        );

      case 'hub':
  return (
    <HubPage 
      onNavigate={setPage} 
      onContinue={() => setPage('estudio')} 
      hasSession={!!videoActual} 
      userRole={userRole}
      onLogout={handleLogout} // <--- PASAMOS LA FUNCIÓN AQUÍ
    />
  );
      case 'mapa':
        return (
          <MapaPage
            onBack={() => setPage('hub')}
            categoriaSel={categoriaSel} setCategoriaSel={setCategoriaSel}
            autorSel={autorSel} setAutorSel={setAutorSel}
            instrSel={instrSel} setInstrSel={setInstrSel}
            volSel={volSel} setVolSel={setVolSel}
            vistos={vistos}
            onSelectVideo={(v) => {
              setVideoActual(v);
              localStorage.setItem('lafortuna_last_video', JSON.stringify(v));
              setPage('estudio');
            }}
            onNavigateToNotes={() => setPage('notas_hub')}
            onContinue={() => setPage('estudio')}
            hasSession={!!videoActual}
          />
        );

      case 'estudio':
        return (
          <EstudioPage
            video={videoActual}
            onBack={() => setPage('mapa')}
            vistos={vistos}
            toggleVisto={toggleVisto}
            onNavigateToNotes={() => setPage('notas_hub')}
            onSelectVideo={(v) => {
              setVideoActual(v);
              localStorage.setItem('lafortuna_last_video', JSON.stringify(v));
            }}
          />
        );

      case 'admin':
        return <AdminPage onBack={() => setPage('hub')} />;

      case 'notas_hub':
        return (
          <NotasHubPage
            onBack={() => setPage('hub')}
            onNavigateToVideo={(v) => {
              setVideoActual(v);
              localStorage.setItem('lafortuna_last_video', JSON.stringify(v));
              setPage('estudio');
            }}
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
          />
        );

      default:
        return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
    }
  };

  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      color: '#fff',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      overflowX: 'hidden',
      fontFamily: 'sans-serif'
    }}>
      <style>
  {`
  @keyframes float {
    0% { transform: translate(0px, 0px); }
    50% { transform: translate(0px, -15px); } /* Movimiento vertical */
    100% { transform: translate(0px, 0px); }
  }
  .floating-node {
    animation: float 6s ease-in-out infinite;
  }
  `}
</style>
      {renderPage()}
    </div>
  );
}