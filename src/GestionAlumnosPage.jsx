import React, { useState, useEffect } from 'react';
// Importamos las herramientas de Firebase (asegúrate de que la ruta a tu config sea correcta)
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Estado para el formulario de nuevo alumno
  const [nuevo, setNuevo] = useState({
    nombre: '',
    diaPago: '',
    programa: 'BJJ Adultos',
    perfil: 'Recreativo',
    notas: '',
    contacto: ''
  });

  // 1. ESCUCHA EN TIEMPO REAL
  // Trae los alumnos de Firebase y los ordena por nombre
  useEffect(() => {
    const q = query(collection(db, "alumnos"), orderBy("nombre", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnos(docs);
    });
    return () => unsub();
  }, []);

  // 2. LÓGICA DE CÁLCULO DE PAGOS (AUTOMÁTICO)
  const calcularEstadoPago = (dia) => {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaPagoNum = parseInt(dia);

    if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

    if (diaActual < diaPagoNum) {
      return { label: 'AL CORRIENTE', color: '#4CAF50' }; // Verde
    } else if (diaActual === diaPagoNum) {
      return { label: 'PAGA HOY', color: '#d4af37' }; // Dorado
    } else {
      const retraso = diaActual - diaPagoNum;
      // Si lleva más de 5 días de retraso, se pone rojo crítico
      return { 
        label: `ATRASADO (${retraso}d)`, 
        color: retraso > 5 ? '#ff4444' : '#ffbb33' 
      };
    }
  };

  // 3. GUARDAR EN FIREBASE
  const handleGuardar = async () => {
    if (!nuevo.nombre || !nuevo.diaPago) {
      alert("El nombre y el día de pago son obligatorios.");
      return;
    }
    try {
      await addDoc(collection(db, "alumnos"), {
        ...nuevo,
        fechaRegistro: new Date().toISOString(),
        activo: true
      });
      setMostrarForm(false);
      setNuevo({ nombre: '', diaPago: '', programa: 'BJJ Adultos', perfil: 'Recreativo', notas: '', contacto: '' });
    } catch (e) {
      console.error("Error al guardar alumno:", e);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      
      {/* HEADER DINÁMICO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>
          ← VOLVER AL HUB
        </button>
        <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.2rem' }}>GESTIÓN DE ALUMNOS</h2>
        <button 
          onClick={() => setMostrarForm(true)} 
          style={{ ...styles.btnGold, width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.5rem' }}
        >
          +
        </button>
      </div>

      {/* LISTADO DE ALUMNOS (GRID RESPONSIVO) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '15px' 
      }}>
        {alumnos.map(alumno => {
          const pago = calcularEstadoPago(alumno.diaPago);
          return (
            <div key={alumno.id} style={{ 
              ...styles.card, 
              width: '100%', 
              textAlign: 'left', 
              borderLeft: `5px solid ${pago.color}`,
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{alumno.nombre}</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>
                    {alumno.programa} | {alumno.perfil}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <span style={{ 
                     fontSize: '0.65rem', 
                     backgroundColor: pago.color + '22', 
                     color: pago.color, 
                     padding: '4px 8px', 
                     borderRadius: '4px',
                     fontWeight: 'bold',
                     border: `1px solid ${pago.color}`
                   }}>
                     {pago.label}
                   </span>
                </div>
              </div>

              {/* NOTAS ESPECIALES (IMPORTANTE PARA ATENCIÓN PERSONALIZADA) */}
              {alumno.notas && (
                <div style={{ 
                  marginTop: '15px', 
                  padding: '10px', 
                  backgroundColor: '#1a1a1a', 
                  borderRadius: '6px', 
                  fontSize: '0.8rem', 
                  color: '#bbb',
                  borderLeft: '2px solid #333'
                }}>
                  <strong>Nota:</strong> {alumno.notas}
                </div>
              )}
              
              <div style={{ marginTop: '15px', fontSize: '0.7rem', color: '#555' }}>
                Día de cobro: {alumno.diaPago} de cada mes
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PARA NUEVO ALUMNO */}
      {mostrarForm && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' 
        }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '400px' }}>
            <h3 style={styles.goldTitle}>REGISTRAR ALUMNO</h3>
            
            <input 
              placeholder="Nombre completo" 
              style={styles.input} 
              value={nuevo.nombre}
              onChange={e => setNuevo({...nuevo, nombre: e.target.value})}
            />
            
            <input 
              placeholder="Día de pago (ej: 5)" 
              type="number"
              style={styles.input} 
              value={nuevo.diaPago}
              onChange={e => setNuevo({...nuevo, diaPago: e.target.value})}
            />

            <select 
              style={{...styles.input, appearance: 'none'}} 
              value={nuevo.programa}
              onChange={e => setNuevo({...nuevo, programa: e.target.value})}
            >
              <option value="BJJ Adultos">BJJ Adultos</option>
              <option value="BJJ Kids">BJJ Kids</option>
              <option value="No-Gi">No-Gi</option>
              <option value="Competición">Competición</option>
            </select>

            <select 
              style={{...styles.input, appearance: 'none'}} 
              value={nuevo.perfil}
              onChange={e => setNuevo({...nuevo, perfil: e.target.value})}
            >
              <option value="Recreativo">Recreativo</option>
              <option value="Competidor">Competidor</option>
              <option value="Atención Especial">Atención Especial</option>
              <option value="Autismo/Neurodivergente">Autismo/Neurodivergente</option>
            </select>

            <textarea 
              placeholder="Notas médicas, objetivos o comentarios..." 
              style={{ ...styles.input, height: '80px', resize: 'none' }} 
              value={nuevo.notas}
              onChange={e => setNuevo({...nuevo, notas: e.target.value})}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleGuardar} style={styles.btnGold}>GUARDAR</button>
              <button onClick={() => setMostrarForm(false)} style={styles.btnOutline}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionAlumnosPage;