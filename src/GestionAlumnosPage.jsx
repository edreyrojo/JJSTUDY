import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';

const GestionAlumnosPage = ({ onBack, styles }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [verArchivados, setVerArchivados] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  const estadoInicial = {
    nombre: '',
    fechaPago: '',
    diaPago: '',
    programa: 'BJJ Adultos',
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

  // 1. ESCUCHA INDEPENDIENTE (onSnapshot garantiza datos en tiempo real)
  useEffect(() => {
    // Si esta consulta no muestra datos, revisa la consola del navegador (F12). 
    // Firebase suele pedir crear un índice para combinar "where" y "orderBy".
    const q = query(
      collection(db, "alumnos"), 
      where("activo", "==", !verArchivados), 
      orderBy("nombre", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnos(docs);
    }, (error) => {
      console.error("Error en la Bóveda:", error);
    });

    return () => unsub();
  }, [verArchivados]);

  // 2. MANEJO DE FOTO
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setNuevo(prev => ({...prev, fotoBase64: reader.result}));
    reader.readAsDataURL(file);
  };

  // 3. SEMÁFORO DE PAGOS (Lógica de 3 colores + preventivo)
  const calcularEstadoPago = (dia) => {
    if (verArchivados) return { label: 'INACTIVO', color: '#666' };
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const diaPagoNum = parseInt(dia);
    if (!diaPagoNum) return { label: 'SIN FECHA', color: '#666' };

    if (diaActual < diaPagoNum) {
      const faltan = diaPagoNum - diaActual;
      // Preventivo: si faltan 3 días o menos, se pone naranja
      if (faltan <= 3) return { label: `PRÓXIMO (${faltan}d)`, color: '#ffbb33' };
      return { label: 'AL CORRIENTE', color: '#4CAF50' };
    }
    if (diaActual === diaPagoNum) return { label: 'PAGA HOY', color: '#d4af37' };
    const retraso = diaActual - diaPagoNum;
    return { label: `ATRASADO (${retraso}d)`, color: '#ff4444' };
  };

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
      alert("Error al guardar en Firebase. Revisa la consola.");
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>
          <h2 style={{ ...styles.goldTitle, margin: 0, fontSize: '1.2rem' }}>
            {verArchivados ? 'BÓVEDA DE RETARGETING' : 'GESTIÓN DE DOJO'}
          </h2>
          <button onClick={() => setMostrarForm(true)} style={{ ...styles.btnGold, width: '45px', height: '45px', borderRadius: '50%', fontSize: '1.5rem' }}>+</button>
        </div>
        <button onClick={() => setVerArchivados(!verArchivados)} style={{ background: 'none', border: 'none', color: '#d4af37', textDecoration: 'underline', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }}>
          {verArchivados ? "Ver alumnos activos" : "Ver alumnos inactivos (Archivo)"}
        </button>
      </div>

      {/* LISTADO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {alumnos.length === 0 ? (
          <p style={{ color: '#444', textAlign: 'center', gridColumn: '1/-1', marginTop: '50px' }}>No hay registros en esta sección.</p>
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
                    <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alumno.nombre}</h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#d4af37' }}>{alumno.programa}</p>
                    <span style={{ fontSize: '0.7rem', color: pago.color, fontWeight: 'bold' }}>{pago.label}</span>
                  </div>
                  <button onClick={() => {
                    const msj = alumno.activo ? "¿Archivar?" : "¿Reactivar?";
                    if(window.confirm(msj)) updateDoc(doc(db, "alumnos", alumno.id), { activo: !alumno.activo });
                  }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
                    {alumno.activo ? '📦' : '♻️'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', borderTop: '1px solid #222', paddingTop: '8px' }}>
                  <span>📱 {alumno.contacto || '-'}</span>
                  <span>📸 {alumno.redes || '-'}</span>
                </div>

                <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#050505', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <p style={{ margin: 0, color: '#aaa', fontStyle: 'italic', lineHeight: '1.2' }}>
                    {alumno.notasTecnicas || "Sin observaciones."}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL */}
      {mostrarForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ ...styles.card, width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{...styles.goldTitle, marginBottom: '20px'}}>NUEVO ALUMNO</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <div onClick={() => document.getElementById('fotoInput').click()} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#222', margin: '0 auto 8px', border: '2px dashed #d4af37', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {nuevo.fotoBase64 ? <img src={nuevo.fotoBase64} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="" /> : <span style={{fontSize:'1.5rem'}}>📷</span>}
                </div>
                <input id="fotoInput" type="file" accept="image/*" capture="environment" hidden onChange={handleFotoChange} />
                <p style={{fontSize: '0.5rem', color: '#d4af37'}}>FOTO DE PERFIL</p>
            </div>

            <input placeholder="Nombre completo" style={styles.input} value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
            
            <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.6rem', color: '#d4af37' }}>FECHA DE PRÓXIMO PAGO:</label>
                <input type="date" style={{...styles.input, marginTop: '5px'}} value={nuevo.fechaPago} onChange={e => setNuevo({...nuevo, fechaPago: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="WhatsApp" style={styles.input} value={nuevo.contacto} onChange={e => setNuevo({...nuevo, contacto: e.target.value})} />
                <input placeholder="Instagram" style={styles.input} value={nuevo.redes} onChange={e => setNuevo({...nuevo, redes: e.target.value})} />
            </div>

            <select style={{...styles.input, appearance: 'none', backgroundColor: '#111'}} value={nuevo.programa} onChange={e => setNuevo({...nuevo, programa: e.target.value})}>
              <option value="BJJ Adultos">BJJ ADULTOS</option>
              <option value="BJJ Kids">BJJ KIDS</option>
              <option value="BJJ Teens">BJJ TEENS</option>
              <option value="BJJ Woman´s">BJJ WOMAN´S</option>
            </select>

            <textarea placeholder="Scouting técnico / Historial" style={{ ...styles.input, height: '80px' }} value={nuevo.notasTecnicas} onChange={e => setNuevo({...nuevo, notasTecnicas: e.target.value})} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={handleGuardar} style={styles.btnGold}>DAR DE ALTA</button>
              <button onClick={() => { setMostrarForm(false); setNuevo(estadoInicial); }} style={styles.btnOutline}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionAlumnosPage;