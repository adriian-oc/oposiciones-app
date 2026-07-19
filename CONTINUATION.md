# Prompt de continuación — ADOC (academia de oposiciones)

Pega esto como primer mensaje en una conversación nueva de Claude Code para retomar el trabajo.

---

## Contexto del proyecto

ADOC es una plataforma de preparación de oposiciones: banco de preguntas por tema, supuestos
prácticos, Test de Teoría, seguimiento de progreso, calendario de repaso, chat con el profesor
asignado y panel de administración. Stack: **React + FastAPI + MongoDB** (esqueleto en capas
api → services → repositories → Mongo), con **autenticación propia** (JWT + hash de contraseña,
sin dependencias externas de identidad).

- **Repo de trabajo local**: `/Users/adrian/Desktop/Adoc/oposiciones-app`
- **Repos remotos**: `https://github.com/adriian-oc/Pagina-final.git` (remote `pagina-final`,
  **el principal a partir de ahora** — el usuario pidió que cada modificación se suba ahí) y
  `https://github.com/adriian-oc/oposiciones-app.git` (remote `origin`, se mantiene sincronizado
  en paralelo, sin motivo concreto para dejarlo desactualizado).
- **Negocio actual en producción**: la academia opera hoy sobre una app previa
  (`academia-adoc.web.app`), sin relación de código con este repo. **Regla dura: no se toca hasta
  que este proyecto esté listo y el usuario apruebe explícitamente el cutover del dominio.**

## Decisión de arquitectura clave

Identidad = **JWT propio** (`POST /api/auth/login` → token firmado con `JWT_SECRET_KEY`,
contraseñas con `bcrypt`). Todo (roster, progreso, contenido, chat, pagos, sesión...) vive en
**MongoDB**, accedido con **Motor async** (no pymongo síncrono).

## Estado: todo lo autónomo está terminado y verificado

**Fases 0–7 del plan** (auth+roles, migración del banco de preguntas ~1400 preguntas, motor de
práctica con navegación por caso, panel de admin responsive, vista de profesor+chat,
progreso/racha/novedades, solicitudes de acceso) — **completas**, probadas por API y en navegador.

**5 mejoras post-migración pedidas después** — completas:
1. Nav responsive en móvil (menú hamburguesa)
2. Limpieza de código muerto y avisos de ESLint
3. Suite de tests de backend (`backend/tests/`, pytest, 14 tests) contra una Mongo de test
   dedicada (`opositores_test`)
4. Rate limiting (5/hora por IP) en el endpoint público `/api/access-requests/`
5. Migración completa de pymongo síncrono a Motor async (todo el backend + scripts standalone)

**2 funcionalidades nuevas pedidas después** — completas:
6. **Calendario de estudio automático** (alumno): configura horas disponibles por día de la
   semana, se genera solo qué practicar priorizando temas con más fallos, se regenera
   automáticamente tras cada práctica terminada (hook en `exam_service.finish_attempt`)
7. **Panel de "preguntas con más fallos"** (admin ve todos los alumnos, profesor solo los
   asignados): tab "Refuerzo" en `Admin.js` y `ProfesorDashboard.js`, reutiliza
   `analytics_failures` ya recogida

Durante el desarrollo se encontraron y arreglaron **3 bugs reales** (no hipotéticos, confirmados
con tests/reproducción):
- `window.prompt()` no soportado en el navegador de pruebas → reemplazado por un modal propio
  al convertir una solicitud de acceso en alumno
- `allowed_content: null` (= "acceso completo") no se podía volver a aplicar una vez restringido
  un alumno, por un filtro que descartaba `None` explícitos en `UserRepository.update_fields`
- Los fallos de Supuestos Prácticos (sin `theme_id` real) se descartaban silenciosamente antes
  de guardarse en `analytics_failures`, por un `if not theme_id: continue` que trataba `""` como
  "falta" en vez de como "Supuesto sin tema" — nunca habrían aparecido en ningún panel de fallos

