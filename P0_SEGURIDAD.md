# P0 — Seguridad y estabilidad (implementado)

Este documento resume el primer bloque de correcciones P0 y el orden exacto para
desplegarlo sin romper los flujos de onboarding.

> Estado: cambios aplicados en el repo, `npm run lint` limpio, `npm run build`
> correcto y `firebase deploy --only firestore:rules --dry-run` compila las
> reglas. **Nada se ha desplegado todavía.**

## 1. Qué se corrigió

### Seguridad (Firestore Rules)

- **Autoescalada de rol bloqueada.** Un usuario ya no puede cambiarse a sí mismo
  `rol`, `validado`, `cursos_liberados`, `email`, `teamId` ni `sedeId`.
  Solo el administrador puede hacerlo.
- **Onboarding de una sola vez.** Un usuario solo puede convertirse en
  `profesor`/`instructor` durante el onboarding inicial y únicamente si:
  - ya era staff (`rol` profesor/instructor), y
  - crea su propio team (`teamId = uid`) o presenta un **código de sede válido**.
- **Códigos de sede fuera de `sedes`.** Los códigos ahora viven en la colección
  privada `codigosAcceso/{codigo}`:
  - se pueden leer por ID exacto (para vincularse),
  - no se pueden listar (no se pueden enumerar),
  - el código pasó de 3 a 6 dígitos.
- **`sedes` ya no es legible por todo el mundo.** Solo el propio equipo o el
  administrador. El staff no puede cambiar `teamId`, `codigoAcceso` ni borrar
  la sede.
- **Videos, rutas y asignaciones** solo se leen con cuenta **validada**.
- **Teams y academias** con lectura acotada/razonable.
- El cliente ya no copia `cursos_liberados`, `teamId`, `sedeId` ni `rol` al
  migrar una cuenta con Google.

### Estabilidad / bugs

- **Panel Maestro ya no rompe** al pulsar “GESTIONAR ALUMNOS”: `App` pasa
  `onVerSede` y el panel abre la sede seleccionada en Gestión de Alumnos.
- **Alumnos ya no ven el onboarding de staff.** Solo aparece para
  profesor/instructor sin equipo.
- **Gestión de Alumnos recibe `sedeActual`** (antes era código muerto).
- **Filtro de archivados** ya no deja la lista vacía.
- Al editar un alumno **ya no se escribe el campo `id`** dentro del documento.
- El modal de pago cae correctamente a la mensualidad base cuando el alumno
  tiene `montoMensualidad: ''`.
- Ya no se crean alumnos con `sedeId = teamId` cuando no existe una sede real.
- **Fotos comprimidas** antes de guardar:
  - perfil (`MiCuenta`): 720 px / 300 KB,
  - logo de academia (`AdminPage`): 600 px / 380 KB.
- **Planeador:**
  - una clase recién guardada ya no se queda en “Abriendo clase...” aunque el
    `limit(150)` la deje fuera de la consulta,
  - desmarcar asistencia ya no borra el historial técnico,
  - desmarcar una clase ya no elimina la asistencia registrada por otra clase
    del mismo día,
  - un admin ya no puede pasar lista en clases de otro dojo,
  - las clases nuevas guardan `sedeId`.
- **Constructor de rutas:**
  - eliminar un borrador nuevo pide confirmación,
  - publicar valida que las lecciones se puedan reproducir,
  - las lecciones del Vault se etiquetan como Vault (no como Drive),
  - editar un video ya no “congela” su clasificación automática.
- **localStorage corrupto** ya no deja la app en pantalla negra.

## 2. Orden de despliegue (importante)

Los cambios de cliente dependen de las reglas nuevas. El orden seguro es:

1. **Desplegar reglas**
   ```bash
   firebase deploy --only firestore:rules
   ```
2. **Desplegar la app** (Vercel, como siempre).
3. **Sincronizar los códigos existentes una sola vez**
   - Entrar como administrador.
   - Hub → **CONTROL DE ACCESOS** → pestaña **MANTENIMIENTO**.
   - Pulsar **“Sincronizar códigos de acceso”**.
   - Esto copia los códigos de las sedes existentes a `codigosAcceso`.
     Sin este paso, un instructor nuevo no podrá vincularse con su código.

