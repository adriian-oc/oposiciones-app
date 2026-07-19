import logging
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status

from config.settings import settings
from models.user import UserCreate, UserInDB, UserUpdate
from repositories.user_repository import UserRepository
from repositories.progress_repository import ProgressRepository
from services.auth_service import hash_password, generate_reset_token, reset_token_expiry

logger = logging.getLogger(__name__)


def _has_novedades(user: dict, progress: dict, staff_id: str) -> bool:
    """Compara progress.updated_at contra la última vez que ESTE miembro del staff revisó a
    este alumno (user.last_reviewed_by[staff_id]): si nunca lo revisó, o si el progreso se
    actualizó después de esa última revisión, hay actividad nueva que mostrar."""
    if not progress or not progress.get("updated_at"):
        return False
    last_reviewed = (user.get("last_reviewed_by") or {}).get(staff_id)
    if last_reviewed is None:
        return True
    updated_at = progress["updated_at"]
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    if isinstance(last_reviewed, str):
        last_reviewed = datetime.fromisoformat(last_reviewed)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    if last_reviewed.tzinfo is None:
        last_reviewed = last_reviewed.replace(tzinfo=timezone.utc)
    return updated_at > last_reviewed


class AdminService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.progress_repo = ProgressRepository()

    async def list_students(self, viewer_staff_id: str = None):
        from services.progress_service import ProgressService
        students = await self.user_repo.list_all()
        progress_service = ProgressService()
        for s in students:
            if s.get("role") != "student":
                continue
            progress = await self.progress_repo.get_by_user(s["id"])
            if viewer_staff_id:
                s["has_novedades"] = _has_novedades(s, progress, viewer_staff_id)
            s["progress_summary"] = await progress_service.get_summary(s["id"])
        return students

    async def mark_reviewed(self, student_id: str, staff_id: str, is_admin: bool = False) -> None:
        user = await self.user_repo.get_by_id(student_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not is_admin and user.get("assigned_profesor_id") != staff_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        await self.user_repo.mark_reviewed_by(student_id, staff_id, datetime.now(timezone.utc))

    async def create_student(self, user_data: UserCreate) -> UserInDB:
        """Alta directa: la cuenta se crea con una contraseña inicial aleatoria e inutilizable
        -- el admin genera y comparte un enlace de restablecimiento (mismo botón que para
        cualquier otro usuario) para que la persona fije su propia contraseña."""
        if await self.user_repo.email_exists(user_data.email):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

        placeholder_hash = hash_password(secrets.token_urlsafe(24))
        return await self.user_repo.create_with_password(user_data, placeholder_hash)

    async def send_password_reset(self, user_id: str) -> str:
        """Genera un enlace de restablecimiento de un solo uso (24h) -- nunca se ve/gestiona
        una contraseña en claro, ni siquiera el admin la ve."""
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        token, token_hash = generate_reset_token()
        await self.user_repo.set_reset_token(user_id, token_hash, reset_token_expiry())
        return f"{settings.frontend_base_url}/reset-password?token={token}"

    async def update_student(self, user_id: str, update: UserUpdate) -> dict:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return await self.user_repo.update_fields(user_id, update)

    async def set_revoked(self, user_id: str, revoked: bool) -> dict:
        """Revocar nunca borra la cuenta ni el doc de roster -- si se borrara, el email
        quedaría huérfano en "ya en uso" sin ningún documento que lo gestione."""
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return await self.user_repo.set_revoked(user_id, revoked)
