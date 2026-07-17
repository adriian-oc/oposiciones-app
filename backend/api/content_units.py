from fastapi import APIRouter, Depends, Query
from typing import List

from models.content_unit import ContentUnitResponse
from services.content_unit_service import ContentUnitService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/content-units", tags=["content-units"])


@router.get("/", response_model=List[ContentUnitResponse])
async def get_content_units(
    area_id: str = Query(..., description="Id de CONTENT_AREAS: tesp, esq, tgen, ttesp, ttgen..."),
    current_user: dict = Depends(get_current_user),
):
    """Unidades de contenido no interactivas (PDF descargable o 'Próximamente') de un área."""
    return ContentUnitService().get_by_area(area_id)
