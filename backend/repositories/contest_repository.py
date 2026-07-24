from config.database import get_database
from models.contest import ContestConfig, ContestEntryInDB
from typing import List, Optional


class ContestRepository:
    def __init__(self):
        self.db = get_database()
        self.config_collection = self.db.contest_config
        self.entries_collection = self.db.contest_entries

    async def get_config(self) -> Optional[dict]:
        return await self.config_collection.find_one({"id": "contest_config"}, {"_id": 0})

    async def save_config(self, config: ContestConfig) -> ContestConfig:
        await self.config_collection.update_one(
            {"id": "contest_config"}, {"$set": config.model_dump()}, upsert=True
        )
        return config

    async def count_entries(self) -> int:
        return await self.entries_collection.count_documents({})

    async def create_entry(self, entry: ContestEntryInDB) -> ContestEntryInDB:
        await self.entries_collection.insert_one(entry.model_dump())
        return entry

    async def get_entry_by_email(self, email: str) -> Optional[dict]:
        return await self.entries_collection.find_one({"email": email}, {"_id": 0})

    async def get_entry_by_user_id(self, user_id: str) -> Optional[dict]:
        return await self.entries_collection.find_one({"user_id": user_id}, {"_id": 0})

    async def get_all_entries(self) -> List[dict]:
        return await self.entries_collection.find({}, {"_id": 0}).sort("joined_at", 1).to_list(length=None)