Durante el hueco entre el paso 1 y el 3, el onboarding de instructores nuevos
puede fallar con “Código no reconocido”. Es esperado y se resuelve con el paso 3.

## 3. Pruebas recomendadas tras desplegar

- [ ] Alumno nuevo: se registra, el admin lo valida y **no** ve el onboarding.
- [ ] Instructor nuevo: se registra con código, el admin lo valida, elige
      “SOY INSTRUCTOR”, pega el código y queda vinculado a su sede.
- [ ] Profesor: crea su team desde el onboarding.
- [ ] Admin: cambia rol, valida y libera cursos de un usuario.
- [ ] Con la consola del navegador, intentar
      `updateDoc(doc(db,'usuarios',miUid), { rol:'profesor' })` → debe fallar.
- [ ] Con la consola, intentar leer todas las `sedes` de otro equipo → debe fallar.
- [ ] Subir foto de perfil y logo de academia desde un móvil real.
- [ ] Crear una clase en el Planeador, abrirla y pasar lista.
- [ ] Panel Maestro → “GESTIONAR ALUMNOS” abre la sede correcta.
- [ ] Un instructor que cambia de sede con un código nuevo.

## 4. Segundo bloque aplicado (P1)

- **Alumnos por sede:** un `instructor` ya solo puede leer/crear/editar/borrar
  alumnos de su propia sede; el `profesor` conserva la visión de todo el team y
  el admin la visión global.
- **Clases por sede:** un instructor solo puede crear/editar/borrar clases de su
  sede (las legacy sin `sedeId` siguen siendo accesibles). El profesor conserva
  todo el team.
- **Planeador:** la lista de alumnos se consulta por `sedeId` cuando el usuario
  es instructor; la asistencia y las acciones de la clase se ocultan si la clase
  pertenece a otra sede.
- **Reglas nuevas ya desplegadas** junto con el primer bloque.

## 5. Tercer bloque aplicado (rendimiento / PWA)

- **Error Boundary global:** un error de render ya no deja pantalla negra.
- **Carga diferida:** Mapa, Estudio, Búsqueda, Timer, Admin, Gestión, Planeador,
  Rutas, MiCuenta y Panel Maestro se descargan bajo demanda. El bundle inicial
  bajó de ~1.40 MB a ~0.88 MB (gzip ~285 KB).
- **Viewport:** se permitió el zoom (se quitó `user-scalable=no`).
- **PWA:** el manifest ya no fuerza orientación vertical (`orientation: any`),
  útil en iPad/tablet.
- **Altura dinámica:** todas las pantallas usan `var(--app-vh)` con fallback
  `100vh` → `100dvh` cuando el navegador lo soporta.
- **Base móvil:** se eliminó el `body` centrado de la plantilla de Vite y se
  fijó esquema oscuro.
- **Logos pesados:** nuevo botón en Admin → Mantenimiento →
  “Comprimir logos pesados”. Comprime los logos antiguos que superan 400 KB y
  elimina el campo duplicado `logobase64`. También se evita reescribir un logo
  gigante sin cambios al guardar la sede.

> Tras desplegar, entra como admin y pulsa **“Comprimir logos pesados”** una vez.

## 6. Pendiente para el siguiente bloque (P1)

- **Paywall real.** Hoy se limita a usuarios validados, pero un usuario
  validado con la consola todavía puede leer metadatos de videos/rutas. Para
  cerrarlo de verdad hay que mover videos a Storage con URLs firmadas o
  denormalizar una ACL por usuario/sede en cada video/ruta.
- `firestore.indexes.json` versionado y paginación real en alumnos/clases.
- Fotos fuera de Firestore (Storage) para dejar de acercarse al límite de 1 MB.
- Router/URLs, service worker, `signInWithRedirect` en iOS.
