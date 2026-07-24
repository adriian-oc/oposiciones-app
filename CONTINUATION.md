# Prompt de continuación — ADOC (academia de oposiciones)

Pega esto como primer mensaje en una conversación nueva de Claude Code para retomar el trabajo.

---

Lee este archivo entero y continúa con el trabajo pendiente por prioridad. Repo: `/Users/adrian/Desktop/Adoc/oposiciones-app` (React CRA + FastAPI + MongoDB). Producción: backend en Render (`https://pagina-final-mhnt.onrender.com`, plan free, se duerme tras inactividad), frontend en Vercel (`https://adoc-oposiciones.vercel.app`), Mongo en Atlas. Remotos git: `origin` (github.com/adriian-oc/oposiciones-app) y `pagina-final` (github.com/adriian-oc/Pagina-final) — pushear a los dos sin pedir permiso cada vez (pero confirmar siempre antes de un deploy real a producción).

## Pendiente — por prioridad

1. **[HECHO del todo, incluida la recalculación de estadísticas] Corregir respuestas erróneas del Test de Teoría parte general (Temas 1-11) + examen nuevo "Repaso Temas 1-11".** Los alumnos reportaban notas mal calculadas; el profesor revisó el Tema 9 a mano y encontró ~12 errores (la revisión real encontró 56). Los PDF oficiales están en `/Users/adrian/Desktop/OPO/OPO 2/Test/GM/2. Parte general Test Vanesa año 1 tema 1 al 11/`.

   **Confirmado un bug sistemático de desplazamiento de índice (+1) en la carga de estos datos**: cuando la respuesta correcta real era la opción a), b) o c), quedó marcada la opción siguiente; cuando era la d) (última), quedó bien por no haber "siguiente" opción. Verificado exhaustivamente, pregunta por pregunta, en los **11 temas** contra su PDF individual. Total 495 correcciones (337 de Temas 1,2,3,4,6,7,9,10,11 + 158 de Temas 5 y 8) mediante `scripts/fix_general_theme_answers.py` (commits `a769fd5` y `8f2b318`), que compara el valor actual antes de tocarlo y guarda cada cambio en `edit_history` para auditoría. **Aplicado en producción el 2026-07-24: 478 aplicadas, 17 saltadas como conflicto porque el profesor ya las había corregido a mano por su cuenta en producción el 21 de julio (verificado en su `edit_history`) — el script no las tocó, tal como está diseñado.**

   Además, `Test Adrián 1-11.pdf` **no era un documento de repaso de preguntas ya cargadas, sino un examen nuevo** (101 preguntas propias, con su propia clave de respuestas, mezclando contenido de los Temas 1-11) que no estaba subido a la app. Se ha creado como tema nuevo **"Repaso Temas 1-11"** (code `GENERAL_REPASO_1_11`, part `GENERAL`, order 24) con sus 101 preguntas, vía `scripts/seed_test_adrian_1_11.py` (idempotente) — **ya aplicado y verificado en producción el 2026-07-24** (101 preguntas insertadas, tema visible en Cuadernos.js sin tocar frontend). Nota: la pregunta 93 del PDF original tenía dos letras superpuestas en la clave ("CB", posible corrección manual del autor sin borrar la anterior); se optó por C por coincidir con el contenido legal (arts. 265/268 TFUE) — revisar a mano vía Admin si se prefiere B.

   Excepcionalmente, esta vez el propio usuario pasó las credenciales de producción en el chat y Claude ejecutó los scripts directamente (el usuario no se manejaba con terminal/entornos) — no es la norma: por defecto seguir dando los scripts para que el usuario los corra él, y solo repetir esto si el usuario lo vuelve a pedir explícitamente.

   **[HECHO 2026-07-24] Recalcular estadísticas** (ver punto 4, ya cerrado del todo) — aplicado en producción: 6 exámenes con snapshot corregido, 1 intento de alumno con nota recalculada.

2. **[HECHO 2026-07-24] Sembrar las 20 preguntas de draft_questions en producción.** Ejecutado `scripts/seed_draft_questions_novedad.py` contra producción — 20 preguntas insertadas (`draft_questions` en Mongo Atlas). Queda como trabajo manual del profesor/admin: Admin → Novedad de temario → Preguntas sin lanzar → publicar como Cuadernillo o Supuesto.

