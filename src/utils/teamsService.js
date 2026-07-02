import { db } from '../firebase';
import {
    doc, getDoc, setDoc, addDoc, updateDoc,
    collection, query, where, getDocs, orderBy,
    onSnapshot, writeBatch
} from 'firebase/firestore';

// ─────────────────────────────────────────────
// GENERADOR DE CÓDIGOS DE ACCESO POR SEDE
// ─────────────────────────────────────────────
export const generarCodigoAcceso = (nombreTeam, nombreCiudad) => {
    const prefijo = nombreTeam.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4).padEnd(4, 'X');
    const ciudad = nombreCiudad.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');
    const numero = Math.floor(Math.random() * 900 + 100);
    return `${prefijo}-${ciudad}-${numero}`;
};

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
export const inicializarUsuario = async (uid) => {
    const usuarioRef = doc(db, "usuarios", uid);
    const usuarioSnap = await getDoc(usuarioRef);
    if (!usuarioSnap.exists()) return { esNuevo: true };

    const usuarioData = usuarioSnap.data();
    if (usuarioData.academiaId && !usuarioData.teamId) return { esLegacy: true, ...usuarioData };

    const { rol, teamId, sedeId } = usuarioData;
    let teamData = null;
    let sedeData = null;

    if (teamId) {
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (teamSnap.exists()) teamData = { id: teamSnap.id, ...teamSnap.data() };
    }
    if (sedeId) {
        const sedeSnap = await getDoc(doc(db, "sedes", sedeId));
        if (sedeSnap.exists()) sedeData = { id: sedeSnap.id, ...sedeSnap.data() };
    }

    return { rol, teamId, sedeId, teamData, sedeData, uid };
};

// ─────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────
export const crearNuevoTeam = async ({ uid, nombreTeam, nombreSede, ciudad }) => {
    const batch = writeBatch(db);
    const teamRef = doc(db, "teams", uid);
    batch.set(teamRef, { nombre: nombreTeam, propietarioUid: uid, fechaCreacion: new Date().toISOString(), activo: true });

    const sedeRef = doc(collection(db, "sedes"));
    const codigoAcceso = generarCodigoAcceso(nombreTeam, ciudad);
    batch.set(sedeRef, { teamId: uid, nombre: nombreSede, ciudad: ciudad, tipo: 'sede_principal', codigoAcceso: codigoAcceso, fechaCreacion: new Date().toISOString(), activa: true });

    const usuarioRef = doc(db, "usuarios", uid);
    batch.set(usuarioRef, { uid, rol: 'profesor', teamId: uid, sedeId: sedeRef.id, academiaId: uid, necesitaOnboarding: false, fechaActualizacion: new Date().toISOString() }, { merge: true });

    await batch.commit();
    return { teamId: uid, sedeId: sedeRef.id, codigoAcceso };
};

