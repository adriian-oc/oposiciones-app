import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

# Mismo patrón y misma limitación de disco local (no persistente en un despliegue real) que
# document_submission_service.py -- ver aviso ahí.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "avatars"
MAX_BYTES = 5 * 1024 * 1024
CONTENT_TYPE_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class AvatarService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def upload(self, user_id: str, file: UploadFile) -> dict:
        extension = CONTENT_TYPE_EXTENSIONS.get(file.content_type)
        if not extension:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se admiten imágenes JPG, PNG o WEBP")

        content = await file.read()
        if len(content) > MAX_BYTES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "La imagen no puede superar los 5 MB")

        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4()}.{extension}"
        (UPLOAD_DIR / stored_name).write_bytes(content)

        previous = user.get("avatar_path")
        avatar_path = f"avatars/{stored_name}"
        await self.user_repo.set_avatar_path(user_id, avatar_path)

        if previous:
            try:
                (UPLOAD_DIR.parent / previous).unlink(missing_ok=True)
            except OSError as e:
                logger.warning(f"No se pudo borrar el avatar anterior de {user_id}: {e}")

        return await self.user_repo.get_by_id(user_id)
