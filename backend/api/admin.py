from fastapi import APIRouter, Depends, status
from typing import List

from models.user import UserCreate, UserResponse, UserUpdate
from services.admin_service import AdminService
from middleware.auth import require_role

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
    current_user: dict = Depends(require_role(["admin"])),
):
    link = await get_admin_service().send_password_reset(user_id)
    return {"reset_link": link}


@router.patch("/students/{user_id}", response_model=UserResponse)
async def update_student(
    user_id: str,
    update: UserUpdate,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Edición de campos de roster: allowed_content, assigned_profesor_id, payment_type, profile, role..."""
    return await get_admin_service().update_student(user_id, update)


@router.post("/students/{user_id}/revoke", response_model=UserResponse)
async def revoke_student(
    user_id: str,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Nunca borra la cuenta -- ver AdminService.set_revoked."""
    return await get_admin_service().set_revoked(user_id, True)


@router.post("/students/{user_id}/reactivate", response_model=UserResponse)
async def reactivate_student(
    user_id: str,
    current_user: dict = Depends(require_role(["admin"])),
):
    return await get_admin_service().set_revoked(user_id, False)


@router.post("/students/{user_id}/mark-reviewed")
async def mark_reviewed(
    user_id: str,
    current_user: dict = Depends(require_role(["admin", "profesor"])),
):
    """Limpia el badge de novedades para ESTE miembro del staff (last_reviewed_by[staff_id]),
    sin afectar al badge de otros profesores/admins que también vean al mismo alumno."""
    await get_admin_service().mark_reviewed(user_id, current_user["id"], is_admin=current_user["role"] == "admin")
    return {"message": "ok"}


@router.post("/students/migration-announcement")
async def send_migration_announcement(current_user: dict = Depends(require_role(["admin"]))):
    """Aviso puntual de migración: da 3 días de acceso completo temporal a todos los alumnos
    activos y les manda el correo con ese aviso + su enlace para fijar contraseña."""
    sent = await get_admin_service().send_migration_announcement()
    return {"sent": sent}