**Pantalla "Cuadernos" con sidebar (pedida después, completa)**: el original tenía un desplegable
lateral con 7 áreas de contenido en orden fijo (Supuestos Prácticos, Cuadernillos, Temario
Específica/General, Esquemas, Test de Teoría Específica/General); el nuevo frontend no tenía
ningún equivalente. Se construyó `frontend/src/pages/Cuadernos.js` (ruta `/cuadernos`) que
reproduce ese sidebar exactamente, reutilizando `config/contentAreas.js` (ya existía, sin usar) y
un helper nuevo `frontend/src/utils/contentAccessUnits.js` que centraliza la derivación de
unidades por área. **Nota real**: Esquemas, Temario Parte General y ambos Test de Teoría muestran
"Próximamente" en todos los temas porque ese contenido nunca se extrajo de ADOC (documentado ya en
`scripts/migrate_quiz_data.py`) — no es un bug de esta sesión.

**Auditoría completa "qué falta vs. el original" + implementación (pedida después, completa)**:
tras construir Cuadernos, se comparó a fondo `webapp/index.html` contra el resto del roster/admin
y se encontraron y cerraron huecos grandes:
- **Alta de alumno con duración + checklist de contenido**: `UserCreate` no aceptaba
  `expires_at`/`allowed_content`/`profile` al crear (quedaba con acceso ilimitado siempre).
  `ContentAccessChecklist.js` (nuevo) reproduce el árbol de checkboxes por área/tema del original.
- **`allowed_content` pasó de campo cosmético a aplicado de verdad**: no se comprobaba en ningún
  sitio del backend. Ahora `ExamService._check_practical_set_access` devuelve 403 si el
  practical_set pedido no está en `allowed_content` del alumno, y `Cuadernos.js` oculta esas filas.
  Formato de clave nuevo (no el del original): `gen:<practical_set_id>` / `cuad:<theme_id>` /
  `<area_id>:<theme_id>`.
- **Tabla de alumnos**: se añadieron columnas Expira/Pago/Progreso y el profesor asignado como
  `<select>` inline (antes solo texto), botones 📊 Progreso y 👤 Perfil.
- **Mi Progreso** (`/progreso/:userId?`) y **Mi Estudio** (`/estudio/:userId?`, con pestañas Por
  tema / Supuestos Prácticos / Notas) — no existían como pantallas, solo un `Analytics.js` no
  equivalente. Ambas aceptan un `userId` ajeno para que admin/profesor vean el progreso de un
  alumno en modo solo lectura (banner "👁 Estás viendo el progreso de X"), igual que
  `viewStudentAnalysis()` del original.
- **Sistema de Notas** (no existía en absoluto, ni modelo): recurso nuevo completo
  `backend/{models,repositories,services,api}/note*.py` + botón "📝 Notas" en `TakeExam.js`
  durante una práctica, ligado al caso actual.
- Endpoints backend nuevos: `GET/PUT /api/notes/...`, `GET /api/progress/{user_id}`,
  `GET /api/progress/{user_id}/history/{content_unit_key}`; `AdminService.list_students` ahora
  adjunta `progress_summary` por alumno.

Se descubrió en verificación (no un bug de esta sesión, dato de prueba obsoleto): el alumno
`alumno.test@example.com` tenía `allowed_content: ['cuad_1', 'cuad_2']` guardado desde antes de
que hubiera aplicación real — al activarla, quedó bloqueado. Se reseteó a `null` en la Mongo local
directamente (no hay script que lo reintroduzca).

**Ronda 3 de feedback (puntuación, navegación, Test de Teoría, acceso de profesores) —
completa**:
- **Bug real de puntuación**: `_calculate_score` (backend) ya calculaba un campo `scale`
  correcto por tipo de examen, pero nunca usaba 15 para prácticas (`PRACTICAL`) y
  `ExamResults.js` tenía `/ 70` hardcodeado sin usar ese campo. Arreglado: Supuestos/Cuadernillos
  puntúan sobre 15, Test de Teoría sobre 70. **Los intentos ya guardados antes de este fix
  conservan su `details.scale` antiguo** (no hay migración retroactiva) — solo los intentos
  nuevos salen bien.
- **Test de Teoría (ttesp/ttgen) ahora es contenido real**: el formulario de subida de preguntas
  del admin ganó un selector de área (`content_area`); un tema con preguntas cargadas para esa
  área aparece "Practicar" en Cuadernos y lanza un examen con todas sus preguntas de una vez
  (`ExamService.start_theory_practice`, `content_unit_key='<area_id>:<theme_id>'`, mismo formato
  que las claves de `allowed_content`).
