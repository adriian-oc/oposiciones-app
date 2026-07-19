from fastapi import APIRouter, Depends, Query

from models.study_calendar import StudyPreferencesUpdate, StudyCalendarEntryResponse
from services.study_calendar_service import StudyCalendarService
from middleware.auth import require_role, get_current_user
from utils.staff_access import check_can_view_student

router = APIRouter(prefix="/api/study-calendar", tags=["study-calendar"])


def get_service():
    return StudyCalendarService()


@router.get("/preferences")
async def get_preferences(current_user: dict = Depends(require_role(["student"]))):
    return await get_service().get_preferences(current_user["id"])


@router.put("/preferences")
async def set_preferences(
    update: StudyPreferencesUpdate,
    current_user: dict = Depends(require_role(["student"])),
):
    """Guarda las horas disponibles por día y regenera el calendario en el mismo acto."""
    return await get_service().set_preferences(current_user["id"], update)


@router.get("/", response_model=list[StudyCalendarEntryResponse])
async def get_calendar(
    days: int = Query(14, ge=1, le=60),
    current_user: dict = Depends(require_role(["student"])),
):
    return await get_service().get_calendar(current_user["id"], days)


@router.post("/regenerate")
async def regenerate_calendar(current_user: dict = Depends(require_role(["student"]))):
    count = await get_service().regenerate_calendar(current_user["id"])
    return {"entries_created": count}


@router.post("/entries/{entry_id}/complete")
async def complete_entry(
    entry_id: str,
    current_user: dict = Depends(require_role(["student"])),
):
    return await get_service().complete_entry(entry_id, current_user["id"])


@router.get("/{user_id}", response_model=list[StudyCalendarEntryResponse])
async def get_calendar_for_student(
    user_id: str,
    days: int = Query(14, ge=1, le=60),
    current_user: dict = Depends(get_current_user),
):
    """Vista de solo lectura del calendario de un alumno para admin/profesor -- sin
    preferencias/regenerar/completar, igual que Mi Progreso ajeno."""
    await check_can_view_student(user_id, current_user)
    return await get_service().get_calendar(user_id, days)
