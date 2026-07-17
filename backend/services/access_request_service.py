from fastapi import HTTPException, status

from models.access_request import AccessRequestCreate, AccessRequestInDB
from repositories.access_request_repository import AccessRequestRepository


class AccessRequestService:
    def __init__(self):
        self.repo = AccessRequestRepository()

    def create_request(self, data: AccessRequestCreate) -> dict:
        request = AccessRequestInDB(**data.model_dump())
        created = self.repo.create(request)
        return created.model_dump()

    def list_requests(self) -> list:
        return self.repo.get_all()

    def update_status(self, request_id: str, new_status: str) -> dict:
        existing = self.repo.get_by_id(request_id)
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Access request not found")
        return self.repo.update_status(request_id, new_status)
