import { db } from '../firebase';
import {
    doc, getDoc, setDoc, addDoc,
    collection, query, where, getDocs, orderBy,
    onSnapshot, writeBatch
} from 'firebase/firestore';

// ─────────────────────────────────────────────
// GENERADOR DE CÓDIGOS DE ACCESO POR SEDE
// Formato: PREFIJO-CIUDAD-NNNNNN (ej: HAKA-LEO-482913)
// El código es la única llave para vincularse a una sede; por eso usa
// 6 dígitos (900,000 combinaciones) en lugar de 3.
// ─────────────────────────────────────────────
export const generarCodigoAcceso = (nombreTeam, nombreCiudad) => {
    const prefijo = String(nombreTeam || 'TEAM')
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z]/g, '')
        .substring(0, 4)
        .padEnd(4, 'X');

    const ciudad = String(nombreCiudad || 'HQ')
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/[^A-Z]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X');

    const numero = Math.floor(Math.random() * 900000 + 100000); // 100000-999999
    return `${prefijo}-${ciudad}-${numero}`;
};

// Guarda el mapeo código → sede. Es lo que permite validar la vinculación
// desde las reglas de Firestore sin exponer todas las sedes.
const guardarCodigoAcceso = async (codigoAcceso, { sedeId, teamId, nombreSede }) => {
    const codigo = String(codigoAcceso || '').trim().toUpperCase();
    if (!codigo || !sedeId) return;
    await setDoc(doc(db, 'codigosAcceso', codigo), {
        sedeId,
        teamId: teamId || '',
        nombreSede: nombreSede || '',
        actualizadoEn: new Date().toISOString()
    }, { merge: true });
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
        nombreSede,
        ciudad: ciudad,
        tipo: 'sede_principal',
        codigoAcceso: codigoAcceso,
        logoBase64: '',
        horarios: [],
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        fechaCreacion: new Date().toISOString(),
        activa: true
    });

    // 2.b Mapeo del código de acceso (colección privada, no listable).
    batch.set(doc(db, 'codigosAcceso', codigoAcceso), {
        sedeId: sedeRef.id,
        teamId: uid,
        nombreSede: nombreSede,
        actualizadoEn: new Date().toISOString()
    }, { merge: true });

    // 3. Actualizar el usuario como propietario
    const usuarioRef = doc(db, "usuarios", uid);
    batch.set(usuarioRef, {
        uid,
        rol: 'profesor',
        teamId: uid,
        sedeId: sedeRef.id,
        academiaId: uid, // <--- FALTABA ESTO
        necesitaOnboarding: false, // <--- ESTO APAGA EL BUCLE INFINITO
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
// ONBOARDING: Instructor/profesor se vincula con código de sede
// El código se resuelve en `codigosAcceso` (solo lectura por ID exacto),
// no listando todas las sedes. Las reglas verifican ese mapeo.
// ─────────────────────────────────────────────
export const vincularInstructorASede = async (uid, codigoAcceso) => {
    const codigo = String(codigoAcceso || '').trim().toUpperCase();
    if (!codigo) {
        throw new Error("Ingresa el código que te dio tu profesor.");
    }

    const mapaSnap = await getDoc(doc(db, 'codigosAcceso', codigo));
    if (!mapaSnap.exists()) {
        throw new Error("Código no reconocido. Pide a tu profesor que sincronice el código de la sede.");
    }

    const mapa = mapaSnap.data();
    const sedeId = mapa.sedeId;
    const teamId = mapa.teamId;
    if (!sedeId || !teamId) {
        throw new Error("El código está incompleto. Pide a tu profesor que lo regenere.");
    }

    // Conservamos el rol de staff si ya lo tenía; si es nuevo, entra como instructor.
    const usuarioRef = doc(db, "usuarios", uid);
    const usuarioSnap = await getDoc(usuarioRef);
    const rolActual = usuarioSnap.exists() ? usuarioSnap.data().rol : null;
    const rolFinal = ['profesor', 'instructor'].includes(rolActual) ? rolActual : 'instructor';

    await setDoc(usuarioRef, {
        rol: rolFinal,
        teamId,
        sedeId,
        academiaId: teamId,
        academiaNombre: mapa.nombreSede || '',
        necesitaOnboarding: false,
        fechaVinculacion: new Date().toISOString(),
        codigoVerificado: codigo
    }, { merge: true });

    return {
        teamId,
        sedeId,
        academiaId: teamId,
        nombreSede: mapa.nombreSede || ''
    };
};

// ─────────────────────────────────────────────
// MIGRACIÓN: copia los códigos existentes de `sedes` a `codigosAcceso`.
// El administrador debe ejecutarlo una vez después de desplegar las reglas.
// ─────────────────────────────────────────────
export const sincronizarCodigosAcceso = async () => {
    const snap = await getDocs(collection(db, 'sedes'));
    const sedes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((sede) => String(sede.codigoAcceso || '').trim());

    let creados = 0;
    for (let i = 0; i < sedes.length; i += 400) {
        const batch = writeBatch(db);
        sedes.slice(i, i + 400).forEach((sede) => {
            const codigo = String(sede.codigoAcceso).trim().toUpperCase();
            batch.set(doc(db, 'codigosAcceso', codigo), {
                sedeId: sede.id,
                teamId: sede.teamId || sede.academiaId || '',
                nombreSede: sede.nombreSede || sede.nombre || '',
                actualizadoEn: new Date().toISOString()
            }, { merge: true });
            creados += 1;
        });
        await batch.commit();
    }

    return creados;
};

// ─────────────────────────────────────────────
// SEDES: Crear nueva sede afiliada (solo propietario)
// ─────────────────────────────────────────────
export const crearSedeAfiliada = async ({ teamId, nombreSede, ciudad, nombreTeam }) => {
    const codigoAcceso = generarCodigoAcceso(nombreTeam, ciudad);
    const sedeRef = doc(collection(db, "sedes"));
    const batch = writeBatch(db);

    batch.set(sedeRef, {
        teamId,
        nombre: nombreSede,
        nombreSede,
        ciudad,
        tipo: 'afiliado',
        codigoAcceso,
        logoBase64: '',
        horarios: [],
        programas: ["BJJ Adultos", "BJJ Kids", "BJJ Teens", "No-Gi"],
        fechaCreacion: new Date().toISOString(),
        activa: true
    });

    batch.set(doc(db, 'codigosAcceso', codigoAcceso), {
        sedeId: sedeRef.id,
        teamId: teamId || '',
        nombreSede: nombreSede || '',
        actualizadoEn: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    return { sedeId: sedeRef.id, codigoAcceso };
};

// ─────────────────────────────────────────────
// SEDES: Escucha en tiempo real todas las sedes de un team
// ─────────────────────────────────────────────
export const escucharSedesDeTeam = (teamId, callback, onError) => {
    // Sin orderBy para no depender de un índice compuesto. Se ordena en cliente.
    const q = query(
        collection(db, "sedes"),
        where("teamId", "==", teamId)
    );
    return onSnapshot(q, (snap) => {
        const sedes = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.fechaCreacion || '').localeCompare(String(b.fechaCreacion || '')));
        callback(sedes);
    }, (error) => {
        console.error('Error al escuchar sedes:', error);
        if (typeof onError === 'function') onError(error);
        else callback([]);
    });
};

// ─────────────────────────────────────────────
// ALUMNOS: Query según rol del usuario
// - Propietario: todos los alumnos del team
// - Instructor: solo alumnos de su sede
// ─────────────────────────────────────────────
export const buildAlumnosQuery = ({ rol, teamId, sedeId, soloArchivados = false }) => {
    const activo = !soloArchivados;

    const cleanTeamId = teamId?.trim();
    const cleanSedeId = sedeId?.trim();

    if (!cleanTeamId) {
        return null;
    }

    const veTodoElTeam = ['propietario', 'profesor', 'admin'].includes(rol);
    const colRef = collection(db, "alumnos");

    // Propietarios, profesores y admins ven todo el equipo.
    if (veTodoElTeam) {
        return query(
            colRef,
            where("teamId", "==", cleanTeamId),
            where("activo", "==", activo),
            orderBy("nombre", "asc")
        );
    }

    // Instructores ven solamente los alumnos de su sede.
    if (!cleanSedeId) {
        return query(colRef, where("teamId", "==", "nada_a_mostrar"));
    }

    return query(
        colRef,
        where("teamId", "==", cleanTeamId),
        where("sedeId", "==", cleanSedeId),
        where("activo", "==", activo),
        orderBy("nombre", "asc")
    );
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

    if (!codigoAcceso) {
        throw new Error("La sede no tiene código de acceso. Pide a un administrador que lo regenere antes de migrar.");
    }

    // El código debe existir ANTES de actualizar al usuario, porque las reglas
    // verifican el mapeo `codigosAcceso` en la misma operación.
    await guardarCodigoAcceso(codigoAcceso, {
        sedeId,
        teamId: academiaId,
        nombreSede: nombreSede || "Sede Principal"
    });

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
        rol: 'profesor',
        teamId: academiaId,
        sedeId: sedeId,
        academiaId: academiaId,
        necesitaOnboarding: false,
        codigoVerificado: codigoAcceso,
        fechaVinculacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    console.log(`✅ Migración completa. Team: ${academiaId}, Sede: ${sedeId}, Alumnos migrados: ${alumnosSnap.size}`);
    return { teamId: academiaId, sedeId, codigoAcceso };
};

// ─────────────────────────────────────────────
// PANEL MAESTRO: Stats globales por sede
// ─────────────────────────────────────────────
export const obtenerStatsDeTeam = async (teamId) => {
    // APLICAMOS TRIM POR SEGURIDAD Y CAMBIAMOS academiaId POR teamId
    const cleanTeamId = teamId?.trim();
    
    const alumnosQ = query(
        collection(db, "alumnos"),
        where("teamId", "==", cleanTeamId), // <-- CORRECCIÓN AQUÍ
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