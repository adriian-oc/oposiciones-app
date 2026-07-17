from config.database import get_database
from models.access_request import AccessRequestInDB
from typing import List, Optional

class AccessRequestRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.access_requests

    async def create(self, request: AccessRequestInDB) -> AccessRequestInDB:
        await self.collection.insert_one(request.model_dump())
        return request

    async def get_all(self) -> List[dict]:
        return await self.collection.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=None)

    async def get_by_id(self, request_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": request_id}, {"_id": 0})

    async def update_status(self, request_id: str, status: str) -> Optional[dict]:
        await self.collection.update_one({"id": request_id}, {"$set": {"status": status}})
        return await self.get_by_id(request_id)
