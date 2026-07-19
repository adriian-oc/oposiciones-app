from fastapi import APIRouter, Depends

from services.progress_service import ProgressService
from services.exam_service import ExamService
from middleware.auth import get_current_user
from utils.staff_access import check_can_view_student

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/me")
async def get_my_progress(current_user: dict = Depends(get_current_user)):
    service = ProgressService()
    progress = await service.get_progress(current_user["id"])
    progress["summary"] = await service.get_summary(current_user["id"])
    return progress


@router.get("/{user_id}")
async def get_user_progress(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["id"]:
        await check_can_view_student(user_id, current_user)
    service = ProgressService()
    progress = await service.get_progress(user_id)
    progress["summary"] = await service.get_summary(user_id)
    return progress


@router.get("/{user_id}/history/{content_unit_key}")
async def get_user_practice_history(
    user_id: str,
    content_unit_key: str,
    current_user: dict = Depends(get_current_user),
):
    if user_id != current_user["id"]:
        await check_can_view_student(user_id, current_user)
    return await ExamService().get_practice_history(user_id, content_unit_key)
