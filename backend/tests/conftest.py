"""
Fixtures compartidas. Corre contra una base Mongo de test dedicada ('opositores_test', separada
de la de desarrollo) y el emulador de Firebase Auth -- nunca contra datos reales.

Requiere, antes de `pytest`: Mongo local corriendo y el emulador de Firebase Auth en
localhost:9099 (`npx firebase-tools@latest emulators:start --only auth --project demo-oposiciones`).

Nota técnica: el propio backend usa Motor (async) para hablar con Mongo, pero estas fixtures usan
un pymongo.MongoClient SÍNCRONO dedicado y separado del que crea la app -- a propósito, para no
tener que coordinar el event loop async de las fixtures con el que gestiona internamente
TestClient (que ejecuta la app en su propio hilo/loop). Dos clientes distintos (uno sync, uno
async) hablando con la misma base de datos no tiene ningún conflicto real; solo evita la
complejidad de compartir un único event loop entre fixtures de sesión y TestClient.
"""
import os
import uuid

# Debe fijarse ANTES de importar `server`/`config.settings`, porque Settings() se instancia al
# importar el módulo y pydantic-settings da prioridad a las variables de entorno sobre .env.
os.environ["MONGO_DB_NAME"] = "opositores_test"
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
os.environ.setdefault("FIREBASE_PROJECT_ID", "demo-oposiciones")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-not-for-production-min-32-chars")

import pymongo
import pytest
import requests
from fastapi.testclient import TestClient
from firebase_admin import auth as firebase_auth

from services.firebase_service import init_firebase, create_firebase_user
from models.user import UserInDB

TEST_PASSWORD = "test-password-123"


@pytest.fixture(scope="session")
def run_id():
    """Sufijo único por sesión de test para no chocar con usuarios de ejecuciones anteriores
    que sigan vivos en el emulador (el emulador no se reinicia entre ejecuciones de pytest)."""
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="session")
def raw_db():
    """Cliente pymongo síncrono dedicado para preparar/inspeccionar datos de test directamente,
    independiente del cliente Motor que usa la app (ver nota técnica arriba)."""
    raw_client = pymongo.MongoClient(os.environ["MONGO_URL"])
    raw_client.drop_database(os.environ["MONGO_DB_NAME"])
    db = raw_client.get_database(os.environ["MONGO_DB_NAME"])
    yield db
    raw_client.close()


@pytest.fixture(scope="session")
def client(raw_db):
    from server import app
    with TestClient(app) as c:
        yield c


def _sign_in(email: str, password: str = TEST_PASSWORD) -> str:
    host = os.environ["FIREBASE_AUTH_EMULATOR_HOST"]
    url = f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key"
    r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})
    r.raise_for_status()
    return r.json()["idToken"]


def _make_user(raw_db, run_id: str, role: str, label: str) -> dict:
    """Crea un usuario directamente (Firebase + Mongo, vía el cliente pymongo dedicado), sin
    pasar por el endpoint de admin, para que las fixtures de rol no dependan de que otros tests
    hayan corrido antes."""
    init_firebase()
    email = f"{label}.{run_id}@test.example.com"
    firebase_user = create_firebase_user(email, f"{label.capitalize()} de Test")
    firebase_auth.update_user(firebase_user.uid, password=TEST_PASSWORD)

    user = UserInDB(email=email, display_name=f"{label.capitalize()} de Test", role=role, firebase_uid=firebase_user.uid)
    raw_db.users.insert_one(user.model_dump())

    token = _sign_in(email)
    return {"id": user.id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def admin_user(client, raw_db, run_id):
    return _make_user(raw_db, run_id, "admin", "admin")


@pytest.fixture(scope="session")
def profesor_user(client, raw_db, run_id):
    return _make_user(raw_db, run_id, "profesor", "profesor")


@pytest.fixture(scope="session")
def student_user(client, raw_db, run_id):
    return _make_user(raw_db, run_id, "student", "alumno")


@pytest.fixture(scope="session")
def other_student_user(client, raw_db, run_id):
    return _make_user(raw_db, run_id, "student", "otro-alumno")
