import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, where, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles, usuario }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [verArchivados, setVerArchivados] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoConfig, setEditandoConfig] = useState(false);
  
  // --- ESTADOS PARA CONFIGURACIÓN (CON LOGO Y HORARIOS OBJETOS) ---
  const [config, setConfig] = useState({
    nombreAcademia: 'Tu Dojo',
    sede: 'Ubicación',
    logoBase64: '',
    horarios: [], // Formato: [{ hora: "07:00", nombre: "Matutino" }]
    programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "BJJ Woman´s"]
  });

  // Estados para el constructor de horarios intuitivo
  const [tempHora, setTempHora] = useState("19:00");
  const [tempNombreClase, setTempNombreClase] = useState("");

  const estadoInicial = {
    nombre: '',
    fechaPago: '',
    diaPago: '',
    programa: '',
    horario: '',
    perfil: 'Recreativo',
    tieneExperiencia: false,
    tiempoExperiencia: '',
    notasTecnicas: '',
    contacto: '',
    redes: '',
    fotoBase64: '',
    activo: true
  };

  const [nuevo, setNuevo] = useState(estadoInicial);

  // 1. CARGAR CONFIGURACIÓN DE LA ACADEMIA
  useEffect(() => {
    if (!usuario?.uid) return; 
    const academiaId = usuario.academiaId || usuario.uid;
    const docRef = doc(db, "academias", academiaId);

    const unsubConfig = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(data);
        // Inicializar valores por defecto en el formulario si hay datos
        if (data.programas?.length > 0 || data.horarios?.length > 0) {
          setNuevo(prev => ({
            ...prev,
            programa: data.programas[0] || '',
            horario: data.horarios[0] ? `${data.horarios[0].hora} - ${data.horarios[0].nombre}` : ''
          }));
        }
      }
    });
    return () => unsubConfig();
  }, [usuario]);

  // 2. ESCUCHA DE ALUMNOS (CON FILTRO MULTISEDE)
  useEffect(() => {
    if (!usuario?.uid) return; 
    const idParaFiltrar = usuario.academiaId || usuario.uid;

    const q = query(
      collection(db, "alumnos"), 
      where("activo", "==", !verArchivados),
      where("academiaId", "==", idParaFiltrar),
      orderBy("nombre", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnos(docs);
    }, (error) => {
      console.error("Error en la Bóveda:", error);
    });

    return () => unsub();
  }, [verArchivados, usuario]);

  // 3. MANEJO DE FOTO ALUMNO Y LOGO ACADEMIA
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setNuevo(prev => ({...prev, fotoBase64: reader.result}));
    reader.readAsDataURL(file);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setConfig(prev => ({...prev, logoBase64: reader.result}));
    reader.readAsDataURL(file);
  };

  // 4. SEMÁFORO DE PAGOS (ORIGINAL)
  const calcularEstadoPago = (dia) => {
    if (verArchivados) return { label: 'INACTIVO', color: '#666' };
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaPagoNum = parseInt(dia);
    if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

    if (diaActual < diaPagoNum) {
      const faltan = diaPagoNum - diaActual;
      if (faltan <= 3) return { label: `PRÓXIMO (${faltan}d)`, color: '#ffbb33' };
      return { label: 'AL CORRIENTE', color: '#4CAF50' };
    }
    if (diaActual === diaPagoNum) return { label: 'PAGA HOY', color: '#d4af37' };
    return { label: `ATRASADO (${diaActual - diaPagoNum}d)`, color: '#ff4444' };
  };

  // 5. GESTIÓN DE HORARIOS INTUITIVA
  const agregarHorario = () => {
    if (!tempNombreClase) return alert("Escribe el nombre de la clase");
    const nuevoH = { hora: tempHora, nombre: tempNombreClase };
    const nuevosHorarios = [...config.horarios, nuevoH].sort((a,b) => a.hora.localeCompare(b.hora));
    setConfig(prev => ({ ...prev, horarios: nuevosHorarios }));
    setTempNombreClase("");
  };

  const eliminarHorario = (index) => {
    const nuevos = config.horarios.filter((_, i) => i !== index);
    setConfig(prev => ({ ...prev, horarios: nuevos }));
  };

  // 6. FUNCIONES DE GUARDADO Y ELIMINACIÓN
  const handleGuardarAlumno = async () => {
    if (!nuevo.nombre || !nuevo.fechaPago) {
      alert("Nombre y fecha de pago son obligatorios.");
      return;
    }
    const diaExtraido = nuevo.fechaPago.split('-')[2];
    
    try {
      await addDoc(collection(db, "alumnos"), {
        ...nuevo,
        diaPago: diaExtraido,
        academiaId: usuario.academiaId || usuario.uid,
        fechaRegistro: new Date().toISOString()
      });
      setMostrarForm(false);
      setNuevo(estadoInicial);
    } catch (e) {
      alert("Error al guardar alumno.");
    }
  };

  const eliminarDefinitivo = async (id) => {
    if (window.confirm("¿ELIMINAR DEFINITIVAMENTE? Esta acción no se puede deshacer.")) {
      try {
        await deleteDoc(doc(db, "alumnos", id));
      } catch (e) { alert("Error al eliminar."); }
    }
  };

 const handleUpdateConfig = async () => {
  // SEGURIDAD: Si por alguna razón el prop 'usuario' no llegó, detenemos todo
  if (!usuario || !usuario.uid) {
    console.error("No se encontró información del usuario activo.");
    alert("Error: Sesión no detectada. Por favor, recarga la página.");
    return;
  }

  try {
    const academiaId = usuario.academiaId || usuario.uid;
    console.log("Intentando actualizar academia:", academiaId);

    // Validación de peso de logo (opcional pero recomendada)
    if (config.logoBase64 && config.logoBase64.length > 1000000) {
      alert("El logo es muy pesado. Usa uno de menos de 1MB.");
      return;
    }

    const academiaRef = doc(db, "academias", academiaId);
    await setDoc(academiaRef, {
      ...config,
      ultimaActualizacion: new Date().toISOString()
    }, { merge: true });
    
    setEditandoConfig(false);
    alert("Configuración de Dojo actualizada exitosamente. ");
  } catch (e) {
    console.error("Error en Firebase:", e);
    alert("Error crítico: " + e.message);
  }
};

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>
      
      {/* HEADER CON LOGO DINÁMICO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {config.logoBase64 && <img src={config.logoBase64} alt="logo" style={{ width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' }} />}
            <div>
              <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.2rem' }}>{config.nombreAcademia.toUpperCase()}</h2>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>{config.sede}</p>
            </div>
          </div>
          <button onClick={() => setEditandoConfig(true)} style={{ ...styles.btnOutline, width: '45px', height: '45px', borderRadius: '50%' }}>⚙️</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <button onClick={() => setVerArchivados(!verArchivados)} style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.8rem', cursor: 'pointer' }}>
                {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
            </button>
            <button onClick={() => setMostrarForm(true)} style={{ ...styles.btnGold, width: 'auto', padding: '10px 25px' }}>+ NUEVO GUERRERO</button>
        </div>
      </div>

      {/* LISTADO DE ALUMNOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {alumnos.length === 0 ? (
          <div style={{ textAlign: 'center', gridColumn: '1/-1', marginTop: '50px' }}>
            <p style={{ color: '#444' }}>No hay registros en esta sección.</p>
            <p style={{ color: '#d4af37', fontSize: '0.7rem' }}>Configura tu Academia en el icono ⚙️ para empezar.</p>
          </div>
        ) : (
          alumnos.map(alumno => {
            const pago = calcularEstadoPago(alumno.diaPago);
            return (
              <div key={alumno.id} style={{ ...styles.card, width: '100%', textAlign: 'left', borderLeft: `5px solid ${pago.color}`, padding: '15px', position: 'relative' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ width: '55px', height: '55px', borderRadius: '50%', backgroundColor: '#111', overflow: 'hidden', border: `1px solid ${pago.color}`, flexShrink: 0 }}>
                    {alumno.fotoBase64 ? <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center', lineHeight: '55px' }}>🥋</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alumno.nombre}</h3>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#d4af37' }}>{alumno.horario} | {alumno.programa}</p>
                    <span style={{ fontSize: '0.7rem', color: pago.color, fontWeight: 'bold' }}>{pago.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button onClick={() => {
                      const msj = alumno.activo ? "¿Archivar?" : "¿Reactivar?";
                      if(window.confirm(msj)) updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                    }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
                      {alumno.activo ? '📦' : '♻️'}
                    </button>
                    {verArchivados && (
                      <button onClick={() => eliminarDefinitivo(alumno.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', borderTop: '1px solid #222', paddingTop: '8px' }}>
                  <span>📱 {alumno.contacto || '-'}</span>
                  <span>📸 {alumno.redes || '-'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL REGISTRO ALUMNO */}
      {mostrarForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{...styles.goldTitle, marginBottom: '20px'}}>NUEVO ALUMNO</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#222', margin: '0 auto 8px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="" /> : <span style={{fontSize:'1.5rem'}}>📷</span>}
                </div>
                <input id="fotoInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                <p style={{fontSize: '0.5rem', color: '#d4af37'}}>FOTO DE PERFIL</p>
            </div>

            <input placeholder="Nombre completo" style={styles.input} value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
            
            <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.6rem', color: '#d4af37' }}>FECHA DE PRÓXIMO PAGO:</label>
                <input type="date" style={{...styles.input, marginTop: '5px'}} value={nuevo.fechaPago} onChange={e => setNuevo({...nuevo, fechaPago: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', color: '#d4af37' }}>PROGRAMA:</label>
                    <select style={styles.input} value={nuevo.programa} onChange={e => setNuevo({...nuevo, programa: e.target.value})}>
                        {config.programas.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', color: '#d4af37' }}>HORARIO:</label>
                    <select style={styles.input} value={nuevo.horario} onChange={e => setNuevo({...nuevo, horario: e.target.value})}>
                        {config.horarios.map((h, i) => <option key={i} value={`${h.hora} - ${h.nombre}`}>{h.hora} - {h.nombre}</option>)}
                    </select>
                </div>
            </div>

            <textarea placeholder="Scouting técnico" style={{ ...styles.input, height: '80px' }} value={nuevo.notasTecnicas} onChange={e => setNuevo({...nuevo, notasTecnicas: e.target.value})} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={handleGuardarAlumno} style={styles.btnGold}>DAR DE ALTA</button>
              <button onClick={() => setMostrarForm(false)} style={styles.btnOutline}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN (LOGO + HORARIO INTUITIVO) */}
      {editandoConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={styles.goldTitle}>CONFIGURACIÓN DE SEDE</h3>

            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <div onClick={() => document.getElementById('logoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '10px', backgroundColor: '#222', margin: '0 auto 8px', border: '1px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {config.logoBase64 ? <img src={config.logoBase64} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="" /> : <span style={{fontSize:'1.2rem'}}>🏯</span>}
                </div>
                <input id="logoInput" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                <p style={{fontSize: '0.5rem', color: '#d4af37'}}>LOGO ACADEMIA</p>
            </div>

            <input placeholder="Nombre Academia" style={styles.input} value={config.nombreAcademia} onChange={e => setConfig({...config, nombreAcademia: e.target.value})} />
            <input placeholder="Sede / Ciudad" style={styles.input} value={config.sede} onChange={e => setConfig({...config, sede: e.target.value})} />
            
            {/* GESTOR DE HORARIOS */}
            <div style={{ border: '1px solid #222', padding: '15px', borderRadius: '10px', marginTop: '15px' }}>
              <p style={{ color: '#d4af37', fontSize: '0.7rem', textAlign: 'left', marginBottom: '10px' }}>GESTIÓN DE CLASES:</p>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <input type="time" style={{ ...styles.input, width: '120px', margin: 0 }} value={tempHora} onChange={e => setTempHora(e.target.value)} />
                <input placeholder="Clase (ej: No-Gi)" style={{ ...styles.input, margin: 0 }} value={tempNombreClase} onChange={e => setTempNombreClase(e.target.value)} />
                <button onClick={agregarHorario} style={{ ...styles.btnGold, width: '45px', padding: 0 }}>+</button>
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {config.horarios.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #111', fontSize: '0.8rem' }}>
                    <span>{h.hora} - {h.nombre}</span>
                    <button onClick={() => eliminarHorario(i)} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ color: '#d4af37', fontSize: '0.7rem', textAlign: 'left', marginTop: '15px' }}>PROGRAMAS (Separa por comas):</p>
            <textarea style={{...styles.input, height: '60px'}} value={config.programas.join(', ')} onChange={e => setConfig({...config, programas: e.target.value.split(',').map(s => s.trim())})} />
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={handleUpdateConfig} style={styles.btnGold}>GUARDAR TODO</button>
                <button onClick={() => setEditandoConfig(false)} style={styles.btnOutline}>CERRAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionAlumnosPage;