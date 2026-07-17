from config.database import get_database
from models.message import MessageInDB
from typing import List

class MessageRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.messages

    async def create(self, message: MessageInDB) -> MessageInDB:
        await self.collection.insert_one(message.model_dump())
        return message

    async def get_thread(self, student_id: str) -> List[dict]:
        return await (
            self.collection.find({"student_id": student_id}, {"_id": 0})
            .sort("created_at", 1)
            .to_list(length=None)
        )
