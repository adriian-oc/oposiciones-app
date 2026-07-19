import logging

from fastapi import HTTPException, status

from models.message import MessageCreate, MessageInDB
from repositories.message_repository import MessageRepository
from repositories.user_repository import UserRepository
from services.email_service import EmailService

logger = logging.getLogger(__name__)


class MessageService:
    def __init__(self):
        self.message_repo = MessageRepository()
        self.user_repo = UserRepository()
        self.email_service = EmailService()

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

        # Aviso por email solo cuando escribe staff (profesor/admin) al alumno -- si el alumno
        # escribe a su profesor, no hay bandeja de entrada de staff que avisar por email todavía.
        # Best-effort: un fallo de envío no debe tumbar el guardado del mensaje.
        if current_user["role"] in ("admin", "profesor"):
            try:
                student = await self.user_repo.get_by_id(student_id)
                if student and student.get("email"):
                    self.email_service.send_new_message_notice(
                        to_email=student["email"],
                        to_name=student.get("display_name") or student["email"],
                        sender_name=current_user.get("display_name") or "tu profesor",
                    )
            except Exception as e:
                logger.error(f"Fallo al avisar por email del mensaje nuevo a {student_id}: {e}")

        return created.model_dump()