3. **Historial: reanudar/borrar test a medias (alumno) + ver/borrar test de alumno (profesor).** El alumno debe poder retomar un test en curso o borrarlo (esto ya existía). El profesor debe poder ver las respuestas concretas de un alumno en un test, o borrarlo.

   **[HECHO 2026-07-24] Ver detalle de un examen ya completado (qué preguntas falló, qué marcó, cuál era la correcta) — alumno propio + profesor/admin.** Pedido explícito: "Adrián quiere saber qué preguntas ha fallado Mercedes en ese test". El desglose pregunta-por-pregunta ya existía para el propio alumno (`frontend/src/pages/ExamResults.js`, vía `GET /api/exams/attempts/{id}/results`), pero el endpoint daba 403 si lo pedía cualquiera que no fuera el dueño del intento. Cambios:
   - `backend/services/exam_service.py` (`get_attempt_results`): ahora acepta `current_user` completo en vez de solo `user_id`, y si el intento no es del que pregunta, aplica `utils.staff_access.check_can_view_student` (mismo criterio que el resto de "ver progreso ajeno": admin cualquiera, profesor solo sus alumnos asignados). `backend/api/exams.py` actualizado a juego.
   - `frontend/src/pages/Progress.js`: la columna "Acciones" del Historial ya no se oculta en modo "solo lectura" — ahora también hay "Ver Resultados" para intentos completados (los "en progreso" muestran solo el estado, sin acciones de alumno).
   - `frontend/src/pages/ExamResults.js`: detecta si el intento es propio (`attempt.user_id === user.id`); si no, muestra el mismo `ViewingBanner` que el resto de vistas de solo lectura, y **oculta** "Repasar fallos" y "Pedir ayuda al profesor" (esos botones actúan sobre la cuenta de quien hace clic, no tendría sentido disparados por un profesor mirando el examen de otro).
   - Probado en local con datos reales de `alumno.test@example.com` (dry-run manual en navegador, no hay test automatizado): admin ve el detalle con el email correcto en el aviso, botones de alumno ocultos; el propio alumno sigue viendo los suyos con normalidad.
   - Pendiente dentro de este punto: que el profesor/admin también pueda **borrar** un test de un alumno (no solo verlo), y que el alumno pueda **reanudar** un test a medias desde el Historial si no lo hace ya (revisar si "Continuar" ya cubre esto).
   - **Posible bug sin cerrar (reportado 2026-07-24, no confirmado como bug real todavía):** el usuario probó esto en producción (como admin y como profesor, con recarga forzada, cierre de sesión y ventana normal) y seguía sin ver "Ver Resultados" en el Historial ajeno. Verificado por servidor que el bundle desplegado SÍ contiene el fix (contenido exacto comprobado, no solo fecha) tanto en `adoc-oposiciones.vercel.app` como en `pagina-final-nine.vercel.app`. Diagnóstico de trabajo: `AuthContext.logout()` no hace un reload completo de página (`services/auth_service` / `context/AuthContext.js:33`, solo `setUser(null)`), así que una pestaña de SPA abierta desde antes del deploy puede seguir corriendo el JS viejo en memoria indefinidamente aunque se recargue el "estado" de la app — se le pidió probar en **ventana de incógnito** para confirmar. Revisar la respuesta antes de dar el punto 3 por cerrado del todo; si en incógnito tampoco funciona, es un bug real y hay que investigar más.

4. **[HECHO 2026-07-24] Recalcular estadísticas de alumnos al corregir una pregunta.** Dos partes:
   - **Automático a partir de ahora:** `backend/services/answer_correction_service.py` (`AnswerCorrectionService`) se dispara solo desde `QuestionService.update_question` cada vez que un admin/curador cambia `correct_answer` de una pregunta ya subida — parchea el snapshot de los exámenes afectados, recalcula la nota de los intentos ya terminados, y reconstruye `user_theme_stats`/`analytics_failures`/`progress` de los alumnos afectados. No rompe la edición si falla (logueado, no propagado). Probado de punta a punta con datos sintéticos.
   - **Corrección retroactiva de lo ya aplicado antes de tener el hook automático:** `scripts/recalculate_stats_after_answer_fix.py` (idempotente, con `--dry-run`) — **ya ejecutado en producción**: recorrió las 495 correcciones de índice de Temas 1-11, encontró 6 exámenes con snapshot afectado y 1 intento de un alumno con nota mal calculada, y lo corrigió (estadísticas del alumno reconstruidas). Relanzado justo después en `--dry-run`: 0 pendiente, confirma que quedó aplicado limpio. Seguro re-ejecutar si hace falta.

5. **Eliminar todos los emojis y usar imágenes de un banco gratuito.** Sustituir los emoji usados como iconos en toda la app (Admin.js, Layout.js, ProfesorDashboard.js, `config/notificationIcons.js`, etc.) por imágenes/iconos SVG de una web de recursos gratuitos para uso web, manteniendo el significado de cada uno.

6. **Admin — Novedad de temario: estado de envío.** Si ya se mandó la comunicación de una novedad, mostrar "Ya enviado" a la derecha de la tarjeta, cambiar el botón a "Reenviar" o "Enviar solo a los que no han abierto", y mostrar un contador X/Y vistos sobre el total de destinatarios. Necesita registrar qué novedades se mandaron y a quién, cruzado con los eventos de apertura de Brevo (`EmailService.get_recent_activity`, evento `opened`).

7. **Rediseñar inicio de profesor con tarjetas, unificando Inicio y Mis alumnos.** Usar el sistema de tarjetas ya existente en Admin.js como referencia visual para `ProfesorDashboard.js`, fusionando la pestaña de inicio con la de alumnos en una vista más elegante. Mejorar también la vista de inicio del alumno.

8. **[REEMPLAZA lo anterior, no es una mejora del calendario existente] "Plan Inteligente de Hoy" — motor de repetición espaciada, sustituye por completo el calendario de estudio.** Especificación completa dada por el usuario el 2026-07-24 (pegada casi literal porque tiene decisiones de producto y copy concretas, no solo dirección general):

   **Objetivo:** el alumno nunca decide qué estudiar. No hay fechas fijas ni calendario mensual — solo una **prioridad dinámica** que el sistema recalcula automáticamente cada vez que el alumno termina una actividad. Se quiere que sea uno de los elementos diferenciadores de la plataforma (pensar en Anki/SuperMemo/Duolingo, adaptado a esta oposición).

   **Base científica del algoritmo** (adaptar, no copiar sin más):
   - Curva del olvido de Ebbinghaus + repetición espaciada.
   - SM-2 adaptado (no el algoritmo original literal).
   - Retrieval practice.
   - Mastery learning.
   - Interleaving (mezclar temas/bloques en vez de bloques monotemáticos).
   - Además de lo anterior: dificultad histórica del alumno, cercanía del examen, tiempo disponible, rendimiento anterior.

   **Estructura de contenido a planificar** — cada bloque evoluciona de forma independiente (aprobar/suspender un Cuadernillo NO reinicia el resto del tema):
   - Parte específica: 13 temas, cada uno con Lectura comprensiva + Test de teoría + Cuadernillo práctico (3 unidades de aprendizaje independientes por tema).
   - Parte general: 23 temas de lectura + 24 tests independientes.

   **Tras cada actividad**, calcular automáticamente (sin que el alumno indique "fácil/difícil" manualmente — se deduce del resultado): nivel de dominio, probabilidad de olvido, dificultad, historial, tiempo empleado, número de intentos, evolución. Con eso decide cuándo volver a mostrar ese contenido.

   **Planificación diaria**, por orden de prioridad: 1) repasos urgentes, 2) contenidos con mayor riesgo de olvido, 3) contenidos con más errores, 4) contenidos nuevos, 5) repasos opcionales. Nunca saturar con demasiados temas nuevos a la vez — adaptar la carga diaria automáticamente.

   **Modo examen** (al acercarse la fecha del examen, cambia de comportamiento automáticamente): reducir contenido nuevo; aumentar simulacros, repasos rápidos, preguntas conflictivas, artículos más fallados y temas débiles.

   **Estadísticas del alumno:** dominio por tema, dominio por bloque, probabilidad de olvido, próximo repaso, fortalezas, debilidades, evolución, tiempo invertido, progreso total del curso.

   **Panel del profesor:** acceso completo — calendario de cualquier alumno, progreso, historial, tiempo de estudio, errores frecuentes, temas dominados/débiles, evolución, simulacros realizados, actividades pendientes.

   **Panel del administrador:** todos los alumnos, estadísticas globales, detección de abandono, tasas de finalización, comparar rendimiento entre promociones, preguntas que más fallan en general, temas más difíciles en general, y **configurar los parámetros del algoritmo** (intervalos de repetición, reglas del calendario inteligente).

   **UX — nombre y presentación (importante, es una decisión de producto, no solo de diseño):** el alumno nunca debe sentir que usa "un calendario". El módulo pasa a llamarse **"Plan Inteligente de Hoy"** y es la pantalla principal del alumno: no muestra fechas ni agenda, muestra la planificación de hoy generada automáticamente, con formato tipo:
     ```
     📅 PLAN INTELIGENTE DE HOY
     Hoy invertirás aproximadamente 78 minutos.
     Nuestro algoritmo ha seleccionado estas actividades porque maximizan tu probabilidad de aprobar la oposición.

     1. Repaso urgente — Tema 7 · Cuadernillo práctico — Probabilidad de olvido: Alta
     2. Contenido nuevo — Tema 9 · Lectura comprensiva
     3. Test de consolidación — Tema 4
     4. Repaso rápido — Tema 2

     Objetivo del día: Incrementar un 1,8 % tu dominio global del temario.
     ```
   Al terminar cada actividad, recalcular automáticamente el resto del plan del día (mejor o peor de lo esperado → reorganiza lo que queda).

   **Página de inicio (marketing/landing):** sección destacada titulada **"¿Cómo funciona nuestro método inteligente de estudio?"**, explicando en lenguaje sencillo (no técnico) que la memoria sigue la curva del olvido, que el sistema detecta cuándo se está empezando a olvidar algo y calcula el mejor momento para repasarlo, que no se pierde tiempo repasando lo ya dominado, y que cada alumno tiene un plan distinto porque se adapta a su rendimiento — objetivo "recordar más con menos esfuerzo", no "estudiar más horas". Con un desplegable/botón **"Conoce la ciencia detrás del método"** que explica de forma visual y divulgativa: curva del olvido de Ebbinghaus, repetición espaciada, retrieval practice, interleaving, y cómo el algoritmo adapta el plan según el rendimiento. Debe transmitir innovación, confianza y respaldo científico, sin tecnicismos.

   **Diseño:** moderno, limpio, muy visual — debe mostrarse claramente qué toca hoy, lo siguiente, nivel de dominio, riesgo de olvido, progreso. Mucho más atractivo que un calendario tradicional.

   **Al implementar:** primero analizar la arquitectura existente (`backend/services/study_calendar_service.py` ya tiene un `_build_new_queue` de una ronda anterior, y `frontend/src/pages/StudyCalendar.js`) y decidir qué reutilizar; el resultado debe quedar como código limpio, modular y escalable — sin romper funcionalidades existentes de por medio (histórico de exámenes, progreso, etc.). Es una feature grande: probablemente merece su propia sesión de planificación (Plan mode) antes de tocar código, no implementarla de un tirón.

