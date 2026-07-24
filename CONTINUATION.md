# Prompt de continuación — ADOC (academia de oposiciones)

Pega esto como primer mensaje en una conversación nueva de Claude Code para retomar el trabajo.

---

Lee este archivo entero y continúa con el trabajo pendiente por prioridad. Repo: `/Users/adrian/Desktop/Adoc/oposiciones-app` (React CRA + FastAPI + MongoDB). Producción: backend en Render (`https://pagina-final-mhnt.onrender.com`, plan free, se duerme tras inactividad), frontend en Vercel (`https://adoc-oposiciones.vercel.app`), Mongo en Atlas. Remotos git: `origin` (github.com/adriian-oc/oposiciones-app) y `pagina-final` (github.com/adriian-oc/Pagina-final) — pushear a los dos sin pedir permiso cada vez (pero confirmar siempre antes de un deploy real a producción).

## Pendiente — por prioridad

1. **[HECHO en producción, salvo recalcular estadísticas] Corregir respuestas erróneas del Test de Teoría parte general (Temas 1-11) + examen nuevo "Repaso Temas 1-11".** Los alumnos reportaban notas mal calculadas; el profesor revisó el Tema 9 a mano y encontró ~12 errores (la revisión real encontró 56). Los PDF oficiales están en `/Users/adrian/Desktop/OPO/OPO 2/Test/GM/2. Parte general Test Vanesa año 1 tema 1 al 11/`.

   **Confirmado un bug sistemático de desplazamiento de índice (+1) en la carga de estos datos**: cuando la respuesta correcta real era la opción a), b) o c), quedó marcada la opción siguiente; cuando era la d) (última), quedó bien por no haber "siguiente" opción. Verificado exhaustivamente, pregunta por pregunta, en los **11 temas** contra su PDF individual. Total 495 correcciones (337 de Temas 1,2,3,4,6,7,9,10,11 + 158 de Temas 5 y 8) mediante `scripts/fix_general_theme_answers.py` (commits `a769fd5` y `8f2b318`), que compara el valor actual antes de tocarlo y guarda cada cambio en `edit_history` para auditoría. **Aplicado en producción el 2026-07-24: 478 aplicadas, 17 saltadas como conflicto porque el profesor ya las había corregido a mano por su cuenta en producción el 21 de julio (verificado en su `edit_history`) — el script no las tocó, tal como está diseñado.**

   Además, `Test Adrián 1-11.pdf` **no era un documento de repaso de preguntas ya cargadas, sino un examen nuevo** (101 preguntas propias, con su propia clave de respuestas, mezclando contenido de los Temas 1-11) que no estaba subido a la app. Se ha creado como tema nuevo **"Repaso Temas 1-11"** (code `GENERAL_REPASO_1_11`, part `GENERAL`, order 24) con sus 101 preguntas, vía `scripts/seed_test_adrian_1_11.py` (idempotente) — **ya aplicado y verificado en producción el 2026-07-24** (101 preguntas insertadas, tema visible en Cuadernos.js sin tocar frontend). Nota: la pregunta 93 del PDF original tenía dos letras superpuestas en la clave ("CB", posible corrección manual del autor sin borrar la anterior); se optó por C por coincidir con el contenido legal (arts. 265/268 TFUE) — revisar a mano vía Admin si se prefiere B.

   Excepcionalmente, esta vez el propio usuario pasó las credenciales de producción en el chat y Claude ejecutó los scripts directamente (el usuario no se manejaba con terminal/entornos) — no es la norma: por defecto seguir dando los scripts para que el usuario los corra él, y solo repetir esto si el usuario lo vuelve a pedir explícitamente.

   Pendiente:
   - **Recalcular estadísticas de alumnos** (ver punto 4): los `attempts`/`progress` de alumnos que respondieron estas preguntas antes de la corrección siguen contabilizados con la respuesta antigua (posiblemente errónea) hasta que se implemente esa recalculación — no está hecha todavía.

2. **Sembrar las 20 preguntas de draft_questions en producción.** El código ya está desplegado (confirmado por curl: `/api/draft-questions` responde en Render, y el bundle de Vercel ya incluye el componente `DraftQuestionsBank`). Falta solo que el usuario ejecute, con su `.env` de producción:
   ```
   cd backend && source venv/bin/activate && python ../scripts/seed_draft_questions_novedad.py
   ```
   Después: Admin (o panel del profesor) → Novedad de temario → Preguntas sin lanzar → publicar como Cuadernillo o Supuesto.

3. **Historial: reanudar/borrar test a medias (alumno) + ver/borrar test de alumno (profesor).** El alumno debe poder retomar un test en curso o borrarlo, y ver sus test ya completados para repasar fallos. El profesor debe poder ver las respuestas concretas de un alumno en un test, o borrarlo. Revisar `frontend/src/pages/Progress.js` (o donde esté el Historial) y el modelo de `attempts`/`exams` en Mongo.

4. **Recalcular estadísticas de alumnos al corregir una pregunta.** Cuando se edita `correct_answer` de una pregunta (vía Admin, o por las correcciones del punto 1), repasar los `attempts`/`progress` de alumnos que ya respondieron esa pregunta: si su respuesta coincide con la NUEVA respuesta correcta pero estaba contabilizada como fallo, corregir su estadística.

5. **Eliminar todos los emojis y usar imágenes de un banco gratuito.** Sustituir los emoji usados como iconos en toda la app (Admin.js, Layout.js, ProfesorDashboard.js, `config/notificationIcons.js`, etc.) por imágenes/iconos SVG de una web de recursos gratuitos para uso web, manteniendo el significado de cada uno.

