from repositories.note_repository import NoteRepository
from typing import List, Optional

class NoteService:
    def __init__(self):
        self.repo = NoteRepository()

    async def get_by_user(self, user_id: str) -> List[dict]:
        return await self.repo.get_by_user(user_id)

    async def get_one(self, user_id: str, content_unit_key: str, case_index: int) -> Optional[dict]:
        return await self.repo.get_one(user_id, content_unit_key, case_index)

    async def upsert(self, user_id: str, content_unit_key: str, case_index: int, text: str, label: Optional[str]) -> Optional[dict]:
        return await self.repo.upsert(user_id, content_unit_key, case_index, text, label)
