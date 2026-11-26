# P1 — Pagos, accesibilidad, router y offline

Este bloque cubre los pasos 2, 3 y 4 del plan.

## 1. Pagos y vencimientos

Archivos: `src/utils/gestionAlumnos.js`, `src/components/GestionAlumnosPage.jsx`.

- **Regla clara:** el pago extiende desde el **vencimiento actual**.
  - Si el alumno está al día o adelantado, el nuevo vencimiento se corre desde
    la fecha que ya tenía.
  - Si está atrasado, cada mes pagado reduce el atraso. Pagar 1 mes estando
    3 meses atrasado deja 2 meses pendientes; es lo correcto para una
    mensualidad por periodos.
- **“Poner al día”**: el modal calcula cuántos meses faltan para que el nuevo
  vencimiento quede en el futuro y ofrece un botón con ese número exacto.
- **Aviso de atraso restante**: si aun pagando quedan días de atraso, el modal
  lo muestra en rojo antes de guardar y el toast lo recuerda después.
- **No se permiten fechas de pago futuras.**
- El registro de pago ahora guarda:
  `periodoDesde`, `periodoHasta`, `periodo`, `fecha` (fecha real del pago),
  `meses`, `monto`, `metodo`, `nota`.
- El historial muestra el periodo cubierto:
  `Cubre 01 feb → 01 mar`.
- **Cobrado del mes** ahora cuenta pagos de alumnos activos **y archivados**
  (es dinero que entró). Los conteos de activos/atrasados siguen siendo solo
  de activos.
- El select de meses incluye el valor de “poner al día” aunque sea 5, 8, etc.
  (hasta 36 meses).

## 2. Accesibilidad

Nuevo hook: `src/hooks/useDialogA11y.js`.

- Cierra con **Escape**.
- **Trampa de foco**: Tab/Shift+Tab no se escapan del modal.
- **Bloqueo de scroll** del body.
- Devuelve el foco al elemento que abrió el modal.
- Pila de diálogos: si hay dos modales abiertos, solo el superior responde.

Aplicado a:

- Gestión de Alumnos: expediente, formulario, configuración y pago.
- Planeador: tipos de bloque y foto ampliada.
- Constructor de rutas: modal de video y selector.
- Timer: reglas personalizadas.
- Estudio: reporte de video.
- Hub: anuncio, soporte y tutoriales.
- Instalación y onboarding.

Además:

- Tabs de expediente/configuración con `role="tablist"` y `aria-selected`.
- Timer con `role="timer"` y `aria-live` en la fase (no en cada segundo).
- `aria-label` en los buscadores principales.
- Objetivos táctiles de iconos subidos a 32–34 px en Gestión y Rutas.

## 3. Navegación sin URL

Se probó un router por hash y se retiró por decisión de producto: mostrar
`#/mapa`, `#/alumnos`, etc. expone la estructura interna y facilita que alguien
busque rutas específicas.

Ahora:

- La navegación vuelve a ser **estado interno** (`page`), sin cambiar la URL.
- Cualquier hash heredado (`#/mapa`, etc.) se limpia al arrancar con
  `history.replaceState`.
- No se agregan entradas al historial del navegador.
- El botón atrás del navegador vuelve al comportamiento normal.
- Se conserva la navegación interna entre Hub, Mapa, Estudio, Dojo, Planeador,
  Timer, Admin, etc.

## 3.b Recuperación tras deploy

- El `ErrorBoundary` detecta errores de chunk viejo
  (`Failed to fetch dynamically imported module`, `Importing a module script failed`,
  `ChunkLoadError`, etc.).
- En ese caso **recarga una vez automáticamente** para tomar la versión nueva.
- Si el error persiste, muestra una pantalla simple con **RECARGAR** y
  **VOLVER AL INICIO** (sin sugerir borrar datos locales).
- El detalle técnico queda oculto en un desplegable.

## 4. Service Worker / offline

Archivo: `public/sw.js`, registrado solo en producción desde `src/main.jsx`.

- **Navegación**: red primero; si no hay conexión, sirve el `index.html` cacheado.
- **Assets del mismo origen** (`/assets/*`, imágenes, CSS, JS, JSON):
  cache-first con relleno en segundo plano.
- **Firebase, Drive, YouTube y cualquier origen externo**: solo red.
- Primera visita online necesaria para llenar la caché.
- En un deploy nuevo, la navegación online trae el index nuevo y sus assets
  con hash nuevo; no se queda con la versión vieja.
- Si necesitas forzar una actualización: recarga una vez con red o borra el
  service worker desde DevTools → Application → Service Workers.

## 5. Despliegue

Este bloque no cambia reglas de Firestore. Solo app:

```bash
git push origin main   # Vercel despliega
```

Después del deploy:

- [ ] Abrir la app y recargar una vez para registrar el service worker.
- [ ] Comprobar que la URL permanece limpia (sin `#/...`) al navegar.
- [ ] Activar modo avión y comprobar que el shell abre.
- [ ] Registrar un pago atrasado y usar “PONER AL DÍA”.
- [ ] Verificar que un pago futuro está bloqueado.
- [ ] Probar Escape/Tab en el modal de pago y en el expediente.
