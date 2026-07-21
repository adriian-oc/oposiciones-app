import uuid

from fastapi import HTTPException, UploadFile, status

from repositories.user_repository import UserRepository
from services.storage_service import StorageService

MAX_BYTES = 5 * 1024 * 1024
CONTENT_TYPE_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class AvatarService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.storage = StorageService()

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

        stored_name = f"{uuid.uuid4()}.{extension}"
        avatar_path = self.storage.save("avatars", stored_name, content, file.content_type)

        previous = user.get("avatar_path")
        await self.user_repo.set_avatar_path(user_id, avatar_path)
        if previous:
            self.storage.delete(previous)

        return await self.user_repo.get_by_id(user_id)
