import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from config.settings import settings
from models.message import MessageInDB
from models.user import UserCreate, UserInDB, UserUpdate
from repositories.message_repository import MessageRepository
from repositories.user_repository import UserRepository
from repositories.progress_repository import ProgressRepository
from services.auth_service import hash_password, generate_reset_token, reset_token_expiry
from services.email_service import EmailService
from services.notification_service import NotificationService

logger = logging.getLogger(__name__)

# Campos que un profesor puede tocar sobre sus alumnos PROPIOS vía PATCH /students/{id} --
# allowlist a propósito (no blocklist): cualquier campo nuevo que se añada a UserUpdate en el
# futuro queda fuera para un profesor hasta que se decida explícitamente lo contrario, en vez de
# quedar expuesto por descuido. role/assigned_profesor_id/linked_user_id/revoked/student_type
# siguen siendo solo-admin incluso para alumnos propios (crear cuenta, cambiar rol, reasignar
# profesor y marcar propio/centro no entran en "gestionar mis alumnos").
PROFESOR_EDITABLE_FIELDS = {"allowed_content", "payment_type", "payments_received", "expires_at"}


def _has_novedades(user: dict, progress: dict, staff_id: str) -> bool:
    """Compara progress.updated_at contra la última vez que ESTE miembro del staff revisó a
    este alumno (user.last_reviewed_by[staff_id]): si nunca lo revisó, o si el progreso se
    actualizó después de esa última revisión, hay actividad nueva que mostrar."""
    if not progress or not progress.get("updated_at"):
        return False
    last_reviewed = (user.get("last_reviewed_by") or {}).get(staff_id)
    if last_reviewed is None:
        return True
    updated_at = progress["updated_at"]
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    if isinstance(last_reviewed, str):
        last_reviewed = datetime.fromisoformat(last_reviewed)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    if last_reviewed.tzinfo is None:
        last_reviewed = last_reviewed.replace(tzinfo=timezone.utc)
    return updated_at > last_reviewed


def _describe_new_access(old_allowed, new_allowed) -> str | None:
    """Compara el allowed_content anterior contra el nuevo y describe qué se AÑADIÓ -- None si
    no hay nada nuevo (una restricción de acceso no genera aviso, solo una concesión)."""
    if old_allowed is None:
        return None  # ya tenía acceso completo, no se le puede dar más
    if new_allowed is None:
        return "Ahora tienes acceso a todo el contenido."
    new_items = [k for k in new_allowed if k not in old_allowed]
    if not new_items:
        return None
    return f"Ahora tienes acceso a {len(new_items)} contenido(s) nuevo(s)."


