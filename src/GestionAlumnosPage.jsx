import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [verArchivados, setVerArchivados] = useState(false); // Switch para ver la "Bóveda"
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Estado para el formulario (incluye los nuevos campos de contacto y foto)
  const [nuevo, setNuevo] = useState({
    nombre: '',
    diaPago: '',
    programa: 'BJJ Adultos',
    perfil: 'Recreativo',
    notasTecnicas: '', // Notas de BJJ
    contacto: '', // Celular/WhatsApp
    redes: '', // Instagram
    fotoUrl: '', // URL de imagen
    activo: true
  });

  // 1. ESCUCHA EN TIEMPO REAL FILTRADA
  useEffect(() => {
    // Filtramos por el estado 'activo' según lo que el usuario quiera ver
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

  // 2. LÓGICA DE CÁLCULO DE PAGOS
  const calcularEstadoPago = (dia) => {
    if (verArchivados) return { label: 'INACTIVO', color: '#666' };
    
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaPagoNum = parseInt(dia);

    if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

    if (diaActual < diaPagoNum) {
      return { label: 'AL CORRIENTE', color: '#4CAF50' };
    } else if (diaActual === diaPagoNum) {
      return { label: 'PAGA HOY', color: '#d4af37' };
    } else {
      const retraso = diaActual - diaPagoNum;
      return { 
        label: `ATRASADO (${retraso}d)`, 
        color: retraso > 5 ? '#ff4444' : '#ffbb33' 
      };
    }
  };

  // 3. ARCHIVAR / RE-ACTIVAR ALUMNO (Retargeting)
  const toggleEstadoAlumno = async (id, estadoActual) => {
    const msj = estadoActual ? "¿Archivar alumno? Se enviará a la bóveda." : "¿Re-activar alumno?";
    if (window.confirm(msj)) {
      await updateDoc(doc(db, "alumnos", id), { activo: !estadoActual });
    }
  };

  // 4. GUARDAR EN FIREBASE
  const handleGuardar = async () => {
    if (!nuevo.nombre || !nuevo.diaPago) {
      alert("El nombre y el día de pago son obligatorios.");
      return;
    }
    try {
      await addDoc(collection(db, "alumnos"), {
        ...nuevo,
        fechaRegistro: new Date().toISOString()
      });
      setMostrarForm(false);
      setNuevo({ nombre: '', diaPago: '', programa: 'BJJ Adultos', perfil: 'Recreativo', notasTecnicas: '', contacto: '', redes: '', fotoUrl: '', activo: true });
    } catch (e) {
      console.error("Error al guardar alumno:", e);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>
            ← VOLVER
          </button>
          <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1rem' }}>
            {verArchivados ? 'BÓVEDA (INACTIVOS)' : 'GESTIÓN DE ALUMNOS'}
          </h2>
          <button 
            onClick={() => setMostrarForm(true)} 
            style={{ ...styles.btnGold, width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.5rem' }}
          >
            +
          </button>
        </div>
        
        {/* Switch para Bóveda */}
        <button 
          onClick={() => setVerArchivados(!verArchivados)}
          style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'right' }}
        >
          {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Bóveda)"}
        </button>
      </div>

      {/* GRID DE ALUMNOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {alumnos.map(alumno => {
          const pago = calcularEstadoPago(alumno.diaPago);
          return (
            <div key={alumno.id} style={{ 
              ...styles.card, 
              width: '100%', 
              textAlign: 'left', 
              borderLeft: `5px solid ${pago.color}`,
              padding: '15px'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Foto del Alumno */}
                <div style={{ width: '55px', height: '55px', borderRadius: '50%', backgroundColor: '#222', overflow: 'hidden', border: '1px solid #333' }}>
                  {alumno.fotoUrl ? 
                    <img src={alumno.fotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="profile" /> : 
                    <div style={{ textAlign: 'center', lineHeight: '55px', fontSize: '1.2rem' }}>🥋</div>
                  }
                </div>
                
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{alumno.nombre}</h3>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#888' }}>{alumno.programa} | {alumno.perfil}</p>
                  <span style={{ fontSize: '0.7rem', color: pago.color, fontWeight: 'bold' }}>● {pago.label}</span>
                </div>

                {/* Botón Archivar/Reactivar */}
                <button 
                  onClick={() => toggleEstadoAlumno(alumno.id, alumno.activo)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  {alumno.activo ? '📦' : '♻️'}
                </button>
              </div>

              {/* DATOS DE CONTACTO */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '10px', fontSize: '0.75rem', color: '#d4af37' }}>
                <span>📱 {alumno.contacto || 'Sin tel'}</span>
                <span>📸 {alumno.redes || 'Sin IG'}</span>
              </div>

              {/* NOTAS TÉCNICAS */}
              <div style={{ 
                marginTop: '12px', 
                padding: '10px', 
                backgroundColor: '#0a0a0a', 
                borderRadius: '6px', 
                border: '1px solid #1a1a1a' 
              }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.6rem', color: '#555', fontWeight: 'bold', textTransform: 'uppercase' }}>Observaciones Técnicas</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic' }}>
                  {alumno.notasTecnicas || "Sin notas técnicas..."}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PARA NUEVO ALUMNO / EDITAR */}
      {mostrarForm && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '450px', marginTop: '50px', marginBottom: '50px' }}>
            <h3 style={styles.goldTitle}>REGISTRAR EN LA FORTUNA</h3>
            
            <input placeholder="Nombre completo" style={styles.input} value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <input placeholder="Día pago (1-31)" type="number" style={styles.input} value={nuevo.diaPago} onChange={e => setNuevo({...nuevo, diaPago: e.target.value})} />
              <input placeholder="WhatsApp/Cel" style={styles.input} value={nuevo.contacto} onChange={e => setNuevo({...nuevo, contacto: e.target.value})} />
            </div>

            <input placeholder="Instagram (ej: @usuario)" style={styles.input} value={nuevo.redes} onChange={e => setNuevo({...nuevo, redes: e.target.value})} />
            <input placeholder="URL de la Foto" style={styles.input} value={nuevo.fotoUrl} onChange={e => setNuevo({...nuevo, fotoUrl: e.target.value})} />

            <select style={{...styles.input, appearance: 'none'}} value={nuevo.programa} onChange={e => setNuevo({...nuevo, programa: e.target.value})}>
              <option value="BJJ Adultos">BJJ Adultos</option>
              <option value="BJJ Kids">BJJ Kids</option>
              <option value="No-Gi">No-Gi</option>
              <option value="Competición">Competición</option>
            </select>

            <select style={{...styles.input, appearance: 'none'}} value={nuevo.perfil} onChange={e => setNuevo({...nuevo, perfil: e.target.value})}>
              <option value="Recreativo">Recreativo</option>
              <option value="Competidor">Competidor</option>
              <option value="Atención Especial">Atención Especial</option>
              <option value="Autismo/Neurodivergente">Autismo/Neurodivergente</option>
            </select>

            <textarea 
              placeholder="Notas Técnicas (Ej: Reforzar escapes de montura, excelente uso de De la Riva)" 
              style={{ ...styles.input, height: '100px', resize: 'none' }} 
              value={nuevo.notasTecnicas}
              onChange={e => setNuevo({...nuevo, notasTecnicas: e.target.value})}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleGuardar} style={styles.btnGold}>DAR DE ALTA</button>
              <button onClick={() => setMostrarForm(false)} style={styles.btnOutline}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionAlumnosPage;