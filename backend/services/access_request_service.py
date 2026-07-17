from fastapi import HTTPException, status

from models.access_request import AccessRequestCreate, AccessRequestInDB
from repositories.access_request_repository import AccessRequestRepository


class AccessRequestService:
    def __init__(self):
        self.repo = AccessRequestRepository()

    async def create_request(self, data: AccessRequestCreate) -> dict:
        request = AccessRequestInDB(**data.model_dump())
        created = await self.repo.create(request)
        return created.model_dump()

    async def list_requests(self) -> list:
        return await self.repo.get_all()

    async def update_status(self, request_id: str, new_status: str) -> dict:
        existing = await self.repo.get_by_id(request_id)
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Access request not found")
        return await self.repo.update_status(request_id, new_status)
