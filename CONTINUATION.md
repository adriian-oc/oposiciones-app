# Prompt de continuación — Migración ADOC Cuadernos → oposiciones-app

Pega esto como primer mensaje en una conversación nueva de Claude Code para retomar el trabajo.

---

## Contexto del proyecto

Estoy migrando **ADOC Cuadernos** (academia de oposiciones, app de producción real en un único
`index.html` con Firebase Auth+Firestore+Hosting, plan Spark gratuito) hacia una base propia de
**React + FastAPI + MongoDB**, usando como punto de partida el repo `oposiciones-app` (que ya
traía un esqueleto en capas: api → services → repositories → Mongo).

- **Repo de trabajo local**: `/Users/adrian/Desktop/Adoc/oposiciones-app`
- **Repos remotos**: `https://github.com/adriian-oc/Pagina-final.git` (remote `pagina-final`,
  **el principal a partir de ahora** — el usuario pidió que cada modificación se suba ahí) y
  `https://github.com/adriian-oc/oposiciones-app.git` (remote `origin`, se mantiene sincronizado
  en paralelo, sin motivo concreto para dejarlo desactualizado). Ambos están al día en el commit
  `2e28b99` a fecha de este resumen.
- **App de producción de ADOC** (código fuente en `/Users/adrian/Desktop/Adoc/webapp`, ver su
  `CLAUDE.md` ahí para arquitectura/datos original): `adoc-9e397.web.app` /
  `academia-adoc.web.app`. **Regla dura: nunca se ha tocado ni se debe tocar hasta el cutover
  final, explícitamente aprobado por el usuario.**
- **Plan de migración por fases** (el documento original que se acordó con el usuario):
  `/Users/adrian/.claude/plans/immutable-painting-penguin.md`

## Decisión de arquitectura clave

Identidad = **Firebase Auth únicamente** (login, sin plan gratuito limitante porque ahora hay
Admin SDK real). Todo lo demás (roster, progreso, contenido, chat, pagos...) vive en **MongoDB**,
accedido con **Motor async** (no pymongo síncrono — se migró todo el backend a async en esta
sesión para no bloquear el event loop bajo carga).

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

## Lo único pendiente: Fase 8 (infraestructura) y Fase 9 (validación + cutover)

**Bloqueado en el usuario**, no en mí: no puedo crear cuentas de terceros en su nombre. Falta que
él cree:
1. Cluster gratuito en **MongoDB Atlas**
2. Proyecto de **Firebase real** (o decidir si sigue usando el emulador para siempre, cosa poco
   recomendable en producción) + cuenta de servicio para `FIREBASE_SERVICE_ACCOUNT_JSON`
3. Backend desplegado en **Render o Railway** (ya está `backend/Procfile` listo)
4. Frontend desplegado en **Vercel o Netlify**

Toda la configuración/documentación de despliegue ya está preparada: `backend/.env.example`,
`frontend/.env.example`, instrucciones paso a paso en `README.md` del repo.

La Fase 9 (checklist de validación + cutover del dominio) depende por completo de que la Fase 8
esté hecha, y el cutover final del dominio **requiere aprobación explícita del usuario en el
momento**, nunca autónoma.

## Entorno de desarrollo local (cómo retomar)

Todo corre en local, contra datos de prueba sintéticos (nunca contra Firestore real de ADOC):

```bash
# Mongo local (probablemente ya esté corriendo como servicio de brew)
brew services start mongodb/brew/mongodb-community@7.0

# Emulador de Firebase Auth
cd /Users/adrian/Desktop/Adoc/oposiciones-app
npx firebase-tools@latest emulators:start --only auth --project demo-oposiciones

# Backend
cd backend && source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8000

# Frontend (usar la tool preview_start con name:"oposiciones-frontend", NO Bash,
# ya está en .claude/launch.json del repo Y en /Users/adrian/Desktop/WEB/.claude/launch.json)
```

**Usuarios de prueba** (contraseña para todos: `test-password-123`):
- `admin.test@example.com` (admin) · `profesor.test@example.com` (profesor) ·
  `alumno.test@example.com` (student, ya tiene datos de progreso/fallos/calendario de prueba)

Si hacen falta más, `python scripts/dev_bootstrap.py` (con backend+emulador corriendo) los
recrea. Los datos reales de contenido (banco de preguntas migrado de ADOC) ya están en la Mongo
local `opositores_dev` — no hace falta re-ejecutar `scripts/migrate_quiz_data.py` a menos que se
recree la base desde cero.

## Asunto sin resolver: el usuario no podía entrar desde su propio navegador

En la sesión anterior el usuario reportó "Correo o contraseña incorrectos" al intentar entrar con
`admin.test@example.com` desde su navegador real (no el navegador embebido de la sesión de
Claude Code). Se verificó exhaustivamente que backend, emulador y el bundle servido por el
frontend eran correctos. **Se descubrió que el proceso del frontend (`react-scripts start`)
se había caído** en algún momento — causa más probable del problema, aunque no confirmada del
todo porque el usuario no llegó a compartir el error de consola pedido. Si vuelve a fallar el
login: lo primero es comprobar que el frontend (puerto 3000) esté realmente sirviendo (no solo
que responda `curl`, sino que compile sin errores), y si sigue fallando, pedir al usuario el
error exacto de la consola del navegador (F12 → Consola/Red).

## Cómo seguir

Cuando retomes: confirma que los 4 servicios locales están arriba (Mongo, emulador, backend,
frontend), pregunta al usuario si quiere seguir con la Fase 8 ahora (¿ya tiene alguna de las 4
cuentas creadas?) o prefiere seguir puliendo funcionalidades en local primero.
