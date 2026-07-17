# Opositores App

Reescritura de ADOC Cuadernos (Firebase, single-file) sobre una base propia de React + FastAPI +
MongoDB, con Firebase Auth como único punto de identidad (login) y todo lo demás en Mongo. Ver
`/Users/adrian/.claude/plans/immutable-painting-penguin.md` para el plan de migración completo
por fases.

## Desarrollo local

Requiere: Python 3.12+, Node 18+, MongoDB local, Firebase CLI (`npx firebase-tools`).

```bash
# Mongo local
brew services start mongodb/brew/mongodb-community@7.0

# Emulador de Firebase Auth (no requiere cuenta real de Firebase)
npx firebase-tools@latest emulators:start --only auth --project demo-oposiciones

# Backend
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # y rellenar MONGO_URL=mongodb://localhost:27017, FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env  # y rellenar REACT_APP_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
npm start
```

Usuarios de prueba: `python scripts/dev_bootstrap.py` (con backend y emulador corriendo) crea un
admin/profesor/alumno sintéticos y devuelve sus ID tokens.

Migración de contenido desde ADOC (solo una vez, contra Mongo local):
```bash
python scripts/extract_quiz_data.py   # extrae QUIZ_DATA/AREA_PDFS/CONTENT_AREAS de index.html
python scripts/migrate_quiz_data.py   # los vuelca a Mongo (idempotente)
```

## Tests

```bash
cd backend && source venv/bin/activate
pytest tests/ -v
```

Corre contra una base Mongo separada (`opositores_test`, se vacía sola al empezar la sesión de
test) y el mismo emulador de Firebase Auth del desarrollo local -- nunca toca `opositores_dev`
ni datos reales. Cubre auth/roles, roster, el flujo de práctica y su scoring, autorización del
chat, y la whitelist + rate limit de las solicitudes de acceso.

## Despliegue a staging (Fase 8 del plan de migración)

Esto requiere crear cuentas reales -- son pasos que solo puede hacer el dueño del proyecto, no
un agente automatizado:

1. **MongoDB Atlas** (tier gratuito M0): crear cluster, usuario de BBDD, y copiar el
   `MONGO_URL` de conexión (formato `mongodb+srv://...`).
2. **Firebase**: crear (o reutilizar) un proyecto de Firebase, activar Authentication con el
   proveedor de email/contraseña, y generar una cuenta de servicio (Configuración del proyecto >
   Cuentas de servicio > Generar nueva clave privada) para `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. **Backend en Render o Railway**: nuevo servicio Python apuntando a `backend/`, comando de
   arranque `uvicorn server:app --host 0.0.0.0 --port $PORT` (ya está en `backend/Procfile`),
   variables de entorno = las de `backend/.env.example` rellenas con los valores reales de
   Atlas/Firebase. **Nunca pegar el JSON de la cuenta de servicio en un repo** -- solo como
   variable de entorno en el panel del hosting.
4. **Frontend en Vercel o Netlify**: apuntar a `frontend/`, build command `npm run build`,
   variables de entorno = las de `frontend/.env.example`, con `REACT_APP_API_URL` apuntando a la
   URL del backend del paso 3.
5. Ejecutar `scripts/migrate_roster.py` (por escribir cuando llegue el momento del cutover --
   exporta `roster`/`progress` reales de Firestore de producción, solo lectura) contra el Mongo
   de staging para tener datos reales de alumnos en staging antes de validar.

**El dominio de producción de ADOC (`adoc-9e397.web.app` / `academia-adoc.web.app`) no se toca
en ningún momento de este proceso.** El staging vive en URLs nuevas (`*.onrender.com`,
`*.vercel.app` o similares) hasta que, tras la validación completa (Fase 9), se apruebe
explícitamente el cutover final.
