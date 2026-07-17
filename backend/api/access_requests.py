from fastapi import APIRouter, Depends, Request, status
from typing import List

from models.access_request import AccessRequestCreate, AccessRequestResponse, AccessRequestStatusUpdate
from services.access_request_service import AccessRequestService
from middleware.auth import require_role
from utils.rate_limit import limiter

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


def get_service():
    return AccessRequestService()


@router.post("/", response_model=AccessRequestResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_access_request(request: Request, data: AccessRequestCreate):
    """Formulario público de solicitud de acceso -- sin autenticación, igual que en ADOC
    (accessRequests/{id}: cualquiera puede crear, solo el admin lee/gestiona). Limitado por IP
    para que no se pueda hacer spam de solicitudes al no requerir login."""
    return await get_service().create_request(data)


@router.get("/", response_model=List[AccessRequestResponse])
async def list_access_requests(current_user: dict = Depends(require_role(["admin"]))):
    return await get_service().list_requests()


@router.patch("/{request_id}", response_model=AccessRequestResponse)
async def update_access_request(
    request_id: str,
    update: AccessRequestStatusUpdate,
    current_user: dict = Depends(require_role(["admin"])),
):
    return await get_service().update_status(request_id, update.status)
