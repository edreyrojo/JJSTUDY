// teamsService.js
// Servicio central para la arquitectura Multi-Team de Team Hakagure Platform
// Maneja: Teams, Sedes, Roles, Migración de datos legacy

import { db } from '../firebase';
import {
    doc, getDoc, setDoc, addDoc, updateDoc,
    collection, query, where, getDocs, orderBy,
    onSnapshot, writeBatch
} from 'firebase/firestore';

// ─────────────────────────────────────────────
// GENERADOR DE CÓDIGOS DE ACCESO POR SEDE
// Formato: PREFIJO-CIUDAD-NNN (ej: HAKA-LEO-001)
// ─────────────────────────────────────────────
export const generarCodigoAcceso = (nombreTeam, nombreCiudad) => {
    const prefijo = nombreTeam
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 4)
        .padEnd(4, 'X');

    const ciudad = nombreCiudad
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^A-Z]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X');

    const numero = Math.floor(Math.random() * 900 + 100); // 100-999
    return `${prefijo}-${ciudad}-${numero}`;
};

// ─────────────────────────────────────────────
// INICIALIZACIÓN: Detecta o crea el perfil del usuario
// Llamar al montar la app, después del login
// Retorna: { rol, teamId, sedeId, teamData, sedeData }
// ─────────────────────────────────────────────
export const inicializarUsuario = async (uid) => {
    const usuarioRef = doc(db, "usuarios", uid);
    const usuarioSnap = await getDoc(usuarioRef);

    if (!usuarioSnap.exists()) {
        // Usuario nuevo — el onboarding decidirá qué hacer
        return { esNuevo: true };
    }

    const usuarioData = usuarioSnap.data();

    // Usuario legacy (tiene academiaId pero no teamId) — necesita migración
    if (usuarioData.academiaId && !usuarioData.teamId) {
        return { esLegacy: true, ...usuarioData };
    }

    // Usuario ya migrado
    const { rol, teamId, sedeId } = usuarioData;

    // Carga datos del team y sede
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
// ONBOARDING: Crear un nuevo Team (Profesor/Fundador)
// ─────────────────────────────────────────────
export const crearNuevoTeam = async ({ uid, nombreTeam, nombreSede, ciudad }) => {
    const batch = writeBatch(db);

    // 1. Crear el Team
    const teamRef = doc(db, "teams", uid); // El uid del propietario ES el teamId
    batch.set(teamRef, {
        nombre: nombreTeam,
        propietarioUid: uid,
        fechaCreacion: new Date().toISOString(),
        activo: true
    });

    // 2. Crear la Sede Principal
    const sedeRef = doc(collection(db, "sedes"));
    const codigoAcceso = generarCodigoAcceso(nombreTeam, ciudad);
    batch.set(sedeRef, {
        teamId: uid,
        nombre: nombreSede,
        ciudad: ciudad,
        tipo: 'sede_principal',
        codigoAcceso: codigoAcceso,
        logoBase64: '',
        horarios: [],
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        fechaCreacion: new Date().toISOString(),
        activa: true
    });

    // 3. Actualizar el usuario como propietario
    const usuarioRef = doc(db, "usuarios", uid);
    batch.set(usuarioRef, {
        uid,
        rol: 'propietario',
        teamId: uid,
        sedeId: sedeRef.id,
        fechaActualizacion: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    return {
        teamId: uid,
        sedeId: sedeRef.id,
        codigoAcceso
    };
};

// ─────────────────────────────────────────────
// ONBOARDING: Instructor se vincula con código de sede
// ─────────────────────────────────────────────
export const vincularInstructorASede = async (uid, codigoAcceso) => {
    // Buscar la sede por código
    const q = query(
        collection(db, "sedes"),
        where("codigoAcceso", "==", codigoAcceso.trim().toUpperCase())
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error("Código de acceso inválido. Verifica con tu profesor.");
    }

    const sedeDoc = snap.docs[0];
    const sedeData = sedeDoc.data();

    // Actualizar usuario
    await setDoc(doc(db, "usuarios", uid), {
        rol: 'instructor',
        teamId: sedeData.teamId,
        sedeId: sedeDoc.id,
        fechaVinculacion: new Date().toISOString()
    }, { merge: true });

    return {
        teamId: sedeData.teamId,
        sedeId: sedeDoc.id,
        nombreSede: sedeData.nombre
    };
};

// ─────────────────────────────────────────────
// SEDES: Crear nueva sede afiliada (solo propietario)
// ─────────────────────────────────────────────
export const crearSedeAfiliada = async ({ teamId, nombreSede, ciudad, nombreTeam }) => {
    const codigoAcceso = generarCodigoAcceso(nombreTeam, ciudad);

    const sedeRef = await addDoc(collection(db, "sedes"), {
        teamId,
        nombre: nombreSede,
        ciudad,
        tipo: 'afiliado',
        codigoAcceso,
        logoBase64: '',
        horarios: [],
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        fechaCreacion: new Date().toISOString(),
        activa: true
    });

    return { sedeId: sedeRef.id, codigoAcceso };
};

// ─────────────────────────────────────────────
// SEDES: Escucha en tiempo real todas las sedes de un team
// ─────────────────────────────────────────────
export const escucharSedesDeTeam = (teamId, callback) => {
    const q = query(
        collection(db, "sedes"),
        where("teamId", "==", teamId),
        orderBy("fechaCreacion", "asc")
    );
    return onSnapshot(q, (snap) => {
        const sedes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(sedes);
    });
};

// ─────────────────────────────────────────────
// ALUMNOS: Query según rol del usuario
// - Propietario: todos los alumnos del team
// - Instructor: solo alumnos de su sede
// ─────────────────────────────────────────────
export const buildAlumnosQuery = ({ rol, teamId, sedeId, soloArchivados = false }) => {
    const activo = !soloArchivados;

    if (rol === 'propietario') {
        // Ve TODO el team
        return query(
            collection(db, "alumnos"),
            where("teamId", "==", teamId),
            where("activo", "==", activo),
            orderBy("nombre", "asc")
        );
    } else {
        // Solo su sede
        return query(
            collection(db, "alumnos"),
            where("sedeId", "==", sedeId),
            where("activo", "==", activo),
            orderBy("nombre", "asc")
        );
    }
};

// ─────────────────────────────────────────────
// MIGRACIÓN: Usuarios y alumnos legacy (academiaId → teamId + sedeId)
// Ejecutar UNA SOLA VEZ por usuario legacy
// ─────────────────────────────────────────────
export const migrarDatosLegacy = async ({ uid, academiaId, nombreTeam, nombreSede, ciudad }) => {
    console.log("🔄 Iniciando migración legacy...");

    // 1. Crear team si no existe
    const teamRef = doc(db, "teams", academiaId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        await setDoc(teamRef, {
            nombre: nombreTeam || "Mi Team",
            propietarioUid: uid,
            fechaCreacion: new Date().toISOString(),
            activo: true,
            migradoDesde: 'legacy'
        });
    }

    // 2. Buscar si ya existe sede principal para este academiaId
    const sedesQ = query(
        collection(db, "sedes"),
        where("teamId", "==", academiaId),
        where("tipo", "==", "sede_principal")
    );
    const sedesSnap = await getDocs(sedesQ);

    let sedeId;
    let codigoAcceso;

    if (sedesSnap.empty) {
        // Crear sede principal
        codigoAcceso = generarCodigoAcceso(nombreTeam || "TEAM", ciudad || "HQ");
        const sedeRef = await addDoc(collection(db, "sedes"), {
            teamId: academiaId,
            nombre: nombreSede || "Sede Principal",
            ciudad: ciudad || "",
            tipo: 'sede_principal',
            codigoAcceso,
            logoBase64: '',
            horarios: [],
            programas: [],
            fechaCreacion: new Date().toISOString(),
            activa: true,
            migradoDesde: 'legacy'
        });
        sedeId = sedeRef.id;
    } else {
        sedeId = sedesSnap.docs[0].id;
        codigoAcceso = sedesSnap.docs[0].data().codigoAcceso;
    }

    // 3. Migrar todos los alumnos con este academiaId
    const alumnosQ = query(
        collection(db, "alumnos"),
        where("academiaId", "==", academiaId)
    );
    const alumnosSnap = await getDocs(alumnosQ);

    const batch = writeBatch(db);

    alumnosSnap.docs.forEach(alumnoDoc => {
        const data = alumnoDoc.data();
        // Solo migrar si no tiene teamId todavía
        if (!data.teamId) {
            batch.update(alumnoDoc.ref, {
                teamId: academiaId,
                sedeId: sedeId,
                // Mantenemos academiaId para no romper nada durante transición
            });
        }
    });

    // 4. Actualizar usuario
    batch.set(doc(db, "usuarios", uid), {
        rol: 'propietario',
        teamId: academiaId,
        sedeId: sedeId,
        fechaMigracion: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    console.log(`✅ Migración completa. Team: ${academiaId}, Sede: ${sedeId}, Alumnos migrados: ${alumnosSnap.size}`);
    return { teamId: academiaId, sedeId, codigoAcceso };
};

// ─────────────────────────────────────────────
// PANEL MAESTRO: Stats globales por sede
// ─────────────────────────────────────────────
export const obtenerStatsDeTeam = async (teamId) => {
    const alumnosQ = query(
        collection(db, "alumnos"),
        where("teamId", "==", teamId),
        where("activo", "==", true)
    );
    const snap = await getDocs(alumnosQ);
    const alumnos = snap.docs.map(d => d.data());

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const statsPorSede = {};
    let totalAtrasados = 0;
    let totalAlumnos = 0;

    alumnos.forEach(a => {
        const sid = a.sedeId || 'sin_sede';
        if (!statsPorSede[sid]) {
            statsPorSede[sid] = { total: 0, atrasados: 0, alDia: 0 };
        }
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