- **Nav simplificada**: se quitaron las pestañas "Exámenes" (`ExamGenerator.js`, borrado) y
  "Práctica" (`Practice.js`, borrado) — Cuadernos ya cubre ambas. La capacidad de generar examen
  mixto/Simulacro sigue en el backend (`POST /api/exams/generate`) pero **ya no tiene ninguna
  pantalla que la use** — si se quiere recuperar hay que darle un hueco de UI de nuevo.
- **Profesor**: ve Cuadernos con acceso completo (antes se lo ocultaba el nav); desde "Mis
  Alumnos" tiene enlaces a Progreso/Estudio/Calendario de cada alumno asignado, en modo solo
  lectura (`GET /api/study-calendar/{user_id}` nuevo, mismo criterio de permiso que Mi Progreso
  ajeno — extraído a `backend/utils/staff_access.py::check_can_view_student`, reutilizado en los
  tres sitios).
- **Refuerzo rediseñado por completo**: pasó de una lista plana de "preguntas más falladas" a un
  árbol por área/tema (mismo componente `loadContentAreaUnits()` que usa Cuadernos), con nota
  media (ya escalada 15/70) + nº de intentos + nº de alumnos por unidad
  (`GET /api/analytics/practice-stats`, nuevo), expandible a las preguntas más falladas de esa
  unidad. Para "Supuestos Prácticos" las fallidas salen agregadas de todos los supuestos juntas
  (no hay desglose por supuesto individual en `analytics_failures`) — limitación conocida, no
  bloqueante.

**Ronda 4: QA automático + investigación de competidores (pedida sin necesidad de aprobación en
cada paso) — completa**:
- **Bugs reales encontrados y arreglados** en una pasada de QA por todas las pantallas/roles:
  1. `ExamHistory.js` mostraba la puntuación sin su escala (`40.83` a secas) y coloreaba con
     umbrales absolutos (`>=70` verde) que ya no tenían sentido tras la ronda 3 (una nota
     perfecta de 15/15 salía en rojo). Arreglado: `GET /api/exams/history` ahora incluye
     `scale`, y el color se calcula por porcentaje.
  2. `Admin.js` → "Gestionar Preguntas": el `useEffect` solo cargaba preguntas si
     `selectedTheme` tenía valor, así que "Todos los temas" (el valor por defecto) nunca
     disparaba la carga — parecía que no había preguntas aunque las hubiera.
  3. **`window.confirm()`** en "Finalizar Examen" (`TakeExam.js`) colgó la sesión entera del
     navegador de pruebas durante la verificación — mismo problema ya documentado para
     `window.prompt()` más arriba. Se creó `frontend/src/components/ConfirmDialog.js`
     (reutilizable) y se sustituyeron las 3 llamadas a `window.confirm()` de todo el frontend
     (`TakeExam.js` finalizar, `Admin.js` revocar acceso y eliminar pregunta).
- **2 funcionalidades nuevas**, elegidas porque estaban validadas por dos fuentes independientes:
  ya existían en el ADOC original y nunca se migraron (`toggleTimer()`/`repasarFallos()` en
  `webapp/index.html:1440` y `:1506`), y la investigación de competidores (OpositaTest, Adams
  Test, OpoSapiens...) las señala como de las más buscadas en 2026 (simulacro cronometrado, modo
  repaso de fallos):
  1. **Cronómetro** en `TakeExam.js`: cuenta atrás configurable (minutos), pausa/reanuda/reinicia,
     aviso visual bajo 5 min y en negativo si se pasa el tiempo.
  2. **"Repasar fallos"**: botón en `ExamResults.js` (solo si hubo incorrectas) que arranca un
     examen nuevo con únicamente las preguntas falladas de ese intento —
     `ExamService.retry_failures` (backend) + `POST /api/exams/attempts/{id}/retry-failures`.
     No cuenta como práctica completa (sin `content_unit_key`/`mode=practice`) para no
     distorsionar el rollup de progreso ni las medias de Refuerzo.
- Ideas de la investigación de competidores **evaluadas y aparcadas conscientemente** (mucho más
  grandes, no implementadas esta ronda): algoritmo de repetición espaciada (SRS) de verdad sobre
  el histórico de fallos (no solo repetir los de un intento), exportar progreso a PDF (existía en
  ADOC como `exportProgreso()`, nunca migrado), app/PWA instalable.

