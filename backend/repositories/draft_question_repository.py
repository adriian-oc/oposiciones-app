from config.database import get_database
from models.draft_question import DraftQuestionInDB, DraftQuestionCreate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class DraftQuestionRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.draft_questions

    async def create(self, data: DraftQuestionCreate, created_by: Optional[str]) -> DraftQuestionInDB:
        draft = DraftQuestionInDB(**data.model_dump(), created_by=created_by)
        await self.collection.insert_one(draft.model_dump())
        return draft

    async def bulk_create(self, drafts: List[DraftQuestionInDB]) -> None:
        if drafts:
            await self.collection.insert_many([d.model_dump() for d in drafts])
            logger.info(f"Bulk created {len(drafts)} draft questions")

    async def list_drafts(self, theme_id: Optional[str] = None, status: str = "draft") -> List[dict]:
        query = {"status": status}
        if theme_id:
            query["theme_id"] = theme_id
        return await self.collection.find(query, {"_id": 0}).sort("created_at", 1).to_list(length=None)

    async def get_by_id(self, draft_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": draft_id}, {"_id": 0})

    async def get_many_by_ids(self, draft_ids: List[str]) -> List[dict]:
        return await self.collection.find({"id": {"$in": draft_ids}}, {"_id": 0}).to_list(length=None)

    async def update(self, draft_id: str, fields: dict) -> Optional[dict]:
        await self.collection.update_one({"id": draft_id}, {"$set": fields})
        return await self.get_by_id(draft_id)

    async def delete(self, draft_id: str) -> bool:
        result = await self.collection.delete_one({"id": draft_id})
        return result.deleted_count > 0

    async def mark_published(self, draft_ids: List[str]) -> None:
        await self.collection.update_many({"id": {"$in": draft_ids}}, {"$set": {"status": "published"}})
