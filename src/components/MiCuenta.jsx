import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

// Mantenemos la función global por si no se provee por prop
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

    // MEJORA: Hook detector de pantalla móvil para activar responsividad quirúrgica
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Utiliza la prop si existe, o la función local como respaldo
    const ejecutarNotificacion = typeof notify === 'function' ? notify : localNotify;

    const estiloBotonGuardar = {
        ...(styles.btnGold || {}),
        flex: 1,
        fontWeight: 'bold',
        backgroundColor: cargando ? '#ffbb00' : '#d4af37',
        color: '#000',
        cursor: cargando ? 'not-allowed' : 'pointer'
    };

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

    const categoriasPeso = ['Gallo (Rooster)', 'Pluma Ligero (Light Feather)', 'Pluma (Feather)', 'Ligero (Light)', 'Medio (Middle)', 'Medio Pesado (Medium Heavy)', 'Pesado (Heavy)', 'Súper Pesado (Super Heavy)', 'Ultra Pesado (Ultra Heavy)', 'Absoluto'];
    const especialidades = ['Pasador de Guardia', 'Guardiero', 'Leg Locker', 'Derribador (Takedowns)', 'Sumisiones Rápidas', 'Presión (Smash)', 'All-Rounder'];
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
        // CORRECCIÓN: Respaldo ultra seguro en caso de que notify.confirm no venga instanciado desde el padre
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

    // CORRECCIÓN FIX: Forzamos conversión a string para evitar caídas catastróficas del replace si viene un dato numérico
    const getWhatsAppLink = (numero) => {
        if (!numero) return "#";
        const numLimpio = String(numero).replace(/\D/g, '');
        return `https://wa.me/${numLimpio}`;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex',
            justifyContent: 'center', alignItems: esMovil ? 'flex-start' : 'center', zIndex: 4000,
            padding: esMovil ? '0px' : '20px', boxSizing: 'border-box'
        }}>
            <div style={{
                ...(styles.card || {}),
                width: '100%',
                maxWidth: '650px',
                maxHeight: esMovil ? '100vh' : '95vh',
                height: esMovil ? '100vh' : 'auto',
                borderRadius: esMovil ? '0px' : (styles.card?.borderRadius || '12px'),
                overflowY: 'auto',
                // Añadimos paddings dinámicos para evitar obstrucciones del área de la cámara frontal (Notch) y barra inferior
                paddingTop: esMovil ? 'calc(env(safe-area-inset-top, 24px) + 20px)' : '30px',
                paddingBottom: esMovil ? 'calc(env(safe-area-inset-bottom, 15px) + 30px)' : '30px',
                paddingLeft: esMovil ? '15px' : '30px',
                paddingRight: esMovil ? '15px' : '30px',
                border: esMovil ? 'none' : '1px solid #d4af37',
                backgroundColor: '#000',
                boxSizing: 'border-box'
            }}>

                <h3 style={{ ...(styles.goldTitle || {}), textAlign: 'center', marginBottom: '5px' }}>
                    MI CUENTA
                </h3>
                <p style={{ textAlign: 'center', color: '#888', margin: '0 0 25px 0', fontSize: '0.9rem' }}>
                    Pasaporte JJ
                </p>

                {/* HEADER (Foto + Bio) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px' }}>
                    <div
                        onClick={() => editando && document.getElementById('perfilInput').click()}
                        style={{
                            width: '120px', height: '120px', borderRadius: '15px',
                            backgroundColor: '#111', margin: '0 auto 10px',
                            border: editando ? '2px dashed #d4af37' : '2px solid #333',
                            overflow: 'hidden', cursor: editando ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {datos.fotoBase64 ? (
                            <img src={datos.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Perfil" />
                        ) : (
                            <span style={{ fontSize: '3rem' }}>👤</span>
                        )}
                    </div>
                    {editando && (
                        <>
                            <input id="perfilInput" type="file" accept="image/*" hidden onChange={handleFotoChange} />
                            <p style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '15px', cursor: 'pointer' }}>
                                Cambiar Foto
                            </p>
                        </>
                    )}
                    <input
                        disabled={!editando}
                        placeholder="Añade tu frase, lema o estilo de lucha..."
                        style={{
                            ...(styles.input || {}),
                            width: esMovil ? '100%' : '80%',
                            textAlign: 'center',
                            fontStyle: 'italic',
                            color: '#aaa',
                            border: 'none',
                            borderBottom: editando ? '1px solid #333' : 'none',
                            backgroundColor: 'transparent',
                            padding: '5px',
                            boxSizing: 'border-box'
                        }}
                        value={datos.bio}
                        onChange={e => setDatos({ ...datos, bio: e.target.value })}
                    />
                </div>

                {/* SECCIÓN 1: PERFIL DEPORTIVO */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}> PERFIL DEPORTIVO</p>

                    {/* Cinturón Gráfico */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            height: '35px', width: '100%', backgroundColor: coloresCinturon[datos.cinturon] || '#FFF',
                            borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            border: '2px solid #333', overflow: 'hidden', boxSizing: 'border-box'
                        }}>
                            <div style={{
                                height: '100%', width: '90px', backgroundColor: datos.cinturon === 'Negro' ? '#D32F2F' : '#111',
                                display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', borderLeft: '2px solid rgba(0,0,0,0.3)'
                            }}>
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} style={{ height: '100%', width: '6px', backgroundColor: i < datos.grados ? '#FFF' : 'transparent', borderRight: i < datos.grados ? '1px solid rgba(0,0,0,0.2)' : 'none' }} />
                                ))}
                            </div>
                        </div>
                        {editando && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <select value={datos.cinturon} onChange={(e) => setDatos({ ...datos, cinturon: e.target.value, grados: 0 })} style={{ ...(styles.input || {}), flex: 2, margin: 0 }}>
                                    {['Blanco', 'Azul', 'Morado', 'Café', 'Negro'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={datos.grados} onChange={(e) => setDatos({ ...datos, grados: Number(e.target.value) })} style={{ ...(styles.input || {}), flex: 1, margin: 0 }}>
                                    {[0, 1, 2, 3, 4].map(g => <option key={g} value={g}>{g} Grados</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {/* CAMBIO: flex de los bloques pasa a 100% en móvil para no colapsar las celdas */}
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>CATEGORÍA DE PESO</p>
                            <select disabled={!editando} value={datos.pesoCategoria} onChange={e => setDatos({ ...datos, pesoCategoria: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {categoriasPeso.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>ESPECIALIDAD</p>
                            <select disabled={!editando} value={datos.especialidad} onChange={e => setDatos({ ...datos, especialidad: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TIEMPO ENTRENANDO</p>
                            <input disabled={!editando} placeholder="Ej. 2 años y 3 meses" style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }} value={datos.tiempoEntrenando} onChange={e => setDatos({ ...datos, tiempoEntrenando: e.target.value })} />
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TALLA DE GI</p>
                            <select disabled={!editando} value={datos.tallaGi} onChange={e => setDatos({ ...datos, tallaGi: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                {tallas.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: DATOS PERSONALES */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>INFO PERSONAL</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: '1 1 100%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>NOMBRE COMPLETO</p>
                            <input disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }} value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 30%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>EDAD</p>
                            <input type="number" disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }} value={datos.edad} onChange={e => setDatos({ ...datos, edad: e.target.value })} />
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 30%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>GÉNERO</p>
                            <select disabled={!editando} value={datos.genero} onChange={e => setDatos({ ...datos, genero: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }}>
                                <option value="">Seleccionar...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 32%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>CIUDAD/BASE</p>
                            <input disabled={!editando} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }} value={datos.ciudad} onChange={e => setDatos({ ...datos, ciudad: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: CONTACTO Y REDES */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>CONTACTO & SALUD</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>

                        {/* Teléfono con Botón de WhatsApp */}
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TELÉFONO (Móvil)</p>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input disabled={!editando} placeholder="Ej. 5512345678" style={{ ...(styles.input || {}), flex: 1, margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }} value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} />
                                {!editando && datos.telefono && (
                                    <a href={getWhatsAppLink(datos.telefono)} target="_blank" rel="noreferrer" style={{ ...(styles.btnGold || {}), padding: '10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        CONTACTAR
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Instagram Optimizado */}
                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 47%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>INSTAGRAM</p>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', border: '1px solid #333', borderRadius: '6px', padding: '0 10px', minHeight: '40px', boxSizing: 'border-box', width: '100%' }}>
                                <span style={{ color: '#666', marginRight: '2px' }}>@</span>
                                {/* CAMBIO: flex 1 para aprovechar todo el ancho libre interior */}
                                <input disabled={!editando} style={{ backgroundColor: 'transparent', color: '#fff', border: 'none', outline: 'none', padding: '8px 0', width: '100%', flex: 1, opacity: editando ? 1 : 0.8 }} value={datos.instagram} onChange={e => setDatos({ ...datos, instagram: e.target.value.replace('@', '') })} />
                            </div>
                        </div>

                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 55%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#ff4444', fontSize: '0.65rem', marginBottom: '5px', fontWeight: 'bold' }}>CONTACTO DE EMERGENCIA</p>
                            <input disabled={!editando} placeholder="Nombre y Teléfono" style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, borderColor: editando ? '#ff4444' : '#333', boxSizing: 'border-box' }} value={datos.emergencia} onChange={e => setDatos({ ...datos, emergencia: e.target.value })} />
                        </div>

                        <div style={{ flex: esMovil ? '1 1 100%' : '1 1 38%', boxSizing: 'border-box' }}>
                            <p style={{ color: '#ff4444', fontSize: '0.65rem', marginBottom: '5px', fontWeight: 'bold' }}>TIPO DE SANGRE</p>
                            <select disabled={!editando} value={datos.tipoSangre} onChange={e => setDatos({ ...datos, tipoSangre: e.target.value })} style={{ ...(styles.input || {}), width: '100%', margin: 0, opacity: editando ? 1 : 0.8, boxSizing: 'border-box' }}>
                                <option value="">---</option>
                                {sangres.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 4. SECCIÓN: VINCULACIÓN ACADÉMICA */}
                <div style={{ marginBottom: '25px', borderTop: '1px solid #222', paddingTop: '20px', boxSizing: 'border-box' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px' }}>ESTADO DE ALIANZA:</p>
                    <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #d4af3744', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', flexDirection: esMovil ? 'column' : 'row', alignItems: esMovil ? 'flex-start' : 'center', gap: '15px', marginBottom: editando ? '15px' : '0' }}>

                            <div style={{
                                width: '50px', height: '50px', borderRadius: '8px',
                                backgroundColor: usuario?.academiaId ? '#d4af37' : '#333',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem', overflow: 'hidden', border: '1px solid #333',
                                flexShrink: 0
                            }}>
                                {usuario?.academiaId ? (
                                    sedeActual?.logoBase64 ? (
                                        <img
                                            src={sedeActual.logoBase64}
                                            alt="Logo Dojo"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : "🏯"
                                ) : "⛺"}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <p style={{ margin: 0, color: usuario?.academiaId ? '#fff' : '#888', fontSize: '0.95rem', fontWeight: 'bold' }}>
                                        {sedeActual?.nombre || (usuario?.academiaId ? "Sede Vinculada" : "Lobo Solitario (Sin Academia)")}
                                    </p>

                                    {usuario?.rol && (
                                        <span style={{
                                            backgroundColor: '#d4af3722', color: '#d4af37',
                                            padding: '2px 6px', borderRadius: '4px',
                                            fontSize: '0.65rem', textTransform: 'uppercase',
                                            border: '1px solid #d4af3744', fontWeight: 'bold'
                                        }}>
                                            {usuario.rol}
                                        </span>
                                    )}
                                </div>
                                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.7rem' }}>
                                    {usuario?.academiaId ? `ID: ${usuario.academiaId}` : "Usa el modo edición para unirte a una Sede."}
                                </p>
                            </div>

                            {editando && usuario?.academiaId && (
                                <button onClick={handleDesvincular} style={{ background: 'none', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 12px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold', width: esMovil ? '100%' : 'auto' }}>
                                    DESERTAR
                                </button>
                            )}
                        </div>

                        {editando && (
                            <div style={{ borderTop: '1px solid #222', paddingTop: '15px', marginTop: esMovil ? '10px' : '0' }}>
                                <p style={{ color: '#888', fontSize: '0.65rem', margin: '0 0 8px 0', fontWeight: 'bold' }}>VINCULARSE A UNA NUEVA SEDE:</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input placeholder="Pega el Código ID del Profesor/Dojo..." style={{ ...(styles.input || {}), flex: 1, margin: 0, fontSize: '0.8rem', boxSizing: 'border-box' }} value={datos.academiaIdEnlace} onChange={e => setDatos({ ...datos, academiaIdEnlace: e.target.value })} />
                                </div>
                                <p style={{ fontSize: '0.6rem', color: '#666', marginTop: '5px' }}>* El cambio se aplicará al guardar el perfil.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. BOTONES DE ACCIÓN FINAL */}
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                    {!editando ? (
                        <>
                            <button onClick={onBack} style={{ ...(styles.btnOutline || {}), flex: 1, padding: esMovil ? '12px 0' : '10px 0' }}>VOLVER</button>
                            <button onClick={() => setEditando(true)} style={{ ...(styles.btnGold || {}), flex: 1, fontWeight: 'bold', padding: esMovil ? '12px 0' : '10px 0' }}>EDITAR</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditando(false)} style={{ ...(styles.btnOutline || {}), flex: 1, padding: esMovil ? '12px 0' : '10px 0' }}>CANCELAR</button>
                            <button
                                onClick={handleGuardar}
                                disabled={cargando}
                                style={{
                                    ...estiloBotonGuardar,
                                    padding: esMovil ? '12px 0' : '10px 0',
                                    backgroundColor: cargando ? '#b8962d' : '#d4af37',
                                    opacity: cargando ? 0.7 : 1
                                }}
                            >
                                {cargando ? "FORJANDO..." : "GUARDAR CAMBIOS"}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MiCuenta;