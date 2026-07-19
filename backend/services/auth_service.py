import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Tuple

import bcrypt
import jwt

from config.settings import settings

RESET_TOKEN_TTL_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Devuelve el user id (sub) del token. Lanza jwt.PyJWTError si no es válido o ha caducado."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    return payload["sub"]


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_reset_token() -> Tuple[str, str]:
    """Devuelve (token en claro para compartir una sola vez, hash para guardar en Mongo) --
    igual que una contraseña, el token en claro nunca se persiste, solo su hash."""
    token = secrets.token_urlsafe(32)
    return token, hash_reset_token(token)


def reset_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_TTL_HOURS)
