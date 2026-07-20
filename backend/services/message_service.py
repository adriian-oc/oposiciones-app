import logging
from datetime import datetime

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
        thread = await self.message_repo.get_thread(student_id)
        await self.message_repo.mark_read(current_user["id"], student_id, datetime.utcnow())
        return thread

    async def _unread_messages(self, current_user: dict) -> list:
        """Último mensaje de cada hilo relevante que el usuario todavía no ha leído -- alumno
        mira su propio hilo, profesor los de sus alumnos asignados, admin los de todos."""
        role = current_user["role"]
        if role == "student":
            student_ids = [current_user["id"]]
        elif role in ("profesor", "admin"):
            students = await self.user_repo.list_all()
            student_ids = [
                s["id"] for s in students
                if s.get("role") == "student"
                and (role == "admin" or s.get("assigned_profesor_id") == current_user["id"])
            ]
        else:
            return []

        unread = []
        for student_id in student_ids:
            last_message = await self.message_repo.get_last_message(student_id)
            if not last_message or last_message["sender_id"] == current_user["id"]:
                continue
            read = await self.message_repo.get_read(current_user["id"], student_id)
            if not read or last_message["created_at"] > read["last_read_at"]:
                unread.append(last_message)
        return unread

    async def has_unread(self, current_user: dict) -> bool:
        """Para el punto rojo del icono de notificaciones."""
        return bool(await self._unread_messages(current_user))

    async def get_unread_threads(self, current_user: dict) -> list:
        """Para el desplegable de notificaciones: un alumno ve quién le escribió (su profesor o
        admin), un profesor/admin ve qué alumno escribió -- en ambos casos "el otro" del hilo,
        no necesariamente el remitente del último mensaje visto desde el propio punto de vista."""
        messages = await self._unread_messages(current_user)
        if not messages:
            return []
        role = current_user["role"]
        other_ids = {(m["sender_id"] if role == "student" else m["student_id"]) for m in messages}
        others = {u["id"]: u for u in await self.user_repo.list_all() if u["id"] in other_ids}
        threads = []
        for m in messages:
            other_id = m["sender_id"] if role == "student" else m["student_id"]
            other = others.get(other_id)
            threads.append({
                "student_id": m["student_id"],
                "display_name": (other or {}).get("display_name") or "Mensaje nuevo",
                "last_message_at": m["created_at"],
            })
        threads.sort(key=lambda t: t["last_message_at"], reverse=True)
        return threads

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
