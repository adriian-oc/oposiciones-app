import uuid

from fastapi import HTTPException, UploadFile, status

from services.storage_service import StorageService

MAX_BYTES = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
}


class ChatAttachmentService:
    def __init__(self):
        self.storage = StorageService()

    async def upload(self, file: UploadFile) -> dict:
        extension = ALLOWED_CONTENT_TYPES.get(file.content_type)
        if not extension:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Tipo de archivo no admitido -- solo imágenes (jpg, png, webp, gif) o "
                "documentos (pdf, doc, docx, xls, xlsx, txt)",
            )

        content = await file.read()
        if len(content) > MAX_BYTES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo no puede superar los 15 MB")

        stored_name = f"{uuid.uuid4()}.{extension}"
        attachment_path = self.storage.save("chat", stored_name, content, file.content_type)

        return {
            "attachment_path": attachment_path,
            "attachment_name": file.filename or stored_name,
            "attachment_type": "image" if file.content_type.startswith("image/") else "file",
        }
