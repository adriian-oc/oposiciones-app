from fastapi import HTTPException, status

from repositories.user_repository import UserRepository


async def check_can_view_student(user_id: str, current_user: dict) -> None:
    """admin ve a cualquier alumno; profesor solo a sus alumnos asignados; nadie más.
    Reutilizado por Mi Progreso, el calendario de estudio y el panel de Refuerzo, así que
    cambiar la regla aquí la cambia en los tres sitios a la vez."""
    if current_user["role"] == "admin":
        return
    if current_user["role"] == "profesor":
        target = await UserRepository().get_by_id(user_id)
        if target and target.get("assigned_profesor_id") == current_user["id"]:
            return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view this student's data")
