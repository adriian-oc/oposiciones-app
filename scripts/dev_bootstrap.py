"""
Script de desarrollo local (NO usar contra Firebase/Mongo reales): crea usuarios de prueba
sintéticos (admin/profesor/alumno) directamente contra el emulador de Firebase Auth y el
Mongo local, y obtiene un ID token de cada uno para poder probar la API manualmente.

Requiere: emulador de Firebase Auth en localhost:9099 y Mongo local corriendo,
backend corriendo en localhost:8000 (para probar /api/auth/me al final).

Uso: cd backend && source venv/bin/activate && python ../scripts/dev_bootstrap.py
"""
import os
import sys
import uuid

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")

from firebase_admin import auth as firebase_auth  # noqa: E402

from config.settings import settings  # noqa: E402
from config.database import connect_to_mongo  # noqa: E402
from models.user import UserCreate, UserInDB  # noqa: E402
from repositories.user_repository import UserRepository  # noqa: E402
from services.firebase_service import init_firebase, create_firebase_user  # noqa: E402

EMULATOR_HOST = os.environ["FIREBASE_AUTH_EMULATOR_HOST"]
TEST_PASSWORD = "test-password-123"

TEST_USERS = [
    {"email": "admin.test@example.com", "display_name": "Admin de Prueba", "role": "admin"},
    {"email": "profesor.test@example.com", "display_name": "Profesor de Prueba", "role": "profesor"},
    {"email": "alumno.test@example.com", "display_name": "Alumno de Prueba", "role": "student"},
]


def sign_in_and_get_id_token(email: str, password: str) -> str:
    """Usa el REST API del emulador (no disponible así en producción) para autenticar
    y obtener un ID token real, evitando tener que abrir un navegador para probar."""
    url = f"http://{EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key"
    resp = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})
    resp.raise_for_status()
    return resp.json()["idToken"]


def set_password_in_emulator(local_id: str, password: str) -> None:
    firebase_auth.update_user(local_id, password=password)


def main():
    connect_to_mongo()
    init_firebase()
    repo = UserRepository()

    tokens = {}
    for spec in TEST_USERS:
        if repo.email_exists(spec["email"]):
            print(f"Ya existe: {spec['email']} (rol {spec['role']}), lo salto")
            continue

        firebase_user = create_firebase_user(spec["email"], spec["display_name"])
        set_password_in_emulator(firebase_user.uid, TEST_PASSWORD)

        user = UserInDB(
            email=spec["email"],
            display_name=spec["display_name"],
            role=spec["role"],
            firebase_uid=firebase_user.uid,
        )
        repo.collection.insert_one(user.model_dump())

        id_token = sign_in_and_get_id_token(spec["email"], TEST_PASSWORD)
        tokens[spec["role"]] = id_token
        print(f"Creado: {spec['email']} (rol {spec['role']}, firebase_uid={firebase_user.uid})")

    print("\n--- ID tokens (válidos ~1h, solo emulador) ---")
    for role, token in tokens.items():
        print(f"\n{role.upper()}:\n{token}")

    if tokens:
        print("\n--- Prueba rápida contra /api/auth/me ---")
        for role, token in tokens.items():
            r = requests.get("http://127.0.0.1:8000/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            print(f"{role}: status={r.status_code} body={r.json()}")


if __name__ == "__main__":
    main()
