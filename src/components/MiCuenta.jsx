import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const MiCuenta = ({ usuario, onBack, styles }) => {
    const [editando, setEditando] = useState(false);
    
    // Estado ampliado con TODOS los nuevos campos
    const [datos, setDatos] = useState({
        nombre: usuario?.nombre || '',
        cinturon: usuario?.cinturon || 'Blanco',
        grados: usuario?.grados || 0,
        fotoBase64: usuario?.fotoBase64 || '',
        edad: usuario?.edad || '',
        ciudad: usuario?.ciudad || '',
        bio: usuario?.bio || '',
        academiaIdEnlace: '', 
        // Nuevos campos
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

    const [cargando, setCargando] = useState(false);

    const coloresCinturon = {
        'Blanco': '#FFFFFF', 'Azul': '#2196F3', 'Morado': '#9C27B0', 
        'Café': '#795548', 'Negro': '#212121'
    };

    // Opciones para los Selects
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
            delete datosAGuardar.academiaIdEnlace; // No guardamos el input temporal

            if (datos.academiaIdEnlace && datos.academiaIdEnlace.trim() !== "") {
                datosAGuardar.academiaId = datos.academiaIdEnlace.trim();
                datosAGuardar.academiaNombre = "Sede Pendiente de Verificar"; 
            }

            await updateDoc(userRef, datosAGuardar);
            setEditando(false);
            setDatos({...datos, academiaIdEnlace: ''});
            alert("Pasaporte actualizado correctamente 🥋");
        } catch (error) {
            console.error("Error al actualizar:", error);
            alert("Error al guardar los cambios.");
        } finally {
            setCargando(false);
        }
    };

    const handleDesvincular = async () => {
        if(window.confirm("¿Seguro que deseas desvincularte de tu academia actual?")) {
            setCargando(true);
            try {
                const userRef = doc(db, "usuarios", usuario.uid);
                await updateDoc(userRef, { academiaId: null, academiaNombre: null });
                alert("Te has desvinculado de la academia.");
            } catch (error) {
                console.error("Error al desvincular:", error);
            } finally {
                setCargando(false);
            }
        }
    };

    // Función para formatear el número para WhatsApp (quita espacios y símbolos)
    const getWhatsAppLink = (numero) => {
        if (!numero) return "#";
        const numLimpio = numero.replace(/\D/g, ''); // Deja solo números
        return `https://wa.me/${numLimpio}`;
    };

    return (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
            backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', 
            justifyContent: 'center', alignItems: 'center', zIndex: 4000, 
            padding: '20px', boxSizing: 'border-box' 
        }}>
            <div style={{ 
                ...styles.card, width: '100%', maxWidth: '650px', maxHeight: '95vh', 
                overflowY: 'auto', padding: '30px', border: '1px solid #d4af37',
                backgroundColor: '#000' 
            }}>
                
                <h3 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '5px' }}>
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
                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
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
                            <p style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '15px' }}>
                                Cambiar Foto
                            </p>
                        </>
                    )}
                    <input 
                        disabled={!editando}
                        placeholder="Añade tu frase, lema o estilo de lucha..." 
                        style={{ 
                            ...styles.input, width: '80%', textAlign: 'center', fontStyle: 'italic', 
                            color: '#aaa', border: 'none', borderBottom: editando ? '1px solid #333' : 'none',
                            backgroundColor: 'transparent', padding: '5px'
                        }} 
                        value={datos.bio} onChange={e => setDatos({ ...datos, bio: e.target.value })} 
                    />
                </div>

                {/* SECCIÓN 1: PERFIL DEPORTIVO */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}> PERFIL DE DEPORTIVO</p>
                    
                    {/* Cinturón Gráfico */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ 
                            height: '35px', width: '100%', backgroundColor: coloresCinturon[datos.cinturon], 
                            borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            border: '2px solid #333', overflow: 'hidden'
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
                                <select value={datos.cinturon} onChange={(e) => setDatos({...datos, cinturon: e.target.value, grados: 0})} style={{ ...styles.input, flex: 2, margin: 0 }}>
                                    {['Blanco', 'Azul', 'Morado', 'Café', 'Negro'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={datos.grados} onChange={(e) => setDatos({...datos, grados: Number(e.target.value)})} style={{ ...styles.input, flex: 1, margin: 0 }}>
                                    {[0, 1, 2, 3, 4].map(g => <option key={g} value={g}>{g} Grados</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>CATEGORÍA DE PESO</p>
                            <select disabled={!editando} value={datos.pesoCategoria} onChange={e => setDatos({...datos, pesoCategoria: e.target.value})} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }}>
                                <option value="">Seleccionar...</option>
                                {categoriasPeso.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>ESPECIALIDAD</p>
                            <select disabled={!editando} value={datos.especialidad} onChange={e => setDatos({...datos, especialidad: e.target.value})} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }}>
                                <option value="">Seleccionar...</option>
                                {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TIEMPO ENTRENANDO</p>
                            <input disabled={!editando} placeholder="Ej. 2 años y 3 meses" style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }} value={datos.tiempoEntrenando} onChange={e => setDatos({ ...datos, tiempoEntrenando: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TALLA DE GI</p>
                            <select disabled={!editando} value={datos.tallaGi} onChange={e => setDatos({...datos, tallaGi: e.target.value})} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }}>
                                <option value="">Seleccionar...</option>
                                {tallas.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: DATOS PERSONALES */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>INFO PERSONAL</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: '1 1 100%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>NOMBRE COMPLETO</p>
                            <input disabled={!editando} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }} value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 30%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>EDAD</p>
                            <input type="number" disabled={!editando} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }} value={datos.edad} onChange={e => setDatos({ ...datos, edad: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 30%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>GÉNERO</p>
                            <select disabled={!editando} value={datos.genero} onChange={e => setDatos({...datos, genero: e.target.value})} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }}>
                                <option value="">Seleccionar...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div style={{ flex: '1 1 30%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>CIUDAD/BASE</p>
                            <input disabled={!editando} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }} value={datos.ciudad} onChange={e => setDatos({ ...datos, ciudad: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: CONTACTO Y REDES */}
                <div style={{ marginBottom: '25px', backgroundColor: '#070707', padding: '20px', borderRadius: '10px', border: '1px solid #222' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>CONTACTO & SALUD</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        
                        {/* Teléfono con Botón de WhatsApp integrado */}
                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>TELÉFONO (Móvil)</p>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input disabled={!editando} placeholder="Ej. 5512345678" style={{ ...styles.input, flex: 1, margin: 0, opacity: editando ? 1 : 0.8 }} value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} />
                                {!editando && datos.telefono && (
                                    <a href={getWhatsAppLink(datos.telefono)} target="_blank" rel="noreferrer" style={{ ...styles.btnGold, padding: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                        WA
                                    </a>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: '1 1 45%' }}>
                            <p style={{ color: '#888', fontSize: '0.65rem', marginBottom: '5px' }}>INSTAGRAM</p>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', border: '1px solid #333', borderRadius: '6px', padding: '0 10px' }}>
                                <span style={{ color: '#666' }}>@</span>
                                <input disabled={!editando} style={{ backgroundColor: 'transparent', color: '#fff', border: 'none', outline: 'none', padding: '10px', width: '100%', opacity: editando ? 1 : 0.8 }} value={datos.instagram} onChange={e => setDatos({ ...datos, instagram: e.target.value.replace('@', '') })} />
                            </div>
                        </div>

                        <div style={{ flex: '1 1 60%' }}>
                            <p style={{ color: '#ff4444', fontSize: '0.65rem', marginBottom: '5px', fontWeight: 'bold' }}>CONTACTO DE EMERGENCIA</p>
                            <input disabled={!editando} placeholder="Nombre y Teléfono" style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8, borderColor: editando ? '#ff4444' : '#333' }} value={datos.emergencia} onChange={e => setDatos({ ...datos, emergencia: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 30%' }}>
                            <p style={{ color: '#ff4444', fontSize: '0.65rem', marginBottom: '5px', fontWeight: 'bold' }}>TIPO DE SANGRE</p>
                            <select disabled={!editando} value={datos.tipoSangre} onChange={e => setDatos({...datos, tipoSangre: e.target.value})} style={{ ...styles.input, width: '100%', margin: 0, opacity: editando ? 1 : 0.8 }}>
                                <option value="">---</option>
                                {sangres.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 4. SECCIÓN: VINCULACIÓN ACADÉMICA (Mantenida igual, solo re-estilizada) */}
                <div style={{ marginBottom: '25px', borderTop: '1px solid #222', paddingTop: '20px' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '15px' }}>ESTADO DE ALIANZA:</p>
                    <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #d4af3744' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: editando ? '15px' : '0' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: usuario?.academiaId ? '#d4af37' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                {usuario?.academiaId ? "🏯" : "⛺"}
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, color: usuario?.academiaId ? '#fff' : '#888', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {usuario?.academiaNombre || (usuario?.academiaId ? "Sede Vinculada" : "Lobo Solitario (Sin Academia)")}
                                </p>
                                <p style={{ margin: 0, color: '#666', fontSize: '0.7rem' }}>
                                    {usuario?.academiaId ? `ID: ${usuario.academiaId}` : "Usa el modo edición para unirte a una Sede."}
                                </p>
                            </div>
                            {editando && usuario?.academiaId && (
                                <button onClick={handleDesvincular} style={{ background: 'none', border: '1px solid #ff4444', color: '#ff4444', padding: '5px 10px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                                    DESERTAR
                                </button>
                            )}
                        </div>
                        {editando && (
                            <div style={{ borderTop: '1px solid #222', paddingTop: '15px' }}>
                                <p style={{ color: '#888', fontSize: '0.65rem', margin: '0 0 8px 0', fontWeight: 'bold' }}>VINCULARSE A UNA NUEVA SEDE:</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input placeholder="Pega el Código ID del Profesor/Dojo..." style={{ ...styles.input, flex: 1, margin: 0, fontSize: '0.8rem' }} value={datos.academiaIdEnlace} onChange={e => setDatos({...datos, academiaIdEnlace: e.target.value})} />
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
                            <button onClick={onBack} style={{ ...styles.btnOutline, flex: 1 }}>VOLVER AL HUB</button>
                            <button onClick={() => setEditando(true)} style={{ ...styles.btnGold, flex: 1, fontWeight: 'bold' }}>EDITAR PASAPORTE</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditando(false)} style={{ ...styles.btnOutline, flex: 1 }}>CANCELAR</button>
                            <button onClick={handleGuardar} disabled={cargando} style={{ ...styles.btnGold, flex: 1, fontWeight: 'bold', backgroundColor: cargando ? '#444' : '' }}>
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