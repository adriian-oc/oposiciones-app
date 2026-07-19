from config.database import get_database
from models.note import NoteInDB
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class NoteRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.notes

    async def get_by_user(self, user_id: str) -> List[dict]:
        return await self.collection.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(length=None)

    async def get_one(self, user_id: str, content_unit_key: str, case_index: int) -> Optional[dict]:
        return await self.collection.find_one(
            {"user_id": user_id, "content_unit_key": content_unit_key, "case_index": case_index},
            {"_id": 0},
        )

    async def upsert(self, user_id: str, content_unit_key: str, case_index: int, text: str, label: Optional[str]) -> Optional[dict]:
        """Guardar con text vacío borra la nota, en vez de dejar un documento vacío."""
        query = {"user_id": user_id, "content_unit_key": content_unit_key, "case_index": case_index}
        if not text.strip():
            await self.collection.delete_one(query)
            return None
        existing = await self.collection.find_one(query, {"_id": 0})
        if existing:
            await self.collection.update_one(query, {"$set": {"text": text, "label": label, "updated_at": datetime.utcnow()}})
        else:
            note = NoteInDB(user_id=user_id, content_unit_key=content_unit_key, case_index=case_index, text=text, label=label)
            await self.collection.insert_one(note.model_dump())
        return await self.get_one(user_id, content_unit_key, case_index)
