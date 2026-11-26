# Gestión de sedes madre, sedes afiliadas y contenido

## 1. Modelo

```
SEDE MADRE / ACADEMIA
  academias/{academiaId}
  ├── nombre, ciudad, logo, ownerUid, teamId
  ├── cursos_liberados[]        ← instruccionales para toda la academia
  └── sedes/{sedeId}
        ├── academiaId, teamId
        ├── nombre, ciudad, tipo (principal | afiliada)
        ├── codigoAcceso
        └── cursos_liberados[]  ← excepción: solo esta sede
```

- **Sede madre:** HOLKAN, HANNYA ACADEMY. Es el sistema/organización.
- **Sede afiliada:** MAKTUB, FULL BLOODED BROTHERS, HANNYA ZONA SUR, HANNYA MARFIL.
- **`teamId`:** identificador interno de la academia. Para academias nuevas es el
  ID del documento de academia.
- **`academiaId`:** documento de perfil de la academia.
- **`sedeId`:** sede concreta del usuario/alumno.
- Un usuario pertenece a **una sola sede madre a la vez**.

## 2. Dónde se administra

**Hub → CONTROL DE ACCESOS → ESTRUCTURAS**

La vista vieja de árbol fue reemplazada por un maestro-detalle:

- Lista de sedes madre a la izquierda.
- Al seleccionar una: Resumen, Sedes, Equipo y Contenido.
- Botones:
  - **NUEVA SEDE MADRE**: crea academia + team + sede principal + código.
  - **AGREGAR SEDE**: crea una sede afiliada con código y hereda contenido.
  - **ASIGNAR STAFF**: usuario + rol + sede.
  - **AJUSTES**: nombre, ciudad, dueño y logo.

## 3. Aislamiento de alumnos

| Quién | Qué ve |
|---|---|
| Admin | Todos los alumnos de todas las sedes |
| Profesor/instructor de una sede | **Solo los alumnos de su propia sede** |
| Profesor de la sede madre | Solo los alumnos de **su** sede, no los de sus afiliadas |
| Alumno | Solo sus datos |

Esto se aplica en:

- `firestore.rules` (`alumnos` exige `teamId` + `sedeId` del usuario).
- `GestionAlumnosPage` y `buildAlumnosQuery` (consulta por sede).
- `PlaneadorClasesPage` (clases y alumnos filtrados por sede).
- `PanelMaestro` quedó **solo para admin**.

Verificado con un instructor temporal de FULL BLOODED BROTHERS:
vio **8 alumnos**, no los 26 del admin ni los de otras sedes.

## 4. Contenido: academia o sede

En **Contenido** hay un selector **“Aplicar contenido a”**:

- **Toda la academia:** se hereda a todas sus sedes.
- **Solo [sede]:** excepción local, no se ve en las demás.

Funciona para:

- **Instruccionales:** se guardan en `academias/{id}.cursos_liberados` o
  `sedes/{id}.cursos_liberados`.
- **Rutas:** asignación `destinoTipo: "academia"` o `"sede"`.

La app resuelve el acceso:

- `accesoVault` revisa cursos de academia y cursos de sede.
- `rutasAprendizaje.coincideDestino`:
  - academia → todas las sedes del team.
  - sede → **solo esa sede** (se corrigió una regla que hacía visible la ruta
    en todo el team).

## 5. Clases

- Las clases son **locales a la sede**. Incluyen asistencia y datos de alumnos,
  por eso no se comparten entre sedes.
- La visibilidad “Global” se retiró del editor.
- El contenido compartido se publica como **ruta/instruccional**, no como clase.
- Las clases viejas sin `sedeId` se pueden reparar en
  **Estructuras → Resumen → Reparar con creador**.

## 6. Normalización aplicada a producción

Se corrigieron solo enlaces, sin mover alumnos de sede:

- 5 sedes: `teamId` alineado con su academia.
- 4 cuentas de staff: `academiaId`/`teamId` alineados con su sede.
- 8 alumnos: `academiaId`/`teamId` alineados con su sede.
- 3 clases: `sedeId` inferido del creador.

Respaldo de los valores anteriores:
`C:\Users\zamna\AppData\Local\Temp\normalizacion-backup-1795721346000.json`

## 7. Pendiente de decisión del admin

La vista muestra **4 sedes sin academia**; hay que asignarlas desde
**Sedes → Sedes sin academia**:

- `TEAM HAGAKURE` (sede del admin): probablemente HOLKAN.
- `veracruz` / team `holkan`: probablemente HOLKAN.
- `HANNYA ACADEMY MARFIL`: HANNYA ACADEMY.
- `GENESIS ACADEMY`: decidir si es una nueva sede madre o se afilia.

Al asignarlas, el botón **NORMALIZAR** alinea su team y sus datos.

## 8. Marcas de tiempo globales de instruccionales

**Admin → CONTROL MAESTRO → MARCAS**

- El admin elige curso y video, y crea marcas con tiempo (`03:45`), título y
  descripción opcional.
- Se guardan en `marcasVideo/{marcaId}`:
  `videoId`, `cursoId`, `tiempo`, `segundos`, `titulo`, `descripcion`.
- Reglas: lectura para usuarios validados; escritura solo admin.
- En **Modo Estudio**, el usuario ve dos bloques separados:
  - **MARCADORES DEL PROFESOR:** marcas globales del admin. Al tocarlas salta
    al minuto.
  - **MIS MARCADORES:** notas privadas del alumno (sin cambios).
- Son independientes: el alumno puede seguir creando sus propias marcas sin
  modificar las globales.

### Reproductor y captura exacta

La pestaña MARCAS incluye un reproductor embebido:

- El admin reproduce y pausa el instruccional dentro de la misma pantalla.
- **CAPTURAR TIEMPO** toma el segundo exacto del reproductor y lo pone en el
  campo TIEMPO.
- **IR AL TIEMPO ESCRITO** salta a un minuto concreto para verificar.
- Botones **-5s / -1s / +1s / +5s** para ajustar fino.
- Al tocar una marca existente, el video salta a ese momento.

### Reproductor nativo y búsqueda exacta

Drive bloquea el `<video>` directo con `Cross-Origin-Resource-Policy: same-site`,
así que se usa la **Google Drive API v3** con una clave pública restringida:

```
https://www.googleapis.com/drive/v3/files/{id}?alt=media&key=...
```

- La clave solo permite `drive.googleapis.com` y solo responde a los
  referrers de `jjstudy.vercel.app` y `localhost`.
- No da acceso a archivos privados: únicamente reproduce archivos que ya son
  públicos en el Vault.
- Soporta `Range`, por lo que el navegador puede buscar, pausar y saltar a un
  segundo exacto.
- La lógica está en `src/utils/driveVideo.js`. Para rotar la clave se define
  `VITE_DRIVE_API_KEY` en Vercel.
- Si el video no es público o la clave falla, tanto el admin como el Modo
  Estudio caen automáticamente al visor oficial de Drive en un iframe.

Validación de duración:

- El admin muestra la duración real del video.
- No permite guardar una marca posterior al final del video.
- Las marcas viejas que quedaron fuera de rango se muestran en rojo en el
  panel, con un botón **LIMPIAR FUERA DE RANGO**, y se ocultan en Modo Estudio
  para no saltar al final por error.

## 9. Siguiente endurecimiento (opcional)

- Mover `clases.asistencia` a una subcolección privada
  (`clases/{id}/asistencia/{alumnoId}`) si en el futuro se quieren compartir
  clases entre sedes sin exponer alumnos.
- Fotos de clase privadas por defecto.
- Índices de Firestore versionados.
- Paginación de alumnos/clases.
