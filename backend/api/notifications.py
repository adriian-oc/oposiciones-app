from fastapi import APIRouter, Depends, Query
from typing import List

from models.notification import NotificationResponse
from services.notification_service import NotificationService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_notification_service():
    return NotificationService()


@router.get("/unread", response_model=List[NotificationResponse])
async def get_unread(current_user: dict = Depends(get_current_user)):
    return await get_notification_service().get_unread(current_user["id"])


@router.get("/recent", response_model=List[NotificationResponse])
async def get_recent(limit: int = Query(50, ge=1, le=200), current_user: dict = Depends(get_current_user)):
    """Últimas notificaciones sean o no leídas -- panel de comunicaciones a página completa y
    relleno del desplegable de la campanita (ver NotificationRepository.get_recent)."""
    return await get_notification_service().get_recent(current_user["id"], limit)


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await get_notification_service().mark_read(notification_id, current_user["id"])
    return {"message": "ok"}
