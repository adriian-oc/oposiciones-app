from fastapi import HTTPException, status

from models.message import MessageCreate, MessageInDB
from repositories.message_repository import MessageRepository
from repositories.user_repository import UserRepository


class MessageService:
    def __init__(self):
        self.message_repo = MessageRepository()
        self.user_repo = UserRepository()

    async def _authorize(self, current_user: dict, student_id: str) -> None:
        """El alumno solo ve/escribe su propio hilo; el profesor solo el de sus alumnos
        asignados; el admin, cualquiera."""
        role = current_user["role"]
        if role == "admin":
            return
        if role == "student":
            if current_user["id"] != student_id:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
            return
        if role == "profesor":
            student = await self.user_repo.get_by_id(student_id)
            if not student or student.get("assigned_profesor_id") != current_user["id"]:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
            return
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

    async def get_thread(self, student_id: str, current_user: dict) -> list:
        await self._authorize(current_user, student_id)
        return await self.message_repo.get_thread(student_id)

    async def send_message(self, student_id: str, data: MessageCreate, current_user: dict) -> dict:
        await self._authorize(current_user, student_id)
        message = MessageInDB(student_id=student_id, sender_id=current_user["id"], text=data.text)
        created = await self.message_repo.create(message)
        return created.model_dump()
