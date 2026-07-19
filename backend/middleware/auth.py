from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from services.auth_service import decode_access_token
from repositories.user_repository import UserRepository

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verifica el JWT emitido por POST /api/auth/login y carga el roster desde Mongo.

    Este es el único punto de verificación de sesión: require_role() de abajo, y el resto de
    endpoints que dependen de get_current_user, no necesitan cambiar -- solo miran
    current_user["role"], sin importar cómo se resolvió la identidad.
    """
    token = credentials.credentials
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
        )

    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    # revoked se comprueba antes que expires_at y bloquea cualquier rol, incluido staff: son dos
    # estados distintos -- revocar es una decisión manual e inmediata del admin, expirar es
    # automático por fecha y solo se aplica a alumnos (ver más abajo).
    if user.get("revoked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta revocada")

    # admin/profesor están exentos de expires_at -- el acceso de duración limitada es un
    # concepto de facturación del alumno, el personal no debe perder acceso por eso.
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
