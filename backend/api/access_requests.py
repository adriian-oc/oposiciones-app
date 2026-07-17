from fastapi import APIRouter, Depends, status
from typing import List

from models.access_request import AccessRequestCreate, AccessRequestResponse, AccessRequestStatusUpdate
from services.access_request_service import AccessRequestService
from middleware.auth import require_role

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


def get_service():
    return AccessRequestService()


@router.post("/", response_model=AccessRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_access_request(data: AccessRequestCreate):
    """Formulario público de solicitud de acceso -- sin autenticación, igual que en ADOC
    (accessRequests/{id}: cualquiera puede crear, solo el admin lee/gestiona)."""
    return get_service().create_request(data)


@router.get("/", response_model=List[AccessRequestResponse])
async def list_access_requests(current_user: dict = Depends(require_role(["admin"]))):
    return get_service().list_requests()


@router.patch("/{request_id}", response_model=AccessRequestResponse)
async def update_access_request(
    request_id: str,
    update: AccessRequestStatusUpdate,
    current_user: dict = Depends(require_role(["admin"])),
):
    return get_service().update_status(request_id, update.status)
