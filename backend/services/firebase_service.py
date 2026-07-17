import json
import os

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from config.settings import settings

_app: firebase_admin.App | None = None


def init_firebase() -> firebase_admin.App:
    """Inicializa la app de Firebase Admin una sola vez por proceso.

    Modo emulador (dev/staging sin secretos): si FIREBASE_AUTH_EMULATOR_HOST está
    configurado, el SDK Admin habla con el emulador local y no necesita una cuenta
    de servicio real -- basta con un project_id, aunque sea uno de mentira (p.ej.
    "demo-oposiciones"), porque el emulador nunca llama a Google.

    Modo real (producción): requiere el JSON de una cuenta de servicio con permisos
    acotados a Firebase Authentication Admin, inyectado como variable de entorno
    (nunca committeado), no como fichero en el repo.
    """
    global _app
    if _app is not None:
        return _app

    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host
        _app = firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
    elif settings.firebase_service_account_json:
        cred = credentials.Certificate(json.loads(settings.firebase_service_account_json))
        _app = firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
    else:
        raise RuntimeError(
            "Configura FIREBASE_AUTH_EMULATOR_HOST (dev/staging) o "
            "FIREBASE_SERVICE_ACCOUNT_JSON (producción) antes de arrancar el servidor."
        )

    return _app


def verify_id_token(id_token: str) -> dict:
    """Verifica un ID token de Firebase y devuelve su payload decodificado (incluye 'uid', 'email')."""
    init_firebase()
    return firebase_auth.verify_id_token(id_token)


def create_firebase_user(email: str, display_name: str) -> firebase_auth.UserRecord:
    init_firebase()
    return firebase_auth.create_user(email=email, display_name=display_name, email_verified=False)


def generate_password_reset_link(email: str) -> str:
    """Enlace de restablecimiento de contraseña -- nunca se expone/gestiona una contraseña en claro,
    ni siquiera el admin la ve, replicando la decisión de producto ya vigente en ADOC."""
    init_firebase()
    return firebase_auth.generate_password_reset_link(email)


def delete_firebase_user(uid: str) -> None:
    init_firebase()
    firebase_auth.delete_user(uid)