**Ronda 5 (gestión de preguntas, examen interactivo, Test de Teoría automático, documentos de
profesor) — completa**, verificada por `pytest` (14/14) y en navegador con los 3 usuarios de
prueba:

- **3 leaks reales de `correct_answer` cerrados** (uno era el reportado en el prompt de
  traspaso, dos se descubrieron investigando esta misma ronda):
  1. `ExamService.get_exam`/`start_attempt`/`start_practice`/`start_theory_practice`/
     `retry_failures` devolvían el examen completo con `correct_answer` por pregunta sin
     filtrar, legible en el intento antes de contestar. Fix: `ExamService._scrub_exam` quita
     `correct_answer` de `questions[]` en todos esos retornos.
  2. `GET /api/practical-sets/{id}` (detalle completo de un Cuadernillo/Supuesto, con
     `correct_answer`) solo exigía estar autenticado, no rol admin — cualquier alumno podía
     pedirlo directo por ID. Se restringió a `require_role(["admin","curator"])` (confirmado que
     ningún flujo de alumno lo usaba, solo `getAll` sin preguntas).
  3. `ExamService.get_attempt_results` calculaba y **persistía** un scoring completo (con
     `correct_answer` por pregunta) la primera vez que se llamaba, aunque el intento **no**
     estuviera terminado — y `TakeExam.js` lo llama al arrancar para leer `exam_id`. Fix: solo
     calcula/devuelve `details` si `attempt.finished_at` está puesto.
- **"Gestionar Preguntas" (Admin)** rehecho como árbol tipo Cuadernos
  (`frontend/src/components/QuestionsManager.js`, reutiliza `loadContentAreaUnits()`), con
  edición/alta/baja inline. Cubre las 4 áreas con banco de preguntas real: Test de Teoría
  Esp./Gen. (colección `questions`, ya tenía `PUT` sin usar desde UI) y Cuadernillos/Supuestos
  (preguntas embebidas en `practical_sets`, sin CRUD previo — se añadieron
  `update_question`/`add_question`/`delete_question` en `PracticalSetService` +
  3 rutas nuevas en `backend/api/practical_sets.py`). Temario/Esquemas no tienen banco de
  preguntas (son áreas solo-documento) y se marcan como tales en el árbol. `delete_question`
  renumera `position` de forma contigua y corrige `cases[].question_positions` (referencian
  `position`, no índice de array) — verificado a mano en Mongo tras editar/borrar/añadir.
- **Interacciones de examen** (`frontend/src/pages/TakeExam.js`):
  - Dejar en blanco: click de nuevo en la opción marcada, o botón "Dejar en blanco" explícito.
  - Corrección en directo: toggle opcional (apagado por defecto) en un diálogo nuevo
    (`PracticeOptionsDialog.js`) antes de arrancar; `AttemptInDB.live_correction` decide si
    `submit_answer` devuelve `is_correct`/`correct_answer` por pregunta al momento.
  - Botón "💬 Preguntar a mi profesor" (`AskTeacherButton.js`) en preguntas falladas (en directo
    y en `ExamResults.js`), enlaza a `/chat?prefill=...` — `Chat.js` ahora lee ese query param.
    Se muestra siempre (se asume profesor siempre asignado; si no, el admin ya ve el hilo por el
    bypass existente en `message_service`).
- **Test de Teoría automático** (⚠️ revertido en la ronda 6, ver más abajo — este punto describe
  una premisa equivocada: se pensó que Test de Teoría podía derivar de Cuadernillos, pero es
  contenido propio y distinto que ya existía fuera de este repo).
- **Documentos PDF de profesor**: recurso nuevo completo
  (`backend/{models,repositories,services,api}/document_submission*.py`, mismo patrón
  pending→approved/rejected que `access_request`), storage en disco local
  (`backend/uploads/documents/`, montado en `/uploads` vía `StaticFiles` — **explícitamente
  documentado en el código como solución de desarrollo**, no sobrevive un despliegue con
  backend/frontend en hosts separados; antes de la Fase 8 hace falta S3/Firebase Storage/etc).
  Pestaña "Mis Documentos" nueva en `ProfesorDashboard.js` (subir + ver estado propio), pestaña
  "Documentos" nueva en `Admin.js` (aprobar/rechazar). Visibilidad tras aprobar: solo los alumnos
  con `assigned_profesor_id` igual al profesor que lo subió (no todo alumno con acceso al tema,
  a diferencia del resto de `content_units`) — `Cuadernos.js` pide
  `GET /api/documents/approved-mine` una vez y pinta un enlace "📄 Documento de tu profesor" por
  tema.

