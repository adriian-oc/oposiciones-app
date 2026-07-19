"""
Fixtures compartidas. Corre contra una base Mongo de test dedicada ('opositores_test', separada
de la de desarrollo) -- nunca contra datos reales.

Requiere, antes de `pytest`: Mongo local corriendo.

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
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-not-for-production-min-32-chars")

import pymongo
import pytest
from fastapi.testclient import TestClient

from models.user import UserInDB
from services.auth_service import hash_password

TEST_PASSWORD = "test-password-123"


@pytest.fixture(scope="session")
def run_id():
    """Sufijo único por sesión de test para no chocar con usuarios de ejecuciones anteriores."""
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


def _make_user(client, raw_db, run_id: str, role: str, label: str) -> dict:
    """Crea un usuario directamente en Mongo (vía el cliente pymongo dedicado), sin pasar por
    el endpoint de admin, para que las fixtures de rol no dependan de que otros tests hayan
    corrido antes."""
    email = f"{label}.{run_id}@test.example.com"
    user = UserInDB(
        email=email,
        display_name=f"{label.capitalize()} de Test",
        role=role,
        password_hash=hash_password(TEST_PASSWORD),
    )
    raw_db.users.insert_one(user.model_dump())

    login = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    login.raise_for_status()
    token = login.json()["access_token"]
    return {"id": user.id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def set_known_password(client, admin_headers: dict, user_id: str, password: str = TEST_PASSWORD) -> None:
    """Para un usuario dado de alta por un admin (POST /api/admin/students, que fija una
    contraseña inicial aleatoria e inutilizable): ejercita el flujo real de restablecimiento
    para dejarlo con una contraseña conocida, en vez de escribir directo en Mongo."""
    reset = client.post(f"/api/admin/students/{user_id}/send-password-reset", headers=admin_headers)
    reset.raise_for_status()
    token = reset.json()["reset_link"].split("token=")[1]
    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": password})
    r.raise_for_status()


@pytest.fixture(scope="session")
def admin_user(client, raw_db, run_id):
    return _make_user(client, raw_db, run_id, "admin", "admin")


@pytest.fixture(scope="session")
def profesor_user(client, raw_db, run_id):
    return _make_user(client, raw_db, run_id, "profesor", "profesor")


@pytest.fixture(scope="session")
def student_user(client, raw_db, run_id):
    return _make_user(client, raw_db, run_id, "student", "alumno")


@pytest.fixture(scope="session")
def other_student_user(client, raw_db, run_id):
    return _make_user(client, raw_db, run_id, "student", "otro-alumno")
