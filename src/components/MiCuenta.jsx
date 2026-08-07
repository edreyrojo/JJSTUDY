import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

const localNotify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};

const MiCuenta = ({ usuario, onBack, styles, notify, sedeActual }) => {
    const [editando, setEditando] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const ejecutarNotificacion = typeof notify === 'function' ? notify : localNotify;

    const [datos, setDatos] = useState({
        nombre: usuario?.nombre || '',
        cinturon: usuario?.cinturon || 'Blanco',
        grados: usuario?.grados || 0,
        fotoBase64: usuario?.fotoBase64 || '',
        edad: usuario?.edad || '',
        ciudad: usuario?.ciudad || '',
        bio: usuario?.bio || '',
        academiaIdEnlace: '',
        pesoCategoria: usuario?.pesoCategoria || '',
        especialidad: usuario?.especialidad || '',
        tiempoEntrenando: usuario?.tiempoEntrenando || '',
        genero: usuario?.genero || '',
        telefono: usuario?.telefono || '',
        emergencia: usuario?.emergencia || '',
        tipoSangre: usuario?.tipoSangre || '',
        instagram: usuario?.instagram || '',
        tallaGi: usuario?.tallaGi || ''
    });

    const coloresCinturon = {
        'Blanco': '#FFFFFF', 'Azul': '#2196F3', 'Morado': '#9C27B0',
        'Café': '#795548', 'Negro': '#212121'
    };

    const categoriasPeso = ['Gallo', 'Pluma Ligero', 'Pluma', 'Ligero', 'Medio', 'Medio Pesado', 'Pesado', 'Súper Pesado', 'Ultra Pesado', 'Absoluto'];
    const especialidades = ['Pasador de Guardia', 'Guardiero', 'Leg Locker', 'Derribador', 'Sumisiones Rápidas', 'Presión (Smash)', 'All-Rounder'];
    const tallas = ['A00', 'A0', 'A1', 'A1L', 'A2', 'A2L', 'A3', 'A4', 'A5'];
    const sangres = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

    const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setDatos({ ...datos, fotoBase64: reader.result });
            reader.readAsDataURL(file);
        }
    };

    const handleGuardar = async () => {
        setCargando(true);
        try {
            const userRef = doc(db, "usuarios", usuario.uid);
            let datosAGuardar = { ...datos };
            delete datosAGuardar.academiaIdEnlace;

            if (datos.academiaIdEnlace && datos.academiaIdEnlace.trim() !== "") {
                datosAGuardar.academiaId = datos.academiaIdEnlace.trim();
                datosAGuardar.academiaNombre = "Sede Pendiente de Verificar";
            }

            await updateDoc(userRef, datosAGuardar);
            setEditando(false);
            setDatos({ ...datos, academiaIdEnlace: '' });
            ejecutarNotificacion("Pasaporte actualizado correctamente 🥋");
        } catch (error) {
            console.error("Error al actualizar:", error);
            ejecutarNotificacion("Error al guardar los cambios.", "error");
        } finally {
            setCargando(false);
        }
    };

    const handleDesvincular = async () => {
        const confirmacionValida = typeof notify?.confirm === 'function'
            ? notify.confirm("¿Seguro que deseas desvincularte de tu academia actual?")
            : window.confirm("¿Seguro que deseas desvincularte de tu academia actual?");

        if (confirmacionValida) {
            setCargando(true);
            try {
                const userRef = doc(db, "usuarios", usuario.uid);
                await updateDoc(userRef, { academiaId: null, academiaNombre: null });
                ejecutarNotificacion("Te has desvinculado de la academia.");
            } catch (error) {
                console.error("Error al desvincular:", error);
            } finally {
                setCargando(false);
            }
        }
    };

    const getWhatsAppLink = (numero) => {
        if (!numero) return "#";
        const numLimpio = String(numero).replace(/\D/g, '');
        return `https://wa.me/${numLimpio}`;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 4000,
            padding: esMovil ? '0px' : '20px', boxSizing: 'border-box'
        }}>
            <div style={{
                ...(styles.card || {}),
                width: '100%',
                maxWidth: '720px',
                maxHeight: esMovil ? '100vh' : '90vh',
                height: esMovil ? '100vh' : 'auto',
                borderRadius: esMovil ? '0px' : '14px',
                overflowY: 'auto',
                paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 24px) + 15px)' : '25px',
                paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 15px) + 25px)' : '25px',
                paddingLeft: esMovil ? '15px' : '30px',
                paddingRight: esMovil ? '15px' : '30px',
                border: esMovil ? 'none' : '1px solid #d4af37',
                backgroundColor: '#0a0a0a',
                boxSizing: 'border-box',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
            }}>

                {/* ENCABEZADO */}
                <h3 style={{ ...(styles.goldTitle || {}), textAlign: 'center', marginBottom: '2px', fontSize: '1.2rem', letterSpacing: '2px' }}>
                    MI CUENTA
                </h3>
                <p style={{ textAlign: 'center', color: '#d4af37', margin: '0 0 20px 0', fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Pasaporte BJJ Vault
                </p>

                {/* FOTO + BIO */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                    <div
                        onClick={() => editando && document.getElementById('perfilInput').click()}
                        style={{
                            width: '100px', height: '100px', borderRadius: '12px',
                            backgroundColor: '#111', margin: '0 auto 8px',
                            border: editando ? '2px dashed #d4af37' : '2px solid #333',
                            overflow: 'hidden', cursor: editando ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {datos.fotoBase64 ? (
                            <img src={datos.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Perfil" />
                        ) : (
                            <span style={{ fontSize: '2.5rem' }}>👤</span>
                        )}
                    </div>
                    {editando && (
                        <>
                            <input id="perfilInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                            <p style={{ fontSize: '0.6rem', color: '#d4af37', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', cursor: 'pointer' }}>
                                Cambiar Foto
                            </p>
                        </>
                    )}
                    <input
                        disabled={!editando}
                        placeholder="Lema o estilo de lucha..."
                        style={{
                            ...(styles.input || {}),
                            width: esMovil ? '100%' : '75%',
                            textAlign: 'center',
                            fontStyle: 'italic',
                            color: '#aaa',
                            border: 'none',
                            borderBottom: editando ? '1px solid #d4af37' : 'none',
                            backgroundColor: 'transparent',
                            padding: '4px',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                        }}
                        value={datos.bio}
                        onChange={e => setDatos({ ...datos, bio: e.target.value })}
                    />
                </div>

                {/* SECCIÓN 1: PERFIL DEPORTIVO */}
                <div style={{ marginBottom: '20px', backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '6px', letterSpacing: '1px' }}>PERFIL DEPORTIVO</p>

                    <div style={{ marginBottom: '15px' }}>
                        <div style={{
                            height: '30px', width: '100%', backgroundColor: coloresCinturon[datos.cinturon] || '#FFF',
                            borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            border: '1px solid #333', overflow: 'hidden', boxSizing: 'border-box'
                        }}>
                            <div style={{
                                height: '100%', width: '80px', backgroundColor: datos.cinturon === 'Negro' ? '#D32F2F' : '#111',
                                display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', borderLeft: '1px solid rgba(0,0,0,0.3)'
                            }}>
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} style={{ height: '100%', width: '5px', backgroundColor: i < datos.grados ? '#FFF' : 'transparent' }} />
                                ))}
                            </div>
                        </div>
                        {editando && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <select value={datos.cinturon} onChange={(e) => setDatos({ ...datos, cinturon: e.target.value, grados: 0 })} style={{ ...(styles.input || {}), flex: 2, margin: 0, padding: '6px' }}>
                                    {['Blanco', 'Azul', 'Morado', 'Café', 'Negro'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={datos.grados} onChange={(e) => setDatos({ ...datos, grados: Number(e.target.value) })} style={{ ...(styles.input || {}), flex: 1, margin: 0, padding: '6px' }}>
                                    {[0, 1, 2, 3, 4].map(g => <option key={g} value={g}>{g} Gr.</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr', gap: '10px' }}>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>PESO</p>
                            <select disabled={!editando} value={datos.pesoCategoria} onChange={e => setDatos({ ...datos, pesoCategoria: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {categoriasPeso.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>ESPECIALIDAD</p>
                            <select disabled={!editando} value={datos.especialidad} onChange={e => setDatos({ ...datos, especialidad: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>TIEMPO</p>
                            <input disabled={!editando} placeholder="Ej. 2 años" style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }} value={datos.tiempoEntrenando} onChange={e => setDatos({ ...datos, tiempoEntrenando: e.target.value })} />
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>TALLA GI</p>
                            <select disabled={!editando} value={datos.tallaGi} onChange={e => setDatos({ ...datos, tallaGi: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {tallas.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: DATOS PERSONALES */}
                <div style={{ marginBottom: '20px', backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '6px', letterSpacing: '1px' }}>INFO PERSONAL</p>
                    <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '2fr 1fr 1fr', gap: '10px' }}>
                        <div style={{ gridColumn: esMovil ? 'span 1' : 'span 3' }}>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>NOMBRE</p>
                            <input disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }} value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>EDAD</p>
                            <input type="number" disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }} value={datos.edad} onChange={e => setDatos({ ...datos, edad: e.target.value })} />
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>GÉNERO</p>
                            <select disabled={!editando} value={datos.genero} onChange={e => setDatos({ ...datos, genero: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }}>
                                <option value="">---</option>
                                <option value="Masculino">Masc.</option>
                                <option value="Femenino">Fem.</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>CIUDAD</p>
                            <input disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }} value={datos.ciudad} onChange={e => setDatos({ ...datos, ciudad: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: CONTACTO Y SALUD */}
                <div style={{ marginBottom: '20px', backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '6px', letterSpacing: '1px' }}>CONTACTO & SALUD</p>
                    <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr', gap: '10px' }}>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>TELÉFONO</p>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input disabled={!editando} placeholder="Móvil" style={{ ...(styles.input || {}), flex: 1, margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }} value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} />
                                {!editando && datos.telefono && (
                                    <a href={getWhatsAppLink(datos.telefono)} target="_blank" rel="noreferrer" style={{ ...(styles.btnGold || {}), padding: '8px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                        WA
                                    </a>
                                )}
                            </div>
                        </div>
                        <div>
                            <p style={{ color: '#888', fontSize: '0.6rem', marginBottom: '3px' }}>INSTAGRAM</p>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', border: '1px solid #333', borderRadius: '6px', padding: '0 8px', minHeight: '36px', boxSizing: 'border-box', width: '100%' }}>
                                <span style={{ color: '#666', marginRight: '2px', fontSize: '0.8rem' }}>@</span>
                                <input disabled={!editando} style={{ backgroundColor: 'transparent', color: '#fff', border: 'none', outline: 'none', padding: '6px 0', width: '100%', flex: 1, opacity: editando ? 1 : 0.8, fontSize: '0.85rem' }} value={datos.instagram} onChange={e => setDatos({ ...datos, instagram: e.target.value.replace('@', '') })} />
                            </div>
                        </div>
                        <div>
                            <p style={{ color: '#ff4444', fontSize: '0.6rem', marginBottom: '3px', fontWeight: 'bold' }}>EMERGENCIA</p>
                            <input disabled={!editando} placeholder="Nombre / Tel" style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, borderColor: editando ? '#ff4444' : '#333', padding: '8px', boxSizing: 'border-box' }} value={datos.emergencia} onChange={e => setDatos({ ...datos, emergencia: e.target.value })} />
                        </div>
                        <div>
                            <p style={{ color: '#ff4444', fontSize: '0.6rem', marginBottom: '3px', fontWeight: 'bold' }}>SANGRE</p>
                            <select disabled={!editando} value={datos.tipoSangre} onChange={e => setDatos({ ...datos, tipoSangre: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, padding: '8px', boxSizing: 'border-box' }}>
                                <option value="">---</option>
                                {sangres.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 4. VINCULACIÓN ACADÉMICA */}
                <div style={{ marginBottom: '20px', borderTop: '1px solid #222', paddingTop: '15px', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '10px' }}>ALIANZA Y SEDE:</p>
                    <div style={{ backgroundColor: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #d4af3733', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', flexDirection: esMovil ? 'column' : 'row', alignItems: esMovil ? 'flex-start' : 'center', gap: '12px', marginBottom: editando ? '12px' : '0' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '6px',
                                backgroundColor: usuario?.academiaId ? '#d4af37' : '#222',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', overflow: 'hidden', border: '1px solid #333', flexShrink: 0
                            }}>
                                {usuario?.academiaId ? (
                                    sedeActual?.logoBase64 ? (
                                        <img src={sedeActual.logoBase64} alt="Dojo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : "🏯"
                                ) : "⛺"}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <p style={{ margin: 0, color: usuario?.academiaId ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        {sedeActual?.nombre || (usuario?.academiaId ? "Sede Vinculada" : "Lobo Solitario")}
                                    </p>
                                    {usuario?.rol && (
                                        <span style={{ backgroundColor: '#d4af3722', color: '#d4af37', padding: '1px 5px', borderRadius: '3px', fontSize: '0.55rem', textTransform: 'uppercase', border: '1px solid #d4af3744', fontWeight: 'bold' }}>
                                            {usuario.rol}
                                        </span>
                                    )}
                                </div>
                                <p style={{ margin: '2px 0 0 0', color: '#666', fontSize: '0.65rem' }}>
                                    {usuario?.academiaId ? `ID: ${usuario.academiaId}` : "Sin vincular"}
                                </p>
                            </div>

                            {editando && usuario?.academiaId && (
                                <button onClick={handleDesvincular} style={{ background: 'none', border: '1px solid #ff4444', color: '#ff4444', padding: '6px 10px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold', width: esMovil ? '100%' : 'auto' }}>
                                    DESERTAR
                                </button>
                            )}
                        </div>

                        {editando && (
                            <div style={{ borderTop: '1px solid #222', paddingTop: '10px', marginTop: '10px' }}>
                                <p style={{ color: '#888', fontSize: '0.6rem', margin: '0 0 6px 0', fontWeight: 'bold' }}>CÓDIGO DE NUEVA SEDE:</p>
                                <input placeholder="Pega el ID del Profesor..." style={{ ...(styles.input || {}), width: '100%', margin: 0, fontSize: '0.75rem', padding: '8px', boxSizing: 'border-box' }} value={datos.academiaIdEnlace} onChange={e => setDatos({ ...datos, academiaIdEnlace: e.target.value })} />
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. BOTONES DE ACCIÓN */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {!editando ? (
                        <>
                            <button onClick={onBack} style={{ ...(styles.btnOutline || {}), flex: 1, padding: '10px 0', fontSize: '0.8rem' }}>VOLVER</button>
                            <button onClick={() => setEditando(true)} style={{ ...(styles.btnGold || {}), flex: 1, fontWeight: 'bold', padding: '10px 0', fontSize: '0.8rem' }}>EDITAR</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditando(false)} style={{ ...(styles.btnOutline || {}), flex: 1, padding: '10px 0', fontSize: '0.8rem' }}>CANCELAR</button>
                            <button
                                onClick={handleGuardar}
                                disabled={cargando}
                                style={{
                                    ...(styles.btnGold || {}),
                                    flex: 1,
                                    padding: '10px 0',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    backgroundColor: cargando ? '#b8962d' : '#d4af37',
                                    opacity: cargando ? 0.7 : 1,
                                    cursor: cargando ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {cargando ? "FORJANDO..." : "GUARDAR"}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MiCuenta;