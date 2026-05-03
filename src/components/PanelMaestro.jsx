// PanelMaestro.jsx
// Vista global exclusiva del Propietario del Team
// Muestra todas las sedes, stats, alumnos globales y gestión de códigos

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, onSnapshot,
    orderBy, doc, updateDoc
} from 'firebase/firestore';
import {
    escucharSedesDeTeam,
    crearSedeAfiliada,
    obtenerStatsDeTeam
} from './teamsService';
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        border: '1px solid #d4af37'
    });
};

const PanelMaestro = ({ usuario, teamData, sedeData, styles, onVerSede, onBack }) => {
    const [sedes, setSedes] = useState([]);
    const [stats, setStats] = useState({ statsPorSede: {}, totalAlumnos: 0, totalAtrasados: 0 });
    const [sedeSeleccionada, setSedeSeleccionada] = useState(null);
    const [alumnosDeSede, setAlumnosDeSede] = useState([]);
    const [mostrarCrearSede, setMostrarCrearSede] = useState(false);
    const [cargandoStats, setCargandoStats] = useState(true);

    // Form nueva sede
    const [formSede, setFormSede] = useState({ nombre: '', ciudad: '' });
    const [cargandoCrear, setCargandoCrear] = useState(false);

    const teamId = usuario.teamId;

    // 1. Escuchar sedes en tiempo real
    useEffect(() => {
        if (!teamId) return;
        const unsub = escucharSedesDeTeam(teamId, setSedes);
        return () => unsub();
    }, [teamId]);

    // 2. Cargar stats globales
    useEffect(() => {
        if (!teamId) return;
        setCargandoStats(true);
        obtenerStatsDeTeam(teamId)
            .then(setStats)
            .finally(() => setCargandoStats(false));
    }, [teamId, sedes]); // recalcular si cambian las sedes

    // 3. Escuchar alumnos de la sede seleccionada
    useEffect(() => {
        if (!sedeSeleccionada) { setAlumnosDeSede([]); return; }
        const q = query(
            collection(db, "alumnos"),
            where("sedeId", "==", sedeSeleccionada.id),
            where("activo", "==", true),
            orderBy("nombre", "asc")
        );
        const unsub = onSnapshot(q, snap => {
            setAlumnosDeSede(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [sedeSeleccionada]);

    const handleCrearSede = async () => {
        if (!formSede.nombre || !formSede.ciudad) return notify("Completa nombre y ciudad.", "error");
        setCargandoCrear(true);
        try {
            const result = await crearSedeAfiliada({
                teamId,
                nombreSede: formSede.nombre,
                ciudad: formSede.ciudad,
                nombreTeam: teamData?.nombre || "TEAM"
            });
            setMostrarCrearSede(false);
            setFormSede({ nombre: '', ciudad: '' });
            notify(`Sede creada. Código: ${result.codigoAcceso} 🏯`);
        } catch (e) {
            notify("Error al crear sede.", "error");
        } finally {
            setCargandoCrear(false);
        }
    };

    const copiarCodigo = (codigo) => {
        navigator.clipboard.writeText(codigo);
        notify("Código copiado al portapapeles.");
    };

    const calcularEstadoPago = (fechaVencimiento) => {
        if (!fechaVencimiento) return { label: 'SIN FECHA', color: '#666' };
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const vence = new Date(fechaVencimiento); vence.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vence - hoy) / 86400000);
        if (diff > 3) return { label: 'AL CORRIENTE', color: '#4CAF50' };
        if (diff > 0) return { label: `VENCE ${diff}d`, color: '#ffbb33' };
        if (diff === 0) return { label: 'PAGA HOY', color: '#d4af37' };
        return { label: `ATRASADO ${Math.abs(diff)}d`, color: '#ff4444' };
    };

    const totalSedes = sedes.length;
    const sedesPrincipales = sedes.filter(s => s.tipo === 'sede_principal').length;
    const sedesAfiliadas = sedes.filter(s => s.tipo === 'afiliado').length;

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', boxSizing: 'border-box' }}>

            {/* ── HEADER PANEL MAESTRO ── */}
            <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <button onClick={onBack} style={{ ...styles.btnOutline, width: 'auto', padding: '10px 20px' }}>← VOLVER</button>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#555', letterSpacing: '3px' }}>PANEL MAESTRO</p>
                        <h2 style={{ ...styles.goldTitle, margin: '4px 0 0 0', fontSize: '1.4rem' }}>
                            {teamData?.nombre?.toUpperCase() || 'MI TEAM'}
                        </h2>
                    </div>

                    <button
                        onClick={() => setMostrarCrearSede(true)}
                        style={{ ...styles.btnGold, width: 'auto', padding: '10px 16px', fontSize: '0.75rem' }}
                    >
                        + SEDE
                    </button>
                </div>

                {/* ── MÉTRICAS GLOBALES ── */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px', marginBottom: '25px'
                }}>
                    {[
                        { label: 'TOTAL ALUMNOS', valor: stats.totalAlumnos, color: '#d4af37', icono: '👥' },
                        { label: 'AL CORRIENTE', valor: stats.totalAlumnos - stats.totalAtrasados, color: '#4CAF50', icono: '✅' },
                        { label: 'ATRASADOS', valor: stats.totalAtrasados, color: '#ff4444', icono: '⚠️' },
                        { label: 'SEDES ACTIVAS', valor: totalSedes, color: '#888', icono: '🏯' },
                    ].map((m, i) => (
                        <div key={i} style={{
                            backgroundColor: '#0a0a0a', border: `1px solid ${m.color}22`,
                            borderRadius: '12px', padding: '15px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{m.icono}</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: m.color }}>
                                {cargandoStats ? '—' : m.valor}
                            </div>
                            <div style={{ fontSize: '0.5rem', color: '#444', letterSpacing: '1px', marginTop: '2px' }}>
                                {m.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── GRID DE SEDES ── */}
            <div style={{ marginBottom: '30px' }}>
                <p style={{ color: '#444', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '15px' }}>
                    SEDES DEL TEAM — {sedesPrincipales} PRINCIPAL · {sedesAfiliadas} AFILIADAS
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {sedes.map(sede => {
                        const sedeStat = stats.statsPorSede[sede.id] || { total: 0, atrasados: 0, alDia: 0 };
                        const esSeleccionada = sedeSeleccionada?.id === sede.id;
                        const esPrincipal = sede.tipo === 'sede_principal';

                        return (
                            <div
                                key={sede.id}
                                onClick={() => setSedeSeleccionada(esSeleccionada ? null : sede)}
                                style={{
                                    backgroundColor: esSeleccionada ? '#0f0f0f' : '#050505',
                                    border: `1px solid ${esSeleccionada ? '#d4af37' : esPrincipal ? '#d4af3744' : '#222'}`,
                                    borderRadius: '14px', padding: '20px', cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative', overflow: 'hidden'
                                }}
                            >
                                {/* Badge tipo */}
                                <span style={{
                                    position: 'absolute', top: '12px', right: '12px',
                                    fontSize: '0.5rem', fontWeight: 'bold', letterSpacing: '1px',
                                    padding: '3px 8px', borderRadius: '4px',
                                    backgroundColor: esPrincipal ? '#d4af3722' : '#ffffff11',
                                    color: esPrincipal ? '#d4af37' : '#555',
                                    border: `1px solid ${esPrincipal ? '#d4af3744' : '#333'}`
                                }}>
                                    {esPrincipal ? '🏯 PRINCIPAL' : '🤝 AFILIADA'}
                                </span>

                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', paddingRight: '80px' }}>
                                    {sede.nombre}
                                </h3>
                                <p style={{ margin: '0 0 15px 0', fontSize: '0.75rem', color: '#555' }}>
                                    📍 {sede.ciudad}
                                </p>

                                {/* Stats mini */}
                                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#d4af37' }}>{sedeStat.total}</div>
                                        <div style={{ fontSize: '0.55rem', color: '#444' }}>ALUMNOS</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>{sedeStat.alDia}</div>
                                        <div style={{ fontSize: '0.55rem', color: '#444' }}>AL DÍA</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: sedeStat.atrasados > 0 ? '#ff4444' : '#333' }}>
                                            {sedeStat.atrasados}
                                        </div>
                                        <div style={{ fontSize: '0.55rem', color: '#444' }}>ATRASADOS</div>
                                    </div>
                                </div>

                                {/* Código de acceso */}
                                <div style={{
                                    backgroundColor: '#000', border: '1px solid #1a1a1a',
                                    borderRadius: '8px', padding: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.5rem', color: '#444', marginBottom: '2px' }}>CÓDIGO DE ACCESO</div>
                                        <code style={{ color: '#d4af37', fontSize: '0.85rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                                            {sede.codigoAcceso}
                                        </code>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); copiarCodigo(sede.codigoAcceso); }}
                                        style={{
                                            background: '#d4af3722', border: '1px solid #d4af3744',
                                            borderRadius: '6px', color: '#d4af37',
                                            padding: '6px 10px', cursor: 'pointer', fontSize: '0.7rem'
                                        }}
                                    >
                                        📋
                                    </button>
                                </div>

                                {/* Botón entrar a gestión */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onVerSede(sede); }}
                                    style={{
                                        ...styles.btnOutline,
                                        width: '100%', marginTop: '12px',
                                        fontSize: '0.7rem', padding: '8px'
                                    }}
                                >
                                    GESTIONAR ALUMNOS →
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── PANEL: ALUMNOS DE SEDE SELECCIONADA ── */}
            {sedeSeleccionada && (
                <div style={{ marginBottom: '30px' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '15px'
                    }}>
                        <p style={{ color: '#d4af37', fontSize: '0.7rem', letterSpacing: '2px', margin: 0 }}>
                            ALUMNOS — {sedeSeleccionada.nombre.toUpperCase()}
                        </p>
                        <button
                            onClick={() => setSedeSeleccionada(null)}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            CERRAR ×
                        </button>
                    </div>

                    {alumnosDeSede.length === 0 ? (
                        <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center', padding: '30px' }}>
                            No hay alumnos activos en esta sede.
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                            {alumnosDeSede.map(alumno => {
                                const pago = calcularEstadoPago(alumno.fechaPago);
                                return (
                                    <div key={alumno.id} style={{
                                        backgroundColor: '#050505',
                                        border: `1px solid ${pago.color}44`,
                                        borderLeft: `4px solid ${pago.color}`,
                                        borderRadius: '10px', padding: '15px',
                                        display: 'flex', gap: '12px', alignItems: 'center'
                                    }}>
                                        <div style={{
                                            width: '45px', height: '45px', borderRadius: '50%',
                                            backgroundColor: '#111', overflow: 'hidden',
                                            border: `2px solid ${pago.color}`, flexShrink: 0
                                        }}>
                                            {alumno.fotoBase64
                                                ? <img src={alumno.fotoBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ textAlign: 'center', lineHeight: '45px', fontSize: '1rem' }}>👤</div>
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {alumno.nombre.toUpperCase()}
                                            </p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: pago.color }}>
                                                ● {pago.label}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL: CREAR SEDE ── */}
            {mostrarCrearSede && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.95)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 5000, padding: '20px', boxSizing: 'border-box'
                }}>
                    <div style={{ ...styles.card, width: '100%', maxWidth: '420px', padding: '35px', border: '1px solid #d4af37' }}>
                        <h3 style={{ ...styles.goldTitle, textAlign: 'center', marginBottom: '25px', fontSize: '1.1rem' }}>
                            NUEVA SEDE AFILIADA
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>
                                    NOMBRE DE LA SEDE
                                </label>
                                <input
                                    placeholder="Ej: Team Hakagure Orizaba"
                                    style={{ ...styles.input, width: '100%', margin: 0 }}
                                    value={formSede.nombre}
                                    onChange={e => setFormSede({ ...formSede, nombre: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>
                                    CIUDAD
                                </label>
                                <input
                                    placeholder="Ej: Orizaba, Ver."
                                    style={{ ...styles.input, width: '100%', margin: 0 }}
                                    value={formSede.ciudad}
                                    onChange={e => setFormSede({ ...formSede, ciudad: e.target.value })}
                                />
                            </div>
                        </div>

                        <p style={{ fontSize: '0.7rem', color: '#444', marginTop: '15px', textAlign: 'center' }}>
                            Se generará automáticamente un código de acceso único para esta sede.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                                onClick={handleCrearSede}
                                disabled={cargandoCrear}
                                style={{ ...styles.btnGold, flex: 2, opacity: cargandoCrear ? 0.6 : 1 }}
                            >
                                {cargandoCrear ? 'CREANDO...' : 'CREAR SEDE'}
                            </button>
                            <button
                                onClick={() => { setMostrarCrearSede(false); setFormSede({ nombre: '', ciudad: '' }); }}
                                style={{ ...styles.btnOutline, flex: 1 }}
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PanelMaestro;
