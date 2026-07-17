import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from models.user import UserCreate, UserInDB, UserUpdate
from repositories.user_repository import UserRepository
from repositories.progress_repository import ProgressRepository
from services.firebase_service import create_firebase_user, delete_firebase_user, generate_password_reset_link

logger = logging.getLogger(__name__)


def _has_novedades(user: dict, progress: dict, staff_id: str) -> bool:
    """Compara progress.updated_at contra la última vez que ESTE miembro del staff revisó a
    este alumno (user.last_reviewed_by[staff_id]) -- port directo de la lógica de badge
    '🆕 Novedades' de ADOC."""
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

    def list_students(self, viewer_staff_id: str = None):
        students = self.user_repo.list_all()
        if viewer_staff_id:
            for s in students:
                if s.get("role") == "student":
                    progress = self.progress_repo.get_by_user(s["id"])
                    s["has_novedades"] = _has_novedades(s, progress, viewer_staff_id)
        return students

    def mark_reviewed(self, student_id: str, staff_id: str, is_admin: bool = False) -> None:
        user = self.user_repo.get_by_id(student_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not is_admin and user.get("assigned_profesor_id") != staff_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        self.user_repo.mark_reviewed_by(student_id, staff_id, datetime.now(timezone.utc))

    def create_student(self, user_data: UserCreate) -> UserInDB:
        """Alta directa (equivalente al workaround de app secundaria de Firebase en ADOC,
        ya innecesario porque el Admin SDK crea usuarios sin robar la sesión del admin)."""
        if self.user_repo.email_exists(user_data.email):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

        firebase_user = create_firebase_user(user_data.email, user_data.display_name)
        try:
            user = self.user_repo.create_from_firebase(user_data, firebase_user.uid)
        except Exception:
            # si Mongo falla, no dejar un usuario de Firebase huérfano sin roster
            delete_firebase_user(firebase_user.uid)
            raise
        return user

    def send_password_reset(self, email: str) -> str:
        """Nunca se ve/gestiona una contraseña en claro -- mismo comportamiento que ADOC."""
        return generate_password_reset_link(email)

    def update_student(self, user_id: str, update: UserUpdate) -> dict:
        user = self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return self.user_repo.update_fields(user_id, update)

    def set_revoked(self, user_id: str, revoked: bool) -> dict:
        """Revocar nunca borra la cuenta de Firebase Auth ni el doc de roster (evitaría
        dejar el email huérfano en 'ya en uso' sin doc que lo gestione) -- mismo diseño que ADOC."""
        user = self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return self.user_repo.set_revoked(user_id, revoked)
