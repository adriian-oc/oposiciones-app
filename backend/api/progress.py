from fastapi import APIRouter, Depends

from services.progress_service import ProgressService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/me")
async def get_my_progress(current_user: dict = Depends(get_current_user)):
    return await ProgressService().get_progress(current_user["id"])
