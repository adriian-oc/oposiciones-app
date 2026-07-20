from fastapi import HTTPException, status

from models.access_request import AccessRequestCreate, AccessRequestInDB
from models.user import UserCreate, Profile
from repositories.access_request_repository import AccessRequestRepository
from repositories.user_repository import UserRepository
from services.admin_service import AdminService
from services.notification_service import NotificationService


class AccessRequestService:
    def __init__(self):
        self.repo = AccessRequestRepository()
        self.user_repo = UserRepository()
        self.admin_service = AdminService()
        self.notification_service = NotificationService()

    async def create_request(self, data: AccessRequestCreate) -> dict:
        request = AccessRequestInDB(**data.model_dump())
        created = await self.repo.create(request)
        tipo_label = "profesor" if created.tipo == "profesor" else "alumno"
        await self.notification_service.notify_admins(
            "access_request_pending",
            "Nueva solicitud de acceso",
            f"{created.nombre} ha solicitado acceso como {tipo_label}.",
            "/admin",
        )
        return created.model_dump()

    async def list_requests(self) -> list:
        return await self.repo.get_all()

    async def update_status(self, request_id: str, new_status: str) -> dict:
        existing = await self.repo.get_by_id(request_id)
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Access request not found")
        return await self.repo.update_status(request_id, new_status)

    async def convert(self, request_id: str, display_name: str) -> dict:
        """Crea la cuenta a partir de una solicitud y la marca como convertida -- idempotente:
        si la cuenta ya existe (p.ej. un intento anterior creó el usuario pero se cortó antes de
        marcar la solicitud como convertida, dejándola en 'pending' para siempre), no vuelve a
        intentar crearla y solo termina de marcarla, en vez de fallar con "Email already
        registered" y bloquear al admin para siempre en esa solicitud."""
        request = await self.repo.get_by_id(request_id)
        if not request:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Access request not found")
        if not await self.user_repo.email_exists(request["email"]):
            is_profesor = request.get("tipo") == "profesor"
            profile = None if is_profesor else Profile(
                full_name=display_name,
                birth_date=request.get("nacimiento"),
                prep_time=request.get("tiempo_prep"),
                prep_with=request.get("con_quien"),
                weak_points=request.get("puntos_debiles"),
            )
            await self.admin_service.create_student(UserCreate(
                email=request["email"],
                display_name=display_name,
                role="profesor" if is_profesor else "student",
                profile=profile,
            ))
        return await self.repo.update_status(request_id, "converted")
