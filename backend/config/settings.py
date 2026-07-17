from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    mongo_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 43200
    mongo_db_name: str

    # Firebase Auth: identidad de usuarios (login) vive en Firebase Auth; todo lo demás en Mongo.
    # En local/dev, deja firebase_service_account_json vacío y usa firebase_auth_emulator_host
    # (el SDK Admin no necesita credenciales reales para hablar con el emulador).
    firebase_project_id: str = "demo-oposiciones"
    firebase_service_account_json: Optional[str] = None
    firebase_auth_emulator_host: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()