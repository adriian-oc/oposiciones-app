from repositories.document_submission_repository import DocumentSubmissionRepository
from repositories.user_repository import UserRepository
from services.notification_service import NotificationService
from models.document_submission import DocumentSubmissionInDB
from fastapi import HTTPException, status, UploadFile
from pathlib import Path
from typing import List, Optional
import uuid
import logging

logger = logging.getLogger(__name__)

# Almacenamiento en disco local -- solución de DESARROLLO, no definitiva. El disco del backend
# no es persistente ni se comparte con el frontend en un despliegue real (Render/Railway +
# Vercel/Netlify, Fase 8); antes de desplegar en serio hace falta un storage real
# (S3-compatible, Firebase Storage, Cloudinary...) y migrar file_path a una URL absoluta.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "documents"


class DocumentSubmissionService:
    def __init__(self):
        self.repo = DocumentSubmissionRepository()
        self.user_repo = UserRepository()
        self.notification_service = NotificationService()

    async def submit(self, area_id: str, theme_id: str, file: UploadFile, uploaded_by: str) -> dict:
        if file.content_type != "application/pdf":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se admiten archivos PDF")

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4()}.pdf"
        content = await file.read()
        (UPLOAD_DIR / stored_name).write_bytes(content)

        doc = DocumentSubmissionInDB(
            area_id=area_id,
            theme_id=theme_id,
            uploaded_by=uploaded_by,
            file_path=f"documents/{stored_name}",
            original_filename=file.filename or stored_name,
        )
        created = await self.repo.create(doc)

        uploader = await self.user_repo.get_by_id(uploaded_by)
        uploader_name = (uploader or {}).get("display_name") or "Un profesor"
        await self.notification_service.notify_admins(
            "document_pending",
            "Documento pendiente de aprobación",
            f"{uploader_name} ha subido \"{created.original_filename}\" para revisar.",
            "/admin",
        )

        return created.model_dump()

    async def list_pending(self) -> List[dict]:
        return await self.repo.list_by_status("pending")

    async def list_mine(self, uploaded_by: str) -> List[dict]:
        return await self.repo.list_by_uploader(uploaded_by)

    async def review(self, doc_id: str, new_status: str, reviewed_by: str) -> dict:
        if new_status not in ("approved", "rejected"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Estado no válido")
        existing = await self.repo.get_by_id(doc_id)
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
        updated = await self.repo.update_status(doc_id, new_status, reviewed_by)
        return updated

    async def list_approved_for_student(self, student_id: str) -> List[dict]:
        """Documentos aprobados del profesor asignado al alumno -- según lo acordado, solo los
        alumnos de ese profesor (y el admin) ven sus documentos, no todo alumno con acceso al
        tema (a diferencia del resto de content_units)."""
        student = await self.user_repo.get_by_id(student_id)
        profesor_id = student.get("assigned_profesor_id") if student else None
        if not profesor_id:
            return []
        return await self.repo.list_approved_by_uploader(profesor_id)
