from config.database import get_database
from typing import Optional

class ProgressRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.progress

    async def get_by_user(self, user_id: str) -> Optional[dict]:
        return await self.collection.find_one({"user_id": user_id}, {"_id": 0})

    async def upsert(self, user_id: str, doc: dict) -> None:
        await self.collection.update_one({"user_id": user_id}, {"$set": doc}, upsert=True)
