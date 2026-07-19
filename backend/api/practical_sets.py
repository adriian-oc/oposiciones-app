from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from pydantic import BaseModel
from models.practical_set import (
    PracticalSetCreate, PracticalSetResponse, PracticalSetDetailResponse
)
from services.practical_set_service import PracticalSetService
from middleware.auth import get_current_user, require_role


class PracticalSetQuestionUpdate(BaseModel):
    text: Optional[str] = None
    choices: Optional[List[str]] = None
    correct_answer: Optional[int] = None


class PracticalSetQuestionAdd(BaseModel):
    text: str
    choices: List[str]
    correct_answer: int
    case_position: Optional[int] = None

router = APIRouter(prefix="/api/practical-sets", tags=["practical-sets"])

def get_practical_set_service():
    return PracticalSetService()

@router.post("/", response_model=PracticalSetResponse, status_code=status.HTTP_201_CREATED)
async def create_practical_set(
    practical_set_data: PracticalSetCreate,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Create a new practical set (admin/curator only)"""
    service = get_practical_set_service()
    practical_set = await service.create_practical_set(practical_set_data, current_user["id"])
    return PracticalSetResponse(**practical_set)

@router.get("/", response_model=List[PracticalSetResponse])
async def get_practical_sets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all practical sets (summary)"""
    service = get_practical_set_service()
    practical_sets = await service.get_all_practical_sets(skip, limit)
    return [PracticalSetResponse(**ps) for ps in practical_sets]

@router.get("/by-theme/{theme_id}", response_model=List[PracticalSetResponse])
async def get_practical_sets_by_theme(
    theme_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get practical sets by theme"""
    service = get_practical_set_service()
    practical_sets = await service.get_by_theme(theme_id)
    return [PracticalSetResponse(**ps) for ps in practical_sets]

@router.get("/{practical_set_id}", response_model=PracticalSetDetailResponse)
async def get_practical_set(
    practical_set_id: str,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Get practical set details with all questions, incluyendo correct_answer -- restringido a
    admin/curator porque expone las respuestas correctas sin filtrar (ver hallazgo de seguridad
    de la ronda 5). El único consumidor previsto es el árbol de edición de Gestionar Preguntas;
    el flujo de examen del alumno no lo usa (lee el practical_set vía repositorio en
    ExamService.start_practice, no por este endpoint HTTP)."""
    service = get_practical_set_service()
    practical_set = await service.get_practical_set(practical_set_id)
    return PracticalSetDetailResponse(**practical_set)

@router.get("/random/one", response_model=PracticalSetDetailResponse)
async def get_random_practical_set(
    current_user: dict = Depends(get_current_user)
):
    """Get a random practical set for exam"""
    service = get_practical_set_service()
    practical_set = await service.get_random_practical_set()
    return PracticalSetDetailResponse(**practical_set)

@router.delete("/{practical_set_id}")
async def delete_practical_set(
    practical_set_id: str,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Delete a practical set (admin/curator only)"""
    service = get_practical_set_service()
    success = await service.delete_practical_set(practical_set_id)
    return {"message": "Practical set deleted successfully", "success": success}


@router.put("/{practical_set_id}/questions/{question_id}")
async def update_practical_set_question(
    practical_set_id: str,
    question_id: str,
    data: PracticalSetQuestionUpdate,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Editar una pregunta embebida de un Cuadernillo/Supuesto (árbol de Gestionar Preguntas)"""
    service = get_practical_set_service()
    return await service.update_question(
        practical_set_id, question_id, data.model_dump(exclude_unset=True)
    )


@router.post("/{practical_set_id}/questions", status_code=status.HTTP_201_CREATED)
async def add_practical_set_question(
    practical_set_id: str,
    data: PracticalSetQuestionAdd,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Añadir una pregunta nueva a un Cuadernillo/Supuesto ya existente"""
    service = get_practical_set_service()
    payload = data.model_dump(exclude={"case_position"})
    return await service.add_question(practical_set_id, payload, data.case_position)


@router.delete("/{practical_set_id}/questions/{question_id}")
async def delete_practical_set_question(
    practical_set_id: str,
    question_id: str,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Borrar una pregunta embebida de un Cuadernillo/Supuesto"""
    service = get_practical_set_service()
    await service.delete_question(practical_set_id, question_id)
    return {"message": "Question deleted successfully"}
