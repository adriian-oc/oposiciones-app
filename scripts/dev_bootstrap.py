"""
Script de desarrollo local (NO usar contra una base de datos de producción): crea, o si ya
existen les fija la contraseña de prueba, los 3 usuarios sintéticos (admin/profesor/alumno) que
usan el resto de scripts y la verificación manual de la app. Idempotente: si un usuario ya
existe conserva su id y todo su historial (intentos, progreso, chats...), solo se asegura de que
su contraseña sea la de prueba.

Requiere: Mongo local corriendo, backend corriendo en localhost:8000 (para probar
POST /api/auth/login al final).

Uso: cd backend && source venv/bin/activate && python ../scripts/dev_bootstrap.py
"""
import asyncio
import os
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo  # noqa: E402
from models.user import UserCreate  # noqa: E402
from repositories.user_repository import UserRepository  # noqa: E402
from services.auth_service import hash_password  # noqa: E402

TEST_PASSWORD = "test-password-123"

TEST_USERS = [
    {"email": "admin.test@example.com", "display_name": "Admin de Prueba", "role": "admin"},
    {"email": "profesor.test@example.com", "display_name": "Profesor de Prueba", "role": "profesor"},
    {"email": "alumno.test@example.com", "display_name": "Alumno de Prueba", "role": "student"},
]


async def main():
    await connect_to_mongo()
    repo = UserRepository()
    password_hash = hash_password(TEST_PASSWORD)

    for spec in TEST_USERS:
        existing = await repo.get_by_email(spec["email"])
        if existing:
            await repo.set_password_hash(existing["id"], password_hash)
            print(f"Ya existía: {spec['email']} (rol {spec['role']}) -- contraseña de prueba fijada")
            continue

        user_data = UserCreate(email=spec["email"], display_name=spec["display_name"], role=spec["role"])
        user = await repo.create_with_password(user_data, password_hash)
        print(f"Creado: {spec['email']} (rol {spec['role']}, id={user.id})")

    print("\n--- Prueba rápida contra POST /api/auth/login + GET /api/auth/me ---")
    for spec in TEST_USERS:
        login = requests.post(
            "http://127.0.0.1:8000/api/auth/login",
            json={"email": spec["email"], "password": TEST_PASSWORD},
        )
        if login.status_code != 200:
            print(f"{spec['role']}: login FALLÓ status={login.status_code} body={login.text}")
            continue
        token = login.json()["access_token"]
        me = requests.get("http://127.0.0.1:8000/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"{spec['role']}: login OK, /me status={me.status_code} body={me.json()}")


if __name__ == "__main__":
    asyncio.run(main())