6. **Admin — Novedad de temario: estado de envío.** Si ya se mandó la comunicación de una novedad, mostrar "Ya enviado" a la derecha de la tarjeta, cambiar el botón a "Reenviar" o "Enviar solo a los que no han abierto", y mostrar un contador X/Y vistos sobre el total de destinatarios. Necesita registrar qué novedades se mandaron y a quién, cruzado con los eventos de apertura de Brevo (`EmailService.get_recent_activity`, evento `opened`).

7. **Rediseñar inicio de profesor con tarjetas, unificando Inicio y Mis alumnos.** Usar el sistema de tarjetas ya existente en Admin.js como referencia visual para `ProfesorDashboard.js`, fusionando la pestaña de inicio con la de alumnos en una vista más elegante. Mejorar también la vista de inicio del alumno.

8. **Rediseñar el calendario de estudio: vista mensual real + planificación trimestral.** El calendario de alumnos debe mostrarse como un calendario real por meses, con planificación trimestral. Algoritmo pedido explícitamente por el usuario:
   - Lunes: Tema 1 parte específica + Test de Teoría Tema 1.
   - Martes: Tema 2 parte específica + Test de Teoría Tema 2 + Cuadernillo Tema 2.
   - Miércoles: Tema 3 parte específica + Test de Teoría Tema 3 + Cuadernillo Tema 3.
   - ...así con todos los temas de la parte específica.
   - Después, la misma lógica con los temas de la parte general (Test de Teoría + Cuadernillo por tema).
   Una vez generada la planificación trimestral, el profesor la **acepta** y a partir de ahí puede **modificar eventos individuales**. Revisar `backend/services/study_calendar_service.py` (ya tiene `_build_new_queue` de una ronda anterior) y `frontend/src/pages/StudyCalendar.js`.

9. **Almacenamiento persistente (Backblaze B2) — pendiente de credenciales.** Código ya migrado de Cloudflare R2 (pedía tarjeta) a Backblaze B2 (no la pide) — ver `backend/services/storage_service.py`, `backend/config/settings.py` (`b2_key_id`, `b2_application_key`, `b2_bucket_name`, `b2_endpoint`, `b2_public_url`), `backend/.env.example`. Falta que el usuario cree la cuenta/bucket/application key en Backblaze y pase las 4 credenciales (keyID, applicationKey, nombre del bucket, endpoint tipo `s3.us-west-004.backblazeb2.com`).

10. **Fallback de envío manual de correo si Brevo falla.** Si el envío automático no resulta fiable, mostrar un modal con el asunto/cuerpo literal del correo para que el profesor/admin lo copie (botón de copiar al portapapeles) y lo mande a mano.

11. **Curador dual-rol.** Al seleccionar rol "profesor" en el alta/edición de usuario, poder marcar también "es curador" (`is_curator: bool` en `User`). Crear `require_content_editor()` en `middleware/auth.py` (admin/curator O profesor con `is_curator`), sustituir los ~11 usos de `require_role(["admin","curator"])` en `api/questions.py` y `api/practical_sets.py`. Avisar a los admins cuando un profesor/curador modifique contenido.

## Ya hecho recientemente (no repetir)

- Canales de chat separados profesor/admin (sufijo `:admin`), nueva conversación, borrar conversación, adjuntos en chat.
- `student_type` propio/centro, RosterTable reutilizable, cambio de rol de usuario existente.
- Panel de actividad de email (Brevo) en Admin — actividad reciente + estadísticas agregadas (últimos 7 días).
- Foto de perfil (autoservicio + admin), logo ADOC como foto por defecto de admin.
- Notificaciones: campanita rediseñada (no leídas arriba, punto rojo, tope 4 + panel completo `/comunicaciones`).
- Icono de la app al añadir a pantalla de inicio (manifest.json, apple-touch-icon).
- Banco de "Preguntas sin lanzar" (`draft_questions`) para publicar tras una novedad de temario, como Cuadernillo o Supuesto nuevo — código desplegado, falta sembrar en producción (punto 2).
- Corregido bug "Acceso Denegado" al volver de vista de análisis de alumno (profesor).
- Arreglada la barra de navegación que se aplastaba en anchos intermedios de ventana (breakpoint subido de 640px a 1024px).

## Notas de proceso importantes

- **Nunca escribir credenciales reales de producción (Mongo, Brevo, B2...) en ningún archivo del repo**, aunque haya permiso para pushear sin preguntar.
- El `.env` local apunta a Mongo local (`opositores_dev`), que SÍ tiene una copia realista del contenido (639 preguntas, mismos temas) — sirve para desarrollar y verificar, pero los cambios ahí NO se reflejan en producción solos. Para todo lo que toque datos de producción (seeds, correcciones de preguntas, etc.), dar al usuario el script/comando exacto para que lo corra él con su `.env` de producción — Claude no debe tener ni pedir esas credenciales.
- Verificar siempre antes de dar por hecho un fallo de deploy: comprobar directamente la URL de producción (backend y frontend) con curl antes de asumir que algo no está publicado — Vercel/Render pueden mandar un aviso de error de un build que no afecta al sitio ya servido.
- Si aparecen archivos modificados/sin trackear que no reconoces: es probable que haya otra sesión de Claude Code trabajando en paralelo sobre el mismo repo. No los borres ni los incluyas en tus commits — investiga primero, coméntalo brevemente, y sigue con lo tuyo.
