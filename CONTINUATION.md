# Prompt de continuación — ADOC (academia de oposiciones)

Pega esto como primer mensaje en una conversación nueva de Claude Code para retomar el trabajo.

---

## Contexto del proyecto

ADOC es una plataforma de preparación de oposiciones: banco de preguntas por tema, supuestos
prácticos, Test de Teoría, seguimiento de progreso, calendario de repaso, chat, mensajería,
notificaciones y panel de administración. Stack: **React (CRA) + FastAPI + MongoDB** (capas
api → services → repositories → Mongo), **autenticación propia** (JWT + bcrypt).

- **Repo de trabajo local**: `/Users/adrian/Desktop/Adoc/oposiciones-app`
- **Repos remotos**: `pagina-final` (`https://github.com/adriian-oc/Pagina-final.git`) y
  `origin` (`https://github.com/adriian-oc/oposiciones-app.git`) son **mirrors idénticos** —
  pushear siempre a los dos. Instrucción permanente del usuario: subir cada cambio sin pedir
  confirmación cada vez, salvo la regla dura de abajo.
- **Regla dura, sin excepciones**: nunca escribir contraseñas/credenciales reales de personas o
  cuentas de producción en ningún archivo del repo, aunque haya permiso permanente para pushear.
  Ya hubo un incidente de seguridad real por esto (documentado más abajo) — no repetirlo.
- **Producción**: backend en Render (`https://pagina-final-mhnt.onrender.com`, plan free, se
  duerme tras inactividad), frontend en Vercel (`https://adoc-oposiciones.vercel.app`), Mongo en
  Atlas (cluster `Academia`, db `opositores_db`). Envío de email transaccional con **Brevo**
  (plan free, remitente verificado `oposicionesadoc@gmail.com`, cuenta de administración de la
  academia — nunca usar la cuenta personal de Adrián como remitente).
- **El negocio real ya usa esta app en producción** (no un proyecto de pruebas) — hay alumnos
  reales con cuentas reales. Cualquier acción que envíe correos o mensajes a esas cuentas es una
  acción real con efecto real: pedir confirmación antes de acciones masivas o irreversibles.

Antes de nada: `git log --oneline -30` para ver el estado exacto (hay muchísimos commits de
sesiones recientes: permisos de perfil por rol, calendario de estudio editable por
admin/profesor, sistema de notificaciones con campanita, Modo Foco/Pomodoro, cambio rápido de
cuenta admin↔profesor sin re-login, chat admin↔profesor además de admin/profesor↔alumno, cambio
de remitente de email, cada correo automático registrado también como mensaje dentro de la app,
progresión fija del calendario por temario, rediseño de Chat con barra de contactos, foto de
perfil, correos con plantilla visual común, actividad de email de Brevo en Admin, cambio de rol
de usuarios existentes, y alumnos "propios" de un profesor con su propia pestaña de
administración (ambas rondas del 2026-07-20) — ver detalle de la última ronda más abajo).

## Cerrado — importar progreso de alumnos de "la página antigua"

Investigado a fondo tres veces. Los dos primeros intentos no encontraron nada real: (1)
`ADOC_Cuadernos_Online.html` en el escritorio del usuario es una app 100% cliente que guarda
todo en el `localStorage` del navegador de cada alumno — no hay servidor, no hay nada que
importar de ahí. (2) El repo de GitHub que se señaló primero como "la página antigua"
(`origin`) es literalmente el mismo código de este proyecto, sin volcado de datos. (3) La
página antigua real resultó ser otra: `github.com/adriian-oc/adoc-webapp` (código local en
`/Users/adrian/Desktop/Adoc/webapp`), una app Firebase (Auth + Firestore, proyecto `adoc-9e397`,
desplegada en `adoc-9e397.web.app`/`academia-adoc.web.app`) con progreso real de alumnos en
`progress/{uid}` de Firestore — esta sí era una fuente real. El usuario decidió (2026-07-20) no
migrarla: se cierra el tema definitivamente, no hace falta volver a investigarlo.

## Hecho en la ronda del 2026-07-20 (los 5 pedidos de la ronda anterior)

Los 5 puntos de abajo estaban "sin empezar" y ya están implementados, verificados
(pytest + eslint + build + navegador con Browser pane) y pusheados a los dos remotos.

### 1. Algoritmo de generación del calendario de estudio — hecho

`backend/services/study_calendar_service.py::_build_new_queue` (reescrito por completo,
`_build_priority_queue` y el 65/35 con el repaso SM-2 no se tocaron). Conteos reales de temas
(no los 13/13 que se asumía al principio): **15 temas específicos, 23 generales** (bloque 1 =
primeros 13, bloque resto = los otros 10), leídos siempre en vivo de `themes`, nunca hardcodeados.

Decisiones que tomó el usuario al aclarar (por si hace falta revisarlas):
- Lectura comprensiva inicial (una sola vez, `kind="reading"`, sin `content_unit_key`, no se
  repite nunca — estado persistido vía `StudyCalendarRepository.get_completed_reading_theme_ids`):
  cubre los 15 específicos + el bloque 1 de 13 generales (28 temas). El resto de generales
  (14–23) NO tienen día de lectura dedicado, entran directo en la rotación de práctica.
- Supuestos sueltos (sin `theme_id`, banco `Supuesto N`): se reparten en round-robin dentro de
  la rotación, uno por cada tema del día (spec = cuadernillo+supuesto, general = Test de
  Teoría+supuesto) — no hace falta lógica de "horas sobrantes" aparte porque el sistema de
  bloques de 45 min ya avanza varios elementos el mismo día si hay horas de sobra.
- Ciclo que se repite para siempre tras la lectura: específicos → generales bloque 1 → 2ª vuelta
  específicos → resto generales → vuelta a empezar (lo gestiona `itertools.cycle()` en
  `regenerate_calendar`, la lista que devuelve `_build_new_queue` ya no lleva la lectura dentro
  para que no se repita al dar la vuelta).

De paso se arregló un bug ya existente que afectaba directamente a esta función: el botón
"Practicar" del calendario (`frontend/src/pages/StudyCalendar.js::handleStartPractice`) llamaba
siempre a `startPractice` (solo vale para practical_sets), y con `content_unit_key` tipo
`ttgen:<theme_id>` (Test de Teoría) fallaba — ahora bifurca igual que `Cuadernos.js`.

### 2. Rediseño de Chat — hecho

- Header con "Chat con {nombre}" vía `GET /api/messages/{id}/counterpart`
  (`MessageService._counterpart` — alumno ve a su profesor asignado, profesor en su propio hilo
  ve "Administración", admin ve el nombre real del alumno/profesor).
- Barra de contactos para profesor/admin vía `GET /api/messages/threads`
  (`MessageService.list_threads`, solo hilos con al menos un mensaje).
- Pestaña "💬 Chat" fija en el nav para alumno/profesor/admin, todas apuntan a `/chat`
  (`frontend/src/pages/Chat.js` decide el hilo activo según rol: alumno siempre el suyo,
  profesor por defecto el de administración, admin el más reciente de la lista si no hay
  parámetro en la URL). Ruta `/chat` ahora abierta a los 3 roles en `App.js` (antes solo
  `student`); `/profesor/chat/:studentId` se mantiene para deep-links (roster, campanita).

### 3. Foto de perfil — hecho

`backend/services/avatar_service.py` (mismo patrón de disco local que los PDFs de profesor, con
el mismo aviso de que no es solución definitiva para producción real). Endpoints
`POST /api/auth/me/avatar` (autoservicio) y `POST /api/admin/students/{id}/avatar` (admin).
Componente `frontend/src/components/Avatar.js` (foto o inicial de respaldo) reutilizado en
header (`Layout.js`), roster (`RosterTable.js`), `MiPerfil.js` y `ProfileEditorModal` en `Admin.js`.

### 4. Mejorar los correos automáticos — hecho

`backend/services/email_service.py`: envoltorio visual común `_layout`/`_button` (logo real vía
`frontend_base_url` + `<meta charset="utf-8">`, sin el charset las tildes llegaban mal) usado por
los 4 correos. Bienvenida reescrita explicando qué hay dentro de ADOC. El aviso agrupado de
mensajes (`send_new_message_notice`) ahora incluye el texto real de cada mensaje
(`html.escape` sobre nombre y texto, viene de un alumno/profesor) en vez de solo el aviso genérico.

### 5. Actividad de Email de Brevo en Admin — hecho

`GET /api/admin/email-activity` (admin-only, `backend/api/admin.py`) llama a
`EmailService.get_recent_activity` (API de eventos de Brevo, mismo `BREVO_API_KEY`, la llamada
vive siempre en el backend). Nueva tarjeta "Actividad de Email" en `Admin.js` con tabla
Estado/Fecha/Asunto/Remitente/Destinatario. Sin `BREVO_API_KEY` en local (como el resto de
envío) devuelve `[]` y la tarjeta muestra "Todavía no hay actividad registrada" — no se ha podido
verificar con datos reales de Brevo en esta ronda, solo el estado vacío.

## Hecho en la ronda del 2026-07-20 (parte 2) — roles y alumnos propios de profesor

Pedido del usuario: (1) el admin tiene que poder cambiar el rol de un usuario YA creado, no solo
al darlo de alta; (2) los profesores tienen que poder tener "alumnos propios" (clientela privada,
con poder de gestión real) además de "alumnos del centro" (los de siempre, solo seguimiento), y
el admin tiene que ver por profesor cuántos alumnos tiene en total/propios/del centro. Aclarado
con el usuario antes de implementar (respuestas elegidas, todas la opción recomendada):
- Un alumno propio le da al profesor **todo salvo cuenta/rol**: acceso a contenido, pagos,
  fecha de expiración, restablecer contraseña, revocar/reactivar — igual que el admin, pero sin
  poder crear la cuenta ni cambiar el rol de nadie.
- Solo el admin marca a un alumno como propio/centro (el profesor nunca crea ni reasigna).
- Un admin no puede cambiar su propio rol desde el control (sí el de cualquier otro usuario).

Implementado y verificado (pytest + eslint + build + navegador con los tres roles):
- `backend/models/user.py`: nuevo `student_type` ("propio" | "centro" | None) en `UserInDB`/
  `UserResponse`/`UserUpdate`, solo tiene sentido si hay `assigned_profesor_id`.
- `backend/services/admin_service.py`: `_authorize_own_student` (admin sin restricción; profesor
  solo sobre alumnos con `assigned_profesor_id == su_id` y `student_type == "propio"`) usado en
  `update_student`/`set_revoked`/`send_password_reset`. `PROFESOR_EDITABLE_FIELDS` es una
  allowlist (`allowed_content`, `payment_type`, `payments_received`, `expires_at`) — cualquier
  otro campo en el PATCH de un profesor es 403, incluido sobre sus propios alumnos propios.
  `update_student` también bloquea que un admin cambie su propio `role` (400).
- `backend/api/admin.py`: `PATCH /students/{id}`, `.../send-password-reset`, `.../revoke`,
  `.../reactivate` ahora aceptan `require_role(["admin","profesor"])` (antes solo admin).
- `frontend/src/pages/Admin.js`: selector de Rol en el editor de perfil (deshabilitado si es tu
  propia cuenta), botón "👤 Perfil" ahora visible también en filas de admin, selector "Tipo de
  alumno" en "✏️ Acceso" (solo si hay profesor asignado), y nueva tarjeta "Profesores" con la
  tabla alumnos totales/propios/centro (calculada del roster ya cargado, sin endpoint nuevo).
- `EditUserModal` y `ExpiryEditorModal` se sacaron de dentro de `Admin.js` a componentes propios
  (`frontend/src/components/EditUserModal.js` y `ExpiryEditorModal.js`) para poder reusarlos tal
  cual desde `ProfesorDashboard.js`; `EditUserModal` acepta `adminOnly` (`false` oculta reasignar
  profesor y el tipo propio/centro). `RosterTable.js` gatea cada botón/columna por si le pasan el
  handler correspondiente (antes los pintaba todos siempre), para poder reusarlo con un
  subconjunto de acciones sin tocarlo cada vez que cambian los permisos de quien lo usa.
- `frontend/src/pages/ProfesorDashboard.js`: nueva pestaña "🏠 Administrar Propios (N)" que reusa
  `RosterTable` + `EditUserModal`(`adminOnly={false}`) + `ExpiryEditorModal`, filtrada a
  `student_type === 'propio'`, con los mismos endpoints de `adminService` (ya abiertos a profesor
  en el backend).

## Ya aclarado con el usuario (no repetir la explicación)

- El chat manda email al destinatario (agrupado en ventanas de 5 min), pero si esa persona
  responde AL CORREO en vez de en la app, esa respuesta no llega a Mensajes — Brevo aquí solo
  envía, no tiene recepción de correo entrante configurada (haría falta dominio propio +
  parsing de correo entrante, mucho más grande, no se ha pedido implementarlo).
- Los "Bienvenido/a a ADOC" que el usuario vio en el log de Brevo eran altas reales de alumnos
  nuevos (no un fallo del chat) — escribir en el chat nunca dispara el correo de bienvenida,
  son dos rutas de código totalmente separadas.

## Verificación antes de cada commit

Backend: `cd backend && source venv/bin/activate && python -m pytest -q` (14 tests en verde).
Frontend: `CI=true npx eslint <archivos tocados>` y `CI=true npm run build` (Vercel trata los
warnings de ESLint como error de build, aunque en local con `react-scripts start` no falle).

Después de pushear, Render y Vercel auto-despliegan, pero el webhook de Vercel a veces no salta
solo — comprobar en https://vercel.com/adriian-ocs-projects/pagina-final/deployments y si el
commit nuevo no aparece, usar el menú "..." → Crear despliegue → rama `main` → Deploy to
Production a mano. Verificar en el navegador real (Claude in Chrome) con una sesión ya
autenticada cuando sea posible antes de dar algo por terminado.

## Incidente de seguridad ya resuelto (histórico, por si aparece referencia)

En una sesión anterior se subieron por error contraseñas reales en texto plano a este
`CONTINUATION.md` en el repo público. Se rotaron las 11 contraseñas afectadas en producción y se
reescribió el archivo. Desde entonces, regla dura: nunca credenciales reales en el repo (ver
arriba). No hay nada pendiente de ese incidente, solo se documenta para que quede constancia.