9. **Almacenamiento persistente (Backblaze B2) — pendiente de credenciales.** Código ya migrado de Cloudflare R2 (pedía tarjeta) a Backblaze B2 (no la pide) — ver `backend/services/storage_service.py`, `backend/config/settings.py` (`b2_key_id`, `b2_application_key`, `b2_bucket_name`, `b2_endpoint`, `b2_public_url`), `backend/.env.example`. Falta que el usuario cree la cuenta/bucket/application key en Backblaze y pase las 4 credenciales (keyID, applicationKey, nombre del bucket, endpoint tipo `s3.us-west-004.backblazeb2.com`).

10. **[URGENTE, reportado 2026-07-24] El envío automático de correo no es fiable: solo ~54% de los correos se están enviando/entregando, y muchos de los enviados no llegan a entrega.** El usuario quiere que el envío automático simplemente funcione (no un parche) — investigar primero: revisar `EmailService` (Brevo) y sus logs/actividad reciente (`get_recent_activity`) para separar dos problemas distintos: (a) correos que ni siquiera se disparan desde el backend (bug en el trigger/cola de envío) vs (b) correos que se envían pero Brevo no los entrega (bounces, dominio sin SPF/DKIM/DMARC bien configurado, plan gratuito de Brevo con límites, IP en lista negra, etc. — revisar el dashboard de Brevo en busca de bounces/quejas). Aún puede tener sentido añadir el **fallback de envío manual** (modal con asunto/cuerpo para copiar y mandar a mano) como red de seguridad una vez arreglado lo automático, pero el foco es arreglar la causa raíz, no solo tapar el síntoma.

