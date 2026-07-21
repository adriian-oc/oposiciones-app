from repositories.document_submission_repository import DocumentSubmissionRepository
from repositories.user_repository import UserRepository
from services.notification_service import NotificationService
from services.storage_service import StorageService
from models.document_submission import DocumentSubmissionInDB
from fastapi import HTTPException, status, UploadFile
from typing import List, Optional
import uuid
import logging

logger = logging.getLogger(__name__)


class DocumentSubmissionService:
    def __init__(self):
        self.repo = DocumentSubmissionRepository()
        self.user_repo = UserRepository()
        self.notification_service = NotificationService()
        self.storage = StorageService()

    async def submit(self, area_id: str, theme_id: str, file: UploadFile, uploaded_by: str) -> dict:
        if file.content_type != "application/pdf":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se admiten archivos PDF")

        stored_name = f"{uuid.uuid4()}.pdf"
        content = await file.read()
        file_path = self.storage.save("documents", stored_name, content, file.content_type)

        doc = DocumentSubmissionInDB(
            area_id=area_id,
            theme_id=theme_id,
            uploaded_by=uploaded_by,
            file_path=file_path,
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