class AdminService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.progress_repo = ProgressRepository()
        self.message_repo = MessageRepository()
        self.email_service = EmailService()
        self.notification_service = NotificationService()

    def _authorize_own_student(self, acting_user: dict, target_user: dict) -> None:
        """admin: sin restricción sobre nadie. profesor: solo sobre SUS alumnos marcados
        'propio' (ver student_type en models/user.py) -- un alumno 'centro' del mismo profesor,
        o de otro profesor, sigue siendo solo-admin. Cualquier otro rol, 403."""
        if acting_user["role"] == "admin":
            return
        if (
            acting_user["role"] == "profesor"
            and target_user.get("role") == "student"
            and target_user.get("assigned_profesor_id") == acting_user["id"]
            and target_user.get("student_type") == "propio"
        ):
            return
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")

    async def _record_system_message(self, user_id: str, text: str) -> None:
        """Cada correo automático (bienvenida, restablecer contraseña, aviso de migración...)
        deja también constancia en Mensajes -- así queda un histórico dentro de la propia app,
        no solo en la bandeja de email real, y el propio hilo ya sirve para responder. Firmado
        como el admin real (hay solo uno en la práctica) porque es quien manda estos correos."""
        admin = next((u for u in await self.user_repo.list_all() if u.get("role") == "admin"), None)
        if not admin:
            return
        await self.message_repo.create(MessageInDB(student_id=user_id, sender_id=admin["id"], text=text))

    async def list_students(self, viewer_staff_id: str = None):
        from services.progress_service import ProgressService
        students = await self.user_repo.list_all()
        progress_service = ProgressService()
        for s in students:
            if s.get("role") != "student":
                continue
            progress = await self.progress_repo.get_by_user(s["id"])
            if viewer_staff_id:
                s["has_novedades"] = _has_novedades(s, progress, viewer_staff_id)
            s["progress_summary"] = await progress_service.get_summary(s["id"])
        return students

    async def mark_reviewed(self, student_id: str, staff_id: str, is_admin: bool = False) -> None:
        user = await self.user_repo.get_by_id(student_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not is_admin and user.get("assigned_profesor_id") != staff_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        await self.user_repo.mark_reviewed_by(student_id, staff_id, datetime.now(timezone.utc))

    async def create_student(self, user_data: UserCreate) -> UserInDB:
        """Alta directa: la cuenta se crea con una contraseña inicial aleatoria e inutilizable
        -- el admin genera y comparte un enlace de restablecimiento (mismo botón que para
        cualquier otro usuario) para que la persona fije su propia contraseña."""
        if await self.user_repo.email_exists(user_data.email):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

        placeholder_hash = hash_password(secrets.token_urlsafe(24))
        user = await self.user_repo.create_with_password(user_data, placeholder_hash)
        await self._send_reset_link(user.id, user.email, user.display_name, is_new_account=True)
        return user

    async def send_password_reset(self, user_id: str, acting_user: dict) -> str:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        self._authorize_own_student(acting_user, user)
        return await self._send_reset_link(user["id"], user["email"], user.get("display_name"), is_new_account=False)

    async def _send_reset_link(self, user_id: str, email: str, display_name: str, is_new_account: bool) -> str:
        """Genera un enlace de restablecimiento de un solo uso (24h) y lo manda por email --
        nunca se ve/gestiona una contraseña en claro, ni siquiera el admin la ve. El link
        también se devuelve para que el admin lo pueda copiar a mano como respaldo."""
        token, token_hash = generate_reset_token()
        await self.user_repo.set_reset_token(user_id, token_hash, reset_token_expiry())
        link = f"{settings.frontend_base_url}/reset-password?token={token}"
        if is_new_account:
            self.email_service.send_welcome_email(email, display_name or email, link)
            message_text = f"Te hemos creado una cuenta en ADOC. Antes de entrar, fija tu contraseña aquí: {link}"
        else:
            self.email_service.send_password_reset_email(email, display_name or email, link)
            message_text = f"Te hemos enviado un enlace para restablecer tu contraseña: {link}"
        await self._record_system_message(user_id, message_text)
        return link

    async def update_student(self, user_id: str, update: UserUpdate, acting_user: dict) -> dict:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        self._authorize_own_student(acting_user, user)

        if acting_user["role"] == "profesor":
            extra_fields = update.model_fields_set - PROFESOR_EDITABLE_FIELDS
            if extra_fields:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"Un profesor no puede cambiar: {', '.join(sorted(extra_fields))}",
                )
        elif "role" in update.model_fields_set and user_id == acting_user["id"]:
            # Un admin no puede quitarse su propio rol de admin desde este control -- evitaría
            # quedarse fuera del panel por accidente (sí puede cambiar el rol de CUALQUIER otro).
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes cambiar tu propio rol")

        updated = await self.user_repo.update_fields(user_id, update)

        if "linked_user_id" in update.model_fields_set:
            # El vínculo entre las dos cuentas de una misma persona real es recíproco -- fijarlo
            # en un solo lado (o quitarlo) lo refleja también en el otro, así el cambio rápido de
            # cuenta (POST /api/auth/switch) funciona en los dos sentidos sin doble edición manual.
            old_linked_id = user.get("linked_user_id")
            new_linked_id = update.linked_user_id
            if old_linked_id and old_linked_id != new_linked_id:
                await self.user_repo.update_fields(old_linked_id, UserUpdate(linked_user_id=None))
            if new_linked_id:
                await self.user_repo.update_fields(new_linked_id, UserUpdate(linked_user_id=user_id))

        if "allowed_content" in update.model_fields_set:
            new_access_msg = _describe_new_access(user.get("allowed_content"), update.allowed_content)
            if new_access_msg:
                await self.notification_service.notify(
                    user_id, "content_access", "Nuevo contenido disponible", new_access_msg, "/cuadernos",
                )

        return updated

    async def set_revoked(self, user_id: str, revoked: bool, acting_user: dict) -> dict:
        """Revocar nunca borra la cuenta ni el doc de roster -- si se borrara, el email
        quedaría huérfano en "ya en uso" sin ningún documento que lo gestione."""
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        self._authorize_own_student(acting_user, user)
        return await self.user_repo.set_revoked(user_id, revoked)

    async def send_migration_announcement(self, trial_days: int = 3) -> int:
        """Avisa a todos los alumnos activos de la migración: da acceso completo temporal
        (temp_full_access_until, no toca allowed_content) durante trial_days y manda un correo
        con ese aviso más su enlace de un solo uso para fijar/confirmar contraseña. Devuelve
        cuántos alumnos recibieron el correo."""
        students = [
            u for u in await self.user_repo.list_all()
            if u.get("role") == "student" and not u.get("revoked")
        ]
        until = datetime.now(timezone.utc) + timedelta(days=trial_days)
        sent = 0
        for student in students:
            if not student.get("email"):
                continue
            await self.user_repo.update_fields(student["id"], UserUpdate(temp_full_access_until=until))
            token, token_hash = generate_reset_token()
            await self.user_repo.set_reset_token(student["id"], token_hash, reset_token_expiry())
            link = f"{settings.frontend_base_url}/reset-password?token={token}"
            self.email_service.send_migration_announcement(
                to_email=student["email"],
                to_name=student.get("display_name") or student["email"],
                reset_link=link,
                trial_days=trial_days,
            )
            await self._record_system_message(student["id"], (
                f"Hemos migrado ADOC a una plataforma nueva. Tienes acceso a todo el material "
                f"durante los próximos {trial_days} días, y entre las mejores puntuaciones de "
                f"este periodo cederemos el acceso completo definitivo. Confirma tu contraseña "
                f"aquí: {link}"
            ))
            sent += 1
        return sent

    async def send_content_update_announcement(self) -> int:
        """Novedad de temario julio 2026 (IMV Ley 1/2026 en Tema 12, convenio especial de
        cotización por prácticas en Tema 4): marca ambos content_units como NEW y avisa a todos
        los alumnos y profesores activos, por email y por notificación in-app. Devuelve cuántos
        recibieron el aviso."""
        from repositories.content_unit_repository import ContentUnitRepository
        from repositories.theme_repository import ThemeRepository

        theme_repo = ThemeRepository()
        unit_repo = ContentUnitRepository()
        for code in ("SPECIFIC_4", "SPECIFIC_12"):
            theme = await theme_repo.get_by_code(code)
            if theme:
                await unit_repo.set_is_new("tesp", theme["id"], True)

        recipients = [
            u for u in await self.user_repo.list_all()
            if u.get("role") in ("student", "profesor") and not u.get("revoked")
        ]
        app_link = settings.frontend_base_url
        title = "Temario actualizado"
        message = (
            "Tema 12 (IMV): reforma de la Ley 1/2026. Tema 4 (Cotización): nuevo convenio "
            "especial para recuperar cotización por prácticas anteriores a 2024."
        )
        sent = 0
        for recipient in recipients:
            await self.notification_service.notify(
                recipient["id"], "content_update", title, message, "/cuadernos",
            )
            if recipient.get("email"):
                self.email_service.send_content_update_email(
                    to_email=recipient["email"],
                    to_name=recipient.get("display_name") or recipient["email"],
                    app_link=app_link,
                )
                await self._record_system_message(
                    recipient["id"],
                    f"{title}: {message} Entra en {app_link} para verlo.",
                )
            sent += 1
        return sent