**Ronda 6 (preguntas de Test de Teoría reales, auth propia, marca, captación) — completa**,
verificada por `pytest` (14/14) y en navegador con los 3 usuarios de prueba:

- **Test de Teoría Parte General, temas 1-11, contenido real importado**: se confirmó que el
  fallback "deriva de Cuadernillos" de la ronda 5 partía de una premisa equivocada — Test de
  Teoría es un banco de preguntas propio y distinto, que ya existía fuera de este repo (JSON del
  usuario, mismo formato que la subida masiva) pero nunca había llegado a la base local. Se
  importaron los 11 temas de Parte General a `content_area=ttgen` (639 preguntas, 0 errores tras
  corregir un desajuste de `correct_answer` en base 1 en 142 de ellas) y se **revirtió por
  completo el fallback a Cuadernillos** en `start_theory_practice` — un tema sin preguntas
  propias vuelve a mostrar "Próximamente", no preguntas prestadas. Parte Específica y Parte
  General 12-23 quedan pendientes de una futura importación (el usuario tiene los archivos, pero
  no confirmados/revisados todavía — uno de ellos, "Tema 11 Error.json" de Parte Específica,
  necesita revisión antes de usarse).
- **Firebase eliminado por completo, autenticación propia contra MongoDB**: login con
  email+contraseña (`bcrypt` + JWT propio, `POST /api/auth/login`), sesión persistida en
  `localStorage`. El restablecimiento de contraseña ya no es autoservicio por email (no hay
  proveedor de email configurado) — el admin genera un enlace de un solo uso (24h) desde su
  panel (`POST /api/admin/students/{id}/send-password-reset`, reutilizado también al dar de alta
  un usuario nuevo) y lo comparte manualmente; el enlace lleva a `/reset-password?token=...`
  (página nueva). `firebase-admin`/`passlib`/`python-jose` fuera de `requirements.txt`; el
  paquete `firebase` fuera de `package.json`; ya no hace falta el emulador de Firebase Auth en
  desarrollo local.
- **Marca ADOC**: logo y banner reales (`frontend/public/branding/`) en el header (`Layout.js`),
  favicon, y como cabecera de la pantalla de login.
- **Captación de alumnos y profesores antes del login**: `Login.js` gana una cabecera con el
  banner y dos CTAs ("Quiero preparar mi oposición" / "Quiero dar clases"). Nueva solicitud de
  profesor (`/trabaja-con-nosotros`, `TeacherApplication.js`) reutiliza el mismo backend que
  `access_request` con un campo `tipo: "alumno"|"profesor"` (default `"alumno"`, no rompe el
  formulario existente) en vez de duplicar la infraestructura de revisión en Admin — la pestaña
  "Solicitudes" ya distingue el tipo con una etiqueta y ofrece "Convertir en profesor".
- **Documentación saneada**: `README.md` reescrito como producto independiente (sin mencionar
  ADOC/migración/el otro repo), y ~40 comentarios en ~20 archivos que citaban "ADOC"/
  `webapp/index.html:N` reescritos para explicar el porqué del código sin la procedencia externa.
  `CONTINUATION.md` (este archivo) sigue existiendo como documento de continuidad entre sesiones,
  pero con el mismo lenguaje saneado en su marco general (este párrafo incluido).

**Ronda 7 (progreso unificado + calendario de repetición espaciada) — completa**, verificada por
`pytest` (14/14) y probando el ciclo completo práctica→estado SM-2→calendario en Mongo/API:

- **"Mi Progreso"/"Mi Estudio"/Historial de exámenes fusionados** en una sola página con pestañas
  (`frontend/src/pages/Progress.js`: Resumen / Por tema / Supuestos Prácticos / Notas /
  Historial) — se borraron `Estudio.js` y `ExamHistory.js`, y las rutas `/estudio` y
  `/exams/history`. Nuevo `GET /api/exams/history/{user_id}` (mismo patrón de permiso que
  `GET /api/progress/{user_id}`, vía `check_can_view_student`) para que admin/profesor vean el
  historial de examen de un alumno concreto desde la misma página, en modo solo lectura (sin
  pestaña Notas, sin acciones, con `ViewingBanner`) — patrón ya existente, solo extendido.
