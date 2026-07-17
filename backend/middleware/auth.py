from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin.auth import InvalidIdTokenError, ExpiredIdTokenError
from services.firebase_service import verify_id_token
from repositories.user_repository import UserRepository

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Identidad = Firebase Auth (verifica el ID token), datos de rol/roster = Mongo.

    Este es el único punto de integración con Firebase Auth: require_role() de abajo,
    y los ~30 endpoints que ya dependen de get_current_user, no necesitan cambiar --
    solo miran current_user["role"], sin importar cómo se resolvió la identidad.
    """
    token = credentials.credentials
    try:
        decoded = verify_id_token(token)
    except (InvalidIdTokenError, ExpiredIdTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
        )

    firebase_uid = decoded.get("uid")
    if firebase_uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user_repo = UserRepository()
    user = await user_repo.get_by_firebase_uid(firebase_uid)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta de Firebase válida pero sin roster asociado en la aplicación",
        )

    # revoked se comprueba antes que expires_at y bloquea cualquier rol (incluido staff),
    # replicando la semántica de ADOC (CLAUDE.md: "Revoke vs. expire").
    if user.get("revoked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta revocada")

    # admin/profesor están exentos de expires_at (staff no debe ser expulsado por un ciclo
    # de facturación) -- solo se aplica a student, igual que en ADOC.
    expires_at = user.get("expires_at")
    if user.get("role") == "student" and expires_at is not None:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso caducado")

    return user

def require_role(allowed_roles: list):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker
