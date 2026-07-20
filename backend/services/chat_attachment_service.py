import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

# Mismo patrón y misma limitación de disco local (no persistente en un despliegue real) que
# avatar_service.py / document_submission_service.py -- ver aviso ahí.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "chat"
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

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4()}.{extension}"
        (UPLOAD_DIR / stored_name).write_bytes(content)

        return {
            "attachment_path": f"chat/{stored_name}",
            "attachment_name": file.filename or stored_name,
            "attachment_type": "image" if file.content_type.startswith("image/") else "file",
        }