- **Calendario de estudio con repetición espaciada real (SM-2 simplificado)**: cada unidad de
  contenido (`content_scores[key]` en `progress`, ya existente) gana `ease_factor`,
  `repetitions`, `interval_days`, `next_review_date`. Tras cada práctica terminada,
  `ProgressService._sm2_update` aplica la regla estándar de SM-2 (Wozniak 1987): acierto alto
  alarga el intervalo (1 día → 6 días → intervalo × ease_factor), fallo lo reinicia a 1 día.
  `StudyCalendarService._build_priority_queue` ahora intercala ~2:1 repasos ya vencidos
  (`next_review_date <= hoy`, con `priority_reason` explicando el intervalo real) con contenido
  nuevo o débil (la lógica de fallos ya existente) — cada entrada del calendario lleva un `kind`
  ("review"/"new") que el frontend pinta como badge 🔁/🆕. Verificado a mano: una práctica
  perfecta (37/37) generó `ease_factor=2.6, repetitions=1, interval_days=1,
  next_review_date=mañana`; adelantando esa fecha a "hoy" y regenerando, la unidad reapareció
  correctamente etiquetada "review" con el motivo correcto.

**Ronda 8 (usuarios reales, landing de venta, práctica directa desde Analítica, despliegue
completo a producción) — completa**:

- **Landing de venta en `/`**: `frontend/src/pages/Landing.js` (nueva, pública, héroe/beneficios/
  diferenciador de repaso espaciado/cómo-empezar/CTA final, acceso "Iniciar sesión" arriba a la
  derecha, sin testimonios ni cifras inventadas), `Login.js` vuelto a formulario simple. `App.js`:
  `/` muestra `Landing` si no hay sesión.
- **Historial (Mi Progreso)**: los intentos sin terminar ganan botón "Ver respuestas"
  (`frontend/src/pages/AttemptProgress.js`, endpoint nuevo
  `GET /api/exams/attempts/{id}/progress`) — muestra lo ya contestado y sus fallos sin revelar
  las respuestas de lo que aún no se ha contestado.
- **Por tema (Mi Progreso)**: reorganizado para mostrar Cuadernillo y Teoría como filas
  independientes por tema de Parte Específica, solo Teoría en Parte General.
- **Analítica → Practicar**: el plan de estudio ahora tiene un botón real que lleva a Cuadernos
  con el tema débil resaltado y solo las áreas practicables abiertas (`Cuadernos.js` acepta
  `?theme=<id>`).
- **11 cuentas reales del roster del usuario** creadas tanto en Mongo local (`opositores_dev`)
  como en **Mongo de producción (Atlas)**: 9 alumnas/os, `adrian.oliva.carceles@gmail.com` como
  profesor, `oposicionesadoc@gmail.com` como admin. Creadas con scripts temporales fuera del
  repo (scratchpad, borrados tras usarse) — **no hay ningún script en el repo que las recree, y
  sus contraseñas NUNCA deben escribirse en ningún archivo del repo** (ver incidente de
  seguridad más abajo). Nombres de los 9 alumnos derivados del prefijo del correo (no había
  columna de nombre en la captura que compartió el usuario) — pendiente de que cada alumno los
  corrija en su perfil si hace falta.

## ⚠️ Incidente de seguridad (2026-07-19, resuelto): contraseñas reales expuestas en GitHub

Durante la ronda 8 se escribieron las contraseñas reales en texto plano en una versión anterior
de este mismo archivo, que se subió a `pagina-final` — **un repositorio público de GitHub**. Se
detectó en la misma sesión (comprobando por qué el dominio de Vercel no cargaba, se acabó
revisando el repo en GitHub y viendo que era público). Acción tomada de inmediato:
1. Las 11 contraseñas de producción se **rotaron** (admin, profesor, y una nueva contraseña
   compartida para los 9 alumnos, distinta de la original) — las que quedaron expuestas ya no
   sirven para entrar a ninguna cuenta real.
2. Este archivo se reescribió para no volver a contener contraseñas.
3. **No se reescribió el historial de git** (`git push --force` para purgarlo sería una acción
   destructiva que requiere confirmación explícita, y rotar las contraseñas ya neutraliza el
   riesgo real sin necesidad de tocar el historial).