export const vincularInstructorASede = async (uid, codigoAcceso) => {
    const q = query(collection(db, "sedes"), where("codigoAcceso", "==", codigoAcceso.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Código de acceso inválido.");

    const sedeDoc = snap.docs[0];
    const sedeData = sedeDoc.data();

    await setDoc(doc(db, "usuarios", uid), { rol: 'instructor', teamId: sedeData.teamId, sedeId: sedeDoc.id, academiaId: sedeData.teamId, necesitaOnboarding: false, fechaVinculacion: new Date().toISOString() }, { merge: true });
    return { teamId: sedeData.teamId, sedeId: sedeDoc.id, nombreSede: sedeData.nombre };
};

// ─────────────────────────────────────────────
// SEDES
// ─────────────────────────────────────────────
export const crearSedeAfiliada = async ({ teamId, nombreSede, ciudad, nombreTeam }) => {
    const codigoAcceso = generarCodigoAcceso(nombreTeam, ciudad);
    const sedeRef = await addDoc(collection(db, "sedes"), { teamId, nombre: nombreSede, ciudad, tipo: 'afiliado', codigoAcceso, logoBase64: '', horarios: [], programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"], fechaCreacion: new Date().toISOString(), activa: true });
    return { sedeId: sedeRef.id, codigoAcceso };
};

export const escucharSedesDeTeam = (teamId, callback) => {
    const q = query(collection(db, "sedes"), where("teamId", "==", teamId), orderBy("fechaCreacion", "asc"));
    return onSnapshot(q, (snap) => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
};

// ─────────────────────────────────────────────
// ALUMNOS: Query unificada
// ─────────────────────────────────────────────
export const buildAlumnosQuery = ({ rol, teamId, sedeId, soloArchivados = false }) => {
    const activo = !soloArchivados;
    const veTodoElTeam = ['propietario', 'profesor', 'admin'].includes(rol);

    if (veTodoElTeam) {
        return query(collection(db, "alumnos"), where("teamId", "==", teamId), where("activo", "==", activo), orderBy("nombre", "asc"));
    } else {
        return query(collection(db, "alumnos"), where("teamId", "==", teamId), where("sedeId", "==", sedeId), where("activo", "==", activo), orderBy("nombre", "asc"));
    }
};

// ─────────────────────────────────────────────
// MIGRACIÓN LEGACY
// ─────────────────────────────────────────────
export const migrarDatosLegacy = async ({ uid, academiaId, nombreTeam, nombreSede, ciudad }) => {
    // (Lógica mantenida igual, usa academiaId porque está buscando registros viejos)
    const teamRef = doc(db, "teams", academiaId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        await setDoc(teamRef, { nombre: nombreTeam || "Mi Team", propietarioUid: uid, fechaCreacion: new Date().toISOString(), activo: true, migradoDesde: 'legacy' });
    }

    const sedesQ = query(collection(db, "sedes"), where("teamId", "==", academiaId), where("tipo", "==", "sede_principal"));
    const sedesSnap = await getDocs(sedesQ);

    let sedeId;
    if (sedesSnap.empty) {
        const codigoAcceso = generarCodigoAcceso(nombreTeam || "TEAM", ciudad || "HQ");
        const sedeRef = await addDoc(collection(db, "sedes"), { teamId: academiaId, nombre: nombreSede || "Sede Principal", ciudad: ciudad || "", tipo: 'sede_principal', codigoAcceso, logoBase64: '', horarios: [], programas: [], fechaCreacion: new Date().toISOString(), activa: true, migradoDesde: 'legacy' });
        sedeId = sedeRef.id;
    } else {
        sedeId = sedesSnap.docs[0].id;
    }

    const alumnosQ = query(collection(db, "alumnos"), where("academiaId", "==", academiaId));
    const alumnosSnap = await getDocs(alumnosQ);
    const batch = writeBatch(db);
    alumnosSnap.docs.forEach(alumnoDoc => {
        if (!alumnoDoc.data().teamId) {
            batch.update(alumnoDoc.ref, { teamId: academiaId, sedeId: sedeId });
        }
    });

    batch.set(doc(db, "usuarios", uid), { rol: 'propietario', teamId: academiaId, sedeId: sedeId, fechaMigracion: new Date().toISOString() }, { merge: true });
    await batch.commit();
    return { teamId: academiaId, sedeId };
};

// ─────────────────────────────────────────────
// PANEL MAESTRO: Stats (CORREGIDO)
// ─────────────────────────────────────────────
export const obtenerStatsDeTeam = async (teamId) => {
    // CAMBIO: Ahora filtra por teamId
    const alumnosQ = query(collection(db, "alumnos"), where("teamId", "==", teamId), where("activo", "==", true));
    const snap = await getDocs(alumnosQ);
    const alumnos = snap.docs.map(d => d.data());

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const statsPorSede = {};
    let totalAtrasados = 0;
    let totalAlumnos = 0;

    alumnos.forEach(a => {
        const sid = a.sedeId || 'sin_sede';
        if (!statsPorSede[sid]) statsPorSede[sid] = { total: 0, atrasados: 0, alDia: 0 };
        statsPorSede[sid].total++;
        totalAlumnos++;

        if (a.fechaPago) {
            const vence = new Date(a.fechaPago);
            vence.setHours(0, 0, 0, 0);
            if (vence < hoy) {
                statsPorSede[sid].atrasados++;
                totalAtrasados++;
            } else {
                statsPorSede[sid].alDia++;
            }
        }
    });

    return { statsPorSede, totalAlumnos, totalAtrasados };
};