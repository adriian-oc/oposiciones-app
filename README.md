# ADOC — Academia de Oposiciones

Plataforma web para la preparación de oposiciones: banco de preguntas por tema, supuestos
prácticos, Test de Teoría, seguimiento de progreso con calendario de repaso espaciado, chat con
el profesor asignado y panel de administración para gestionar alumnos, profesores y contenido.

Stack: React (frontend) + FastAPI (backend) + MongoDB, con autenticación propia (JWT + hash de
contraseña, sin dependencias externas de identidad).

## Desarrollo local

Requiere: Python 3.12+, Node 18+, MongoDB local.

```bash
# Mongo local
brew services start mongodb/brew/mongodb-community@7.0

# Backend
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # y rellenar MONGO_URL=mongodb://localhost:27017, JWT_SECRET_KEY=<algo largo y aleatorio>
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env
npm start
```

Usuarios de prueba: `python scripts/dev_bootstrap.py` (con el backend corriendo) crea (o, si ya
existen, les fija la contraseña de) un admin/profesor/alumno sintéticos con contraseña
`test-password-123`.

## Tests

```bash
cd backend && source venv/bin/activate
pytest tests/ -v
```

Corre contra una base Mongo separada (`opositores_test`, se vacía sola al empezar la sesión de
test) -- nunca toca `opositores_dev` ni datos reales. Cubre auth/roles, roster, el flujo de
práctica y su scoring, autorización del chat, y la whitelist + rate limit de las solicitudes de
acceso.

## Despliegue

1. **MongoDB Atlas** (tier gratuito M0 sirve para empezar): crear cluster, usuario de BBDD, y
   copiar el `MONGO_URL` de conexión (formato `mongodb+srv://...`).
2. **Backend en Render o Railway**: nuevo servicio Python apuntando a `backend/`, comando de
   arranque `uvicorn server:app --host 0.0.0.0 --port $PORT` (ya está en `backend/Procfile`),
   variables de entorno = las de `backend/.env.example` rellenas con los valores reales
   (`MONGO_URL` de Atlas, un `JWT_SECRET_KEY` largo y aleatorio generado para producción, y
   `FRONTEND_BASE_URL` apuntando a la URL del frontend del paso 3).
3. **Frontend en Vercel o Netlify**: apuntar a `frontend/`, build command `npm run build`,
   variable de entorno `REACT_APP_API_URL` apuntando a la URL del backend del paso 2.

Los documentos PDF que suben los profesores se guardan hoy en disco local
(`backend/uploads/`) — válido en desarrollo, pero no sobrevive un despliegue con el backend en
un host efímero. Antes de depender de esa función en producción hace falta un storage real
(S3-compatible, Firebase Storage, Cloudinary...) y adaptar
`backend/services/document_submission_service.py`.
