from fastapi import APIRouter, Depends, HTTPException, status

from services.profesor_service import ProfesorService
from middleware.auth import require_role, get_current_user

router = APIRouter(prefix="/api/profesor", tags=["profesor"])


def get_profesor_service():
    return ProfesorService()


@router.get("/students")
async def list_my_students(current_user: dict = Depends(require_role(["profesor"]))):
    """Alumnos asignados a este profesor -- vista de solo lectura, ver ProfesorService."""
    return await get_profesor_service().list_my_students(current_user["id"])


@router.get("/students/{student_id}/progress")
async def get_student_progress(
    student_id: str,
    current_user: dict = Depends(get_current_user),
):
    """admin ve cualquier alumno; profesor solo los suyos (comprobado dentro del service)."""
    service = get_profesor_service()
    is_admin = current_user["role"] == "admin"
    if current_user["role"] not in ("admin", "profesor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
    return await service.get_student_progress(student_id, current_user["id"], is_admin=is_admin)
