import logging

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel, EmailStr
from typing import List

import requests

from config.settings import settings
from models.user import UserCreate, UserResponse, UserUpdate
from services.admin_service import AdminService
from services.avatar_service import AvatarService
from services.email_service import EmailService
from middleware.auth import require_role


class RecruitmentEmailRequest(BaseModel):
    email: EmailStr

logger = logging.getLogger(__name__)

EVENT_LABELS = {
    "sent": "Enviado",
    "delivered": "Entregado",
    "opened": "Abierto",
    "clicks": "Clicado",
    "blocked": "Bloqueado",
    "hardBounces": "Rebote duro",
    "softBounces": "Rebote suave",
    "spam": "Spam",
    "invalid": "Inválido",
    "deferred": "Diferido",
    "unsubscribed": "Baja",
    "error": "Error",
}

router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_admin_service():
    return AdminService()


@router.get("/students", response_model=List[UserResponse])
async def list_students(current_user: dict = Depends(require_role(["admin", "profesor"]))):
    """Listado del roster completo. profesor lo ve para poder buscar, pero la vista de
    'mis alumnos' con progreso real se restringe por assigned_profesor_id en la Fase 5."""
    return await get_admin_service().list_students(viewer_staff_id=current_user["id"])


@router.post("/students", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    user_data: UserCreate,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Alta de alumno o staff: crea el roster en Mongo."""
    return await get_admin_service().create_student(user_data)


@router.post("/students/{user_id}/send-password-reset")
async def send_password_reset(
    user_id: str,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    """admin: cualquier usuario. profesor: solo sus alumnos propios (ver AdminService._authorize_own_student)."""
    link = await get_admin_service().send_password_reset(user_id, current_user)
    return {"reset_link": link}


@router.patch("/students/{user_id}", response_model=UserResponse)
async def update_student(
    user_id: str,
    update: UserUpdate,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    """Edición de campos de roster: allowed_content, assigned_profesor_id, payment_type, profile,
    role... admin sin restricción; profesor solo sobre sus alumnos propios y un subconjunto de
    campos (ver AdminService.PROFESOR_EDITABLE_FIELDS)."""
    return await get_admin_service().update_student(user_id, update, current_user)


@router.post("/students/{user_id}/revoke", response_model=UserResponse)
async def revoke_student(
    user_id: str,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    """Nunca borra la cuenta -- ver AdminService.set_revoked. admin: cualquiera; profesor: solo propios."""
    return await get_admin_service().set_revoked(user_id, True, current_user)


@router.post("/students/{user_id}/reactivate", response_model=UserResponse)
async def reactivate_student(
    user_id: str,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    return await get_admin_service().set_revoked(user_id, False, current_user)


@router.post("/students/{user_id}/mark-reviewed")
async def mark_reviewed(
    user_id: str,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    """Limpia el badge de novedades para ESTE miembro del staff (last_reviewed_by[staff_id]),
    sin afectar al badge de otros profesores/admins que también vean al mismo alumno."""
    await get_admin_service().mark_reviewed(user_id, current_user["id"], is_admin=current_user["role"] == "admin")
    return {"message": "ok"}


@router.post("/students/{user_id}/avatar", response_model=UserResponse)
async def upload_student_avatar(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["admin"])),
):
    """Admin cambia la foto de perfil de cualquier usuario del roster."""
    updated = await AvatarService().upload(user_id, file)
    return UserResponse(**updated)


@router.get("/email-activity")
async def get_email_activity(current_user: dict = Depends(require_role(["admin"]))):
    """Actividad reciente de envíos de Brevo (misma vista que Transaccional > Tiempo real en el
    panel de Brevo), traída al propio Admin -- ver EmailService.get_recent_activity."""
    try:
        events = EmailService().get_recent_activity()
    except requests.exceptions.RequestException as e:
        logger.error(f"Fallo al consultar actividad de email en Brevo: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudo consultar la actividad de email")

    return [
        {
            "event": e.get("event"),
            "event_label": EVENT_LABELS.get(e.get("event"), e.get("event")),
            "date": e.get("date"),
            "subject": e.get("subject"),
            "from": e.get("from"),
            "to": e.get("email"),
        }
        for e in events
    ]


def _pct(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100, 2) if denominator else 0.0


@router.get("/email-stats")
async def get_email_stats(
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(require_role(["admin"])),
):
    """Resumen agregado (misma vista que Estadísticas > Transaccional del panel de Brevo) para
    los últimos `days` días -- ver EmailService.get_aggregated_stats. Los porcentajes se calculan
    aquí en el backend para que el frontend solo tenga que pintarlos."""
    try:
        raw = EmailService().get_aggregated_stats(days)
    except requests.exceptions.RequestException as e:
        logger.error(f"Fallo al consultar estadísticas de email en Brevo: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudieron consultar las estadísticas de email")

    if raw is None:
        return None

    sent = raw.get("requests", 0)
    delivered = raw.get("delivered", 0)
    hard_bounces = raw.get("hardBounces", 0)
    soft_bounces = raw.get("softBounces", 0)
    return {
        "sent": sent,
        "delivered_pct": _pct(delivered, sent),
        "opens_pct": _pct(raw.get("uniqueOpens", 0), delivered),
        "trackable_pct": _pct(sent - raw.get("invalid", 0), sent),
        "unique_clicks_pct": _pct(raw.get("uniqueClicks", 0), delivered),
        "bounced_pct": _pct(hard_bounces + soft_bounces, sent),
        "complaint_pct": _pct(raw.get("spamReports", 0), sent),
        "hard_bounce_pct": _pct(hard_bounces, sent),
        "soft_bounce_pct": _pct(soft_bounces, sent),
        "blocked_pct": _pct(raw.get("blocked", 0), sent),
    }


@router.post("/send-recruitment-email")
async def send_recruitment_email(
    data: RecruitmentEmailRequest,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Correo de captación a un email suelto que todavía no tiene cuenta (p.ej. alguien que
    preguntó por WhatsApp o en persona) -- ver EmailService.send_recruitment_email. No crea
    ningún registro en Mongo, solo manda el correo con el enlace a /solicitar-acceso."""
    signup_link = f"{settings.frontend_base_url}/solicitar-acceso"
    EmailService().send_recruitment_email(data.email, signup_link)
    return {"message": "ok"}


@router.post("/students/migration-announcement")
async def send_migration_announcement(current_user: dict = Depends(require_role(["admin"]))):
    """Aviso puntual de migración: da 3 días de acceso completo temporal a todos los alumnos
    activos y les manda el correo con ese aviso + su enlace para fijar contraseña."""
    sent = await get_admin_service().send_migration_announcement()
    return {"sent": sent}


@router.post("/content-updates/temario-novedad-2026")
async def send_content_update_announcement(current_user: dict = Depends(require_role(["admin"]))):
    """Aviso puntual de la novedad de temario de julio 2026 (IMV Ley 1/2026 en Tema 12,
    convenio especial de cotización por prácticas en Tema 4): marca ambos temas como NEW y
    avisa a todos los alumnos y profesores activos, por email y por notificación in-app."""
    sent = await get_admin_service().send_content_update_announcement()
    return {"sent": sent}
