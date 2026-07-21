from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from models.draft_question import (
    DraftQuestionCreate,
    DraftQuestionResponse,
    DraftQuestionUpdate,
    PublishDraftQuestionsRequest,
    PublishDraftQuestionsResponse,
)
from services.draft_question_service import DraftQuestionService
from middleware.auth import require_role

router = APIRouter(prefix="/api/draft-questions", tags=["draft-questions"])

# Banco de preguntas generadas pero sin publicar (novedad de temario): admin y profesor pueden
# revisarlas, editarlas y lanzarlas como cuadernillo o supuesto -- a diferencia del resto de
# gestión de preguntas/practical_sets (solo admin/curator), aquí profesor sí participa porque el
# usuario pidió explícitamente que ambos roles puedan elegir cómo publicarlas.
ALLOWED_ROLES = ["admin", "profesor"]


def get_service():
    return DraftQuestionService()


@router.get("/", response_model=List[DraftQuestionResponse])
async def list_drafts(
    theme_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(ALLOWED_ROLES)),
):
    return await get_service().list_drafts(theme_id=theme_id)


@router.post("/", response_model=DraftQuestionResponse, status_code=201)
async def create_draft(
    data: DraftQuestionCreate,
    current_user: dict = Depends(require_role(ALLOWED_ROLES)),
):
    return await get_service().create_draft(data, current_user["id"])


@router.patch("/{draft_id}", response_model=DraftQuestionResponse)
async def update_draft(
    draft_id: str,
    data: DraftQuestionUpdate,
    current_user: dict = Depends(require_role(ALLOWED_ROLES)),
):
    return await get_service().update_draft(draft_id, data)


@router.delete("/{draft_id}", status_code=204)
async def delete_draft(
    draft_id: str,
    current_user: dict = Depends(require_role(ALLOWED_ROLES)),
):
    await get_service().delete_draft(draft_id)


@router.post("/publish", response_model=PublishDraftQuestionsResponse)
async def publish_drafts(
    data: PublishDraftQuestionsRequest,
    current_user: dict = Depends(require_role(ALLOWED_ROLES)),
):
    return await get_service().publish(
        question_ids=data.question_ids,
        theme_id=data.theme_id,
        target=data.target,
        title=data.title,
        description=data.description,
        user_id=current_user["id"],
    )