**Regla dura a partir de ahora**: ninguna contraseña real (de producción o de cualquier cuenta
de una persona real) se escribe en ningún archivo de este repo, ni siquiera en `CONTINUATION.md`
— solo se comunican por chat directamente al usuario, nunca por escrito en un archivo versionado.

## Producción: desplegada y verificada de punta a punta (2026-07-19)

Las tres piezas están en vivo y conectadas entre sí — el usuario creó las tres cuentas de
hosting él mismo (no puedo crear cuentas de terceros en su nombre), y desde ahí tomé el control
de su mismo navegador (extensión Claude in Chrome, ya autenticada) para configurar y desplegar
todo:

1. **MongoDB Atlas**: cluster `Academia`, base `opositores_db`, usuario
   `adrianolivacarceles_db_user`, acceso de red abierto a `0.0.0.0/0` (necesario porque el
   backend se conecta desde una IP externa). Cadena de conexión guardada como variable de
   entorno en Render, nunca en el repo.
2. **Backend en Render** (plan Free — **no Railway**: Railway solo da 30 días o 5$ de crédito de
   prueba y luego hay que pagar un plan; Render tiene un plan gratuito real, con el único coste
   de que el servicio "duerme" tras 15 min sin uso y la siguiente petición tarda ~30-50s).
   Servicio `Pagina-final`, root directory `backend`, start command
   `uvicorn server:app --host 0.0.0.0 --port $PORT` (mismo comando que `backend/Procfile`,
   Render no lo lee automáticamente así que se configuró a mano). URL:
   **`https://pagina-final-mhnt.onrender.com`**.
3. **Frontend en Vercel** (plan Free/Hobby). Proyecto `pagina-final`, root directory `frontend`,
   preset Create React App, variable `REACT_APP_API_URL` apuntando al backend de Render.
   **URL comercial (la que se comparte/usa siempre)**: **`https://adoc-oposiciones.vercel.app`**.
   La URL auto-generada `https://pagina-final-nine.vercel.app` también sigue activa (mismo
   proyecto, dos dominios apuntando a Producción), no hace falta redirigirla. (Ojo: la UI de
   Vercel/GitHub a veces muestra dominios o rutas de archivos con acentos raros tipo
   "página-final-nueve" por un glitch de renderizado — el dominio/rutas reales, sin tildes, son
   los de este documento). El "preset de servicios" multi-repo de Vercel había detectado también
   `backend/` como un segundo servicio a desplegar — se descartó explícitamente (el backend ya
   vive en Render) y se forzó el preset a "Create React App" con root directory `frontend`
   únicamente.
4. **`FRONTEND_BASE_URL`** en Render apunta a `https://adoc-oposiciones.vercel.app` (se usa para
   construir los enlaces de restablecimiento de contraseña que el admin genera y comparte).
5. **Logo** (`frontend/public/branding/logo.png`): el archivo original era un lienzo 1024×1024
   con mucho margen blanco alrededor del icono real (por eso se veía diminuto/ilegible en el
   header). Se recortó al icono + wordmark "ADOC" (sin el eslogan, ilegible a tamaño de
   cabecera), con fondo transparente — y se quitó el `<span>ADOC</span>` duplicado que iba al
   lado en Layout/Login/Landing, ya que el logo recortado ya incluye el texto.

**Bug real encontrado y arreglado durante el despliegue**: el primer intento de deploy en Vercel
falló — `frontend/src/pages/Cuadernos.js`, el `useCallback` de `load` usaba `highlightThemeId`
sin declararlo en el array de dependencias (`react-hooks/exhaustive-deps`). En local
`react-scripts start` solo avisa; el build de producción (`CI=true`, como pone Vercel por
defecto) trata los warnings de ESLint como error y rompe el build. Arreglado añadiendo
`highlightThemeId` a las dependencias; verificado localmente con `CI=true npm run build` antes
de volver a subir.

**Verificado de punta a punta**: login real contra `https://adoc-oposiciones.vercel.app` con
la cuenta admin — la petición viaja al backend de Render, consulta Mongo Atlas, devuelve JWT y
entra al panel de admin. Las 11 cuentas reales del roster ya existen también en esta base de
producción (contraseñas rotadas tras el incidente de seguridad de arriba — pedir al usuario que
las comparta si hace falta operar sobre esas cuentas, nunca reconstruirlas escribiéndolas aquí).

