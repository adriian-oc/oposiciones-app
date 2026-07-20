from datetime import datetime

from config.database import get_database
from models.message import MessageInDB, MessageReadInDB
from typing import List, Optional

class MessageRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.messages
        self.reads_collection = self.db.message_reads

    async def create(self, message: MessageInDB) -> MessageInDB:
        await self.collection.insert_one(message.model_dump())
        return message

    async def get_thread(self, student_id: str) -> List[dict]:
        return await (
            self.collection.find({"student_id": student_id}, {"_id": 0})
            .sort("created_at", 1)
            .to_list(length=None)
        )

    async def get_last_message(self, student_id: str) -> Optional[dict]:
        results = await (
            self.collection.find({"student_id": student_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(1)
            .to_list(length=1)
        )
        return results[0] if results else None

    async def get_read(self, user_id: str, student_id: str) -> Optional[dict]:
        return await self.reads_collection.find_one(
            {"user_id": user_id, "student_id": student_id}, {"_id": 0}
        )

    async def delete_thread(self, student_id: str) -> None:
        await self.collection.delete_many({"student_id": student_id})
        await self.reads_collection.delete_many({"student_id": student_id})

    async def mark_read(self, user_id: str, student_id: str, when: datetime) -> None:
        await self.reads_collection.update_one(
            {"user_id": user_id, "student_id": student_id},
            {"$set": MessageReadInDB(user_id=user_id, student_id=student_id, last_read_at=when).model_dump()},
            upsert=True,
        )
