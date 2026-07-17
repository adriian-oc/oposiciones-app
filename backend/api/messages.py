from fastapi import APIRouter, Depends, status
from typing import List

from models.message import MessageCreate, MessageResponse
from services.message_service import MessageService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


def get_message_service():
    return MessageService()


@router.get("/{student_id}", response_model=List[MessageResponse])
async def get_thread(student_id: str, current_user: dict = Depends(get_current_user)):
    return get_message_service().get_thread(student_id, current_user)


@router.post("/{student_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    student_id: str,
    data: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    return get_message_service().send_message(student_id, data, current_user)