**Segundo bug real, más gordo**: el primer despliegue a producción solo copió cuentas de
usuario — nadie migró contenido (`practical_sets`/Cuadernillos, `questions`/Test de Teoría,
`content_units`). Producción arrancó con 0 documentos en esas 3 colecciones (`themes` sí tenía
38, porque `ThemeService.seed_initial_themes()` los autogenera en cada arranque del backend si
la colección está vacía — `backend/server.py`, hook de `startup_event`). Cuadernos aparecía
completamente vacío para cualquier rol. Al copiar el contenido de la Mongo local a Atlas se
pisó otro bug más sutil: **cada entorno genera sus propios UUID aleatorios para los temas al
autosembrarlos** (mismos 38 `code` en local y producción, pero `id` distintos) — así que los
`theme_ids`/`theme_id` copiados tal cual desde local no casaban con ningún tema en producción,
y todo seguía saliendo "Próximamente" aunque los documentos ya existieran. Solución: copiar
`practical_sets`/`questions`/`content_units` remapeando `theme_id(s)` por `code` (local id →
code → id de producción para ese mismo code), no por id directo. **Lección para cualquier
migración futura de contenido entre entornos**: nunca copiar `theme_id`/`theme_ids` en crudo
entre bases distintas — siempre remapear por `code`. Verificado a mano: profesor y alumno ven
ahora el mismo árbol completo en Cuadernos (Cuadernillos temas 2-12 y Prestaciones RGSS con
"Practicar", Test de Teoría Parte General temas 1-11 con "Practicar", resto "Próximamente"
igual que en local), y arrancar un examen real (Tema 1, 29 preguntas) funciona en producción.

**Instrucción permanente para este repo**: el usuario pidió subir siempre todos los cambios a
GitHub sin esperar confirmación previa (a diferencia de la política general de pedir permiso
antes de cada `git push`) — ver memoria `feedback_adoc_always_push`. Esto NO se extiende a
desplegar de verdad en producción ni a tocar la infraestructura de hosting: eso sigue
necesitando confirmación explícita en el momento. Y, por el incidente de arriba, **tampoco se
extiende a escribir credenciales reales en ningún archivo** — eso nunca es automático,
independientemente de la instrucción de "subir siempre".

## Entorno de desarrollo local (cómo retomar)

Todo corre en local, contra datos de prueba sintéticos:

```bash
# Mongo local (probablemente ya esté corriendo como servicio de brew)
brew services start mongodb/brew/mongodb-community@7.0

# Backend
cd backend && source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8000

# Frontend (usar la tool preview_start con name:"oposiciones-frontend", NO Bash,
# ya está en .claude/launch.json del repo Y en /Users/adrian/Desktop/WEB/.claude/launch.json)
```

**Usuarios de prueba** (contraseña para todos: `test-password-123`):
- `admin.test@example.com` (admin) · `profesor.test@example.com` (profesor) ·
  `alumno.test@example.com` (student, ya tiene datos de progreso/fallos/calendario de prueba)

Si hacen falta más, `python scripts/dev_bootstrap.py` (con el backend corriendo) los crea (o, si
ya existen, les fija la contraseña de prueba). Los datos de contenido ya están en la Mongo local
`opositores_dev` — no hace falta re-ejecutar los scripts de importación a menos que se recree la
base desde cero.

## Cómo seguir

Producción ya está desplegada y funcionando (ver sección de arriba) — esto ya no es lo primero
que preguntar. Cuando retomes:
1. Confirma que los 3 servicios locales están arriba si vas a seguir trabajando en local (Mongo,
   backend, frontend) — no hace falta si el trabajo es solo verificar producción.
2. Cambios nuevos: seguir subiéndolos a GitHub sin pedir confirmación (instrucción permanente,
   ver memoria `feedback_adoc_always_push`), pero **nunca escribir contraseñas u otras
   credenciales reales en ningún archivo del repo** — el repo `pagina-final` es público.
3. Si el trabajo toca producción de verdad (desplegar un cambio en Render/Vercel más allá de un
   simple `git push` que ya auto-despliega, tocar variables de entorno, rotar credenciales,
   etc.), pedir confirmación explícita en el momento — nunca asumir de una aprobación anterior.
