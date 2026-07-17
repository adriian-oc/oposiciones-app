from config.database import get_database
from models.study_calendar import StudyPreferencesInDB, StudyCalendarEntryInDB
from typing import List, Optional


class StudyCalendarRepository:
    def __init__(self):
        self.db = get_database()
        self.prefs_collection = self.db.study_preferences
        self.entries_collection = self.db.study_calendar

    async def get_preferences(self, user_id: str) -> Optional[dict]:
        return await self.prefs_collection.find_one({"user_id": user_id}, {"_id": 0})

    async def upsert_preferences(self, prefs: StudyPreferencesInDB) -> None:
        await self.prefs_collection.update_one(
            {"user_id": prefs.user_id}, {"$set": prefs.model_dump()}, upsert=True
        )

    async def replace_future_pending_entries(
        self, user_id: str, from_date: str, entries: List[StudyCalendarEntryInDB]
    ) -> None:
        """Sustituye las entradas PENDIENTES desde `from_date` en adelante -- las ya marcadas
        'done' se conservan como historial real de lo que el alumno completó."""
        await self.entries_collection.delete_many({
            "user_id": user_id, "date": {"$gte": from_date}, "status": "pending",
        })
        if entries:
            await self.entries_collection.insert_many([e.model_dump() for e in entries])

    async def get_entries(self, user_id: str, start_date: str, end_date: str) -> List[dict]:
        return await (
            self.entries_collection.find(
                {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_date}},
                {"_id": 0},
            ).sort("date", 1).to_list(length=None)
        )

    async def get_entry(self, entry_id: str, user_id: str) -> Optional[dict]:
        return await self.entries_collection.find_one(
            {"id": entry_id, "user_id": user_id}, {"_id": 0}
        )

    async def set_entry_status(self, entry_id: str, user_id: str, status: str) -> None:
        await self.entries_collection.update_one(
            {"id": entry_id, "user_id": user_id}, {"$set": {"status": status}}
        )
