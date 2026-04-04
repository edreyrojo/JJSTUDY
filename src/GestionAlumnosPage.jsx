import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [verArchivados, setVerArchivados] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Estado inicial robusto
  const estadoInicial = {
    nombre: '',
    fechaPago: '',      // Input date
    diaPago: '',        // Para lógica de semáforo
    programa: 'BJJ Adultos',
    perfil: 'Recreativo',
    tieneExperiencia: false,
    tiempoExperiencia: '',
    notasTecnicas: '',
    contacto: '',
    redes: '',
    fotoBase64: '',     // Captura de cámara
    activo: true
  };

  const [nuevo, setNuevo] = useState(estadoInicial);

  // 1. ESCUCHA ACTIVA CON FILTRO DE BÓVEDA
  useEffect(() => {
    const q = query(
      collection(db, "alumnos"), 
      where("activo", "==", !verArchivados), 
      orderBy("nombre", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnos(docs);
    });
    return () => unsub();
  }, [verArchivados]);

  // 2. PROCESAMIENTO DE FOTO (Cámara/Archivos)
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNuevo({...nuevo, fotoBase64: reader.result});
    };
    reader.readAsDataURL(file);
  };

  // 3. SEMÁFORO DE PAGOS ACTUALIZADO
  const calcularEstadoPago = (dia) => {
    if (verArchivados) return { label: 'INACTIVO', color: '#666' };
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaPagoNum = parseInt(dia);
    if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

    if (diaActual < diaPagoNum) return { label: 'AL CORRIENTE', color: '#4CAF50' };
    if (diaActual === diaPagoNum) return { label: 'PAGA HOY', color: '#d4af37' };
    const retraso = diaActual - diaPagoNum;
    return { label: `ATRASADO (${retraso}d)`, color: retraso > 5 ? '#ff4444' : '#ffbb33' };
  };

  // 4. ARCHIVAR PARA RETARGETING
  const toggleEstadoAlumno = async (id, estadoActual) => {
    const msj = estadoActual ? "¿Enviar a la Bóveda de inactivos?" : "¿Re-activar alumno?";
    if (window.confirm(msj)) {
      await updateDoc(doc(db, "alumnos", id), { activo: !estadoActual });
    }
  };

  // 5. GUARDADO INTEGRAL
  const handleGuardar = async () => {
    if (!nuevo.nombre || !nuevo.fechaPago) {
      alert("Nombre y fecha de pago son obligatorios.");
      return;
    }
    const diaExtraido = nuevo.fechaPago.split('-')[2];
    
    try {
      await addDoc(collection(db, "alumnos"), {
        ...nuevo,
        diaPago: diaExtraido,
        fechaRegistro: new Date().toISOString()
      });
      setMostrarForm(false);
      setNuevo(estadoInicial);
    } catch (e) {
      console.error("Error en Firebase:", e);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>
      
      {/* HEADER DINÁMICO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
          <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1rem' }}>
            {verArchivados ? 'BÓVEDA DE RETARGETING' : 'GESTIÓN DE DOJO'}
          </h2>
          <button onClick={() => setMostrarForm(true)} style={{ ...styles.btnGold, width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.5rem' }}>+</button>
        </div>
        <button onClick={() => setVerArchivados(!verArchivados)} style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }}>
          {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
        </button>
      </div>

      {/* GRID DE TARJETAS DETALLADAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
        {alumnos.map(alumno => {
          const pago = calcularEstadoPago(alumno.diaPago);
          return (
            <div key={alumno.id} style={{ ...styles.card, width: '100%', textAlign: 'left', borderLeft: `5px solid ${pago.color}`, padding: '20px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ width: '65px', height: '65px', borderRadius: '50%', backgroundColor: '#222', overflow: 'hidden', border: `1px solid ${pago.color}` }}>
                  {alumno.fotoBase64 ? <img src={alumno.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center', lineHeight: '65px', fontSize: '1.5rem' }}>🥋</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{alumno.nombre}</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#d4af37', fontWeight: 'bold' }}>{alumno.programa}</p>
                  <span style={{ fontSize: '0.75rem', color: pago.color }}>● {pago.label}</span>
                </div>
                <button onClick={() => toggleEstadoAlumno(alumno.id, alumno.activo)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                  {alumno.activo ? '📦' : '♻️'}
                </button>
              </div>

              {/* INFO EXTRA Y CONTACTO */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', borderTop: '1px solid #222', paddingTop: '10px' }}>
                <span>📱 {alumno.contacto || 'N/A'}</span>
                <span>📸 {alumno.redes || 'N/A'}</span>
              </div>

              {alumno.tieneExperiencia && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#d4af37' }}>
                  <strong>Experiencia:</strong> {alumno.tiempoExperiencia}
                </div>
              )}

              {/* BLOQUE DE NOTAS TÉCNICAS */}
              <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #1a1a1a' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>SCOUTING TÉCNICO</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4' }}>
                  {alumno.notasTecnicas || "Sin observaciones técnicas aún."}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE REGISTRO COMPLETO */}
      {mostrarForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '480px', margin: 'auto' }}>
            <h3 style={styles.goldTitle}>FICHA DE INSCRIPCIÓN</h3>
            
            {/* Foto dinámico */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#222', margin: '0 auto 10px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <span style={{fontSize:'2rem'}}>📷</span>}
                </div>
                <input id="fotoInput" type="file" accept="image/*" capture="environment" hidden onChange={handleFotoChange} />
                <p style={{fontSize: '0.6rem', color: '#d4af37'}}>TAP PARA TOMAR FOTO</p>
            </div>

            <input placeholder="Nombre completo" style={styles.input} value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
            
            <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.7rem', color: '#d4af37', fontWeight: 'bold' }}>PRÓXIMO PAGO (CALENDARIO):</label>
                <input type="date" style={{...styles.input, marginTop: '5px'}} value={nuevo.fechaPago} onChange={e => setNuevo({...nuevo, fechaPago: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="WhatsApp" style={styles.input} value={nuevo.contacto} onChange={e => setNuevo({...nuevo, contacto: e.target.value})} />
                <input placeholder="Instagram" style={styles.input} value={nuevo.redes} onChange={e => setNuevo({...nuevo, redes: e.target.value})} />
            </div>

            <select style={{...styles.input, appearance: 'none'}} value={nuevo.programa} onChange={e => setNuevo({...nuevo, programa: e.target.value})}>
              <option value="BJJ Adultos">BJJ ADULTOS</option>
              <option value="BJJ Kids">BJJ KIDS</option>
              <option value="BJJ Teens">BJJ TEENS</option>
              <option value="BJJ Woman´s">BJJ WOMAN´S</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '5px' }}>
                <input type="checkbox" checked={nuevo.tieneExperiencia} onChange={e => setNuevo({...nuevo, tieneExperiencia: e.target.checked})} style={{accentColor: '#d4af37', width: '20px', height: '20px'}} />
                <span style={{fontSize: '0.85rem'}}>¿Viene de otra academia?</span>
            </div>

            {nuevo.tieneExperiencia && (
                <input placeholder="Tiempo de experiencia (ej: 1 año, Cinta Azul)" style={styles.input} value={nuevo.tiempoExperiencia} onChange={e => setNuevo({...nuevo, tiempoExperiencia: e.target.value})} />
            )}

            <textarea placeholder="Notas Técnicas Iniciales / Historial Médico" style={{ ...styles.input, height: '100px', resize: 'none' }} value={nuevo.notasTecnicas} onChange={e => setNuevo({...nuevo, notasTecnicas: e.target.value})} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={handleGuardar} style={styles.btnGold}>CONFIRMAR ALTA</button>
              <button onClick={() => setMostrarForm(false)} style={styles.btnOutline}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionAlumnosPage;