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
de remitente de email, y que cada correo automático del sistema también queda registrado como
mensaje dentro de la app).

## Pendiente — bloqueado, necesita respuesta del usuario

**Importar el progreso de alumnos de "la página antigua".** Investigado a fondo dos veces: (1)
`ADOC_Cuadernos_Online.html` en el escritorio del usuario es una app 100% cliente que guarda
todo en el `localStorage` del navegador de cada alumno — no hay servidor, no hay nada que
importar de ahí. (2) El repo de GitHub que el usuario señaló como "la página antigua"
(`origin`) es literalmente el mismo código de este proyecto (0 commits de diferencia con
`pagina-final`), sin ningún volcado de datos. No se ha encontrado ninguna fuente real de ese
progreso histórico en ningún sitio. Pendiente: volver a preguntar si hay otra ubicación en
mente, o dar el tema por cerrado definitivamente.

## Pedido nuevo, sin empezar todavía

### 1. Algoritmo de generación del calendario de estudio (mezcla de contenido nuevo)

Archivo: `backend/services/study_calendar_service.py::_build_priority_queue`. Ya existe una
mezcla 65% repasos vencidos (SM-2) / 35% contenido nuevo — **eso se queda igual**. Lo que pide el
usuario es cambiar el ORDEN en que se eligen los temas para el contenido nuevo, a esta secuencia:

1. **Una sola vez al principio**: lectura comprensiva de 1 tema al día (a confirmar con el
   usuario el alcance exacto: ¿todos los temas, específicos y generales, o solo unos?).
2. Los 13 temas específicos, en orden (1 al 13).
3. Los temas generales, tema 1 al 13 de la parte general.
4. 2ª vuelta de los 13 temas específicos.
5. El resto de temas generales (los que no entraron en el paso 3 — revisar cuántos temas
   generales hay en total en la colección `themes`, área `ttgen`, seguramente más de 13).
6. Al acabar la vuelta completa, se repite desde el paso 2 (sin repetir la lectura comprensiva).

Actividades según el tipo de tema del día:
- **Tema general** → test completo de Teoría de ese tema + un supuesto práctico.
- **Tema específico** → el cuadernillo de ese mismo tema + un supuesto práctico.
- **Si sobra tiempo el mismo día** (según las horas configuradas), seguir con el siguiente
  elemento de la progresión ese mismo día, no esperar a mañana.

Antes de implementar, aclarar con el usuario: (a) alcance exacto de la lectura comprensiva
inicial, (b) qué pasa con los supuestos generales sueltos sin `theme_id` (¿entran en la rotación
o quedan fuera?), (c) número exacto de temas generales en total.

### 2. Rediseño de Chat

- Dentro de un chat, mostrar arriba con quién se está hablando (hoy `Chat.js` solo pone el
  título genérico "Chat", sin nombre del otro lado del hilo).
- Barra lateral izquierda con lista de contactos (icono + nombre) de todos los alumnos con
  conversación, para cambiar de hilo sin volver al roster — relevante para profesor/admin.
- Pestaña "💬 Chat" fija en el nav superior, en TODAS las vistas y para todos los roles (hoy el
  acceso es indirecto: alumno vía "Mi profesor", profesor vía roster o su hilo con
  administración, admin vía roster). Tocar `frontend/src/components/Layout.js` (`navLinks`).

### 3. Foto de perfil

Subir/cambiar foto de perfil en `frontend/src/pages/MiPerfil.js` (autoservicio) y en
`ProfileEditorModal` dentro de `Admin.js` (edición por admin). Dónde guardar el archivo: mismo
patrón que los PDFs de profesor (`backend/services/document_submission_service.py`, hoy disco
local, ya documentado ahí como solución de desarrollo, no definitiva para un despliegue real —
aplica el mismo aviso). Mostrar la foto donde ya se ve el nombre (header, roster).

### 4. Mejorar los correos automáticos

- Rediseñar el contenido del correo "Bienvenido/a a ADOC — activa tu cuenta"
  (`backend/services/email_service.py::send_welcome_email`) — el usuario solo pidió "hazlo
  mejor" sin más detalle, usar criterio (más cálido, más claro, con logo).
- El aviso agrupado de mensajes nuevos (`send_new_message_notice`, disparado desde
  `MessageService._send_digest_after_delay` en `backend/services/message_service.py`) hoy solo
  dice "tienes un mensaje nuevo, entra aquí" sin mostrar el texto. Pide que el correo incluya el
  contenido real de los mensajes escritos, no solo el aviso genérico — pasar los textos de
  `new_messages` a `send_new_message_notice` y mostrarlos en la plantilla (escapar HTML por si
  el texto de un alumno tuviera caracteres especiales).

### 5. Traer el "Actividad reciente" de Brevo a la propia web

El usuario vio en Brevo (Transaccional → Tiempo real/Estadísticas) una tabla de actividad de
emails (Enviado/Entregado/Abierto/Clicado/Bloqueado, Fecha, Asunto, Remitente, Destinatarios) y
pregunta si se puede traer al panel de Admin. Es viable: Brevo tiene API de eventos
transaccionales (`GET https://api.brevo.com/v3/smtp/statistics/events`, mismo `BREVO_API_KEY`
que ya usa `EmailService`). Plan: endpoint backend admin-only (p.ej.
`GET /api/admin/email-activity`) que llama a esa API y devuelve los eventos; nueva tarjeta en
`Admin.js` (mismo patrón tarjeta+contenido que las demás) con una tabla. La llamada a Brevo
SIEMPRE desde el backend — nunca exponer `BREVO_API_KEY` al frontend.

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