11. **Curador dual-rol.** Al seleccionar rol "profesor" en el alta/edición de usuario, poder marcar también "es curador" (`is_curator: bool` en `User`). Crear `require_content_editor()` en `middleware/auth.py` (admin/curator O profesor con `is_curator`), sustituir los ~11 usos de `require_role(["admin","curator"])` en `api/questions.py` y `api/practical_sets.py`. Avisar a los admins cuando un profesor/curador modifique contenido.

## Ya hecho recientemente (no repetir)

- Canales de chat separados profesor/admin (sufijo `:admin`), nueva conversación, borrar conversación, adjuntos en chat.
- `student_type` propio/centro, RosterTable reutilizable, cambio de rol de usuario existente.
- Panel de actividad de email (Brevo) en Admin — actividad reciente + estadísticas agregadas (últimos 7 días).
- Foto de perfil (autoservicio + admin), logo ADOC como foto por defecto de admin.
- Notificaciones: campanita rediseñada (no leídas arriba, punto rojo, tope 4 + panel completo `/comunicaciones`).
- Icono de la app al añadir a pantalla de inicio (manifest.json, apple-touch-icon).
- Banco de "Preguntas sin lanzar" (`draft_questions`) para publicar tras una novedad de temario, como Cuadernillo o Supuesto nuevo — sembrado en producción (punto 2).
- Corregido bug "Acceso Denegado" al volver de vista de análisis de alumno (profesor).
- Arreglada la barra de navegación que se aplastaba en anchos intermedios de ventana (breakpoint subido de 640px a 1024px).
- **Concurso de Acceso ADOC Oposiciones** (2026-07-24): campaña con fecha límite (20 días desde el primer uso, autoinicializada) e inscripción pública automática (sin revisión manual de admin, a diferencia de `/solicitar-acceso`) que da acceso restringido a Tema 3 (parte específica, teoría + cuadernillo) + 3 Supuestos elegidos al azar una única vez (mismos para todos los participantes, para que el ranking sea comparable) — reutiliza `allowed_content` sin tocar el control de acceso existente. Bloque destacado en la landing (`/`) con cuenta atrás en vivo y link a `/concurso` (reglas + formulario de inscripción); pestaña "Ranking" (`/concurso/ranking`) para participantes con nota anónima; tarjeta "Concurso" en Admin con clasificación completa (con email) y plazas restantes. Backend: `backend/{models,repositories,services,api}/contest*.py`. Copy de la campaña reescrito sin emoticonos a partir del borrador del usuario.

## Notas de proceso importantes

- **Nunca escribir credenciales reales de producción (Mongo, Brevo, B2...) en ningún archivo del repo**, aunque haya permiso para pushear sin preguntar.
- El `.env` local apunta a Mongo local (`opositores_dev`), que SÍ tiene una copia realista del contenido (639 preguntas, mismos temas) — sirve para desarrollar y verificar, pero los cambios ahí NO se reflejan en producción solos. Para todo lo que toque datos de producción (seeds, correcciones de preguntas, etc.), dar al usuario el script/comando exacto para que lo corra él con su `.env` de producción — Claude no debe tener ni pedir esas credenciales.
- Verificar siempre antes de dar por hecho un fallo de deploy: comprobar directamente la URL de producción (backend y frontend) con curl antes de asumir que algo no está publicado — Vercel/Render pueden mandar un aviso de error de un build que no afecta al sitio ya servido.
- Si aparecen archivos modificados/sin trackear que no reconoces: es probable que haya otra sesión de Claude Code trabajando en paralelo sobre el mismo repo. No los borres ni los incluyas en tus commits — investiga primero, coméntalo brevemente, y sigue con lo tuyo.
