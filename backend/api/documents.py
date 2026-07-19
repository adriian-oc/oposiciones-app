from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from typing import List
from models.document_submission import DocumentSubmissionResponse, DocumentSubmissionStatusUpdate
from services.document_submission_service import DocumentSubmissionService
from middleware.auth import require_role

router = APIRouter(prefix="/api/documents", tags=["documents"])


def get_service():
    return DocumentSubmissionService()


@router.post("/", response_model=DocumentSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_document(
    area_id: str = Form(...),
    theme_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["profesor"])),
):
    """Un profesor sube un PDF para un tema, queda pendiente de aprobación de un admin."""
    return await get_service().submit(area_id, theme_id, file, current_user["id"])


@router.get("/pending", response_model=List[DocumentSubmissionResponse])
async def list_pending_documents(current_user: dict = Depends(require_role(["admin"]))):
    return await get_service().list_pending()


@router.get("/mine", response_model=List[DocumentSubmissionResponse])
async def list_my_documents(current_user: dict = Depends(require_role(["profesor"]))):
    return await get_service().list_mine(current_user["id"])


@router.get("/approved-mine", response_model=List[DocumentSubmissionResponse])
async def list_my_approved_documents(current_user: dict = Depends(require_role(["student"]))):
    """Todos los documentos aprobados del profesor asignado al alumno, de una sola vez -- evita
    una petición por tema desde Cuadernos.js."""
    return await get_service().list_approved_for_student(current_user["id"])


@router.patch("/{doc_id}", response_model=DocumentSubmissionResponse)
async def review_document(
    doc_id: str,
    update: DocumentSubmissionStatusUpdate,
    current_user: dict = Depends(require_role(["admin"])),
):
    return await get_service().review(doc_id, update.status, current_user["id"])
