from config.database import get_database
from models.content_unit import ContentUnitInDB, ContentUnitCreate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class ContentUnitRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.content_units

    async def create(self, data: ContentUnitCreate) -> ContentUnitInDB:
        unit = ContentUnitInDB(**data.model_dump())
        await self.collection.insert_one(unit.model_dump())
        return unit

    async def bulk_create(self, units: List[ContentUnitInDB]):
        if units:
            await self.collection.insert_many([u.model_dump() for u in units])
            logger.info(f"Bulk created {len(units)} content units")

    async def get_by_area(self, area_id: str) -> List[dict]:
        return await self.collection.find({"area_id": area_id}, {"_id": 0}).sort("order", 1).to_list(length=None)

    async def get_one(self, area_id: str, theme_id: str) -> Optional[dict]:
        return await self.collection.find_one({"area_id": area_id, "theme_id": theme_id}, {"_id": 0})
