import asyncio
import logging
from datetime import datetime

from fastapi import HTTPException, status

from config.settings import settings
from models.message import MessageCreate, MessageInDB
from repositories.message_repository import MessageRepository
from repositories.user_repository import UserRepository
from services.email_service import EmailService

logger = logging.getLogger(__name__)

# Ventana de agrupación de avisos por email: si llegan varios mensajes al mismo hilo en menos de
# 5 minutos, se manda un único correo con todos en vez de uno por mensaje. Vive a nivel de módulo
# (no en la instancia, MessageService se crea de nuevo en cada request) -- best-effort como el
# resto del pipeline de email: si el proceso se reinicia a media ventana, se pierde el
# agrupamiento pendiente, como mucho se manda algún correo de más.
DIGEST_WINDOW_SECONDS = 300
_pending_digest_tasks: dict = {}


class MessageService:
    def __init__(self):
        self.message_repo = MessageRepository()
        self.user_repo = UserRepository()
        self.email_service = EmailService()

    async def _authorize(self, current_user: dict, student_id: str) -> None:
        """Dueño del hilo (ve/escribe siempre el suyo), profesor solo el de sus alumnos
        asignados, admin cualquiera -- incluidos los hilos admin↔profesor, ver MessageInDB."""
        role = current_user["role"]
        if role == "admin":
            return
        if current_user["id"] == student_id:
            return
        if role == "profesor":
            owner = await self.user_repo.get_by_id(student_id)
            if owner and owner.get("role") == "student" and owner.get("assigned_profesor_id") == current_user["id"]:
                return
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

    async def get_thread(self, student_id: str, current_user: dict) -> list:
        await self._authorize(current_user, student_id)
        thread = await self.message_repo.get_thread(student_id)
        await self.message_repo.mark_read(current_user["id"], student_id, datetime.utcnow())
        return thread

    async def _relevant_thread_ids(self, current_user: dict) -> list:
        """Hilos que le tocan a este usuario -- alumno el suyo, profesor el suyo (con admin) más
        el de sus alumnos asignados, admin el de todos los alumnos y todos los profesores."""
        role = current_user["role"]
        if role == "student":
            return [current_user["id"]]
        users = await self.user_repo.list_all()
        if role == "profesor":
            return [current_user["id"]] + [
                u["id"] for u in users
                if u.get("role") == "student" and u.get("assigned_profesor_id") == current_user["id"]
            ]
        if role == "admin":
            return [u["id"] for u in users if u.get("role") in ("student", "profesor")]
        return []

    async def _unread_messages(self, current_user: dict) -> list:
        """Último mensaje de cada hilo relevante que el usuario todavía no ha leído."""
        thread_ids = await self._relevant_thread_ids(current_user)
        unread = []
        for thread_id in thread_ids:
            last_message = await self.message_repo.get_last_message(thread_id)
            if not last_message or last_message["sender_id"] == current_user["id"]:
                continue
            read = await self.message_repo.get_read(current_user["id"], thread_id)
            if not read or last_message["created_at"] > read["last_read_at"]:
                unread.append(last_message)
        return unread

    async def has_unread(self, current_user: dict) -> bool:
        """Para el punto rojo del icono de notificaciones."""
        return bool(await self._unread_messages(current_user))

    def _counterpart(self, thread_owner_id: str, current_user: dict, users_by_id: dict) -> dict:
        """'Con quién se habla' en un hilo, para el header del chat y la barra de contactos --
        distinto de 'quién soy yo dentro del hilo': un alumno mirando su propio hilo (thread_owner
        == current_user) ve a su profesor, no a sí mismo; un profesor mirando el suyo ve
        'Administración' (cualquier admin puede responder, no hay uno fijo, ver _authorize)."""
        if thread_owner_id == current_user["id"]:
            if current_user["role"] == "student":
                profesor_id = current_user.get("assigned_profesor_id")
                profesor = users_by_id.get(profesor_id) if profesor_id else None
                return {
                    "id": profesor_id,
                    "display_name": (profesor or {}).get("display_name") or "Administración",
                    "role": "profesor" if profesor else "admin",
                }
            return {"id": None, "display_name": "Administración", "role": "admin"}
        owner = users_by_id.get(thread_owner_id) or {}
        return {
            "id": thread_owner_id,
            "display_name": owner.get("display_name") or "Usuario",
            "role": owner.get("role"),
        }

    async def get_thread_counterpart(self, student_id: str, current_user: dict) -> dict:
        await self._authorize(current_user, student_id)
        users_by_id = {u["id"]: u for u in await self.user_repo.list_all()}
        return self._counterpart(student_id, current_user, users_by_id)

    async def list_threads(self, current_user: dict) -> list:
        """Barra de contactos: un hilo por cada thread_id relevante que ya tenga al menos un
        mensaje (los que todavía no han hablado no aportan nada a una lista de conversaciones)."""
        thread_ids = await self._relevant_thread_ids(current_user)
        users_by_id = {u["id"]: u for u in await self.user_repo.list_all()}
        threads = []
        for thread_id in thread_ids:
            last_message = await self.message_repo.get_last_message(thread_id)
            if not last_message:
                continue
            read = await self.message_repo.get_read(current_user["id"], thread_id)
            unread = (
                last_message["sender_id"] != current_user["id"]
                and (not read or last_message["created_at"] > read["last_read_at"])
            )
            counterpart = self._counterpart(thread_id, current_user, users_by_id)
            threads.append({
                "student_id": thread_id,
                "display_name": counterpart["display_name"],
                "last_message_text": last_message["text"],
                "last_message_at": last_message["created_at"],
                "unread": unread,
            })
        threads.sort(key=lambda t: t["last_message_at"], reverse=True)
        return threads

    async def get_unread_threads(self, current_user: dict) -> list:
        """Para el desplegable de notificaciones: "el otro" del hilo es el dueño (student_id) si
        no es uno mismo (caso normal: alumno o profesor asignado escribiendo), o si no, quien
        escribió (sender_id) -- caso de un hilo del que uno mismo es el dueño, p.ej. el hilo de
        un profesor con administración."""
        messages = await self._unread_messages(current_user)
        if not messages:
            return []
        other_ids = {
            (m["student_id"] if m["student_id"] != current_user["id"] else m["sender_id"])
            for m in messages
        }
        others = {u["id"]: u for u in await self.user_repo.list_all() if u["id"] in other_ids}
        threads = []
        for m in messages:
            other_id = m["student_id"] if m["student_id"] != current_user["id"] else m["sender_id"]
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

        # Aviso por email agrupado (ver DIGEST_WINDOW_SECONDS) solo cuando escribe staff a un
        # hilo que no es el suyo propio -- si el alumno escribe a su profesor, o un profesor
        # responde en su propio hilo con administración, no hay bandeja de staff que avisar
        # por email todavía.
        if current_user["role"] in ("admin", "profesor") and current_user["id"] != student_id:
            self._schedule_digest_email(student_id, created.created_at)

        return created.model_dump()

    def _schedule_digest_email(self, thread_owner_id: str, window_start: datetime) -> None:
        """Si ya hay un aviso agrupado en marcha para este hilo, no se lanza otro -- el que ya
        está en marcha recoge también este mensaje al disparar, porque consulta los mensajes
        reales en el momento de enviar, no los que había al programarse."""
        if thread_owner_id in _pending_digest_tasks:
            return
        task = asyncio.create_task(self._send_digest_after_delay(thread_owner_id, window_start))
        _pending_digest_tasks[thread_owner_id] = task

    async def _send_digest_after_delay(self, thread_owner_id: str, window_start: datetime) -> None:
        try:
            await asyncio.sleep(DIGEST_WINDOW_SECONDS)
            owner = await self.user_repo.get_by_id(thread_owner_id)
            if not owner or not owner.get("email"):
                return
            thread = await self.message_repo.get_thread(thread_owner_id)
            new_messages = [
                m for m in thread
                if m["created_at"] >= window_start and m["sender_id"] != thread_owner_id
            ]
            if not new_messages:
                return
            sender_ids = {m["sender_id"] for m in new_messages}
            users_by_id = {u["id"]: u for u in await self.user_repo.list_all()}
            sender_names = sorted({
                (users_by_id.get(sid) or {}).get("display_name") or "tu profesor" for sid in sender_ids
            })
            # El alumno lee sus mensajes en /chat; el profesor, en el hilo con administración de
            # /profesor/chat/<su propio id> (mismo hilo que ve el admin desde el roster).
            chat_link = (
                f"{settings.frontend_base_url}/chat"
                if owner.get("role") == "student"
                else f"{settings.frontend_base_url}/profesor/chat/{thread_owner_id}"
            )
            self.email_service.send_new_message_notice(
                to_email=owner["email"],
                to_name=owner.get("display_name") or owner["email"],
                sender_name=", ".join(sender_names),
                chat_link=chat_link,
                count=len(new_messages),
            )
        except Exception as e:
            logger.error(f"Fallo al enviar el aviso agrupado de mensajes a {thread_owner_id}: {e}")
        finally:
            _pending_digest_tasks.pop(thread_owner_id, None)
